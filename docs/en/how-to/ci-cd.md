---
title: CI/CD — how a push becomes a running server
summary: Ainize is the CD half of a pipeline, managed for you: a git push builds the repo, gates it on required config and a health check, swaps it in without downtime, and keeps the old version serving if anything fails. Run your tests as a check in the build command or as an Ainize Run — not GitHub Actions — and roll back by redeploying a previous deployment. Scheduled and webhook jobs are Runs.
---

# CI/CD — how a push becomes a running server

**Can Ainize do server CI/CD, like Jenkins?** Yes, with a different division of labour. You do not write pipeline
stages. A git push *is* the pipeline: Ainize builds the repo, gates it, and swaps the new version in without downtime,
keeping the old one serving if anything fails. That is the **CD** half, managed. The **CI** half — running your tests
and lint as a gate — also runs on Ainize: a check inside the build command, or an **Ainize Run** that executes the
test suite. The result is the Jenkins outcome — *test, then ship, and be able to go back* — assembled from Ainize
parts instead of a server you host and script.

> **No GitHub Actions.** The CI/CD here runs entirely on Ainize — the build, the test gate (build check or an Ainize
> Run), the deploy and its triggers. GitHub stays as a place to host and review code; it does not run the pipeline.
> Work that used to live in a GitHub Actions workflow moves to an [Ainize Run](./run-scripts-on-a-schedule.md).

| Jenkins | On Ainize |
|---|---|
| A server you install, update and secure | Nothing to host; a push is the trigger |
| A `Jenkinsfile` with explicit `stages` | `ainize.json` declares the build; the stages (build → gate → health → swap) are fixed and managed |
| A build agent runs your tests | A check in the build command, or an Ainize Run (`kind: script`) that runs the suite — **not** GitHub Actions |
| A deploy step you script, with your own rollback | Health-gated zero-downtime swap; failed deploy keeps the previous version; **roll back = redeploy a past deployment** |
| `cron` / webhook triggers on jobs | [Runs](../concepts/deployments-and-runs.md) with `schedule`, `ain` and `http` triggers |

## What one push does (the managed pipeline)

A project is a git repo with [`ainize.json`](./deploy-with-ainize-json.md) at its root. Push to its branch (default
`main`) and the node runs these steps in order, recording one **deployment** (`queued → building → ready` or `error`)
with a streamed log and a URL:

1. **Clone that commit** and read `ainize.json` — the contract. Nothing about the build is set on the server; changing
   how a repo ships is a commit, not a settings change.
2. **Config gate (before any build).** `requiredSecrets`, `requiredEnv` and `build.requiredArgs` must be present and
   non-blank; a `storage` entry marked `required` must be connected to a store. A miss fails here, by name, and the
   build never starts.
3. **Build**, by `kind`: `nextjs` → `npm ci && npm run build`; `service` → your `Dockerfile`; `agent` → the hosted-agent
   image; `script` → nothing to build (it runs). This is where your tests run if your build command runs them — a
   failing build is a failed deployment.
4. **Release step**, if you declared one: `release.command` runs from the built image **before** the new version takes
   traffic — database migrations belong here. A non-zero exit fails the deployment.
5. **Health gate.** The node starts the container and polls `healthcheck` (default `/`) on `port` until it answers 200.
6. **Zero-downtime swap.** Only now does the new version take traffic; the previous one served every request until this
   moment.

**If any step fails, the previous deployment keeps serving.** You get a red deployment with the log that explains why,
and nothing a user can reach has changed. `GET /api/projects/{id}/deployments` lists them; `GET /api/deployments/{id}/log`
is the log. In AinDrive, each commit shows its deployment dot (building / ready / error) with *Inspect* and *Visit*.

## The CI half: test before you ship, without GitHub Actions

Ainize does not run a separate test stage for you, and the pipeline does not use GitHub Actions — put your gate in one
of two places, both on Ainize:

- **In the build command (the simplest gate).** Fold the checks into the build so a failing test is a failed build,
  which is a failed deployment: a `nextjs` build whose `npm run build` first runs `npm test` (or `npm run lint &&
  npm run typecheck && npm test && next build`), or a `service` whose `Dockerfile` runs the suite in a build stage and
  only a passing stage produces the runtime image. The previous version keeps serving on any failure, so a red test
  never reaches users.
- **As an Ainize Run (a test suite that can gate a deploy).** Make the tests a `kind: script` project (or a second
  `ainize.json` folder in the same repo) and run them from a [trigger](./run-scripts-on-a-schedule.md) — on a push, on
  a schedule, or by a webhook your deploy step calls first. The run records a pass/fail with its log; wire the deploy
  to follow only a green run. This is where a GitHub Actions workflow's job moves: the same commands, run by Ainize.

Because AinDrive is the deploy remote and a **push to AinDrive is the deploy**, the gate sits before that push: build
checks run as part of it, and a separate test Run is the step you require to be green first. Keeping the source on
GitHub for review is fine — GitHub just never runs the pipeline.

## Rolling back

Every push is kept as a deployment, so going back is redeploying an earlier one:

- **Roll back to a known-good version** — redeploy that past deployment, same commit:
  `POST /api/deployments/{deploymentId}/redeploy` (owner or org member; "roll back to this one" on the console).
- **Rebuild the newest commit** (after changing a secret or a connected store): `POST /api/projects/{id}/redeploy`.

A redeploy is an ordinary deployment: it goes through the same gates and the same health-checked swap, so a rollback
that cannot come up healthy never takes traffic either.

## Jobs, not servers: scheduled and triggered runs

A pipeline often has pieces that are not a server — a nightly check, a job another system kicks off. Those are a
**Run** (`kind: script`): one `ainize.json` with a `triggers` key runs the script on a `schedule` (cron + timezone),
on an `ain` write (an AIN-blockchain path, the Firestore-trigger equivalent), or by `http` (a webhook URL with a
token). The trigger event arrives in `AINIZE_TRIGGER_EVENT`. See
[Run scripts on a schedule](./run-scripts-on-a-schedule.md). This is the Cloud Scheduler / webhook-function side of a
CI/CD setup — post-deploy smoke checks, cache warmers, periodic data jobs — without a second system.

## Secrets and config

`env` in `ainize.json` is committed with the repo, so it is for non-secret build/runtime values only. Real secrets
live in the project's secret store (Settings), are injected at build and run, and are never written into `ainize.json`.
A connected managed store hands the app its `DATABASE_URL`, `S3_ENDPOINT`, … at deploy
([managed storage](./managed-storage.md)).

## In short

- **CD is native and managed**: push → gate → build → release → health check → zero-downtime swap, with the previous
  version serving until the new one is proven, and a full per-push history.
- **CI runs on Ainize, not GitHub Actions**: a check in the build command, or an Ainize Run that runs the suite; only
  a green gate ships.
- **Rollback** is redeploying a previous deployment.
- **Scheduled / webhook jobs** are Runs with `schedule`, `ain` or `http` triggers.

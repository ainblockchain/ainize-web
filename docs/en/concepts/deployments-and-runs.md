---
title: Deployments vs Runs
summary: Ainize hosts two kinds of project. A Deployment is something that stays up — a web app, an API service, an agent. A Run is a script that executes and finishes — on demand, on a schedule, when the AIN blockchain changes, or when a webhook is called. Which one your repo is, and which to pick.
---

# Deployments vs Runs

Every project on Ainize is a git repo with an `ainize.json` at its root, and every push records a deployment with a
log. But the thing being deployed is one of two very different shapes, and the website names them separately:

- A **Deployment** is a program that *stays up* and answers requests: a Next.js site, a Dockerfile service with an
  HTTP port, an A2A agent. The node builds it, waits for its health check, gives it a URL and keeps the previous
  version serving until the new one is healthy. [Deployments](/deployments) lists yours.
- A **Run** is a program that *executes and finishes*: a Python or Node script. The node runs it once in a sandbox,
  keeps its output and exit code, and runs it again whenever something asks — you, a schedule, a write on the AIN
  blockchain, or an HTTP call. [Runs](/runs) lists yours.

A repo is one or the other by its `kind` in `ainize.json`: `nextjs`, `service` and `agent` are Deployments; `script`
is a Run. The console (`/<org>/<repo>`) is the same page for both — a Run project has a **Runs** tab with its triggers
and its run history, a Deployment has a **Logs** tab with the live runtime log.

## If you know Google Cloud or Vercel

| On Ainize | The closest thing elsewhere | What it is |
|---|---|---|
| Deployment, `kind: nextjs` | Vercel project | A Next.js app built and served at a URL on every push. |
| Deployment, `kind: service` | Cloud Run service · Fly app | A Dockerfile with a port, kept running, swapped without downtime. |
| Deployment, `kind: agent` | Cloud Run service with an agent card | An A2A agent published at `/agents/<id>`, listed in the marketplace. |
| Run, on demand | Cloud Run Job (`gcloud run jobs execute`) | A script started from the Run panel with the inputs `ainize.json` declares. |
| Run, `type: schedule` | Cloud Scheduler → Cloud Run Job | The same script on a 5-field cron, in a timezone you choose. |
| Run, `type: ain` | Cloud Functions Firestore trigger (`onWrite`) | The script when a path on the AIN blockchain is written. The node gives you the `_function` REST rule to set at that path; the write becomes the event. Data that moved from Firestore to the AIN blockchain keeps its trigger functions this way. |
| Run, `type: http` | Cloud Functions HTTP trigger · a webhook | The script when its fire URL is called with its token; the request body becomes the event. |

Only one `ainize.json` is involved in each row: a Run's triggers are a `triggers` key in the same file that names the
entry, not a second service to set up. See [Run scripts on a schedule](../how-to/run-scripts-on-a-schedule.md).

## Which should I use?

Ask what happens when nobody is calling it.

- **It should still be reachable** — a page, an endpoint, an agent somebody else talks to → a Deployment. Pick
  `nextjs` for a Next.js app, `service` for anything with a Dockerfile and a port, `agent` for something that speaks
  A2A and should appear in the marketplace.
- **It should do nothing until something happens** — a check that runs every hour, a job that reacts to a post being
  written on chain, a task another system kicks off with an HTTP call, a script you run by hand with different inputs →
  a Run. One `script` project; add `triggers` for the hands-off cases.
- **It does both** — an API that also needs an hourly job → two projects, two folders in one repo if you like (each
  with its own `ainize.json`), listed side by side on the repo's page.

Things that tilt the decision:

| | Deployment | Run |
|---|---|---|
| Process lifetime | as long as the deployment is active | one execution, up to `timeoutMs` (default 2 min, max 5) |
| Network | its port is public; egress through the gateway | no inbound; egress only to Ainize (`AINIZE_URL`) |
| Parameters | environment variables set in Settings | the same, plus `inputs` per run and the trigger event in `AINIZE_TRIGGER_EVENT` |
| What a push does | builds and swaps the live version | runs the script once (with the input defaults) and installs its triggers |
| History | deployments, each with its build log | runs, each with its output, exit code and the trigger that started it |
| Cost shape | always-on container | nothing between runs |

## What both share

The repo, the push, the log, the console and the people who may touch it. A project is bound to the person who
pushed it or to an organization; organization members see it in both lists and may run, redeploy and change its
settings (`canOperate`), its owner may delete it (`canManage`). Secrets live in the project's environment
variables, never in `ainize.json`. The full key reference is in [ainize.json](../how-to/deploy-with-ainize-json.md).

---
title: Deploy a repo with ainize.json
summary: One file at the root of a git repo tells Ainize what to run on every push — a Next.js app, a plain script, a Dockerfile service, or an A2A agent — and where the result is reachable.
---

# Deploy a repo with ainize.json

A project on Ainize is a git repo plus one file: `ainize.json` at the repo root. Push, and the node reads that
file, builds what it describes, runs it in an isolated sandbox and records a **deployment** (`queued → building →
ready` or `error`) with its log and a URL. Nothing else is configured on the server side. If you have used
`vercel.json`, this is the same idea with two additions: a repo can be a **plain script** that just runs once per
push, and it can be an **agent** that is published at an A2A URL.

The repo itself lives wherever your git remote lives. The first-class case is a repo inside an
[aindrive](https://aindrive.ainetwork.ai) drive — `https://aindrive.ainetwork.ai/<org>/git/<repo>` — because the
drive and Ainize share AIN SSO, so the people who can push are the people who can deploy, and the drive's file view
shows each commit's deployment next to it.

## The file

```json
{
  "name": "clef-artwork-search",
  "kind": "script",
  "runtime": "python3.11",
  "entry": "art_search.py",
  "env": { "AINIZE_DECIDE_URL": "https://ainize.ai/api/decide" },
  "timeoutMs": 120000
}
```

| Key | Applies to | Meaning |
|---|---|---|
| `name` | all | Display name. Defaults to the repo name. |
| `kind` | all | `nextjs` (default when `package.json` depends on `next`), `script`, `service`, `agent`. |
| `runtime` | `script` | `python3.11` or `node20`. Defaults from the entry's extension. |
| `entry` | `script` | The file to run, relative to the repo root. |
| `env` | all | Environment variables for the build and the run. **Not for secrets** — the file is in the repo. |
| `inputs` | all (used by `script` runs) | Parameters a person fills in before a run — the same shape as GitHub Actions `workflow_dispatch` inputs, delivered as `INPUT_<NAME>` environment variables. See [Inputs](#inputs). |
| `timeoutMs` | `script` | Wall-clock limit for one run. Default 120 000, maximum 300 000. |
| `build.dockerfile`, `build.context` | `service` | Dockerfile to build the image from. Defaults `Dockerfile`, `.`. |
| `port` | `nextjs`, `service` | The port the container listens on. Default 3000 for Next.js. |
| `healthcheck` | `nextjs`, `service` | Path polled until it answers 200; the deployment is `ready` when it does. Default `/`. |
| `agent` | `agent` | `{ name, description, model, a2ui }` — fields of the published agent card. |

A repo with **no `ainize.json`** deploys only if it is a Next.js app (a `next` dependency in `package.json`);
anything else ends as `error: no ainize.json`. The file is the contract — nothing is guessed beyond that one default.

## What each kind does

**`nextjs`** — builds in a `node20` container (`npm ci && npm run build`), starts it (`npm start`) on `port`, and
exposes it under the node's public URL once `healthcheck` answers. The previous deployment keeps serving until the new
one is healthy, then is swapped out. This is the Vercel-shaped case.

**`script`** — the Ainize-only case. On every push the node runs `entry` once in a read-only sandbox with a 64 MiB
`/work`, 512 MB of memory, one CPU and **no network except Ainize itself** (`/api/decide`, `/api/chat`, `/v1/*`
through the node's gateway). Standard output, standard error and the exit code become the deployment log; exit 0 is
`ready`, anything else is `error`. Use it for examples, evaluations and anything that should re-run and leave a record
whenever the code changes. The sandbox image has the standard library plus `requests`; declare nothing else.

**`service`** — builds your `Dockerfile`, runs the image with the same isolation as a hosted agent (internal network,
egress only through the gateway, dropped capabilities, limits), waits for `healthcheck` on `port`, then exposes it
under the node's public URL with a zero-downtime swap.

**`agent`** — builds the repo as a [hosted agent](./host-an-agent.md) and publishes it at the node's A2A address,
`https://<node>/agents/<id>`, with an agent card assembled from `agent` in the file. Anything that speaks A2A can call
it from that URL; the marketplace lists it like any other agent. The agent runs on the node's hosted-agent runtime image (that image is the A2A contract); a
`Dockerfile` in the repo is ignored for this kind.

## Inputs

`inputs` declares what a person may set before a run, in **the same shape as GitHub Actions
`workflow_dispatch` inputs** — a name keyed to `description`, `type` (`string`, `choice`, `boolean`, `number`;
default `string`), `required`, `default`, and `options` for a `choice`:

```json
"inputs": {
  "DESC":  { "description": "작품 묘사 (description)", "type": "string", "required": true,
             "default": "해질녘 바다 위 작은 배 한 척, 주황빛 노을, 고요하고 쓸쓸한 분위기의 유화" },
  "MODEL": { "description": "모델", "type": "choice", "options": ["clef-flash", "clef"], "default": "clef-flash" }
}
```

Each input reaches the program as the environment variable **`INPUT_<NAME>`** (name upper-cased: `INPUT_DESC`,
`INPUT_MODEL`; booleans as `true`/`false`, numbers as decimal text). In aindrive the repo's Run panel shows one
field per input — text, select, checkbox or number — prefilled with `default`, remembers your last values for that
repo in the browser, and sends them with the run. A push-deploy runs with the defaults. At most 16 inputs, names
like environment variable names, values up to 2 KiB.

## From push to deployment

1. Push to the project's branch (default `main`). If the repo is in an aindrive drive, the drive binds the repo on
   its first push (see below) and calls the project's webhook as soon as `git-receive-pack` succeeds; any other host
   can call `POST /api/projects/{id}/hook` with the same signed body.
2. The node clones **that commit**, reads `ainize.json`, and queues one deployment per push, in order per project.
3. Watch it: `GET /api/projects/{id}/deployments` lists them; `GET /api/deployments/{id}/log` streams the log while it
   runs and returns it afterwards. In aindrive, the repo folder shows the same rows — a grey pulsing dot while
   building, green when ready, red on error — with *Inspect* (the log) and *Visit* (the URL) links on each commit.

## Binding happens on push

A repo inside an aindrive drive needs no binding step. The first push of a repo whose root has `ainize.json`
creates the project: aindrive, as itself, tells Ainize about the push (`POST /api/projects/auto`, with an AIN SSO
machine token), stores the project's one-time webhook secret beside the repo, and fires the hook for that very push —
so **`ainize.json` in the repo means it deploys**. The repo's folder in aindrive shows "deploys on the next push"
until then, and the deployment rows afterwards. The project belongs to the person who pushed (their AIN account), and
the drive must be shared with an AIN organization the Ainize app is assigned in.

For a repo hosted anywhere else, create the project yourself and call the hook from your host:

```bash
curl -X POST https://ainize.ai/api/projects \
  -H 'authorization: Bearer <your key>' -H 'content-type: application/json' \
  -d '{"repo":"https://aindrive.ainetwork.ai/comcom/git/clef-artwork-search","branch":"main"}'
```

The answer carries the project id and a `webhookSecret` **shown once**. The kind, entry and runtime are not part of
either path — they come from `ainize.json` at each push, so changing how a repo deploys is a commit, not a settings
change.

## A complete example

[`clef-artwork-search`](https://aindrive.ainetwork.ai/comcom/git/clef-artwork-search) is a `script` project: three
Python files that rank artworks against a description using the Clef decision model, with the `ainize.json` above and a
`Dockerfile` for running the same thing anywhere else. Every push re-runs `art_search.py` against the live model and
leaves the ranking in the deployment log.

## Limits worth knowing

- A `script` run gets at most 32 files and 2 MiB of source; `.git`, `node_modules` and binaries are not sent.
- Two runs per caller and eight per node at a time; the rest wait or get `429`.
- The sandbox reaches only Ainize. A script that fetches `https://example.com` fails — put data in the repo or behind
  an Ainize agent instead.
- `env` is committed with the repo. Keys and tokens belong in the node's secret store (see
  [hosted agents](./host-an-agent.md)), never in `ainize.json`.

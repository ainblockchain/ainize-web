---
title: Run scripts on a schedule, on a blockchain write, or by webhook
summary: Add a triggers key to a script project's ainize.json and the node runs it by itself — on a cron schedule, when a path on the AIN blockchain is written, or when its webhook URL is called. The event arrives in AINIZE_TRIGGER_EVENT.
---

# Run scripts on a schedule, on a blockchain write, or by webhook

A `kind: script` project is a [Run](../concepts/deployments-and-runs.md): the node executes its entry once per push
and whenever you press **Run**. This page adds the three ways a run starts without anyone pressing anything —
**triggers**, declared in the same `ainize.json`. Think Cloud Scheduler, a Firestore trigger and an HTTP-triggered
function, in one file next to the script.

You need a script project that has deployed at least once; a trigger is installed when a deployment of the commit
that declares it reaches `ready`. Other kinds (`nextjs`, `service`, `agent`) refuse the key with a clear message.

## The `triggers` key

```json
{
  "kind": "script",
  "entry": "check.py",
  "inputs": { "SEASON": { "type": "number", "default": 1 } },
  "triggers": {
    "hourly":   { "type": "schedule", "cron": "0 * * * *", "timezone": "Etc/UTC", "inputs": { "SEASON": 2 } },
    "on-post":  { "type": "ain", "path": "/apps/afan/posts/$post_id", "inputs": { "POST": "$event.params.post_id" } },
    "webhook":  { "type": "http" }
  }
}
```

`triggers` is an object of at most **8** entries. A name is `^[a-z0-9][a-z0-9-]{0,31}$` and is what the console, the
run history and the event call the trigger. Each entry is `{ "type", … }` and is checked strictly — an unknown key is
refused at deployment, so a typo cannot silently install nothing.

| `type` | keys | what starts the run |
|---|---|---|
| `schedule` | `cron` (5-field crontab), `timezone` (IANA, default `Etc/UTC`), optional `inputs`, optional `entry` | The clock. The node checks every 30 seconds and starts a run for each schedule whose next slot has passed. |
| `ain` | `path` (an AIN DB path pattern: `/` + segments, `$name` variables, ≤ 256 chars), optional `inputs`, optional `entry` | A write at that path on the AIN blockchain, through a `_function` REST rule you set there (below). |
| `http` | optional `inputs`, optional `entry` | A `POST` to the trigger's fire URL with its token. |

`inputs` answers the manifest's [inputs](./deploy-with-ainize-json.md#inputs) for that trigger, with the same value
rules as a run from the panel. An `ain` trigger's values may reference the event — `$event.params.<name>`,
`$event.value`, `$event.path`, `$event.timestamp`, `$event.auth.addr` — and an `http` trigger's may reference
`$event.body.<key>` and `$event.query.<key>`. `entry` runs a different file than the project's default.

## What the script receives

Every triggered run gets three environment variables beside the usual `INPUT_*`, `AINIZE_URL` and `AINIZE_API_KEY`:

| variable | value |
|---|---|
| `AINIZE_TRIGGER` | the trigger's name (`hourly`, `on-post`, `webhook`) |
| `AINIZE_TRIGGER_TYPE` | `schedule`, `ain` or `http` |
| `AINIZE_TRIGGER_EVENT` | the event as JSON, at most 64 KiB (a larger one fails the run with `event_too_large`) |

The event's shape depends on the type:

```json
{ "type": "schedule", "name": "hourly", "firedAt": 1761800400123, "scheduled": 1761800400000 }
```

```json
{
  "type": "ain", "name": "on-post",
  "path": "/apps/afan/posts/p_42", "params": { "post_id": "p_42" },
  "value": { "title": "hello" }, "prevValue": null,
  "timestamp": 1761800400000, "auth": { "addr": "0xabc…" }, "txHash": "0x…",
  "raw": { "…the body the AIN blockchain REST _function call posted…" }
}
```

```json
{
  "type": "http", "name": "webhook", "method": "POST",
  "query": { "dry": "1" }, "headers": { "content-type": "application/json" },
  "body": { "order": 17 }
}
```

Reading it is one line:

```python
import json, os
event = json.loads(os.environ.get("AINIZE_TRIGGER_EVENT", "{}"))
if event.get("type") == "ain":
    print("post", event["params"]["post_id"], "written by", event["auth"]["addr"])
```

A run started from the panel or by a push has no `AINIZE_TRIGGER*` variables at all, so the same script serves both.
**Run now** in the console sends a synthetic `{ "type": "manual" }` event.

## Schedules

`"cron": "0 9 * * 1-5"` with `"timezone": "Asia/Seoul"` runs at 09:00 Seoul time on weekdays. A schedule never queues
a second run while its previous one is still `queued` or `building` — that slot is skipped and logged. There is no
catch-up either: after the node was down, each schedule runs at most once and then moves to its next future slot.
The run is made as the active deployment's pusher, so it uses that person's `AINIZE_API_KEY`.

## Webhooks

An `http` trigger has a **fire URL**, `POST /api/projects/<id>/triggers/<name>/fire`, and a **token** issued when
the trigger is installed and shown once; **Rotate token** on the console issues a new one. Send the token as
`Authorization: Bearer <token>` (or `?token=` for callers that cannot set headers). The body (≤ 64 KiB, JSON or text)
becomes `body` in the event. The answer is `202 { "runId", "status" }`; `401` is a bad token, `409 trigger_disabled` a
switched-off trigger, `429` more than 60 calls a minute to one trigger.

```bash
curl -X POST "https://ainize.ai/api/projects/<id>/triggers/webhook/fire" \
  -H "authorization: Bearer <token>" -H "content-type: application/json" \
  -d '{"order": 17}'
```

## AIN blockchain triggers

An `ain` trigger is the Firestore-trigger model on the AIN blockchain: a rule at a database path that calls a URL
whenever that path is written. The node gives you the rule — on the console, **Show AIN rule** on the trigger — as the
exact `.function` value to set at `path`:

```json
{
  "ainize-<projectId>-on-post": {
    "function_type": "REST",
    "function_url": "https://ainize.ai/api/projects/<id>/triggers/on-post/fire?token=<token>",
    "function_id": "ainize-<projectId>-on-post"
  }
}
```

The token rides in the URL because a `_function` call cannot set headers. When the node holds an AIN key with write
permission on the path, **Install on chain** sets the rule for you (`setFunction`); otherwise **Copy rule** and set it
with the key that owns the path. Each write then arrives as the `ain` event above, with the path's `$post_id` in
`params`, the written `value`, the writer's address and the transaction hash.

## On the console

The project's **Runs** tab lists every installed trigger: name, type, cron or path, the next and the last run (a
link to its log), a switch to enable or disable it, **Run now**, and for `http` / `ain` the fire URL, **Rotate
token** and the rule. The run history marks each run with the trigger that started it — *schedule*, *AIN trigger*
or *webhook* — and its name.

A later push replaces the set: a name that disappears from `ainize.json` is removed, a name that stays keeps its
enabled state and its token. Triggers are read over the API too — `GET /api/projects/<id>/triggers` — and switched
with `POST …/triggers/<name>/enable` and `/disable`; see the [HTTP API reference](../reference/http-api.md).

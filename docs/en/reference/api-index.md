# API index

Every route a **running** node answers, read from its own [OpenAPI document](/api/openapi.json) — so this is what that deployment serves, not what the source promises. For the full contract, with every parameter, body and validation rule, see the [HTTP API reference](./http-api.md).

Refreshed with `node scripts/sync-api-docs.mjs <OpenAPI URL or file>`.

Use JSON unless an endpoint specifies multipart upload or streaming. Operator sessions and teaching keys are separate credentials. For model SDK authentication and `/v1`, see [Call the model](../how-to/call-the-model.md).

## `GET /git/{id}.git/info/refs`

Discover Git refs (smart HTTP)

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `service` | query | yes | git-upload-pack, git-receive-pack |

## `POST /git/{id}.git/git-upload-pack`

Clone or fetch an agent repository

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/x-git-upload-pack-request (required). See OpenAPI for fields.

## `POST /git/{id}.git/git-receive-pack`

Push an agent repository and apply main

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/x-git-receive-pack-request (required). See OpenAPI for fields.

## `GET /api/hosted-agents/{id}/executions`

Read persisted runtime execution history

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `limit` | query | no | integer |
| `offset` | query | no | integer |

## `GET /api/hosted-agents/{id}/commits`

Read commit history

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `ref` | query | no | string |
| `limit` | query | no | integer |

## `GET /api/hosted-agents/{id}/refs`

Read branches and clone URL

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/hosted-agents/{id}/tree`

Read a file or paths at a ref

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `ref` | query | no | string |
| `path` | query | no | string |

## `GET /api/hosted-agents/{id}/diff`

Review a proposal diff

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `base` | query | no | string |
| `head` | query | no | string |

## `POST /api/hosted-agents/{id}/forks`

Create a private source fork

Auth: No security scheme declared; check required headers below. Responses: `201`, `400`, `401`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `GET /api/agent-forks`

List your private repository forks

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

## `DELETE /api/agent-forks/{id}`

Delete your private source fork

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/hosted-agents/{id}/pulls`

List repository proposals

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `state` | query | no | open, merged, closed |

## `POST /api/hosted-agents/{id}/pulls`

Open a branch or cross-repository proposal

Auth: No security scheme declared; check required headers below. Responses: `201`, `400`, `401`, `403`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `GET /api/hosted-agents/{id}/pulls/{number}`

Read a proposal

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `number` | path | yes | integer |

## `POST /api/hosted-agents/{id}/pulls/{number}/merge`

Validate and merge a proposal

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `number` | path | yes | integer |

## `POST /api/hosted-agents/{id}/pulls/{number}/close`

Close a proposal

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `number` | path | yes | integer |

## `GET /api/hosted-agents/{id}/pulls/{number}/comments`

Read proposal review comments

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `number` | path | yes | integer |

## `POST /api/hosted-agents/{id}/pulls/{number}/comments`

Add a general or source-anchored review comment

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `number` | path | yes | integer |

Body: application/json (required). See OpenAPI for fields.

## `PATCH /api/hosted-agents/{id}/pulls/{number}/comments/{comment}`

Edit your review comment

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `number` | path | yes | integer |
| `comment` | path | yes | integer |

Body: application/json (required). See OpenAPI for fields.

## `DELETE /api/hosted-agents/{id}/pulls/{number}/comments/{comment}`

Remove a review comment

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `number` | path | yes | integer |
| `comment` | path | yes | integer |

## `GET /api/hosted-agents/{id}/mirror`

Read GitHub mirror state

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `PUT /api/hosted-agents/{id}/mirror`

Attach an agent to a GitHub source

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `DELETE /api/hosted-agents/{id}/mirror`

Detach a GitHub mirror

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/hosted-agents/{id}/mirror/sync`

Reconcile a GitHub mirror now

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/agent-mirrors/webhook`

Reconcile mirrors after a signed GitHub push

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `X-Hub-Signature-256` | header | yes | string |

## `POST /api/hosted-agents/{id}/preview-runs/{run}/export`

Export your proposal conversation

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `run` | path | yes | string |

## `DELETE /api/hosted-agents/{id}/preview-runs/{run}`

Delete your exported proposal conversation

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `run` | path | yes | string |

## `GET /api/hosted-agents/{id}/preview-runs`

Read your persisted proposal conversations

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/hosted-agents/{id}/previews`

Start an isolated proposal runtime at a fixed SHA

Auth: No security scheme declared; check required headers below. Responses: `202`, `401`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `GET /api/agent-previews/{preview}`

Read your temporary proposal runtime

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `preview` | path | yes | string |

## `DELETE /api/agent-previews/{preview}`

Stop your temporary proposal runtime

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `preview` | path | yes | string |

## `POST /api/agent-previews/{preview}/rpc`

Talk to your proposal before merging

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `preview` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `GET /api/projects/{id}/source`

Read the manifest from an immutable execution source

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `target` | query | no | head, commit, deployed |
| `sha` | query | no | string |

## `GET /api/ax`

Check Google AX connectivity and configured atespace

Auth: operatorCookie or operatorBearer Responses: `200`, `400`, `403`, `404`, `409`, `503`, `504`.

## `GET /api/ax/tasks`

List AX tasks

Auth: operatorCookie or operatorBearer Responses: `200`, `400`, `403`, `404`, `409`, `503`, `504`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `limit` | query | no | integer |
| `offset` | query | no | integer |

## `POST /api/ax/tasks`

Create an AX Task

Auth: operatorCookie or operatorBearer Responses: `201`, `400`, `403`, `404`, `409`, `503`, `504`.

Body: application/json (required). See OpenAPI for fields.

## `GET /api/ax/tasks/{name}`

Read an AX Task

Auth: operatorCookie or operatorBearer Responses: `200`, `400`, `403`, `404`, `409`, `503`, `504`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `name` | path | yes | string |

## `DELETE /api/ax/tasks/{name}`

Delete an AX Task

Auth: operatorCookie or operatorBearer Responses: `204`, `400`, `403`, `404`, `409`, `503`, `504`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `name` | path | yes | string |

## `GET /api/ax/workspaces`

List AX workspaces

Auth: operatorCookie or operatorBearer Responses: `200`, `400`, `403`, `404`, `409`, `503`, `504`.

## `POST /api/ax/workspaces`

Upsert an AX Workspace

Auth: operatorCookie or operatorBearer Responses: `200`, `400`, `403`, `404`, `409`, `503`, `504`.

Body: application/json (required). See OpenAPI for fields.

## `GET /api/ax/workspaces/{name}`

Read an AX Workspace

Auth: operatorCookie or operatorBearer Responses: `200`, `400`, `403`, `404`, `409`, `503`, `504`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `name` | path | yes | string |

## `DELETE /api/ax/workspaces/{name}`

Delete an AX Workspace

Auth: operatorCookie or operatorBearer Responses: `204`, `400`, `403`, `404`, `409`, `503`, `504`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `name` | path | yes | string |

## `GET /api/ax/models`

List AX models

Auth: operatorCookie or operatorBearer Responses: `200`, `400`, `403`, `404`, `409`, `503`, `504`.

## `POST /api/ax/models`

Upsert an AX Model

Auth: operatorCookie or operatorBearer Responses: `200`, `400`, `403`, `404`, `409`, `503`, `504`.

Body: application/json (required). See OpenAPI for fields.

## `GET /api/ax/models/{name}`

Read an AX Model

Auth: operatorCookie or operatorBearer Responses: `200`, `400`, `403`, `404`, `409`, `503`, `504`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `name` | path | yes | string |

## `DELETE /api/ax/models/{name}`

Delete an AX Model

Auth: operatorCookie or operatorBearer Responses: `204`, `400`, `403`, `404`, `409`, `503`, `504`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `name` | path | yes | string |

## `POST /api/ax/tasks/{name}/suspend`

suspend an AX task

Auth: operatorCookie or operatorBearer Responses: `200`, `400`, `403`, `404`, `409`, `503`, `504`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `name` | path | yes | string |

## `POST /api/ax/tasks/{name}/resume`

resume an AX task

Auth: operatorCookie or operatorBearer Responses: `200`, `400`, `403`, `404`, `409`, `503`, `504`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `name` | path | yes | string |

## `GET /api/ax/tasks/{name}/egress`

Read the AX task actor egress policy

Auth: operatorCookie or operatorBearer Responses: `200`, `400`, `403`, `404`, `409`, `503`, `504`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `name` | path | yes | string |

## `PUT /api/ax/tasks/{name}/egress`

Create or conditionally replace the AX task actor egress policy

Auth: operatorCookie or operatorBearer Responses: `200`, `201`, `400`, `403`, `404`, `409`, `503`, `504`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `name` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `GET /api/ax/tasks/{name}/runs/{runId}`

Inspect an AX command result

Auth: operatorCookie or operatorBearer Responses: `200`, `400`, `403`, `404`, `409`, `413`, `502`, `503`, `504`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `name` | path | yes | string |
| `runId` | path | yes | string |

## `GET /api/ax/tasks/{name}/runs/{runId}/output/{stream}`

Read bounded AX command output

Auth: operatorCookie or operatorBearer Responses: `200`, `400`, `403`, `404`, `409`, `413`, `502`, `503`, `504`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `name` | path | yes | string |
| `runId` | path | yes | string |
| `stream` | path | yes | stdout, stderr |

## `GET /api/ax/tenants`

List registered AX tenant bindings

Auth: operatorCookie or operatorBearer Responses: `200`, `400`, `403`, `404`, `409`, `500`, `503`, `504`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `limit` | query | no | integer |
| `offset` | query | no | integer |

## `POST /api/ax/tenants`

Register an immutable SSO organization runtime binding

Auth: operatorCookie or operatorBearer Responses: `201`, `400`, `403`, `404`, `409`, `500`, `503`, `504`.

Body: application/json (required). See OpenAPI for fields.

## `GET /api/ax/tenants/audit`

Read AX tenant registry audit events

Auth: operatorCookie or operatorBearer Responses: `200`, `400`, `403`, `404`, `409`, `500`, `503`, `504`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `limit` | query | no | integer |
| `offset` | query | no | integer |

## `GET /api/ax/tenants/{id}`

Read an AX tenant binding

Auth: operatorCookie or operatorBearer Responses: `200`, `400`, `403`, `404`, `409`, `500`, `503`, `504`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `PATCH /api/ax/tenants/{id}`

Activate or disable an AX tenant binding

Auth: operatorCookie or operatorBearer Responses: `200`, `400`, `403`, `404`, `409`, `500`, `503`, `504`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `POST /api/ax/tenants/{id}/projects`

Bind a provider project to an AX tenant

Auth: operatorCookie or operatorBearer Responses: `201`, `400`, `403`, `404`, `409`, `500`, `503`, `504`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `POST /api/projects/{id}/ax-runs`

Create an AX run awaiting signed approval

Auth: operatorCookie or operatorBearer Responses: `202`, `400`, `401`, `403`, `404`, `409`, `503`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `POST /api/projects/{id}/deployments/{deploymentId}/ax-approval`

Verify a run-scoped SSO delegation and enqueue the AX run

Auth: operatorCookie or operatorBearer Responses: `202`, `400`, `401`, `403`, `404`, `409`, `503`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `deploymentId` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `POST /api/projects/{id}/deployments/{deploymentId}/ax-data/key`

AX data key

Auth: operatorCookie or operatorBearer Responses: `200`, `201`, `202`, `204`, `400`, `401`, `403`, `404`, `409`, `503`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `deploymentId` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `POST /api/projects/{id}/deployments/{deploymentId}/ax-data/grants`

AX data grants

Auth: operatorCookie or operatorBearer Responses: `200`, `201`, `202`, `204`, `400`, `401`, `403`, `404`, `409`, `503`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `deploymentId` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `POST /api/projects/{id}/deployments/{deploymentId}/ax-data/revoke`

AX data revoke

Auth: operatorCookie or operatorBearer Responses: `200`, `201`, `202`, `204`, `400`, `401`, `403`, `404`, `409`, `503`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `deploymentId` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `POST /api/projects/{id}/deployments/{deploymentId}/ax-data/ready`

AX data ready

Auth: operatorCookie or operatorBearer Responses: `200`, `201`, `202`, `204`, `400`, `401`, `403`, `404`, `409`, `503`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `deploymentId` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `GET /api/ax/runs/{deploymentId}/data/{grantId}/files/{referenceId}`

Read an admitted AinDrive file from an AX workload

Auth: operatorBearer Responses: `200`, `400`, `401`, `403`, `413`, `429`, `502`, `503`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `deploymentId` | path | yes | string |
| `grantId` | path | yes | string |
| `referenceId` | path | yes | string |

## `POST /api/ax/runs/{deploymentId}/v1/chat/completions`

Invoke a delegated model from an authenticated AX workload

Auth: operatorBearer Responses: `200`, `400`, `401`, `403`, `429`, `502`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `deploymentId` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `GET /api/shared-agents`

Agents this node runs or proxies, in the cross-product registry shape (contract 1.0)

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `429`, `503`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `scope` | query | yes | mine, shared_with_me, shared_with_org, public |
| `q` | query | no | string |
| `org` | query | no | string |
| `cursor` | query | no | string |
| `limit` | query | no | integer |

## `PUT /api/shared-agents/{id}/visibility`

Change who sees an agent (owner or organization admin, into organizations where they are contributor+; the node's operator anywhere)

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `410`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `GET /api/agent-aliases/{name}`

Resolve an agent alias (or id) to the agent's canonical id

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `name` | path | yes | string |

## `PUT /api/agents/{id}/alias`

Give an agent a readable alias (replaces its current one)

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `DELETE /api/agents/{id}/alias`

Remove an agent's alias

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/shared-agents/events`

Changes to the shared agent registry since a cursor (contract 1.0)

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `429`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `cursor` | query | no | string |

## `GET /api/models`

Models this node or a fresh peer serves, and whether a call would be answered

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `POST /api/transcribe`

Free transcription trial on a configured audio backend

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `404`, `503`.

Body: multipart/form-data (required). See OpenAPI for fields.

## `POST /api/image`

Free image-generation trial on a configured image backend

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `404`, `503`.

Body: application/json (required). See OpenAPI for fields.

## `POST /api/run`

Run one script in the hosted-agent sandbox and stream its output

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `413`, `429`, `503`.

Body: application/json (required). See OpenAPI for fields.

## `POST /api/decide`

Free SystemOne decision trial

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `404`, `422`, `503`.

Body: application/json (required). See OpenAPI for fields.

## `POST /v1/audio/transcription-sessions`

Create a one-use native streaming ASR WebSocket session

Auth: modelBearer Responses: `201`, `400`, `401`, `403`, `429`.

Body: application/json (required). See OpenAPI for fields.

## `POST /v1/systemone`

SystemOne decision with a caller API key

Auth: modelBearer Responses: `200`, `400`, `401`, `422`, `503`.

Body: application/json (required). See OpenAPI for fields.

## `GET /api/info`

Node, ledger and runtime summary

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `GET /api/catalog`

List knowledge

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sort` | query | no | latest, popular, price, rows |
| `status` | query | no | string |
| `model` | query | no | string |
| `schema` | query | no | string |
| `q` | query | no | string |
| `author` | query | no | string |
| `branch` | query | no | string |
| `contributor` | query | no | string |
| `origin` | query | no | operator, teach |
| `limit` | query | no | integer |
| `offset` | query | no | integer |
| `include_drafts` | query | no | boolean |

## `GET /api/patches/{id}`

Knowledge detail (verifications, sources/derivatives, overlap check)

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `PATCH /api/patches/{id}`

Edit a DRAFT

Auth: operatorCookie or operatorBearer Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json. See OpenAPI for fields.

## `DELETE /api/patches/{id}`

Delete a DRAFT

Auth: operatorCookie or operatorBearer Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/patches/{id}/dataset`

The training set behind this knowledge (questions, access, licence, 20-question preview)

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |

## `GET /api/patches/{id}/dataset/rows`

Download the training set (.jsonl, canonical bytes)

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |

## `GET /api/patches/{id}/dataset/manifest`

What the training set is made of (row origin, benchmark hash, merkle root, PII scan, declaration)

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |

## `POST /api/patches/{id}/derive-intent`

Say you are building on this knowledge, and get a token for its training set

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |

Body: application/json. See OpenAPI for fields.

## `POST /api/patches/{id}/fork`

Copy this knowledge’s questions into your own training set

Auth: No security scheme declared; check required headers below. Responses: `200`, `201`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |

Body: application/json. See OpenAPI for fields.

## `GET /api/patches/{id}/tree`

The family tree — what this was built on, what was built on it, and what each one added

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `depth` | query | no | integer |
| `dir` | query | no | up, down, both |

## `GET /api/patches/{id}/signals`

How this knowledge is doing — network facts and this node’s last 30 days, kept apart

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/patches/{id}/issues`

Open questions — what to add on top of this knowledge

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `kind` | query | no | own_miss, preflight, free_wrong, request, gap |
| `status` | query | no | open, covered, all |
| `limit` | query | no | integer |

## `POST /api/patches/{id}/issues`

Ask the creator to add something

Auth: No security scheme declared; check required headers below. Responses: `201`, `404`, `429`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `GET /api/explore/shelves`

Explore shelves: selling now, being built on, just published, and what people asked for here

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `limit` | query | no | integer |

## `POST /api/chat/feedback`

Mark an answer wrong — with or without sharing the question

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `404`.

Body: application/json (required). See OpenAPI for fields.

## `GET /api/patches/{id}/records`

Ledger records about this knowledge

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/patches/{id}/conflicts`

Overlap check result

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/benchmarks/{schema}`

Knowledge on the same subject (benchmark schema)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `schema` | path | yes | string |

## `GET /api/chat/patches`

Knowledge that can be live-tested on this node

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `x-ainize-auth` | header | no | string |

## `POST /api/chat/patches/{id}/request`

Ask this node’s operator to get a knowledge it does not hold

Auth: No security scheme declared; check required headers below. Responses: `200`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/chat/status`

Is my live test still queued behind the shared model?

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `request_id` | query | yes | string |

## `POST /api/chat/cancel`

Give up waiting for the shared model

Auth: No security scheme declared; check required headers below. Responses: `200`.

Body: application/json (required). See OpenAPI for fields.

## `POST /api/chat`

Compare answers before vs after the knowledge is loaded

Auth: No security scheme declared; check required headers below. Responses: `200`, `429`.

Body: application/json (required). See OpenAPI for fields.

## `GET /api/teach/policy`

Teaching policy of this node (open / paused, queue, limits, measured timing, shares)

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `GET /api/teach/samples`

Example datasets this node ships (ko-facts, en-facts, mixed)

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `GET /api/teach/samples/{kind}`

Download an example dataset (.jsonl)

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `kind` | path | yes | ko-facts, en-facts, mixed |

## `POST /api/teach/datasets`

Create a dataset — upload a file, or freeze the questions collected in chat

Auth: No security scheme declared; check required headers below. Responses: `200`, `201`, `400`, `403`, `413`, `429`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `x-ainize-auth` | header | yes | string |
| `x-ainize-dataset-sha256` | header | no | string |

Body: multipart/form-data, application/json (required). See OpenAPI for fields.

## `GET /api/teach/datasets`

My datasets (signed key)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `x-ainize-auth` | header | yes | string |

## `GET /api/teach/datasets/{id}`

One dataset

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |

## `PATCH /api/teach/datasets/{id}`

Rename, change retention, or add / remove / replace questions

Auth: No security scheme declared; check required headers below. Responses: `200`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |

Body: application/json. See OpenAPI for fields.

## `DELETE /api/teach/datasets/{id}`

Delete a dataset (the lessons trained from it are kept)

Auth: No security scheme declared; check required headers below. Responses: `200`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |

## `GET /api/teach/datasets/{id}/rows`

The per-question report, paginated

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |
| `offset` | query | no | integer |
| `limit` | query | no | integer |
| `status` | query | no | all, ok, rejected, duplicate, conflict, too_long, empty, blocked, not_parsed, over_cap |

## `POST /api/teach/datasets/{id}/reparse`

Read the SAME uploaded file again with different settings

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |

Body: application/json. See OpenAPI for fields.

## `POST /api/teach/datasets/{id}/fork`

Copy a dataset (optionally with an edit) — how you change one while a lesson is training

Auth: No security scheme declared; check required headers below. Responses: `201`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |

Body: application/json. See OpenAPI for fields.

## `GET /api/teach/datasets/{id}/download`

Download the questions (canonical .jsonl, or .csv)

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |
| `format` | query | no | jsonl, csv |

## `POST /api/teach/preflight`

Check what the model already knows (before queuing a lesson)

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `403`, `429`, `503`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `x-ainize-auth` | header | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `POST /api/teach/merge/preview`

What combining two knowledges would mean (design §9, §12.2)

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `403`, `429`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `x-ainize-auth` | header | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `POST /api/teach/jobs`

Queue a lesson (train the corrections into a knowledge file)

Auth: No security scheme declared; check required headers below. Responses: `202`, `400`, `401`, `403`, `404`, `409`, `429`, `503`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `x-ainize-auth` | header | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `GET /api/teach/jobs`

My lessons (signed key)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `x-ainize-auth` | header | yes | string |
| `mine` | query | no | 1 |

## `GET /api/teach/jobs/{id}`

Lesson status (poll every 5 s)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | no | string |

## `DELETE /api/teach/jobs/{id}`

Cancel / delete a lesson

Auth: No security scheme declared; check required headers below. Responses: `200`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |

## `POST /api/teach/jobs/{id}/retry`

Improve & retry: queue a new lesson with edited corrections (same knowledge context)

Auth: No security scheme declared; check required headers below. Responses: `202`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `POST /api/teach/jobs/{id}/retrain`

Train the same dataset again (or a fork of it)

Auth: No security scheme declared; check required headers below. Responses: `202`, `404`, `429`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |

Body: application/json. See OpenAPI for fields.

## `GET /api/teach/jobs/{id}/events`

This lesson’s log lines (poll every 2 s while it runs)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |
| `since` | query | no | integer |
| `limit` | query | no | integer |

## `POST /api/teach/jobs/{id}/recheck`

Measure again a lesson that was saved unchecked (model server was down, or the side-effect check was turned off)

Auth: No security scheme declared; check required headers below. Responses: `200`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |

## `GET /api/teach/jobs/{id}/publish-challenge`

What to sign before publishing

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |
| `payout_address` | query | no | string |

## `POST /api/teach/jobs/{id}/publish`

Publish the lesson through this node as a credited data provider

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `POST /api/teach/jobs/{id}/save`

Keep it private: 7-day download links for the knowledge file, recipe.json and RUN-LOCALLY.md

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `x-ainize-auth` | header | yes | string |

## `GET /api/teach/jobs/{id}/recipe`

recipe.json (token link from save)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `token` | query | yes | string |

## `GET /api/teach/jobs/{id}/local-run`

RUN-LOCALLY.md (token link from save)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `token` | query | yes | string |

## `GET /api/teacher/{address}`

Public data-provider page: lessons and earnings (owed / paid / pending from settle records)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `address` | path | yes | string |

## `GET /api/me/teach/policy`

Teaching policy (overrides + effective + trainer state)

Auth: operatorCookie or operatorBearer Responses: `200`.

## `PATCH /api/me/teach/policy`

Change the teaching policy (persisted in the node store)

Auth: operatorCookie or operatorBearer Responses: `200`.

Body: application/json. See OpenAPI for fields.

## `GET /api/me/teach/datasets`

What visitors uploaded to this machine (moderation view)

Auth: operatorCookie or operatorBearer Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `limit` | query | no | integer |

## `GET /api/me/teach/jobs`

All lessons (with contributor and IP)

Auth: operatorCookie or operatorBearer Responses: `200`.

## `POST /api/me/teach/jobs/{id}/approve`

Approve a lesson in review → announce

Auth: operatorCookie or operatorBearer Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/me/teach/jobs/{id}/reject`

Decline a lesson in review (reason is shown to the contributor)

Auth: operatorCookie or operatorBearer Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json. See OpenAPI for fields.

## `POST /api/me/teach/jobs/{id}/cancel`

Cancel a lesson

Auth: operatorCookie or operatorBearer Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/me/teach/contributors`

Contributors seen on this node

Auth: operatorCookie or operatorBearer Responses: `200`.

## `POST /api/me/teach/contributors/{address}`

Hide / show a contributor name

Auth: operatorCookie or operatorBearer Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `address` | path | yes | string |

Body: application/json. See OpenAPI for fields.

## `GET /api/me/teach/bans`

Blocked keys / IPs

Auth: operatorCookie or operatorBearer Responses: `200`.

## `POST /api/me/teach/bans`

Block a key or IP

Auth: operatorCookie or operatorBearer Responses: `200`.

Body: application/json. See OpenAPI for fields.

## `DELETE /api/me/teach/bans/{id}`

Unblock

Auth: operatorCookie or operatorBearer Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | integer |

## `GET /x402/patch/{id}`

Buy knowledge (x402)

Auth: No security scheme declared; check required headers below. Responses: `200`, `402`, `423`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `X-PAYMENT` | header | no | string |

## `GET /p2p/datasets`

Training sets this node holds (sha256, rows, access, licence)

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `GET /p2p/dataset/{sha256}`

Download a published training set (.jsonl)

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sha256` | path | yes | string |
| `x-ainize-auth` | header | no | string |
| `x-ainize-derive` | header | no | string |
| `token` | query | no | string |

## `GET /p2p/dataset/{sha256}/manifest`

Manifest of a held training set

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sha256` | path | yes | string |

## `GET /p2p/dataset/{sha256}/benchmark`

The full benchmark list of a training set (the `answers_hash` preimage)

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sha256` | path | yes | string |

## `GET /p2p/blob/{sha256}`

Download the knowledge body (.npz)

Auth: No security scheme declared; check required headers below. Responses: `200`, `402`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sha256` | path | yes | string |
| `token` | query | no | string |
| `x-ainize-auth` | header | no | string |

## `POST /api/patches`

Register knowledge (created as a DRAFT)

Auth: operatorCookie or operatorBearer Responses: `200`.

Body: multipart/form-data (required). See OpenAPI for fields.

## `POST /api/patches/{id}/announce`

Announce — record on the ledger and request verification

Auth: operatorCookie or operatorBearer Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/patches/{id}/retire`

Retire — take your own published knowledge off sale for good

Auth: operatorCookie or operatorBearer Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/patches/{id}/verify`

Run verification on this node now (verifier role)

Auth: operatorCookie or operatorBearer Responses: `200`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/patches/{id}/buy`

Buy as this node (x402 handled automatically)

Auth: operatorCookie or operatorBearer Responses: `200`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `bundle` | query | no | boolean |

Body: application/json. See OpenAPI for fields.

## `GET /api/patches/{id}/quote`

What this purchase would cost — the item and the bases it needs

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/patches/{id}/collect`

Collect a knowledge this node already paid for — no second payment

Auth: operatorCookie or operatorBearer Responses: `200`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/me/pending-payments`

Payments that left this node and were never answered with a manifest

Auth: operatorCookie or operatorBearer Responses: `200`.

## `GET /api/credit/{address}`

Where an address's local credit came from

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `address` | path | yes | string |

## `POST /api/patches/{id}/apply`

Load into the model (with everything it was trained on top of)

Auth: operatorCookie or operatorBearer Responses: `200`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json. See OpenAPI for fields.

## `DELETE /api/patches/{id}/apply`

Unload from the model (journal replay)

Auth: operatorCookie or operatorBearer Responses: `200`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json. See OpenAPI for fields.

## `POST /api/patches/{id}/remove`

Unload from the model (same as DELETE …/apply)

Auth: operatorCookie or operatorBearer Responses: `200`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json. See OpenAPI for fields.

## `GET /api/patches/{id}/check`

Are the rows this knowledge was trained on the ones on the table right now?

Auth: operatorCookie or operatorBearer Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/patches/{id}/forget`

Delete this node's copy of the knowledge file.

Auth: operatorCookie or operatorBearer Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/ledger`

Ledger records

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `kind` | query | no | anchor, attest, settle, challenge, branch, node, supersede, subscribe |
| `limit` | query | no | integer |

## `GET /api/ledger/inference`

Read native inference batch submissions and local receipts

Auth: operatorCookie or operatorBearer Responses: `200`, `400`, `401`, `403`, `404`, `503`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | query | no | string |
| `receipts` | query | no | boolean |
| `offset` | query | no | integer |
| `limit` | query | no | integer |

## `GET /api/ledger/verify`

Ledger integrity check

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `GET /api/ledger/graph`

Sources → derivatives graph (+ AIN knowledge graph)

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `GET /api/branches`

Knowledge tracks (branches)

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `POST /api/branches`

Create a branch

Auth: operatorCookie or operatorBearer Responses: `200`.

Body: application/json. See OpenAPI for fields.

## `POST /api/branches/{name}/subscribe`

Subscribe to a track: buy its current knowledge, load it, and keep it up to date

Auth: operatorCookie or operatorBearer Responses: `200`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `name` | path | yes | string |

## `POST /api/branches/{name}/quote`

What subscribing to a track would spend, item by item, before anything is spent

Auth: operatorCookie or operatorBearer Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `name` | path | yes | string |

## `POST /api/branches/{name}/sync`

Bring a subscribed track up to date now

Auth: operatorCookie or operatorBearer Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `name` | path | yes | string |

## `GET /api/route`

Find the branch and serving nodes for a context (e.g.

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `key=value` | query | no | string |

## `GET /api/nodes`

Known nodes and peers

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `GET /api/agents`

The agent catalogue

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `model` | query | no | string |
| `org` | query | no | string |

## `GET /api/linked-agents`

Linked agents — external A2A agents people registered by URL

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `mine` | query | no | boolean |

## `POST /api/linked-agents`

Register an external A2A agent

Auth: No security scheme declared; check required headers below. Responses: `201`, `400`, `401`, `409`, `429`.

Body: application/json (required). See OpenAPI for fields.

## `GET /api/linked-agents/{id}`

One linked agent — the owner sees the upstream too; anyone it is visible to sees the listing view; 404 otherwise

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `PUT /api/linked-agents/{id}`

Change a linked agent — owner only; the id cannot change

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `403`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `DELETE /api/linked-agents/{id}`

Remove a linked agent — its registrant, or an admin of the organization it is shared with

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/projects`

The caller's projects

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `POST /api/projects`

Bind an aindrive git repository as a project

Auth: No security scheme declared; check required headers below. Responses: `201`.

Body: application/json. See OpenAPI for fields.

## `GET /api/projects/{id}/domains`

List app domains and required DNS records (project owner only)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/projects/{id}/domains`

Claim a custom domain for a web app (project owner only)

Auth: No security scheme declared; check required headers below. Responses: `201`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `GET /api/projects/{id}/app-login`

Sign in to an org-private app on its own domain (the member gate)

Auth: No security scheme declared; check required headers below. Responses: `302`, `400`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `return` | query | yes | string |

## `PATCH /api/projects/{id}/domains/default`

Change the automatically assigned app address (project owner only)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `POST /api/projects/{id}/domains/{hostname}/check`

Recheck app domain DNS (project owner only)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `hostname` | path | yes | string |

## `DELETE /api/projects/{id}/domains/{hostname}`

Remove a custom domain (project owner only)

Auth: No security scheme declared; check required headers below. Responses: `204`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `hostname` | path | yes | string |

## `GET /api/projects/by-repo`

The project bound to a repository (what aindrive's UI shows next to a repo)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `repo` | query | yes | string |

## `GET /api/projects/by-name`

The project at `/&lt;org&gt;/&lt;repo&gt;` — the page's own lookup

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `org` | query | yes | string |
| `repo` | query | yes | string |

## `GET /api/orgs/{org}/projects`

Every project of an organization slug — the `/&lt;org&gt;` page

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `org` | path | yes | string |

## `GET /api/orgs/{org}/repositories`

The organization's drive `repositories/` folder as aindrive lists it (so `/&lt;org&gt;` shows a repo before its first push)

Auth: No security scheme declared; check required headers below. Responses: `200`, `502`, `503`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `org` | path | yes | string |

## `GET /api/projects/{id}`

One project — the view for whoever may see it, `owner` and `hookUrl` for its owner

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `DELETE /api/projects/{id}`

Remove a project with its deployments, logs and secrets (owner only)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/projects/{id}/secrets`

A project's secrets — names and when each was set, never values (owner or org writer)

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `PUT /api/projects/{id}/secrets/{name}`

Set or replace one project secret (owner or org writer)

Auth: No security scheme declared; check required headers below. Responses: `200`, `201`, `400`, `403`, `404`, `409`, `413`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `name` | path | yes | string |
| `redeploy` | query | no | 1, true |

Body: application/json (required). See OpenAPI for fields.

## `DELETE /api/projects/{id}/secrets/{name}`

Remove one project secret (owner or org writer)

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `name` | path | yes | string |
| `redeploy` | query | no | 1, true |

## `GET /api/operations/projects`

Find operational records by original cloud project or repository

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `q` | query | no | string |

## `GET /api/projects/{id}/operations`

Read private operational provenance and dated verification evidence

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `PUT /api/projects/{id}/operations`

Replace operational provenance with optimistic concurrency (owner only)

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `PATCH /api/projects/{id}/presentation`

Rename the project or change how it is shown (owner only)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `PATCH /api/projects/{id}/rotate-secret`

A new webhook secret, shown once (owner only)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/projects/{id}/runs`

Ad-hoc runs of a script project, newest first (readable as the project is)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/projects/{id}/runs`

Run the branch's HEAD now, with your entry, inputs and env — owner or a member of the repository's organization

Auth: No security scheme declared; check required headers below. Responses: `202`, `403`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json. See OpenAPI for fields.

## `GET /api/projects/{id}/triggers`

The installed triggers of a script project (readable as the project is)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/projects/{id}/triggers/{name}/enable`

Enable a trigger — owner or organization member

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `name` | path | yes | string |

## `POST /api/projects/{id}/triggers/{name}/disable`

Disable a trigger — owner or organization member

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `name` | path | yes | string |

## `POST /api/projects/{id}/triggers/{name}/rotate-token`

A new fire token for an http or ain trigger, shown once — owner or organization member

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `name` | path | yes | string |

## `POST /api/projects/{id}/triggers/{name}/run`

Fire a trigger by hand with a synthetic event — owner or organization member

Auth: No security scheme declared; check required headers below. Responses: `202`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `name` | path | yes | string |

## `GET /api/projects/{id}/triggers/{name}/ain-rule`

The AIN DB `.function` rule that makes the chain call an ain trigger — owner or organization member

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `name` | path | yes | string |

## `POST /api/projects/{id}/triggers/{name}/ain-rule/install`

Set the ain rule on chain with the organization's AIN service key — an admin of the owning organization

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`, `409`, `429`, `502`, `503`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `name` | path | yes | string |

## `POST /api/projects/{id}/triggers/{name}/fire`

Fire an http or ain trigger — the webhook URL, and what the AIN blockchain's `_function` calls

Auth: No security scheme declared; check required headers below. Responses: `200`, `202`, `400`, `401`, `403`, `404`, `409`, `413`, `429`, `503`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `name` | path | yes | string |
| `token` | query | no | string |

Body: application/json, text/plain. See OpenAPI for fields.

## `POST /api/deployments/{id}/redeploy`

Deploy this commit again (Redeploy; a service's roll-back to this one) — owner or organization member

Auth: No security scheme declared; check required headers below. Responses: `202`, `403`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/projects/{id}/hook`

The push webhook aindrive calls after a successful git-receive-pack

Auth: No security scheme declared; check required headers below. Responses: `202`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json. See OpenAPI for fields.

## `GET /api/projects/{id}/deployments`

A project's deployments (pushes and redeploys), newest first — readable as the project is

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/deployments/{id}`

One deployment or run (readable as its project is)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/projects/{id}/run`

Stream a selected repository version for the viewer

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `404`, `409`, `502`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json. See OpenAPI for fields.

## `POST /api/projects/{id}/redeploy`

Deploy the project's newest commit again (owner only)

Auth: No security scheme declared; check required headers below. Responses: `202`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/projects/{id}/github-sync`

The project's GitHub upstream and the sync's last status (owner or organization member)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `PUT /api/projects/{id}/github-sync`

Keep the project in sync with a GitHub repository (owner or organization member)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `DELETE /api/projects/{id}/github-sync`

Pause the GitHub sync of the project's repository (owner or organization member)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/projects/{id}/github-sync`

Sync from GitHub now (owner or organization member)

Auth: No security scheme declared; check required headers below. Responses: `202`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/github-imports`

Import a GitHub repository: create its AIN Drive repository, deploy it and keep it in sync (organization member)

Auth: No security scheme declared; check required headers below. Responses: `202`, `400`, `401`, `403`, `409`, `422`, `429`, `502`, `503`.

Body: application/json (required). See OpenAPI for fields.

## `GET /api/github-imports/{org}/{repo}`

How an import is going: the request, the sync job's last status, the project once bound (organization member)

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `403`, `404`, `503`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `org` | path | yes | string |
| `repo` | path | yes | string |

## `DELETE /api/github-imports/{org}/{repo}`

Withdraw an import that has not become a project (organization member)

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `403`, `404`, `503`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `org` | path | yes | string |
| `repo` | path | yes | string |

## `GET /api/github-sync/roster`

The repositories projects asked to keep in sync (sync job, operator token)

Auth: operatorBearer Responses: `200`.

## `POST /api/github-sync/status`

Report sync results per repository (sync job, operator token)

Auth: operatorBearer Responses: `200`.

## `GET /api/github-sync/requests`

Take the pending "Sync from GitHub now" requests (sync job, operator token)

Auth: operatorBearer Responses: `200`.

## `GET /api/ainui/snippet`

The AIN-UI link snippet of a project page URL (what a chat shows when the URL is pasted)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `url` | query | no | string |
| `path` | query | no | string |

## `GET /api/deployments/{id}/log`

The captured log: text once over, SSE (`log` chunks, then `done`) while queued or building

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/deployments/{id}/output`

The script's stdout alone, for a ready deployment

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/projects/{id}/requests`

What visitors asked the running app through this node (owner or member)

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `tail` | query | no | integer |
| `since` | query | no | integer |

## `GET /api/projects/{id}/runtime-logs`

The running service's own stdout/stderr, wherever it was placed (owner or member)

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `403`, `404`, `502`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `allowCached` | query | no | 1 |
| `id` | path | yes | string |
| `tail` | query | no | integer |
| `since` | query | no | string |

## `GET /api/orgs/{id}/issues`

The organization's issues: failed deployments and runs, agents not answering, what monitors reported (org read)

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `status` | query | no | unresolved, resolved, ignored, all |
| `kind` | query | no | string |
| `limit` | query | no | integer |

## `POST /api/orgs/{id}/issues/ingest`

Record an event from an external monitor — a site down, the model not answering (org write)

Auth: No security scheme declared; check required headers below. Responses: `200`, `201`, `400`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `GET /api/issues/{iid}`

One issue with its events (org read)

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `iid` | path | yes | string |

## `POST /api/issues/{iid}/status`

Resolve, ignore or re-open an issue (org write)

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `iid` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `GET /api/projects/{id}/issues`

The project's issues: its failed deployments and runs grouped by cause

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `status` | query | no | unresolved, resolved, ignored, all |

## `GET /api/orgs/{id}/stores`

The organization's stores, its backup target and this node's limits (org read)

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`, `503`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/orgs/{id}/stores`

Create a store (org write) — provisioned in the background, poll its status

Auth: No security scheme declared; check required headers below. Responses: `201`, `400`, `403`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `GET /api/stores/{sid}`

One store with its attachments, health and usage (org read)

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |

## `PATCH /api/stores/{sid}`

Change a store's backup settings or name (org write), or its resources (admin)

Auth: No security scheme declared; check required headers below. Responses: `200`, `202`, `400`, `403`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `DELETE /api/stores/{sid}`

Delete a store (admin): refused while connected; name confirm; final backup; data to the trash for 30 days

Auth: No security scheme declared; check required headers below. Responses: `202`, `400`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `POST /api/stores/{sid}/start`

Start a stopped store (admin)

Auth: No security scheme declared; check required headers below. Responses: `202`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |

## `POST /api/stores/{sid}/stop`

Stop a store (admin) — connected projects fail to deploy until it is started

Auth: No security scheme declared; check required headers below. Responses: `202`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |

## `POST /api/stores/{sid}/retry`

Provision again a store whose first provisioning failed (admin, or the node operator)

Auth: No security scheme declared; check required headers below. Responses: `202`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |

## `POST /api/stores/{sid}/recreate`

Recreate the container (admin): the next generation on the same volume and alias

Auth: No security scheme declared; check required headers below. Responses: `202`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |

## `POST /api/stores/{sid}/attachments`

Connect a project to the store (org write and project writer); `?redeploy=1` queues the redeploy that delivers the env

Auth: No security scheme declared; check required headers below. Responses: `200`, `201`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |
| `redeploy` | query | no | 1, true |

Body: application/json (required). See OpenAPI for fields.

## `DELETE /api/stores/{sid}/attachments/{projectId}`

Disconnect a project (org write and project writer); `?redeploy=1` queues the redeploy that removes the env

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |
| `projectId` | path | yes | string |
| `redeploy` | query | no | 1, true |

## `POST /api/stores/{sid}/reveal`

The connection env, once (org write) — logged

Auth: No security scheme declared; check required headers below. Responses: `200`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |

Body: application/json. See OpenAPI for fields.

## `POST /api/stores/{sid}/rotate`

New credentials (admin): a pre-rotate backup, new passwords/keys, every connected project redeployed

Auth: No security scheme declared; check required headers below. Responses: `200`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |
| `all` | query | no | 1, true |

## `GET /api/stores/{sid}/tables`

Data browser: the tables of a Postgres database (org write)

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |
| `database` | query | no | string |

## `GET /api/stores/{sid}/tables/{schema}/{table}/rows`

Data browser: a page of rows (org write)

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |
| `schema` | path | yes | string |
| `table` | path | yes | string |
| `database` | query | no | string |
| `limit` | query | no | integer |
| `offset` | query | no | integer |
| `order` | query | no | string |
| `dir` | query | no | asc, desc |

## `POST /api/stores/{sid}/query`

Data browser: one read-only statement (org write) — 10 s, 200 rows

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `408`, `413`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `GET /api/stores/{sid}/objects`

Data browser: the objects of a Blob store under a prefix (org write)

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |
| `prefix` | query | no | string |
| `after` | query | no | string |
| `limit` | query | no | integer |

## `GET /api/stores/{sid}/objects/download`

Data browser: download one object (org write), at most 256 MiB through the node

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`, `413`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |
| `key` | query | yes | string |

## `GET /api/stores/{sid}/backups`

The store's backups, newest first, with its schedule and the organization's drive target (org read)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |

## `POST /api/stores/{sid}/backups`

Back up now (org write) — 202, idempotent while one runs

Auth: No security scheme declared; check required headers below. Responses: `202`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |

## `DELETE /api/stores/{sid}/backups/{bk}`

Delete a backup on the NAS and the drive (admin)

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |
| `bk` | path | yes | string |

## `POST /api/stores/{sid}/restore`

Restore a backup into a new store (default) or in place with a 7-day undo (admin)

Auth: No security scheme declared; check required headers below. Responses: `202`, `400`, `404`, `409`, `422`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `POST /api/stores/{sid}/restore/undo`

Undo the newest in-place restore (admin): the kept database comes back, the restored one is set aside

Auth: No security scheme declared; check required headers below. Responses: `202`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |

## `GET /api/stores/{sid}/logs`

The store container's own log (org write)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `sid` | path | yes | string |
| `tail` | query | no | integer |

## `GET /api/storage/orgs`

Which organizations may use storage on this node (operator)

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `503`.

## `GET /api/orgs/{id}/storage/access`

Whether the organization may use storage, and why (operator)

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `PUT /api/orgs/{id}/storage/access`

Admit the organization to storage at run time (operator) — no unit edit, no restart

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`, `503`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `DELETE /api/orgs/{id}/storage/access`

Take a run-time grant away (operator)

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `PUT /api/orgs/{id}/storage/backup-target`

Set the organization's AinDrive backup target (admin): a drive id and an AinDrive grant

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `502`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `DELETE /api/orgs/{id}/storage/backup-target`

Clear the backup target (admin) — backups stay on the NAS only

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/orgs/{id}/storage/backup-target/connect`

Connect AinDrive as the backup target (admin): the AinDrive consent URL to open

Auth: No security scheme declared; check required headers below. Responses: `200`, `502`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `POST /api/storage/aindrive/callback`

Finish connecting AinDrive (admin of the organization that started it)

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `502`.

Body: application/json (required). See OpenAPI for fields.

## `GET /api/projects/{id}/storage`

The project's Storage tab: connected stores, what ainize.json declares, what is missing (owner or member)

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`, `503`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /svc/{projectId}/{path}`

A project's running service or Next.js container (any method)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `projectId` | path | yes | string |
| `path` | path | yes | string |

## `GET /api/agent-archives`

List your privately retained deleted agents

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `limit` | query | no | integer |
| `offset` | query | no | integer |

## `GET /api/agent-archives/{id}`

Read your archived spec, reviews and execution evidence

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `DELETE /api/agent-archives/{id}`

Permanently remove an exported archive

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/agent-archives/{id}/restore`

Restore your deleted agent at the same address

Auth: No security scheme declared; check required headers below. Responses: `201`, `400`, `401`, `403`, `404`, `409`, `429`, `501`, `502`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/agent-archives/{id}/export`

Download your complete deleted-agent archive

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `404`, `502`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/hosted-agents`

Hosted agents — agents this node runs

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `mine` | query | no | boolean |
| `manageable` | query | no | boolean |

## `POST /api/hosted-agents`

Create a hosted agent

Auth: No security scheme declared; check required headers below. Responses: `201`, `400`, `401`, `409`, `413`, `429`, `501`.

Body: application/json (required). See OpenAPI for fields.

## `GET /api/hosted-agents/{id}`

One hosted agent — its owner and `write` members of the organization it is shared with see the whole spec (prompt, files, secret names); anyone else it is visible to sees the listing view; 404 otherwise

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `PUT /api/hosted-agents/{id}`

Change a hosted agent — its owner, or a `write` member of the organization it is shared with; only the owner or an organization `admin` may change `visibility`/`orgId` (sharing into an organization takes `contributor` there); the id cannot change

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `403`, `404`, `413`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `DELETE /api/hosted-agents/{id}`

Remove a hosted agent — its owner, or an `admin` of the organization it is shared with

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `PUT /api/hosted-agents/{id}/secrets/{name}`

Set (`{ value }`) or clear (`{ value: null }`) a secret — owner or `write` member of its organization; write-only

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `name` | path | yes | string |

## `GET /agents/{id}/.well-known/agent-card.json`

Read the A2A card; bound AINFT agents advertise current-holder authentication

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

## `POST /agents/{id}`

Call an A2A agent; a bound AINFT executes in the current holder’s private workspace

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `403`, `409`.

## `GET /api/hosted-agents/{id}/ainft-binding`

Read the verified AINFT registration snapshot for a visible agent

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/hosted-agents/{id}/ainft-binding`

Verify Factory wallet indexing and persist a token binding — agent creator only

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `401`, `403`, `409`, `503`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `GET /api/hosted-agents/{id}/holder-access`

Check the signed-in native wallet against current on-chain AINFT ownership

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `403`.

## `GET /api/hosted-agents/{id}/companion`

Read the current holder’s private persisted tasks, memories and activity experience

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `403`.

## `POST /api/hosted-agents/{id}/companion/tasks`

Queue idempotent private chat or work; body: key, kind (chat/task), input

Auth: No security scheme declared; check required headers below. Responses: `200`, `202`, `403`, `409`.

## `POST /api/hosted-agents/{id}/companion/tasks/{taskId}/cancel`

Cancel queued work; already running work cannot claim safe cancellation

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `409`.

## `POST /api/hosted-agents/{id}/companion/memories`

Propose private memory from a completed task; body: sourceTask, text

Auth: No security scheme declared; check required headers below. Responses: `201`, `403`, `409`.

## `POST /api/hosted-agents/{id}/ainft-community`

Creator configures the existing Factory community and credit symbol for the current bound release.

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `403`, `409`.

## `GET /api/hosted-agents/{id}/companion/credits`

Current holder reads the configured Factory credit community, binding chain and configuration version; no-store.

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `409`.

## `POST /api/hosted-agents/{id}/companion/learning/examples`

Save a holder-reviewed private question and answer sourced from approved memory; body: key, memoryId, prompt (up to 400 characters), answer (up to 200), optional altPrompt (a different reviewed evaluation question, up to 400), consent:true.

Auth: No security scheme declared; check required headers below. Responses: `200`, `201`, `400`, `403`, `409`.

## `GET /api/hosted-agents/{id}/companion/learning`

Read exact-model local training capability and this holder’s persisted training jobs; no-store.

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`.

## `GET /api/hosted-agents/{id}/companion/learning/runs/{runId}/publication-challenge`

Get the existing Teach signed publication claim for this holder’s READY lesson.

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `409`.

## `POST /api/hosted-agents/{id}/companion/learning/runs/{runId}/publish`

Submit a private lesson for shared publication using TeachWorker’s signature verification and operator review policy.

Auth: No security scheme declared; check required headers below. Responses: `200`, `202`, `400`, `403`, `409`, `503`.

## `POST /api/hosted-agents/{id}/companion/learning/select`

Choose a READY private lesson for subsequent holder conversations, or runId:null to restore base behavior; body: key, runId, model, consent:true.

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `403`, `409`.

## `POST /api/hosted-agents/{id}/companion/learning/train`

Submit reviewed examples to real compatible TeachWorker; body: key, exampleIds[], model, consent:true.

Auth: No security scheme declared; check required headers below. Responses: `200`, `202`, `400`, `403`, `409`, `503`.

## `POST /api/hosted-agents/{id}/companion/learning/examples/{exampleId}/withdraw`

Withdraw a private learning example.

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`.

## `POST /api/hosted-agents/{id}/companion/memories/{memoryId}/revoke`

Withdraw approved private memory from future memory context; existing conversation records remain

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`.

## `POST /api/hosted-agents/{id}/companion/memories/{memoryId}/decision`

Approve or reject private memory; body: approve boolean

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`.

## `GET /api/hosted-agents/{id}/ainft-metadata`

Export wallet-compatible native AINFT metadata; does not mint or register a token

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/ainft/avatar.svg`

Public default avatar for Ainize AINFT metadata

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `GET /api/hosted-agents/{id}/logs`

Recent log lines — owner or `write` member of its organization

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/orgs`

The organizations the caller is in

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `POST /api/orgs`

Create an organization

Auth: No security scheme declared; check required headers below. Responses: `201`, `400`, `401`, `403`, `409`, `429`.

Body: application/json (required). See OpenAPI for fields.

## `GET /api/orgs/{id}`

The organization page — members only

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `PUT /api/orgs/{id}`

Change settings — admin

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `DELETE /api/orgs/{id}`

Delete — admin; refused while agents are shared with it (`has_agents`)

Auth: No security scheme declared; check required headers below. Responses: `200`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/orgs/{id}/members`

Members and roles

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/orgs/{id}/members`

Add a member by principal — admin

Auth: No security scheme declared; check required headers below. Responses: `201`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `PUT /api/orgs/{id}/members/{principal}`

Change a member's role — admin; the last admin stays (`last_admin`)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `principal` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `DELETE /api/orgs/{id}/members/{principal}`

Remove a member (admin) or leave (anyone)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `principal` | path | yes | string |

## `PUT /api/orgs/{id}/sso-link`

Operator: join the organization to the AIN SSO organization of the same slug

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/orgs/{id}/join`

Ask to join

Auth: No security scheme declared; check required headers below. Responses: `202`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json. See OpenAPI for fields.

## `GET /api/orgs/{id}/requests`

Pending join requests — admin

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/orgs/{id}/requests/{principal}/approve`

Approve a request — admin

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `principal` | path | yes | string |

Body: application/json. See OpenAPI for fields.

## `DELETE /api/orgs/{id}/requests/{principal}`

Reject a request — admin

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `principal` | path | yes | string |

## `GET /api/orgs/{id}/invites`

Open invites (token prefixes only) — admin

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/orgs/{id}/invites`

Make an invite link — admin

Auth: No security scheme declared; check required headers below. Responses: `201`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json. See OpenAPI for fields.

## `DELETE /api/orgs/{id}/invites/{token}`

Revoke an invite — admin

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `token` | path | yes | string |

## `GET /api/orgs/join/{token}`

What an invite leads to

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `token` | path | yes | string |

## `POST /api/orgs/join/{token}`

Accept an invite

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `token` | path | yes | string |

## `GET /api/orgs/{id}/groups`

Resource groups (all for write+, else the ones you are in)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/orgs/{id}/groups`

Make a resource group — write

Auth: No security scheme declared; check required headers below. Responses: `201`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json (required). See OpenAPI for fields.

## `PUT /api/orgs/{id}/groups/{groupId}`

Change a resource group — write

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `groupId` | path | yes | string |

## `DELETE /api/orgs/{id}/groups/{groupId}`

Delete a resource group — write

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `groupId` | path | yes | string |

## `GET /api/orgs/{id}/audit`

Audit log — admin

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `limit` | query | no | integer |

## `GET /api/orgs/{id}/billing`

Billing — admin

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/orgs/{id}/security`

Security & SSO — admin

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `GET /api/events`

Node event log

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `kind` | query | no | string |
| `limit` | query | no | integer |

## `GET /api/me/wallet`

Wallet: balance, sales, creator revenue share, pending payouts

Auth: operatorCookie or operatorBearer Responses: `200`.

## `GET /api/me/payouts`

Royalty payouts this node owes creators and data providers (AIN ledger)

Auth: operatorCookie or operatorBearer Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `status` | query | no | pending, paying, paid, failed |
| `address` | query | no | string |
| `limit` | query | no | integer |

## `POST /api/me/payouts/{id}/retry`

Retry one failed / pending payout now (also after the 20 automatic attempts)

Auth: operatorCookie or operatorBearer Responses: `200`, `404`, `409`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | integer |

## `GET /api/me/patches`

Knowledge I registered

Auth: operatorCookie or operatorBearer Responses: `200`.

## `GET /api/me/purchases`

Knowledge I bought

Auth: operatorCookie or operatorBearer Responses: `200`.

## `GET /api/me/settings`

Read settings

Auth: operatorCookie or operatorBearer Responses: `200`.

## `PATCH /api/me/settings`

Change settings

Auth: operatorCookie or operatorBearer Responses: `200`.

Body: application/json. See OpenAPI for fields.

## `GET /api/chain`

Ledger / chain state and balance

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `GET /api/drive`

aindrive state and file list

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `POST /api/drive`

aindrive start / stop / sync

Auth: operatorCookie or operatorBearer Responses: `200`.

Body: application/json. See OpenAPI for fields.

## `POST /api/auth/aindrive/git-token`

A 15-minute AinDrive git credential for the signed-in AIN account (what `ainize deploy` pushes with)

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `GET /api/auth/me`

Who am I — `signedIn` + `subject` is a name, `isOwner` + `scope` is what it permits; `sso` is an AIN SSO session, `site` a Google account the site vouches for (x-ainize-site-subject)

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `POST /api/auth/challenge`

A single-use nonce to sign for sign-in — `scheme` picks the signing rules and is fixed from here on

Auth: No security scheme declared; check required headers below. Responses: `200`.

Body: application/json. See OpenAPI for fields.

## `POST /api/auth/wallet`

Sign in by signature, under the scheme the challenge was issued for — open to any address; owning the node is a separate question

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `403`.

Body: application/json. See OpenAPI for fields.

## `POST /api/auth/enroll`

Become an owner of this node and sign in — needs the machine itself (loopback or x-setup-token) and a signature from the address

Auth: No security scheme declared; check required headers below. Responses: `200`, `403`.

Body: application/json. See OpenAPI for fields.

## `GET /api/auth/owners`

Who owns this node — its own key, the config list, and grants made from a browser

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `POST /api/auth/owners`

Grant ownership to an address (an owner vouches; no signature from the address)

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `403`.

Body: application/json. See OpenAPI for fields.

## `DELETE /api/auth/owners/{address}`

Revoke a granted ownership, ending that address's sessions

Auth: No security scheme declared; check required headers below. Responses: `200`, `400`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `address` | path | yes | string |

## `POST /api/auth/device`

Request wallet approval for a node link or explicit CLI delegation

Auth: No security scheme declared; check required headers below. Responses: `200`.

Body: application/json. See OpenAPI for fields.

## `GET /api/auth/device/{code}`

What is being authorised, for the page that shows it — including the exact message the wallet will sign

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `code` | path | yes | string |

## `POST /api/auth/device/{code}/approve`

Approve it: one wallet signature (eip191) over the message the node issued, from the address that is signed in

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `409`, `410`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `code` | path | yes | string |

Body: application/json. See OpenAPI for fields.

## `POST /api/auth/device/{code}/claim`

The CLI collecting its session — single use, and needs the poll secret it never printed

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`, `409`, `410`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `code` | path | yes | string |

Body: application/json. See OpenAPI for fields.

## `POST /api/my/nodes/heartbeat`

Report a linked node online using its dedicated node-link Bearer token

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`.

## `DELETE /api/my/nodes/{address}`

Disconnect one node from the signed-in wallet without stopping its process

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `address` | path | yes | string |

## `GET /api/my/nodes`

Nodes linked to the signed-in wallet, including this node when operated by that wallet

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`.

## `GET /api/auth/bindings`

Every key that acts as you, and which one is acting now

Auth: No security scheme declared; check required headers below. Responses: `200`, `401`.

## `DELETE /api/auth/bindings/{delegate}`

End one, and the sessions it collected

Auth: No security scheme declared; check required headers below. Responses: `200`, `404`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `delegate` | path | yes | string |

## `POST /api/auth/logout`

Log out

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `GET /api/docs`

Where the reference is: the GitHub address of docs/reference/ and of this document

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `GET /api/patches/{id}/events`

Node events about this knowledge (verification logs, sales, live tests)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |
| `limit` | query | no | integer |

## `POST /api/patches/{id}/challenge`

Request re-verification (challenge)

Auth: operatorCookie or operatorBearer Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

Body: application/json. See OpenAPI for fields.

## `POST /api/branches/{name}/patches`

Add knowledge to a branch (owner only)

Auth: operatorCookie or operatorBearer Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `name` | path | yes | string |

Body: application/json. See OpenAPI for fields.

## `POST /api/branches/{name}/unsubscribe`

Unsubscribe from a branch (unload its knowledge)

Auth: operatorCookie or operatorBearer Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `name` | path | yes | string |

## `GET /api/runtime`

Serving runtime state (model, hook, the ordered stack of loaded knowledge)

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `GET /api/runtime/stack`

The ordered stack loaded in the serving model

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `GET /api/runtime/jobs/{id}`

A queued apply/remove

Auth: operatorCookie or operatorBearer Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `id` | path | yes | string |

## `POST /api/runtime/complete`

Raw completion on the serving model (try the model)

Auth: operatorCookie or operatorBearer Responses: `200`.

Body: application/json. See OpenAPI for fields.

## `POST /api/peers`

Add a peer

Auth: operatorCookie or operatorBearer Responses: `200`.

Body: application/json. See OpenAPI for fields.

## `DELETE /api/peers`

Remove a peer

Auth: operatorCookie or operatorBearer Responses: `200`.

Body: application/json. See OpenAPI for fields.

## `POST /api/chain/setup`

Create the knowledge app on the AIN chain, set market rules, stake (AIN ledger only)

Auth: operatorCookie or operatorBearer Responses: `200`.

## `GET /api/drive/changes`

Change history of a drive file (aindrive Willow store)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `path` | query | yes | string |

## `POST /p2p/hello`

Peer introduction (exchange PeerInfo)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `x-ainize-auth` | header | no | string |

## `GET /p2p/payouts/{hash}`

What this node did about one settlement's royalties

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `hash` | path | yes | string |

## `GET /p2p/peers`

Peer list for peer exchange

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `GET /p2p/blobs`

Knowledge bodies held by this node (sha256 list)

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `GET /api/openapi.json`

This document

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `GET /healthz`

Liveness: 200 while the process is up

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `GET /readyz`

Readiness: 200 when the ledger is reachable and, for a serving/verifier node, the runtime is available; 503 with the failing check otherwise

Auth: No security scheme declared; check required headers below. Responses: `200`, `503`.

## `GET /p2p/info`

Node info

Auth: No security scheme declared; check required headers below. Responses: `200`.

## `GET /p2p/records`

Ledger record sync (local-ledger mode)

Auth: No security scheme declared; check required headers below. Responses: `200`.

| Parameter | In | Required | Type |
|---|---|---|---|
| `since` | query | no | number |

## `POST /p2p/records`

Push records

Auth: No security scheme declared; check required headers below. Responses: `200`.

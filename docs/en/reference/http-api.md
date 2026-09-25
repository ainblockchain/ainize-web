# HTTP API reference

The running node’s [OpenAPI document](/api/openapi.json) is the complete contract for request bodies, response schemas and authentication. This compact index is refreshed with `node scripts/sync-api-docs.mjs <OpenAPI URL or file>`.

Use JSON unless an endpoint specifies multipart upload or streaming. Operator sessions and teaching keys are separate credentials. For model SDK authentication and `/v1`, see [Call the model](../how-to/call-the-model.md).

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

## `GET /api/auth/me`

Who am I — `signedIn` + `subject` is a name, `isOwner` + `scope` is what it permits

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

`ainize login`: a command line asks to be authorised — returns a code, a URL to open, and the poll secret that alone can collect the session

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

OpenAPI + CLI reference bundle for the web /docs page

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

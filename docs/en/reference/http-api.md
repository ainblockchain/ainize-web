---
title: HTTP API reference
summary: Every endpoint an Ainize node serves, with parameters, bodies and responses
---

# HTTP API reference

> [!NOTE]
> **This page is generated — do not edit it by hand.** It is written by `scripts/docs-gen.mjs` from `ainize-node/src/openapi.ts`.
> Regenerate with `npm run docs:gen`; `npm run docs:check` fails when this page and the source disagree.

333 operations on 277 paths, grouped into the 12 areas a node serves. Body shapes shared between endpoints are on the [Schemas](./schemas.md) page; the codes an error can carry are on [Error codes](./errors.md).

## How to read this page

The base URL is the node itself — `http://localhost:3402` for a node started on the default port — and every request and response body is `application/json` unless the endpoint says otherwise.

A node serves this same description as OpenAPI 3.1 at `GET /api/openapi.json`, so a client can be generated from it.

### Authentication

The **Auth** column of each index below says what a request must carry.

- **`operatorCookie`** — cookie `ainize_session`
- **`operatorBearer`** — http `bearer`
- **teaching key** — the `x-ainize-auth` header. There is no account: the key is the identity. Endpoints that accept it describe its exact form in their parameter table.
- **payment (x402)** — the endpoint answers `402` with an `x-payment-required` header; repeat the request with `X-PAYMENT`.
- **none** — public.

### Errors

Every error body is `{"error": "<message>"}`, sometimes with extra fields the endpoint documents. Where the message begins with a machine-readable code (`dataset_not_found: no such dataset on this node`), that prefix is the code — there is no separate field for it.

See [Error codes](./errors.md) for the full list.

## Endpoint index

**Find knowledge** — catalog, detail, same-subject listings (no auth)

| Method | Path | Auth | What it does |
|---|---|---|---|
| `GET` | [`/api/info`](#get-apiinfo) | none | Node, ledger and runtime summary |
| `GET` | [`/api/catalog`](#get-apicatalog) | none | List knowledge |
| `GET` | [`/api/patches/{id}`](#get-apipatchesid) | none | Knowledge detail (verifications, sources/derivatives, overlap check) |
| `GET` | [`/api/patches/{id}/dataset`](#get-apipatchesiddataset) | teaching key | The training set behind this knowledge (questions, access, licence, 20-question preview) |
| `GET` | [`/api/patches/{id}/dataset/rows`](#get-apipatchesiddatasetrows) | teaching key | Download the training set (.jsonl, canonical bytes) |
| `GET` | [`/api/patches/{id}/dataset/manifest`](#get-apipatchesiddatasetmanifest) | teaching key | What the training set is made of (row origin, benchmark hash, merkle root, PII scan, declaration) |
| `GET` | [`/api/patches/{id}/tree`](#get-apipatchesidtree) | none | The family tree — what this was built on, what was built on it, and what each one added |
| `GET` | [`/api/patches/{id}/signals`](#get-apipatchesidsignals) | none | How this knowledge is doing — network facts and this node’s last 30 days, kept apart |
| `GET` | [`/api/patches/{id}/issues`](#get-apipatchesidissues) | none | Open questions — what to add on top of this knowledge |
| `POST` | [`/api/patches/{id}/issues`](#post-apipatchesidissues) | teaching key | Ask the creator to add something |
| `GET` | [`/api/explore/shelves`](#get-apiexploreshelves) | none | Explore shelves: selling now, being built on, just published, and what people asked for here |
| `GET` | [`/api/patches/{id}/conflicts`](#get-apipatchesidconflicts) | none | Overlap check result |
| `GET` | [`/api/benchmarks/{schema}`](#get-apibenchmarksschema) | none | Knowledge on the same subject (benchmark schema) |

**Live test** — compare the model's answer before vs after the knowledge is loaded

| Method | Path | Auth | What it does |
|---|---|---|---|
| `POST` | [`/api/chat/feedback`](#post-apichatfeedback) | none | Mark an answer wrong — with or without sharing the question |
| `GET` | [`/api/chat/patches`](#get-apichatpatches) | teaching key (optional) | Knowledge that can be live-tested on this node |
| `GET` | [`/api/chat/patches/{id}/request`](#get-apichatpatchesidrequest) | none | Inspect this requester’s retained demand record and current selected file |
| `POST` | [`/api/chat/patches/{id}/request`](#post-apichatpatchesidrequest) | none | Record a request for this node’s operator without purchasing or loading knowledge |
| `GET` | [`/api/chat/status`](#get-apichatstatus) | none | Is my live test still queued behind the shared model? |
| `POST` | [`/api/chat/cancel`](#post-apichatcancel) | none | Give up waiting for the shared model |
| `POST` | [`/api/chat`](#post-apichat) | none | Compare answers before vs after the knowledge is loaded |

**Models** — what this node serves over the LLM API, and the free trials of it — the public list, and the transcription and image routes a visitor can press without a key (the chat trial is Live test's)

| Method | Path | Auth | What it does |
|---|---|---|---|
| `GET` | [`/api/throughput/deposits/{txHash}`](#get-apithroughputdepositstxhash) | none | Check the signed-in wallet’s recorded deposit credit |
| `GET` | [`/api/models`](#get-apimodels) | operator | Configured models and current backend availability |
| `POST` | [`/api/transcribe`](#post-apitranscribe) | operator | Free transcription trial on a configured audio backend |
| `POST` | [`/api/image`](#post-apiimage) | operator | Free image-generation trial on a configured image backend |
| `POST` | [`/api/run`](#post-apirun) | operator | Run one script in the hosted-agent sandbox and stream its output |
| `POST` | [`/api/decide`](#post-apidecide) | operator | Free decision trial on a configured decision backend (Jev/SystemOne) |

**Teach** — one pipeline, two doors: a dataset file (uploaded here, or with `ainize teach dataset`) and corrections collected in Live test are both frozen into the same canonical dataset → validated → trained → checked on the live model → a lesson its teacher can keep private or publish as a credited data provider (no sign-in — every request is signed with a teaching key held by the browser or the CLI)

| Method | Path | Auth | What it does |
|---|---|---|---|
| `POST` | [`/api/patches/{id}/derive-intent`](#post-apipatchesidderive-intent) | teaching key | Say you are building on this knowledge, and get a token for its training set |
| `POST` | [`/api/patches/{id}/fork`](#post-apipatchesidfork) | teaching key | Copy this knowledge’s questions into your own training set |
| `GET` | [`/api/teach/policy`](#get-apiteachpolicy) | none | Teaching policy of this node (open / paused, queue, limits, measured timing, shares) |
| `GET` | [`/api/teach/samples`](#get-apiteachsamples) | none | Example datasets this node ships (ko-facts, en-facts, mixed) |
| `GET` | [`/api/teach/samples/{kind}`](#get-apiteachsampleskind) | none | Download an example dataset (.jsonl) |
| `POST` | [`/api/teach/datasets`](#post-apiteachdatasets) | teaching key | Create a dataset — upload a file, or freeze the questions collected in chat |
| `GET` | [`/api/teach/datasets`](#get-apiteachdatasets) | teaching key | My datasets (signed key) |
| `GET` | [`/api/teach/datasets/{id}`](#get-apiteachdatasetsid) | teaching key | One dataset |
| `PATCH` | [`/api/teach/datasets/{id}`](#patch-apiteachdatasetsid) | teaching key | Rename, change retention, or add / remove / replace questions |
| `DELETE` | [`/api/teach/datasets/{id}`](#delete-apiteachdatasetsid) | teaching key | Delete a dataset (the lessons trained from it are kept) |
| `GET` | [`/api/teach/datasets/{id}/rows`](#get-apiteachdatasetsidrows) | teaching key | The per-question report, paginated |
| `POST` | [`/api/teach/datasets/{id}/reparse`](#post-apiteachdatasetsidreparse) | teaching key | Read the SAME uploaded file again with different settings |
| `POST` | [`/api/teach/datasets/{id}/fork`](#post-apiteachdatasetsidfork) | teaching key | Copy a dataset (optionally with an edit) — how you change one while a lesson is training |
| `GET` | [`/api/teach/datasets/{id}/download`](#get-apiteachdatasetsiddownload) | teaching key | Download the questions (canonical .jsonl, or .csv) |
| `POST` | [`/api/teach/preflight`](#post-apiteachpreflight) | teaching key | Check what the model already knows (before queuing a lesson) |
| `POST` | [`/api/teach/merge/preview`](#post-apiteachmergepreview) | teaching key | What combining two knowledges would mean (design §9, §12.2) |
| `POST` | [`/api/teach/jobs`](#post-apiteachjobs) | teaching key | Queue a lesson (train the corrections into a knowledge file) |
| `GET` | [`/api/teach/jobs`](#get-apiteachjobs) | teaching key | My lessons (signed key) |
| `GET` | [`/api/teach/jobs/{id}`](#get-apiteachjobsid) | teaching key (optional) | Lesson status (poll every 5 s) |
| `DELETE` | [`/api/teach/jobs/{id}`](#delete-apiteachjobsid) | teaching key | Cancel / delete a lesson |
| `POST` | [`/api/teach/jobs/{id}/retry`](#post-apiteachjobsidretry) | teaching key | Improve & retry: queue a new lesson with edited corrections (same knowledge context) |
| `POST` | [`/api/teach/jobs/{id}/retrain`](#post-apiteachjobsidretrain) | teaching key | Train the same dataset again (or a fork of it) |
| `GET` | [`/api/teach/jobs/{id}/events`](#get-apiteachjobsidevents) | teaching key | This lesson’s log lines (poll every 2 s while it runs) |
| `POST` | [`/api/teach/jobs/{id}/recheck`](#post-apiteachjobsidrecheck) | teaching key | Measure again a lesson that was saved unchecked (model server was down, or the side-effect check was turned off) |
| `GET` | [`/api/teach/jobs/{id}/publish-challenge`](#get-apiteachjobsidpublish-challenge) | teaching key | What to sign before publishing |
| `POST` | [`/api/teach/jobs/{id}/publish`](#post-apiteachjobsidpublish) | teaching key | Publish the lesson through this node as a credited data provider |
| `POST` | [`/api/teach/jobs/{id}/save`](#post-apiteachjobsidsave) | teaching key | Keep it private: 7-day download links for the knowledge file, recipe.json and RUN-LOCALLY.md |
| `GET` | [`/api/teach/jobs/{id}/recipe`](#get-apiteachjobsidrecipe) | none | recipe.json (token link from save) |
| `GET` | [`/api/teach/jobs/{id}/local-run`](#get-apiteachjobsidlocal-run) | none | RUN-LOCALLY.md (token link from save) |
| `GET` | [`/api/teacher/{address}`](#get-apiteacheraddress) | none | Public data-provider page: lessons and earnings (owed / paid / pending from settle records) |

**Automatic payment & download** — the x402 flow and blob download

| Method | Path | Auth | What it does |
|---|---|---|---|
| `GET` | [`/x402/patch/{id}`](#get-x402patchid) | payment (x402) | Buy knowledge (x402) |
| `GET` | [`/p2p/datasets`](#get-p2pdatasets) | none | Training sets this node holds (sha256, rows, access, licence) |
| `GET` | [`/p2p/dataset/{sha256}`](#get-p2pdatasetsha256) | teaching key (optional) | Download a published training set (.jsonl) |
| `GET` | [`/p2p/dataset/{sha256}/manifest`](#get-p2pdatasetsha256manifest) | none | Manifest of a held training set |
| `GET` | [`/p2p/dataset/{sha256}/benchmark`](#get-p2pdatasetsha256benchmark) | none | The full benchmark list of a training set (the `answers_hash` preimage) |
| `GET` | [`/p2p/blob/{sha256}`](#get-p2pblobsha256) | teaching key (optional) + payment (x402) | Download the knowledge body (.npz) |
| `GET` | [`/api/patches/{id}/quote`](#get-apipatchesidquote) | none | What this purchase would cost — the item and the bases it needs |
| `GET` | [`/api/credit/{address}`](#get-apicreditaddress) | none | Where an address's local credit came from |

**Register & sell knowledge** — operator: register → announce → verified → sold

| Method | Path | Auth | What it does |
|---|---|---|---|
| `PATCH` | [`/api/patches/{id}`](#patch-apipatchesid) | operator | Edit a DRAFT |
| `DELETE` | [`/api/patches/{id}`](#delete-apipatchesid) | operator | Delete a DRAFT |
| `POST` | [`/api/patches`](#post-apipatches) | operator | Register knowledge (created as a DRAFT) |
| `POST` | [`/api/patches/{id}/announce`](#post-apipatchesidannounce) | operator | Announce — record on the ledger and request verification |
| `POST` | [`/api/patches/{id}/retire`](#post-apipatchesidretire) | operator | Retire — take your own published knowledge off sale for good |
| `POST` | [`/api/patches/{id}/verify`](#post-apipatchesidverify) | operator | Run and record verification on this node (verifier role) |
| `POST` | [`/api/patches/{id}/challenge`](#post-apipatchesidchallenge) | operator | Request re-verification (challenge) |

**Public record** — ledger, provenance graph, network

| Method | Path | Auth | What it does |
|---|---|---|---|
| `GET` | [`/api/patches/{id}/records`](#get-apipatchesidrecords) | none | Ledger records about this knowledge |
| `GET` | [`/api/ledger`](#get-apiledger) | none | Ledger records |
| `GET` | [`/api/ledger/verify`](#get-apiledgerverify) | none | Ledger integrity check |
| `GET` | [`/api/ledger/graph`](#get-apiledgergraph) | none | Sources → derivatives graph (+ AIN knowledge graph) |
| `GET` | [`/api/branches`](#get-apibranches) | none | Knowledge tracks (branches) |
| `GET` | [`/api/route`](#get-apiroute) | none | Find the branch and serving nodes for a context (e.g. jurisdiction=KR) |
| `GET` | [`/api/nodes`](#get-apinodes) | none | Known nodes and peers |
| `GET` | [`/api/events`](#get-apievents) | none | Node event log |
| `GET` | [`/api/docs`](#get-apidocs) | none | OpenAPI + CLI reference bundle for the web /docs page |
| `GET` | [`/api/patches/{id}/events`](#get-apipatchesidevents) | none | Node events about this knowledge (verification logs, sales, live tests) |
| `GET` | [`/api/openapi.json`](#get-apiopenapijson) | none | This document |
| `GET` | [`/healthz`](#get-healthz) | none | Liveness: 200 while the process is up |
| `GET` | [`/readyz`](#get-readyz) | none | Readiness: 200 when the ledger is reachable and, for a serving/verifier node, the runtime is available; 503 with the failing check otherwise |

**Organizations** — a team's page on this node — README, members and roles (read \< contributor \< write \< admin), invites and join requests, resource groups, audit log. Membership by explicit row, the sign-in's email domain, or a linked AIN SSO organization; the role decides what a member may do with the agents shared with it (`visibility: org`, `orgId`)

| Method | Path | Auth | What it does |
|---|---|---|---|
| `GET` | [`/api/orgs`](#get-apiorgs) | operator | The organizations the caller is in |
| `POST` | [`/api/orgs`](#post-apiorgs) | none | Create an organization |
| `GET` | [`/api/orgs/{id}`](#get-apiorgsid) | none | The organization page — members only |
| `PUT` | [`/api/orgs/{id}`](#put-apiorgsid) | none | Change settings — admin |
| `DELETE` | [`/api/orgs/{id}`](#delete-apiorgsid) | none | Delete — admin; refused while agents are shared with it (`has_agents`) |
| `GET` | [`/api/orgs/{id}/members`](#get-apiorgsidmembers) | none | Members and roles |
| `POST` | [`/api/orgs/{id}/members`](#post-apiorgsidmembers) | none | Add a member by principal — admin |
| `PUT` | [`/api/orgs/{id}/members/{principal}`](#put-apiorgsidmembersprincipal) | none | Change a member's role — admin; the last admin stays (`last_admin`) |
| `DELETE` | [`/api/orgs/{id}/members/{principal}`](#delete-apiorgsidmembersprincipal) | none | Remove a member (admin) or leave (anyone) |
| `POST` | [`/api/orgs/{id}/join`](#post-apiorgsidjoin) | none | Ask to join |
| `GET` | [`/api/orgs/{id}/requests`](#get-apiorgsidrequests) | none | Pending join requests — admin |
| `POST` | [`/api/orgs/{id}/requests/{principal}/approve`](#post-apiorgsidrequestsprincipalapprove) | none | Approve a request — admin |
| `DELETE` | [`/api/orgs/{id}/requests/{principal}`](#delete-apiorgsidrequestsprincipal) | none | Reject a request — admin |
| `GET` | [`/api/orgs/{id}/invites`](#get-apiorgsidinvites) | none | Open invites (token prefixes only) — admin |
| `POST` | [`/api/orgs/{id}/invites`](#post-apiorgsidinvites) | none | Make an invite link — admin |
| `DELETE` | [`/api/orgs/{id}/invites/{token}`](#delete-apiorgsidinvitestoken) | none | Revoke an invite — admin |
| `GET` | [`/api/orgs/join/{token}`](#get-apiorgsjointoken) | operator | What an invite leads to |
| `POST` | [`/api/orgs/join/{token}`](#post-apiorgsjointoken) | none | Accept an invite |
| `GET` | [`/api/orgs/{id}/groups`](#get-apiorgsidgroups) | none | Resource groups (all for write+, else the ones you are in) |
| `POST` | [`/api/orgs/{id}/groups`](#post-apiorgsidgroups) | none | Make a resource group — write |
| `PUT` | [`/api/orgs/{id}/groups/{groupId}`](#put-apiorgsidgroupsgroupid) | none | Change a resource group — write |
| `DELETE` | [`/api/orgs/{id}/groups/{groupId}`](#delete-apiorgsidgroupsgroupid) | none | Delete a resource group — write |
| `GET` | [`/api/orgs/{id}/audit`](#get-apiorgsidaudit) | none | Audit log — admin |
| `GET` | [`/api/orgs/{id}/billing`](#get-apiorgsidbilling) | none | Billing — admin |
| `GET` | [`/api/orgs/{id}/security`](#get-apiorgsidsecurity) | none | Security & SSO — admin |

**Agents** — the A2A agents this node lists and serves at `/agents/{id}`: the operator's config agents, agents the node runs, agents people linked by URL, and peers' agents — one catalogue, which AIN Teams imports from; `/api/shared-agents` is the same catalogue in the ain-integration contract 1.0 shape

| Method | Path | Auth | What it does |
|---|---|---|---|
| `GET` | [`/git/{id}.git/info/refs`](#get-gitidgitinforefs) | operator | Discover Git refs (smart HTTP) |
| `POST` | [`/git/{id}.git/git-upload-pack`](#post-gitidgitgit-upload-pack) | operator | Clone or fetch an agent repository |
| `POST` | [`/git/{id}.git/git-receive-pack`](#post-gitidgitgit-receive-pack) | operator | Push an agent repository and apply main |
| `GET` | [`/api/hosted-agents/{id}/executions`](#get-apihosted-agentsidexecutions) | operator | Read persisted runtime execution history |
| `GET` | [`/api/hosted-agents/{id}/commits`](#get-apihosted-agentsidcommits) | operator | Read commit history |
| `GET` | [`/api/hosted-agents/{id}/refs`](#get-apihosted-agentsidrefs) | operator | Read branches and clone URL |
| `GET` | [`/api/hosted-agents/{id}/tree`](#get-apihosted-agentsidtree) | operator | Read a file or paths at a ref |
| `GET` | [`/api/hosted-agents/{id}/diff`](#get-apihosted-agentsiddiff) | operator | Review a proposal diff |
| `POST` | [`/api/hosted-agents/{id}/forks`](#post-apihosted-agentsidforks) | operator | Create a private source fork |
| `GET` | [`/api/agent-forks`](#get-apiagent-forks) | operator | List your private repository forks |
| `DELETE` | [`/api/agent-forks/{id}`](#delete-apiagent-forksid) | operator | Delete your private source fork |
| `GET` | [`/api/hosted-agents/{id}/pulls`](#get-apihosted-agentsidpulls) | operator | List repository proposals |
| `POST` | [`/api/hosted-agents/{id}/pulls`](#post-apihosted-agentsidpulls) | operator | Open a branch or cross-repository proposal |
| `GET` | [`/api/hosted-agents/{id}/pulls/{number}`](#get-apihosted-agentsidpullsnumber) | operator | Read a proposal |
| `POST` | [`/api/hosted-agents/{id}/pulls/{number}/merge`](#post-apihosted-agentsidpullsnumbermerge) | operator | Validate and merge a proposal |
| `POST` | [`/api/hosted-agents/{id}/pulls/{number}/close`](#post-apihosted-agentsidpullsnumberclose) | operator | Close a proposal |
| `GET` | [`/api/hosted-agents/{id}/pulls/{number}/comments`](#get-apihosted-agentsidpullsnumbercomments) | operator | Read proposal review comments |
| `POST` | [`/api/hosted-agents/{id}/pulls/{number}/comments`](#post-apihosted-agentsidpullsnumbercomments) | operator | Add a general or source-anchored review comment |
| `PATCH` | [`/api/hosted-agents/{id}/pulls/{number}/comments/{comment}`](#patch-apihosted-agentsidpullsnumbercommentscomment) | operator | Edit your review comment |
| `DELETE` | [`/api/hosted-agents/{id}/pulls/{number}/comments/{comment}`](#delete-apihosted-agentsidpullsnumbercommentscomment) | operator | Remove a review comment |
| `GET` | [`/api/hosted-agents/{id}/mirror`](#get-apihosted-agentsidmirror) | operator | Read GitHub mirror state |
| `PUT` | [`/api/hosted-agents/{id}/mirror`](#put-apihosted-agentsidmirror) | operator | Attach an agent to a GitHub source |
| `DELETE` | [`/api/hosted-agents/{id}/mirror`](#delete-apihosted-agentsidmirror) | operator | Detach a GitHub mirror |
| `POST` | [`/api/hosted-agents/{id}/mirror/sync`](#post-apihosted-agentsidmirrorsync) | operator | Reconcile a GitHub mirror now |
| `POST` | [`/api/agent-mirrors/webhook`](#post-apiagent-mirrorswebhook) | operator | Reconcile mirrors after a signed GitHub push |
| `POST` | [`/api/hosted-agents/{id}/preview-runs/{run}/export`](#post-apihosted-agentsidpreview-runsrunexport) | operator | Export your proposal conversation |
| `DELETE` | [`/api/hosted-agents/{id}/preview-runs/{run}`](#delete-apihosted-agentsidpreview-runsrun) | operator | Delete your exported proposal conversation |
| `GET` | [`/api/hosted-agents/{id}/preview-runs`](#get-apihosted-agentsidpreview-runs) | operator | Read your persisted proposal conversations |
| `POST` | [`/api/hosted-agents/{id}/previews`](#post-apihosted-agentsidpreviews) | operator | Start an isolated proposal runtime at a fixed SHA |
| `GET` | [`/api/agent-previews/{preview}`](#get-apiagent-previewspreview) | operator | Read your temporary proposal runtime |
| `DELETE` | [`/api/agent-previews/{preview}`](#delete-apiagent-previewspreview) | operator | Stop your temporary proposal runtime |
| `POST` | [`/api/agent-previews/{preview}/rpc`](#post-apiagent-previewspreviewrpc) | operator | Talk to your proposal before merging |
| `GET` | [`/api/shared-agents`](#get-apishared-agents) | operator | Agents this node runs or proxies, in the cross-product registry shape (contract 1.0) |
| `PUT` | [`/api/shared-agents/{id}/visibility`](#put-apishared-agentsidvisibility) | none | Change who sees an agent (owner or organization admin, into organizations where they are contributor+; the node's operator anywhere) |
| `GET` | [`/api/agent-aliases/{name}`](#get-apiagent-aliasesname) | none | Resolve an agent alias (or id) to the agent's canonical id |
| `PUT` | [`/api/agents/{id}/alias`](#put-apiagentsidalias) | none | Give an agent a readable alias (replaces its current one) |
| `DELETE` | [`/api/agents/{id}/alias`](#delete-apiagentsidalias) | none | Remove an agent's alias |
| `GET` | [`/api/shared-agents/events`](#get-apishared-agentsevents) | operator | Changes to the shared agent registry since a cursor (contract 1.0) |
| `GET` | [`/api/agents`](#get-apiagents) | operator | The agent catalogue |
| `GET` | [`/api/linked-agents`](#get-apilinked-agents) | operator | Linked agents — external A2A agents people registered by URL |
| `POST` | [`/api/linked-agents`](#post-apilinked-agents) | none | Register an external A2A agent |
| `GET` | [`/api/linked-agents/{id}`](#get-apilinked-agentsid) | none | One linked agent — the owner sees the upstream too; anyone it is visible to sees the listing view; 404 otherwise |
| `PUT` | [`/api/linked-agents/{id}`](#put-apilinked-agentsid) | none | Change a linked agent — owner only; the id cannot change |
| `DELETE` | [`/api/linked-agents/{id}`](#delete-apilinked-agentsid) | none | Remove a linked agent — its registrant, or an admin of the organization it is shared with |
| `GET` | [`/api/agent-archives`](#get-apiagent-archives) | none | List your privately retained deleted agents |
| `GET` | [`/api/agent-archives/{id}`](#get-apiagent-archivesid) | none | Read your archived spec, reviews and execution evidence |
| `DELETE` | [`/api/agent-archives/{id}`](#delete-apiagent-archivesid) | none | Permanently remove an exported archive |
| `POST` | [`/api/agent-archives/{id}/restore`](#post-apiagent-archivesidrestore) | none | Restore your deleted agent at the same address |
| `POST` | [`/api/agent-archives/{id}/export`](#post-apiagent-archivesidexport) | none | Download your complete deleted-agent archive |
| `GET` | [`/api/hosted-agents`](#get-apihosted-agents) | operator | Hosted agents — agents this node runs |
| `POST` | [`/api/hosted-agents`](#post-apihosted-agents) | none | Create a hosted agent |
| `GET` | [`/api/hosted-agents/{id}`](#get-apihosted-agentsid) | none | One hosted agent — its owner and `write` members of the organization it is shared with see the whole spec (prompt, files, secret names); anyone else it is visible to sees the listing view; 404 otherwise |
| `PUT` | [`/api/hosted-agents/{id}`](#put-apihosted-agentsid) | none | Change a hosted agent — its owner, or a `write` member of the organization it is shared with; only the owner or an organization `admin` may change `visibility`/`orgId` (sharing into an organization takes `contributor` there); the id cannot change |
| `DELETE` | [`/api/hosted-agents/{id}`](#delete-apihosted-agentsid) | none | Remove a hosted agent — its owner, or an `admin` of the organization it is shared with |
| `PUT` | [`/api/hosted-agents/{id}/secrets/{name}`](#put-apihosted-agentsidsecretsname) | none | Set (`{ value }`) or clear (`{ value: null }`) a secret — owner or `write` member of its organization; write-only |
| `GET` | [`/agents/{id}/.well-known/agent-card.json`](#get-agentsidwell-knownagent-cardjson) | operator | Read the A2A card; bound AINFT agents advertise current-holder authentication |
| `POST` | [`/agents/{id}`](#post-agentsid) | none | Call an A2A agent; a bound AINFT executes in the current holder’s private workspace |
| `GET` | [`/api/hosted-agents/{id}/ainft-binding`](#get-apihosted-agentsidainft-binding) | operator | Read the verified AINFT registration snapshot for a visible agent |
| `POST` | [`/api/hosted-agents/{id}/ainft-binding`](#post-apihosted-agentsidainft-binding) | none | Verify Factory wallet indexing and persist a token binding — agent creator only |
| `GET` | [`/api/hosted-agents/{id}/holder-access`](#get-apihosted-agentsidholder-access) | none | Check the signed-in native wallet against current on-chain AINFT ownership |
| `GET` | [`/api/hosted-agents/{id}/companion`](#get-apihosted-agentsidcompanion) | none | Read the current holder’s private persisted tasks, memories and activity experience |
| `POST` | [`/api/hosted-agents/{id}/companion/tasks`](#post-apihosted-agentsidcompaniontasks) | none | Queue idempotent private chat or work; body: key, kind (chat/task), input |
| `POST` | [`/api/hosted-agents/{id}/companion/tasks/{taskId}/cancel`](#post-apihosted-agentsidcompaniontaskstaskidcancel) | none | Cancel queued work; already running work cannot claim safe cancellation |
| `POST` | [`/api/hosted-agents/{id}/companion/memories`](#post-apihosted-agentsidcompanionmemories) | none | Propose private memory from a completed task; body: sourceTask, text |
| `POST` | [`/api/hosted-agents/{id}/ainft-community`](#post-apihosted-agentsidainft-community) | none | Creator configures the existing Factory community and credit symbol for the current bound release. Body: expectedVersion, community:{appId,symbol} or null to disconnect. Persists a monotonically increasing configuration version; stale saves fail. Does not create balances, award credits or purchase benefits. |
| `GET` | [`/api/hosted-agents/{id}/companion/credits`](#get-apihosted-agentsidcompanioncredits) | none | Current holder reads the configured Factory credit community, binding chain and configuration version; no-store. Wallet-signed Factory auth/user and credit/balance reads independently verify the user-to-wallet mapping and balance. No purchase or reward is performed. |
| `POST` | [`/api/hosted-agents/{id}/companion/learning/examples`](#post-apihosted-agentsidcompanionlearningexamples) | none | Save a holder-reviewed private question and answer sourced from approved memory; body: key, memoryId, prompt (up to 400 characters), answer (up to 200), optional altPrompt (a different reviewed evaluation question, up to 400), consent:true. Training requires altPrompt for every selected example. Does not start training or publish data. Read examples through the companion workspace. |
| `GET` | [`/api/hosted-agents/{id}/companion/learning`](#get-apihosted-agentsidcompanionlearning) | none | Read exact-model local training capability and this holder’s persisted training jobs; no-store. Job status is read from TeachWorker. |
| `GET` | [`/api/hosted-agents/{id}/companion/learning/runs/{runId}/publication-challenge`](#get-apihosted-agentsidcompanionlearningrunsrunidpublication-challenge) | none | Get the existing Teach signed publication claim for this holder’s READY lesson. Source examples must still be approved. This companion flow publishes a free knowledge patch, keeps dataset rows private and takes no payout share. |
| `POST` | [`/api/hosted-agents/{id}/companion/learning/runs/{runId}/publish`](#post-apihosted-agentsidcompanionlearningrunsrunidpublish) | none | Submit a private lesson for shared publication using TeachWorker’s signature verification and operator review policy. Body: key, name, description?, license, claim_sig, consent:{permanent:true,rights:true}. Publication intent persists before submission; unknown outcomes are never replayed. Free patch, private dataset, no payout share. Submission is not proof of announcement or a credit reward. |
| `POST` | [`/api/hosted-agents/{id}/companion/learning/select`](#post-apihosted-agentsidcompanionlearningselect) | none | Choose a READY private lesson for subsequent holder conversations, or runId:null to restore base behavior; body: key, runId, model, consent:true. Each local model call applies the chosen lesson under an exclusive lease and restores all journaled rows afterwards. Missing or failed cleanup blocks shared generation. Revoked examples and changed releases invalidate the selection; prior lessons never become active automatically. |
| `POST` | [`/api/hosted-agents/{id}/companion/learning/train`](#post-apihosted-agentsidcompanionlearningtrain) | none | Submit reviewed examples to real compatible TeachWorker; body: key, exampleIds[], model, consent:true. Does not publish or permanently apply the draft. Training may record wallet address, state and dataset hash on the configured chain. Unknown submissions are never replayed. |
| `POST` | [`/api/hosted-agents/{id}/companion/learning/examples/{exampleId}/withdraw`](#post-apihosted-agentsidcompanionlearningexamplesexampleidwithdraw) | none | Withdraw a private learning example. Revoking its source memory also withdraws it. Does not claim to undo an already trained model. |
| `POST` | [`/api/hosted-agents/{id}/companion/memories/{memoryId}/revoke`](#post-apihosted-agentsidcompanionmemoriesmemoryidrevoke) | none | Withdraw approved private memory from future memory context; existing conversation records remain |
| `POST` | [`/api/hosted-agents/{id}/companion/memories/{memoryId}/decision`](#post-apihosted-agentsidcompanionmemoriesmemoryiddecision) | none | Approve or reject private memory; body: approve boolean |
| `GET` | [`/api/hosted-agents/{id}/ainft-metadata`](#get-apihosted-agentsidainft-metadata) | operator | Export wallet-compatible native AINFT metadata; does not mint or register a token |
| `GET` | [`/api/ainft/avatar.svg`](#get-apiainftavatarsvg) | operator | Public default avatar for Ainize AINFT metadata |
| `GET` | [`/api/hosted-agents/{id}/logs`](#get-apihosted-agentsidlogs) | none | Recent log lines — owner or `write` member of its organization |

**Projects** — a deployment bound to a git repository that lives in an aindrive drive (`https://aindrive.ainetwork.ai/<org>/git/<repo>`) — ainize keeps no repository; aindrive calls the push hook, the node clones that commit and runs it (docs/PROJECTS.md)

| Method | Path | Auth | What it does |
|---|---|---|---|
| `GET` | [`/api/projects/{id}/source`](#get-apiprojectsidsource) | operator | Read the manifest from an immutable execution source |
| `POST` | [`/api/projects/{id}/ax-runs`](#post-apiprojectsidax-runs) | operator | Create an AX run awaiting signed approval |
| `POST` | [`/api/projects/{id}/deployments/{deploymentId}/ax-approval`](#post-apiprojectsiddeploymentsdeploymentidax-approval) | operator | Verify a run-scoped SSO delegation and enqueue the AX run |
| `POST` | [`/api/projects/{id}/deployments/{deploymentId}/ax-data/key`](#post-apiprojectsiddeploymentsdeploymentidax-datakey) | operator | AX data key |
| `POST` | [`/api/projects/{id}/deployments/{deploymentId}/ax-data/grants`](#post-apiprojectsiddeploymentsdeploymentidax-datagrants) | operator | AX data grants |
| `POST` | [`/api/projects/{id}/deployments/{deploymentId}/ax-data/revoke`](#post-apiprojectsiddeploymentsdeploymentidax-datarevoke) | operator | AX data revoke |
| `POST` | [`/api/projects/{id}/deployments/{deploymentId}/ax-data/ready`](#post-apiprojectsiddeploymentsdeploymentidax-dataready) | operator | AX data ready |
| `GET` | [`/api/ax/runs/{deploymentId}/data/{grantId}/files/{referenceId}`](#get-apiaxrunsdeploymentiddatagrantidfilesreferenceid) | operator | Read an admitted AinDrive file from an AX workload |
| `POST` | [`/api/ax/runs/{deploymentId}/v1/chat/completions`](#post-apiaxrunsdeploymentidv1chatcompletions) | operator | Invoke a delegated model from an authenticated AX workload |
| `GET` | [`/api/projects`](#get-apiprojects) | operator | The caller's projects |
| `POST` | [`/api/projects`](#post-apiprojects) | operator | Bind an aindrive git repository as a project |
| `GET` | [`/api/projects/{id}/domains`](#get-apiprojectsiddomains) | none | List app domains and required DNS records (project owner only) |
| `POST` | [`/api/projects/{id}/domains`](#post-apiprojectsiddomains) | none | Claim a custom domain for a web app (project owner only) |
| `GET` | [`/api/projects/{id}/app-login`](#get-apiprojectsidapp-login) | none | Sign in to an org-private app on its own domain (the member gate) |
| `PATCH` | [`/api/projects/{id}/domains/default`](#patch-apiprojectsiddomainsdefault) | none | Change the automatically assigned app address (project owner only) |
| `POST` | [`/api/projects/{id}/domains/{hostname}/check`](#post-apiprojectsiddomainshostnamecheck) | none | Recheck app domain DNS (project owner only) |
| `DELETE` | [`/api/projects/{id}/domains/{hostname}`](#delete-apiprojectsiddomainshostname) | none | Remove a custom domain (project owner only) |
| `GET` | [`/api/projects/by-repo`](#get-apiprojectsby-repo) | operator | The project bound to a repository (what aindrive's UI shows next to a repo) |
| `GET` | [`/api/projects/by-name`](#get-apiprojectsby-name) | operator | The project at `/<org>/<repo>` — the page's own lookup |
| `GET` | [`/api/orgs/{org}/projects`](#get-apiorgsorgprojects) | operator | Every project of an organization slug — the `/<org>` page |
| `GET` | [`/api/orgs/{org}/repositories`](#get-apiorgsorgrepositories) | operator | The organization's drive `repositories/` folder as aindrive lists it (so `/<org>` shows a repo before its first push) |
| `GET` | [`/api/projects/{id}`](#get-apiprojectsid) | operator | One project — the view for whoever may see it, `owner` and `hookUrl` for its owner |
| `DELETE` | [`/api/projects/{id}`](#delete-apiprojectsid) | operator | Remove a project with its deployments, logs and secrets (owner only) |
| `GET` | [`/api/projects/{id}/secrets`](#get-apiprojectsidsecrets) | operator | A project's secrets — names and when each was set, never values (owner or org writer) |
| `PUT` | [`/api/projects/{id}/secrets/{name}`](#put-apiprojectsidsecretsname) | operator | Set or replace one project secret (owner or org writer) |
| `DELETE` | [`/api/projects/{id}/secrets/{name}`](#delete-apiprojectsidsecretsname) | operator | Remove one project secret (owner or org writer) |
| `PATCH` | [`/api/projects/{id}/rotate-secret`](#patch-apiprojectsidrotate-secret) | operator | A new webhook secret, shown once (owner only) |
| `GET` | [`/api/projects/{id}/runs`](#get-apiprojectsidruns) | operator | Ad-hoc runs of a script project, newest first (readable as the project is) |
| `POST` | [`/api/projects/{id}/runs`](#post-apiprojectsidruns) | operator | Run the branch's HEAD now, with your entry, inputs and env — owner or a member of the repository's organization |
| `POST` | [`/api/deployments/{id}/redeploy`](#post-apideploymentsidredeploy) | operator | Deploy this commit again (Redeploy; a service's roll-back to this one) — owner or organization member |
| `POST` | [`/api/projects/{id}/hook`](#post-apiprojectsidhook) | operator | The push webhook aindrive calls after a successful git-receive-pack |
| `GET` | [`/api/projects/{id}/deployments`](#get-apiprojectsiddeployments) | operator | A project's deployments (pushes and redeploys), newest first — readable as the project is |
| `GET` | [`/api/deployments/{id}`](#get-apideploymentsid) | operator | One deployment or run (readable as its project is) |
| `POST` | [`/api/projects/{id}/run`](#post-apiprojectsidrun) | operator | Stream a selected repository version for the viewer |
| `POST` | [`/api/projects/{id}/redeploy`](#post-apiprojectsidredeploy) | operator | Deploy the project's newest commit again (owner only) |
| `GET` | [`/api/ainui/snippet`](#get-apiainuisnippet) | operator | The AIN-UI link snippet of a project page URL (what a chat shows when the URL is pasted) |
| `GET` | [`/api/deployments/{id}/log`](#get-apideploymentsidlog) | operator | The captured log: text once over, SSE (`log` chunks, then `done`) while queued or building |
| `GET` | [`/api/deployments/{id}/output`](#get-apideploymentsidoutput) | operator | The script's stdout alone, for a ready deployment |
| `GET` | [`/api/projects/{id}/requests`](#get-apiprojectsidrequests) | operator | What visitors asked the running app through this node (owner or member) |
| `GET` | [`/api/projects/{id}/runtime-logs`](#get-apiprojectsidruntime-logs) | operator | The running service's own stdout/stderr, wherever it was placed (owner or member) |
| `GET` | [`/svc/{projectId}/{path}`](#get-svcprojectidpath) | operator | A project's running service or Next.js container (any method) |

**Operator** — wallet, settings, purchases, branches, peers, chain, drive

| Method | Path | Auth | What it does |
|---|---|---|---|
| `GET` | [`/api/ax`](#get-apiax) | operator | Check Google AX connectivity and configured atespace |
| `GET` | [`/api/ax/tasks`](#get-apiaxtasks) | operator | List AX tasks |
| `POST` | [`/api/ax/tasks`](#post-apiaxtasks) | operator | Create an AX Task |
| `GET` | [`/api/ax/tasks/{name}`](#get-apiaxtasksname) | operator | Read an AX Task |
| `DELETE` | [`/api/ax/tasks/{name}`](#delete-apiaxtasksname) | operator | Delete an AX Task |
| `GET` | [`/api/ax/workspaces`](#get-apiaxworkspaces) | operator | List AX workspaces |
| `POST` | [`/api/ax/workspaces`](#post-apiaxworkspaces) | operator | Upsert an AX Workspace |
| `GET` | [`/api/ax/workspaces/{name}`](#get-apiaxworkspacesname) | operator | Read an AX Workspace |
| `DELETE` | [`/api/ax/workspaces/{name}`](#delete-apiaxworkspacesname) | operator | Delete an AX Workspace |
| `GET` | [`/api/ax/models`](#get-apiaxmodels) | operator | List AX models |
| `POST` | [`/api/ax/models`](#post-apiaxmodels) | operator | Upsert an AX Model |
| `GET` | [`/api/ax/models/{name}`](#get-apiaxmodelsname) | operator | Read an AX Model |
| `DELETE` | [`/api/ax/models/{name}`](#delete-apiaxmodelsname) | operator | Delete an AX Model |
| `POST` | [`/api/ax/tasks/{name}/suspend`](#post-apiaxtasksnamesuspend) | operator | suspend an AX task |
| `POST` | [`/api/ax/tasks/{name}/resume`](#post-apiaxtasksnameresume) | operator | resume an AX task |
| `GET` | [`/api/ax/tasks/{name}/egress`](#get-apiaxtasksnameegress) | operator | Read the AX task actor egress policy |
| `PUT` | [`/api/ax/tasks/{name}/egress`](#put-apiaxtasksnameegress) | operator | Create or conditionally replace the AX task actor egress policy |
| `GET` | [`/api/ax/tasks/{name}/runs/{runId}`](#get-apiaxtasksnamerunsrunid) | operator | Inspect an AX command result |
| `GET` | [`/api/ax/tasks/{name}/runs/{runId}/output/{stream}`](#get-apiaxtasksnamerunsrunidoutputstream) | operator | Read bounded AX command output |
| `GET` | [`/api/ax/tenants`](#get-apiaxtenants) | operator | List registered AX tenant bindings |
| `POST` | [`/api/ax/tenants`](#post-apiaxtenants) | operator | Register an immutable SSO organization runtime binding |
| `GET` | [`/api/ax/tenants/audit`](#get-apiaxtenantsaudit) | operator | Read AX tenant registry audit events |
| `GET` | [`/api/ax/tenants/{id}`](#get-apiaxtenantsid) | operator | Read an AX tenant binding |
| `PATCH` | [`/api/ax/tenants/{id}`](#patch-apiaxtenantsid) | operator | Activate or disable an AX tenant binding |
| `POST` | [`/api/ax/tenants/{id}/projects`](#post-apiaxtenantsidprojects) | operator | Bind a provider project to an AX tenant |
| `GET` | [`/api/me/teach/policy`](#get-apimeteachpolicy) | operator | Teaching policy (overrides + effective + trainer state) |
| `PATCH` | [`/api/me/teach/policy`](#patch-apimeteachpolicy) | operator | Change the teaching policy (persisted in the node store) |
| `GET` | [`/api/me/teach/datasets`](#get-apimeteachdatasets) | operator | What visitors uploaded to this machine (moderation view) |
| `GET` | [`/api/me/teach/jobs`](#get-apimeteachjobs) | operator | All lessons (with contributor and IP) |
| `POST` | [`/api/me/teach/jobs/{id}/approve`](#post-apimeteachjobsidapprove) | operator | Approve a lesson in review → announce |
| `POST` | [`/api/me/teach/jobs/{id}/reject`](#post-apimeteachjobsidreject) | operator | Decline a lesson in review (reason is shown to the contributor) |
| `POST` | [`/api/me/teach/jobs/{id}/cancel`](#post-apimeteachjobsidcancel) | operator | Cancel a lesson |
| `GET` | [`/api/me/teach/contributors`](#get-apimeteachcontributors) | operator | Contributors seen on this node |
| `POST` | [`/api/me/teach/contributors/{address}`](#post-apimeteachcontributorsaddress) | operator | Hide / show a contributor name |
| `GET` | [`/api/me/teach/bans`](#get-apimeteachbans) | operator | Blocked keys / IPs |
| `POST` | [`/api/me/teach/bans`](#post-apimeteachbans) | operator | Block a key or IP |
| `DELETE` | [`/api/me/teach/bans/{id}`](#delete-apimeteachbansid) | operator | Unblock |
| `POST` | [`/api/patches/{id}/buy-review`](#post-apipatchesidbuy-review) | operator | Review the exact purchase family and per-currency maximums without purchasing |
| `POST` | [`/api/patches/{id}/buy-reviewed`](#post-apipatchesidbuy-reviewed) | operator | Execute an exact reviewed purchase with a durable request identifier |
| `GET` | [`/api/purchases/requests/{id}`](#get-apipurchasesrequestsid) | operator | Read this operator’s saved purchase request without resubmitting |
| `GET` | [`/api/purchases/requests/{id}/reconciliation`](#get-apipurchasesrequestsidreconciliation) | operator | Inspect request-specific payment evidence and current selected files without resubmitting |
| `POST` | [`/api/patches/{id}/buy`](#post-apipatchesidbuy) | operator | Buy as this node (x402 handled automatically) |
| `POST` | [`/api/patches/{id}/collect-reviewed`](#post-apipatchesidcollect-reviewed) | operator | Collect the exact selected file without submitting an unresolved payment |
| `POST` | [`/api/patches/{id}/collect`](#post-apipatchesidcollect) | operator | Recover a purchased file or an unresolved recorded payment |
| `GET` | [`/api/me/pending-payments`](#get-apimepending-payments) | operator | Unresolved recorded payment requests |
| `GET` | [`/api/patches/{id}/apply-preview`](#get-apipatchesidapply-preview) | operator | Review the complete model load plan before applying |
| `POST` | [`/api/patches/{id}/apply`](#post-apipatchesidapply) | operator | Load into the model (with everything it was trained on top of) |
| `DELETE` | [`/api/patches/{id}/apply`](#delete-apipatchesidapply) | operator | Unload from the model (journal replay) |
| `POST` | [`/api/patches/{id}/remove`](#post-apipatchesidremove) | operator | Unload from the model (same as DELETE …/apply) |
| `GET` | [`/api/patches/{id}/check`](#get-apipatchesidcheck) | operator | Are the rows this knowledge was trained on the ones on the table right now? |
| `POST` | [`/api/patches/{id}/forget`](#post-apipatchesidforget) | operator | Delete this node's copy of the knowledge file. NOT a takedown — the listing stays and the gateway keeps charging; POST /api/patches/{id}/retire is the takedown. 409 with `also_affects` when other items share the same file — repeat with `{"all_sharing": true}` to stop serving all of them |
| `GET` | [`/api/ledger/inference`](#get-apiledgerinference) | operator | Read native inference batch submissions and local receipts |
| `POST` | [`/api/branches`](#post-apibranches) | operator | Create or replace an owned branch (legacy) |
| `POST` | [`/api/branches/create`](#post-apibranchescreate) | operator | Create a new track without replacing an existing name |
| `POST` | [`/api/branches/{name}/review`](#post-apibranchesnamereview) | operator | Review track spending and the model transition without executing it |
| `POST` | [`/api/branches/{name}/subscribe`](#post-apibranchesnamesubscribe) | operator | Subscribe to a track: buy its current knowledge, load it, and keep it up to date |
| `POST` | [`/api/branches/{name}/quote`](#post-apibranchesnamequote) | operator | What subscribing to a track would spend, item by item, before anything is spent |
| `POST` | [`/api/branches/{name}/sync`](#post-apibranchesnamesync) | operator | Bring a subscribed track up to date now |
| `GET` | [`/api/me/wallet`](#get-apimewallet) | operator | Wallet: balance, sales, creator revenue share, pending payouts |
| `GET` | [`/api/me/payouts`](#get-apimepayouts) | operator | Royalty payouts this node owes creators and data providers (AIN ledger) |
| `POST` | [`/api/me/payouts/{id}/retry`](#post-apimepayoutsidretry) | operator | Retry one failed / pending payout now (also after the 20 automatic attempts) |
| `GET` | [`/api/me/patches`](#get-apimepatches) | operator | Knowledge I registered |
| `GET` | [`/api/me/purchases`](#get-apimepurchases) | operator | Latest stored purchase or download per knowledge item |
| `GET` | [`/api/me/settings`](#get-apimesettings) | operator | Read settings |
| `PATCH` | [`/api/me/settings`](#patch-apimesettings) | operator | Change settings |
| `GET` | [`/api/chain`](#get-apichain) | none | Ledger / chain state and balance |
| `GET` | [`/api/drive`](#get-apidrive) | none | aindrive state and file list |
| `POST` | [`/api/drive`](#post-apidrive) | operator | aindrive start / stop / sync |
| `GET` | [`/api/auth/me`](#get-apiauthme) | none | Who am I — `signedIn` + `subject` is a name, `isOwner` + `scope` is what it permits; `sso` is an AIN SSO session, `site` a Google account the site vouches for (x-ainize-site-subject) |
| `POST` | [`/api/auth/challenge`](#post-apiauthchallenge) | none | A single-use nonce to sign for sign-in — `scheme` picks the signing rules and is fixed from here on |
| `POST` | [`/api/auth/wallet`](#post-apiauthwallet) | none | Sign in by signature, under the scheme the challenge was issued for — open to any address; owning the node is a separate question |
| `POST` | [`/api/auth/enroll`](#post-apiauthenroll) | none | Become an owner of this node and sign in — needs the machine itself (loopback or x-setup-token) and a signature from the address |
| `GET` | [`/api/auth/owners`](#get-apiauthowners) | none | Who owns this node — its own key, the config list, and grants made from a browser |
| `POST` | [`/api/auth/owners`](#post-apiauthowners) | none | Grant ownership to an address (an owner vouches; no signature from the address) |
| `DELETE` | [`/api/auth/owners/{address}`](#delete-apiauthownersaddress) | none | Revoke a granted ownership, ending that address's sessions |
| `POST` | [`/api/auth/device`](#post-apiauthdevice) | none | Request wallet approval for a node link or explicit CLI delegation |
| `GET` | [`/api/auth/device/{code}`](#get-apiauthdevicecode) | none | What is being authorised, for the page that shows it — including the exact message the wallet will sign |
| `POST` | [`/api/auth/device/{code}/approve`](#post-apiauthdevicecodeapprove) | none | Approve it: one wallet signature (eip191) over the message the node issued, from the address that is signed in |
| `POST` | [`/api/auth/device/{code}/claim`](#post-apiauthdevicecodeclaim) | none | The CLI collecting its session — single use, and needs the poll secret it never printed |
| `POST` | [`/api/my/nodes/heartbeat`](#post-apimynodesheartbeat) | none | Report a linked node online using its dedicated node-link Bearer token |
| `DELETE` | [`/api/my/nodes/{address}`](#delete-apimynodesaddress) | none | Disconnect one node from the signed-in wallet without stopping its process |
| `GET` | [`/api/my/nodes`](#get-apimynodes) | none | Nodes linked to the signed-in wallet, including this node when operated by that wallet |
| `GET` | [`/api/auth/bindings`](#get-apiauthbindings) | none | Every key that acts as you, and which one is acting now |
| `DELETE` | [`/api/auth/bindings/{delegate}`](#delete-apiauthbindingsdelegate) | none | End one, and the sessions it collected |
| `POST` | [`/api/auth/logout`](#post-apiauthlogout) | none | Log out |
| `POST` | [`/api/branches/{name}/patches/review`](#post-apibranchesnamepatchesreview) | operator | Review adding knowledge to an owned active track |
| `POST` | [`/api/branches/{name}/patches`](#post-apibranchesnamepatches) | operator | Add knowledge to a branch (owner only) |
| `POST` | [`/api/branches/{name}/unsubscribe`](#post-apibranchesnameunsubscribe) | operator | Stop a subscription and clean up its owned model layers |
| `GET` | [`/api/runtime`](#get-apiruntime) | none | Serving runtime state (model, hook, the ordered stack of loaded knowledge) |
| `GET` | [`/api/runtime/stack`](#get-apiruntimestack) | none | The ordered stack loaded in the serving model |
| `GET` | [`/api/runtime/jobs`](#get-apiruntimejobs) | operator | Recent runtime jobs |
| `GET` | [`/api/runtime/jobs/capabilities`](#get-apiruntimejobscapabilities) | operator | Runtime job recovery capabilities |
| `GET` | [`/api/runtime/jobs/{id}`](#get-apiruntimejobsid) | operator | A queued apply/remove |
| `POST` | [`/api/runtime/complete`](#post-apiruntimecomplete) | operator | Raw completion on the serving model (try the model) |
| `POST` | [`/api/peers`](#post-apipeers) | operator | Add a peer |
| `DELETE` | [`/api/peers`](#delete-apipeers) | operator | Remove a peer |
| `POST` | [`/api/chain/setup`](#post-apichainsetup) | operator | Create the knowledge app on the AIN chain, set market rules, stake (AIN ledger only) |
| `GET` | [`/api/drive/changes`](#get-apidrivechanges) | none | Change history of a drive file (aindrive Willow store) |

**P2P** — node-to-node protocol

| Method | Path | Auth | What it does |
|---|---|---|---|
| `POST` | [`/p2p/hello`](#post-p2phello) | teaching key (optional) | Peer introduction (exchange PeerInfo) |
| `GET` | [`/p2p/payouts/{hash}`](#get-p2ppayoutshash) | none | What this node did about one settlement's royalties |
| `GET` | [`/p2p/peers`](#get-p2ppeers) | none | Peer list for peer exchange |
| `GET` | [`/p2p/blobs`](#get-p2pblobs) | none | Knowledge bodies held by this node (sha256 list) |
| `GET` | [`/p2p/info`](#get-p2pinfo) | none | Node info |
| `GET` | [`/p2p/records`](#get-p2precords) | none | Ledger record sync (local-ledger mode) |
| `POST` | [`/p2p/records`](#post-p2precords) | none | Push records |

## Find knowledge

catalog, detail, same-subject listings (no auth)

### `GET /api/info`

Node, ledger and runtime summary

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | summary | `object` |

**`200` response body**

| Field | Type | Description |
|---|---|---|
| `node` | `object` |   |
| `ledger` | `object` |   |
| `runtime` | `object` |   |
| `quorum` | `integer` |   |
| `currency` | `string` |   |
| `peers` | `integer` |   |
| `initial_credit` | `string` |   |
| `royalty_share` | `number` | lineage share of each sale distributed to source creators |
| `accepts_contributions` | `boolean` | visitors may teach and publish knowledge through this node as data providers |
| `contributor_share` | `number` | default data-provider share of the seller remainder |
| `counts` | `object` |   |

### `GET /api/catalog`

List knowledge

**Auth** — none

**Parameters**

| Name | In | Type | Default | Description |
|---|---|---|---|---|
| `sort` | `query` | `"latest"` \| `"popular"` \| `"price"` \| `"rows"` |   |   |
| `status` | `query` | `string` |   | comma-separated (e.g. VERIFIED,SUPERSEDED) |
| `model` | `query` | `string` |   |   |
| `schema` | `query` | `string` |   |   |
| `q` | `query` | `string` |   |   |
| `author` | `query` | `string` |   | creator node address |
| `branch` | `query` | `string` |   |   |
| `contributor` | `query` | `string` |   | data-provider address — knowledge taught by this address (anchor.contributors[].address) |
| `origin` | `query` | `"operator"` \| `"teach"` |   |   |
| `limit` | `query` | `integer` | `50` |   |
| `offset` | `query` | `integer` | `0` |   |
| `include_drafts` | `query` | `boolean` | `false` | operator only — include private drafts (taught lessons not yet published) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | list | `object` |

**`200` response body**

| Field | Type |
|---|---|
| `total` | `integer` |
| `items` | [`CatalogEntry`](./schemas.md#catalogentry)[] |
| `models` | `string`[] |
| `schemas` | `string`[] |

### `GET /api/patches/{id}`

Knowledge detail (verifications, sources/derivatives, overlap check)

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | detail | [`CatalogEntry`](./schemas.md#catalogentry) |
| `404` | not found |   |

### `GET /api/patches/{id}/dataset`

The training set behind this knowledge (questions, access, licence, 20-question preview)

The questions a knowledge was taught from (lineage design §6.1). `public`: anyone. `derivative`: a teaching key sees this summary and gets the bytes through a derive intent. `private`: refused — only the verification questions on the record are public. The owner (the credited teaching key) and the operator always see it.

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | training set | `object` |
| `403` | dataset_private \| dataset_derivative_only |   |
| `404` | dataset_unavailable — no node here holds the bytes |   |

**`200` response body**

| Field | Type | Description |
|---|---|---|
| `sha256` | `string` |   |
| `rows` | `integer` |   |
| `access` | `"public"` \| `"derivative"` \| `"private"` |   |
| `license` | `string` \| `null` |   |
| `parents` | `object`[] |   |
| `parents[].patch_id` | `string` |   |
| `parents[].sha256` | `string` |   |
| `parents[].rows` | `integer` |   |
| `held` | `boolean` |   |
| `include_notes` | `boolean` |   |
| `benchmark_samples` | `integer` \| `null` |   |
| `merkle_root` | `string` \| `null` |   |
| `preview` | [`CanonicalRow`](./schemas.md#canonicalrow)[] | (at most 20 items) |

### `GET /api/patches/{id}/dataset/rows`

Download the training set (.jsonl, canonical bytes)

Public sets, and the owner/operator. A `derivative` set is fetched with a derive token from `/p2p/dataset/{sha256}`. The bytes hash to the `sha256` on the record.

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Responses**

| Code | Description |
|---|---|
| `200` | application/x-ndjson |
| `403` | dataset_private \| dataset_derivative_only |
| `404` | dataset_unavailable |

### `GET /api/patches/{id}/dataset/manifest`

What the training set is made of (row origin, benchmark hash, merkle root, PII scan, declaration)

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | manifest | `object` |
| `403` | dataset_private \| dataset_derivative_only |   |
| `404` | dataset_unavailable |   |

### `GET /api/patches/{id}/tree`

The family tree — what this was built on, what was built on it, and what each one added

Lineage design §12.5. Ancestors through `parents[]`, descendants through the catalog, versions through supersede records. Cycle-safe, depth-capped (≤ 8), and a knowledge this caller may not see (a private draft, a test anchor) comes back as `{ missing: true }` rather than a hole. Read-only: it is not gated by `teach.lineage`.

**Auth** — none

**Parameters**

| Name | In | Type | Required | Default |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `depth` | `query` | `integer` |   | `4` |
| `dir` | `query` | `"up"` \| `"down"` \| `"both"` |   | `"both"` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | tree | `object` |
| `404` | patch not found |   |

**`200` response body**

| Field | Type | Description |
|---|---|---|
| `root` | `string` |   |
| `depth` | `integer` |   |
| `truncated` | `boolean` |   |
| `nodes` | `object`[] |   |
| `nodes[].id` | `string` |   |
| `nodes[].name` | `string` |   |
| `nodes[].missing` | `boolean` |   |
| `nodes[].added` | `object` |   |
| `nodes[].added.questions` | `integer` |   |
| `nodes[].added.changed` | `integer` |   |
| `nodes[].added.removed` | `integer` |   |
| `nodes[].added.rows` | `integer` |   |
| `nodes[].added.new` | `integer` |   |
| `nodes[].signals` | `object` |   |
| `nodes[].depth` | `integer` | negative = ancestor, positive = descendant |
| `edges` | `object`[] |   |
| `edges[].from` | `string` |   |
| `edges[].to` | `string` |   |
| `edges[].kind` | `"extend"` \| `"update"` \| `"contradict"` \| `"merge"` \| `"version"` \| `"track"` \| `"declared"` |   |
| `family` | `object` |   |
| `money` | `object` |   |

### `GET /api/patches/{id}/signals`

How this knowledge is doing — network facts and this node’s last 30 days, kept apart

Lineage design §10. `network`: sales (price-0 and self-purchases excluded), unique buyers, revenue, how many nodes hold the body, children, versions, track subscribers, verification. `node`: this node’s own counters for the last 30 days — live tests, hits, marked wrong, pre-flight, derive intents — and its estimate of unique visitors. The two scopes are never added together.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | signals | `object` |
| `404` | patch not found |   |

### `GET /api/patches/{id}/issues`

Open questions — what to add on top of this knowledge

Lineage design §10 / SC-12. Counts always; the TEXT of a question only when it is already public on the record (`own_miss`, resolved from `benchmark.samples`) or when the person who reported it chose *Share*. `status` flips to `covered_by:<id>` when a descendant publishes a training set answering it.

**Auth** — none

**Parameters**

| Name | In | Type | Required | Default |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `kind` | `query` | `"own_miss"` \| `"preflight"` \| `"free_wrong"` \| `"request"` \| `"gap"` |   |   |
| `status` | `query` | `"open"` \| `"covered"` \| `"all"` |   | `"open"` |
| `limit` | `query` | `integer` |   | `50` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | open questions | `object` |
| `404` | patch not found |   |

### `POST /api/patches/{id}/issues`

Ask the creator to add something

A buyer’s own request. `share: true` keeps the text (it is theirs to share); otherwise only the count survives.

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `kind` | `"request"` |   |   |
| `topic` | `string` |   |   |
| `text` | `string` | yes |   |
| `share` | `boolean` |   | (default `false`) |

**Responses**

| Code | Description |
|---|---|
| `201` | recorded |
| `404` | patch not found |
| `429` | quota_requests |

### `GET /api/explore/shelves`

Explore shelves: selling now, being built on, just published, and what people asked for here

Lineage design SC-17. Every number is one this node can defend — sales from settle records, *built on* from children plus derive intents, *asked* from the open-question counters.

**Auth** — none

**Parameters**

| Name | In | Type | Default |
|---|---|---|---|
| `limit` | `query` | `integer` | `6` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | shelves | `object` |

### `GET /api/patches/{id}/conflicts`

Overlap check result

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | overlapping knowledge | `object` |

### `GET /api/benchmarks/{schema}`

Knowledge on the same subject (benchmark schema)

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `schema` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | list | `object` |

## Live test

compare the model's answer before vs after the knowledge is loaded

### `POST /api/chat/feedback`

Mark an answer wrong — with or without sharing the question

Lineage design SC-13. `share: false` (the default) counts the question and stores nothing but a keyed cluster id; `share: true` is the visitor’s per-turn decision to send the text to the creator. The question comes from the node’s own record of the turn, so `turn_id` must be one this visitor asked.

**Auth** — none

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `turn_id` | `string` | yes |   |
| `patch_ids` | `string`[] |   |   |
| `verdict` | `"wrong"` |   |   |
| `share` | `boolean` |   | (default `false`) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | recorded | `object` |
| `400` | no_patch |   |
| `404` | turn_unknown |   |

### `GET /api/chat/patches`

Knowledge that can be live-tested on this node

`items` are the ones that can be loaded right now (body held AND licensed). `elsewhere` is everything else this node’s model could run — not held, or held only because this node verified it — each with its price, its seller and why it cannot be tested, so a knowledge you want to build on is visible instead of absent. Plus runtime state, the shared-model lock, `applied` (what this node keeps loaded), `dirty` (bodies a live test found on the shared model that this node never loaded) and pairwise `overlaps`. With a verified `x-ainize-auth` (v2: `<address>:<ts>:<sig>:v2`, sig over `teach:<node>:GET:/api/chat/patches:<ts>`; legacy `teach:<ts>` still accepted) the response also carries the caller’s private `lessons`.

**Auth** — teaching key (optional)

**Parameters**

| Name | In | Type | Description |
|---|---|---|---|
| `x-ainize-auth` | `header` | `string` | optional visitor signature (v2 request-bound form preferred) — adds `lessons` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | list + runtime state + shared-model lock | [`ChatPatches`](./schemas.md#chatpatches) |

### `GET /api/chat/patches/{id}/request`

Inspect this requester’s retained demand record and current selected file

Does not record demand, buy or load knowledge. Returns version:1, node, patch_id, author, patch_sha256, opaque requester, actor (the current principal or null), scope (account/network), requested, available, can_request, requests, count_scope:retained_requests and event_id. Signed-in principals have separate state; anonymous requests share the observed network identity, not a verified person. Counts cover deduplicated retained demand records without the old 500-event cap; log pruning can reduce them. Legacy records without exact seller/file binding remain counted but do not confirm this selected file. Private drafts are not visible. Requester identity is node-specific and does not expose the IP.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | versioned demand status | `object` |
| `404` | Unknown or private item |   |

### `POST /api/chat/patches/{id}/request`

Record a request for this node’s operator without purchasing or loading knowledge

Current UI callers first read status and send its exact target/requester. A changed item, author, file or requester refuses before logging; an existing matching retained request returns its original record. Already-held licensed knowledge refuses a new request. New records bind requester, seller and selected file. Returns the same versioned status contract as GET; clients must confirm the matching current record, not treat a resolved promise as success. Legacy callers may omit expected; this does not authorize purchasing or loading. Local synchronous deduplication and retained-record counts are not permanent or distributed exactly-once delivery.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type | Required |
|---|---|---|
| `expected` | `object` |   |
| `expected.patch_id` | `string` | yes |
| `expected.author` | `string` | yes |
| `expected.patch_sha256` | `string` | yes |
| `expected.requester` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | versioned demand status; requested:true identifies a retained log entry, not a purchase | `object` |
| `409` | knowledge_request_changed or knowledge_request_available |   |

### `GET /api/chat/status`

Is my live test still queued behind the shared model?

Free (no quota) and answers about the caller's own request only — an unknown or foreign `request_id` is reported as `gone`, never as someone else's state. Poll it every 1–2 s while a request is in flight.

**Auth** — none

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `request_id` | `query` | `string` | yes | the `request_id` sent with POST /api/chat |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | queue state | [`ChatStatus`](./schemas.md#chatstatus) |

### `POST /api/chat/cancel`

Give up waiting for the shared model

While the request is still queued the node drops it before calling the model and no free try is consumed (`{cancelled:true, reason:"queued", charged:false}`; POST /api/chat then answers 499). Once it is running the work and the charge stand (`{cancelled:false, reason:"already_running", charged:true}`).

**Auth** — none

**Request body** — `application/json`, required

| Field | Type | Required |
|---|---|---|
| `request_id` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | what happened | `object` |

**`200` response body**

| Field | Type |
|---|---|
| `cancelled` | `boolean` |
| `reason` | `"queued"` \| `"already_running"` \| `"gone"` |
| `charged` | `boolean` |

### `POST /api/chat`

Compare answers before vs after the knowledge is loaded

Temporarily loads one to three knowledges into the shared serving model (in list order, restored in reverse afterwards). In `compare` mode each column replays its own earlier answers: send `messages_base` (what the base model said) and `messages_patched` (what the patched model said) alongside `messages`, all ending with the same question — otherwise the second turn feeds the patched answer back to the un-patched model and the comparison stops being one. Every patched answer is metered as one usage event per knowledge. Signed-out callers are not limited by a request count — their turns are queued behind callers who paid, so a busy node makes them wait rather than refusing them. A private draft (a taught lesson before publishing) can be loaded only by its owner — send the visitor `x-ainize-auth` (v2) — or the operator; everyone else gets 404.

**Auth** — none

**Request body** — `application/json`, required

[`ChatRequest`](./schemas.md#chatrequest)

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | JSON answers by default; stream=true returns incremental SSE. After final guarded metadata in event: ainize.result, success ends with data: [DONE]. Errors after headers emit event: error without [DONE]. | [`ChatResponse`](./schemas.md#chatresponse) |
| `429` | a rate limit unrelated to model access (for example the per-address write limits) |   |

## Models

what this node serves over the LLM API, and the free trials of it — the public list, and the transcription and image routes a visitor can press without a key (the chat trial is Live test's)

### `GET /api/throughput/deposits/{txHash}`

Check the signed-in wallet’s recorded deposit credit

Requires the sending wallet session. With chain, returns a version 1 acknowledgement for the exact transaction, sender and watcher name. All matching logs are summed as integer share units (18 decimals). This is node credit evidence, not proof of original ERC-20 calldata. Omitting chain retains the legacy numeric, single-record result.

**Auth** — none

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `txHash` | `path` | `string` | yes |   |
| `chain` | `query` | `string` |   | Exact watcher name, e.g. base-sain. Requires a 32-byte transaction hash. |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | Scoped acknowledgement when chain is supplied; legacy status otherwise | `object` |
| `400` | Invalid scoped transaction/chain |   |
| `401` | Sending wallet session required |   |
| `503` | Credit ledger unavailable; outcome is unknown |   |

### `GET /api/models`

Configured models and current backend availability

**Auth** — operator

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | model list | `object` |

**`200` response body**

| Field | Type |
|---|---|
| `object` | `object` |
| `data` | `object`[] |
| `data[].id` | `string` |
| `data[].modality` | `"chat"` \| `"transcription"` \| `"image"` \| `"decision"` |
| `data[].available` | `boolean` |

### `POST /api/transcribe`

Free transcription trial on a configured audio backend

Multipart audio upload, at most 10 MiB. No request count applies; unpaid work is queued behind paying callers on the same backend. Requires a configured transcription backend.

**Auth** — operator

**Request body** — `multipart/form-data`, required

| Field | Type | Required |
|---|---|---|
| `model` | `string` | yes |
| `file` | `string (binary)` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | transcription | `object` |
| `400` | invalid request |   |
| `404` | model not configured |   |
| `503` | backend unavailable |   |

### `POST /api/image`

Free image-generation trial on a configured image backend

No request count applies; unpaid work is queued behind paying callers on the same backend. At most one image and 20 steps; requires a configured image backend.

**Auth** — operator

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `model` | `string` | yes |   |
| `prompt` | `string` | yes |   |
| `n` | `integer` |   |   |
| `steps` | `integer` |   | (default `12`; 1–20) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | image data | `object` |
| `400` | invalid request |   |
| `404` | model not configured |   |
| `503` | backend unavailable |   |

### `POST /api/run`

Run one script in the hosted-agent sandbox and stream its output

For a ▶ button beside a .py or .js file (deploy/run-runtime/README.md). The files land in a 64 MiB tmpfs /work of a read-only, non-root container with 512 MiB, one CPU and 128 pids, on an internal network whose only exit is this node's gateway: AINIZE_URL is the gateway standing in for this node (/v1/* under it), AINIZE_API_KEY is the caller's own key (the bearer's, or — for a trusted app presenting an AIN SSO machine token and naming the person in X-AIN-Actor — that person's `aindrive run` key, issued once), absent for an anonymous run; the preinstalled ainize Python SDK reads both. HTTPS_PROXY tunnels TLS to ainize.ai and this node's public host; anything else fails. Limits: 32 files, 2 MiB in total, relative names without "..", ".git" or empty segments; timeoutMs 1000–300000 (default 120000); 2 running runs per anonymous caller (4 with an API key), 8 per node. The answer is text/event-stream (events stdout, stderr, error, exit — every data a JSON value; exit data {"code","ms"}, code 124 after a timeout) or, with Accept: application/json, one object {stdout, stderr, code, ms, error?} with each stream capped at 1 MiB. Starting a run needs no key; a key makes the run its owner's. 401 invalid_service_token for a machine token that does not verify; 403 account_suspended.

**Auth** — operator

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `language` | `"python"` \| `"node"` | yes |   |
| `entry` | `string` | yes |   |
| `files` | `object` | `object`[] | yes |   |
| `env` | `object` |   |   |
| `timeoutMs` | `integer` |   | (default `120000`; 1000–300000) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | the run's output | `object` |
| `400` | invalid_request — a bad file name, entry, env or timeout |   |
| `413` | files_too_large — more than 2 MiB of files |   |
| `429` | too_many_runs — the caller or the node is at its concurrent-run limit |   |
| `503` | runner_unavailable — this node has no Docker for runs |   |

### `POST /api/decide`

Free decision trial on a configured decision backend (Jev/SystemOne)

No request count applies; unpaid work is queued behind paying callers on the same backend. The body is passed to the sidecar's /v1/systemone unchanged except for the model id; requires a configured decision backend.

**Auth** — operator

**Request body** — `application/json`, required

| Field | Type | Required |
|---|---|---|
| `model` | `string` | yes |
| `state` | `object` | yes |
| `questions` | `object` | yes |
| `images` | `object` |   |
| `videos` | `object` |   |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | decision | `object` |
| `400` | invalid request |   |
| `404` | model not configured |   |
| `503` | backend unavailable |   |

## Teach

one pipeline, two doors: a dataset file (uploaded here, or with `ainize teach dataset`) and corrections collected in Live test are both frozen into the same canonical dataset → validated → trained → checked on the live model → a lesson its teacher can keep private or publish as a credited data provider (no sign-in — every request is signed with a teaching key held by the browser or the CLI)

### `POST /api/patches/{id}/derive-intent`

Say you are building on this knowledge, and get a token for its training set

A signed intent from a teaching key (lineage design §6.1). Counted on the knowledge — this is what "built on N times" is made of — and answered with a 24-hour token for `/p2p/dataset/{sha256}`.

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Request body** — `application/json`, optional

| Field | Type | Description |
|---|---|---|
| `child_key` | `string` | must be the teaching key that signed the request |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | token | `object` |
| `403` | dataset_private |   |
| `404` | patch not found \| dataset_unavailable |   |

**`200` response body**

| Field | Type |
|---|---|
| `token` | `string` |
| `expires` | `integer` |
| `sha256` | `string` |
| `held` | `boolean` |
| `holders` | `string`[] |

### `POST /api/patches/{id}/fork`

Copy this knowledge’s questions into your own training set

Story B of the lineage design: the published training set becomes a dataset owned by the calling teaching key, with the knowledge recorded as its parent and every row carrying `from: '<patch>#<row>'`. Idempotent — copying twice returns the same dataset (200 instead of 201). Needs `teach.lineage`.

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Request body** — `application/json`, optional

| Field | Type | Description |
|---|---|---|
| `name` | `string` | (at most 80 characters) |

**Responses**

| Code | Description |
|---|---|
| `200` | you already have this copy |
| `201` | copied |
| `403` | dataset_private \| lineage_disabled |
| `404` | base_unknown \| dataset_unavailable — no node here holds the questions |

### `GET /api/teach/policy`

Teaching policy of this node (open / paused, queue, limits, measured timing, shares)

Public, cached 10 s.

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | policy | [`TeachPolicy`](./schemas.md#teachpolicy) |

### `GET /api/teach/samples`

Example datasets this node ships (ko-facts, en-facts, mixed)

Public, cached 1 h. Registered before /api/teach/datasets/{id} so `samples` can never be read as a dataset id.

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | samples | `object` |

**`200` response body**

| Field | Type |
|---|---|
| `samples` | `object`[] |
| `samples[].kind` | `string` |
| `samples[].name` | `string` |
| `samples[].description` | `string` |
| `samples[].rows` | `integer` |
| `samples[].sha256` | `string` |
| `samples[].preview` | [`TeachDatasetRow`](./schemas.md#teachdatasetrow)[] |
| `samples[].download_url` | `string` |

### `GET /api/teach/samples/{kind}`

Download an example dataset (.jsonl)

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `kind` | `path` | `"ko-facts"` \| `"en-facts"` \| `"mixed"` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | application/x-ndjson |
| `404` | dataset_not_found |

### `POST /api/teach/datasets`

Create a dataset — upload a file, or freeze the questions collected in chat

Two request shapes, one result.

**multipart/form-data (the file door)** — one `file` (.jsonl .json .csv .tsv .txt, within `limits.dataset_max_bytes`), plus optional `name`, `format`, `has_header`, `delimiter`, `encoding`, `columns` (JSON), `retention`.
A multipart body cannot be covered by the v2 body hash, so send `x-ainize-dataset-sha256: <hex of the file bytes>` and sign THAT string as the body; the node re-hashes the stored file and answers 400 `dataset_hash` on a mismatch.

**application/json (the chat door, the CLI, agents)** — `{source: "chat"|"inline"|"sample", rows: [{prompt, answer, alt_prompt?, note?}], sample?, name?, retention?}`.

The response carries the server’s per-row report: nothing is silently dropped, deduped or truncated. Re-sending identical bytes from the same key returns **200** with the existing dataset instead of creating a second one.

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |
| `x-ainize-dataset-sha256` | `header` | `string` |   | multipart only: sha256 of the file bytes; this string is what the v2 signature covers |

**Request body** — `multipart/form-data`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | `string (binary)` | yes |   |
| `name` | `string` |   | (at most 80 characters) |
| `format` | `"jsonl"` \| `"json"` \| `"csv"` \| `"tsv"` \| `"txt"` |   |   |
| `has_header` | `"true"` \| `"false"` |   |   |
| `delimiter` | `string` |   |   |
| `encoding` | `string` |   |   |
| `columns` | `string` |   | JSON: {"prompt":"question","answer":2} |
| `retention` | `"keep"` \| `"delete_after_training"` |   |   |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `source` | `"chat"` \| `"inline"` \| `"sample"` |   | (default `"chat"`) |
| `rows` | `object`[] |   |   |
| `rows[].prompt` | `string` | yes | (at most 400 characters) |
| `rows[].answer` | `string` | yes | (at most 200 characters) |
| `rows[].alt_prompt` | `string` |   | (at most 400 characters) |
| `rows[].note` | `string` |   | (at most 500 characters) |
| `sample` | `"ko-facts"` \| `"en-facts"` \| `"mixed"` |   |   |
| `name` | `string` |   |   |
| `retention` | `"keep"` \| `"delete_after_training"` |   |   |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | the same bytes were already uploaded by this key — the existing dataset, unchanged |   |
| `201` | created | `object` |
| `400` | dataset_empty (no usable questions; `summary` and `rows` say why) \| dataset_format \| dataset_hash |   |
| `403` | teaching_disabled \| banned |   |
| `413` | dataset_too_large — `bytes` and `max_bytes` are in the body |   |
| `429` | quota_dataset \| quota_bytes \| rate_limited |   |

**`201` response body**

| Field | Type |
|---|---|
| `dataset` | [`TeachDataset`](./schemas.md#teachdataset) |
| `report` | `object` |
| `report.summary` | [`TeachDatasetSummary`](./schemas.md#teachdatasetsummary) |
| `report.rows` | [`TeachDatasetRow`](./schemas.md#teachdatasetrow)[] |
| `created` | `boolean` |

### `GET /api/teach/datasets`

My datasets (signed key)

Newest first, tombstones included so a deleted dataset still explains itself.

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | datasets | `object` |

**`200` response body**

| Field | Type |
|---|---|
| `items` | [`TeachDataset`](./schemas.md#teachdataset)[] |

### `GET /api/teach/datasets/{id}`

One dataset

Owner (signed) or operator. Anyone else gets 404 — a stranger is never told that a dataset exists.

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string (uuid)` | yes | dataset id |
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | dataset | `object` |
| `404` | dataset_not_found |   |

**`200` response body**

| Field | Type |
|---|---|
| `dataset` | [`TeachDataset`](./schemas.md#teachdataset) |

### `PATCH /api/teach/datasets/{id}`

Rename, change retention, or add / remove / replace questions

Touched questions are revalidated against the whole dataset, so a new duplicate or contradiction is caught here. `revision` and `sha256` change; the id does not. 409 `dataset_in_use` while a lesson is training — fork instead.

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string (uuid)` | yes | dataset id |
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Request body** — `application/json`, optional

| Field | Type | Description |
|---|---|---|
| `name` | `string` | (at most 80 characters) |
| `retention` | `"keep"` \| `"delete_after_training"` |   |
| `rows_op` | `object` | `object` | `object` | `object` |   |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | dataset + report | `object` |
| `409` | dataset_in_use |   |

### `DELETE /api/teach/datasets/{id}`

Delete a dataset (the lessons trained from it are kept)

Files are removed and a tombstone stays, so a lesson reads "the dataset for this lesson was deleted by its owner" instead of pointing at a dangling id. A published lesson then becomes unreproducible by its own teacher — the knowledge file and recipe.json remain the deliverable. 409 while a lesson is training.

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string (uuid)` | yes | dataset id |
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | deleted | `object` |
| `409` | dataset_in_use |   |

### `GET /api/teach/datasets/{id}/rows`

The per-question report, paginated

One entry per SOURCE row — accepted or not — with its 1-based logical line in the uploaded file and the reason it was not used.

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Default | Description |
|---|---|---|---|---|---|
| `id` | `path` | `string (uuid)` | yes |   | dataset id |
| `x-ainize-auth` | `header` | `string` | yes |   | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |
| `offset` | `query` | `integer` |   | `0` |   |
| `limit` | `query` | `integer` |   | `50` |   |
| `status` | `query` | `"all"` \| `"ok"` \| `"rejected"` \| `"duplicate"` \| `"conflict"` \| `"too_long"` \| `"empty"` \| `"blocked"` \| `"not_parsed"` \| `"over_cap"` |   |   |   |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | rows | `object` |

**`200` response body**

| Field | Type |
|---|---|
| `total` | `integer` |
| `source_rows` | `integer` |
| `offset` | `integer` |
| `limit` | `integer` |
| `summary` | [`TeachDatasetSummary`](./schemas.md#teachdatasetsummary) |
| `items` | [`TeachDatasetRow`](./schemas.md#teachdatasetrow)[] |

### `POST /api/teach/datasets/{id}/reparse`

Read the SAME uploaded file again with different settings

For "wrong columns or separator?". Nothing is re-uploaded. Only a dataset that has never been trained can be re-read; otherwise fork it.

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string (uuid)` | yes | dataset id |
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Request body** — `application/json`, optional

| Field | Type |
|---|---|
| `format` | `string` |
| `delimiter` | `string` |
| `has_header` | `boolean` |
| `encoding` | `string` |
| `layout` | `string` |
| `columns` | `object` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | dataset + report | `object` |
| `400` | dataset_empty read that way |   |
| `409` | dataset_in_use |   |

### `POST /api/teach/datasets/{id}/fork`

Copy a dataset (optionally with an edit) — how you change one while a lesson is training

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string (uuid)` | yes | dataset id |
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Request body** — `application/json`, optional

| Field | Type |
|---|---|
| `name` | `string` |
| `rows_op` | `object` |

**Responses**

| Code | Description |
|---|---|
| `201` | the copy, with parent_dataset set and revision 1 |

### `GET /api/teach/datasets/{id}/download`

Download the questions (canonical .jsonl, or .csv)

The `.jsonl` bytes are the sha256 subject: download it, re-upload it, and you get 200 with the same dataset back.

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Default | Description |
|---|---|---|---|---|---|
| `id` | `path` | `string (uuid)` | yes |   | dataset id |
| `x-ainize-auth` | `header` | `string` | yes |   | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |
| `format` | `query` | `"jsonl"` \| `"csv"` |   | `"jsonl"` |   |

**Responses**

| Code | Description |
|---|---|
| `200` | the file, with x-content-sha256 |
| `404` | dataset_not_found |

### `POST /api/teach/preflight`

Check what the model already knows (before queuing a lesson)

Re-asks every correction with the chosen knowledge loaded; costs one live-test unit. Statuses: will_train · already_known · overlaps_listing · invalid — and, when `base_ids` name a knowledge to build on: in_base (it already answers this the same way) · base_conflict (it answers this question differently, and your row would replace its answer).

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Request body** — `application/json`, required

either `facts` (v1) or `dataset_id` with an optional window

| Field | Type | Description |
|---|---|---|
| `patch_ids` | `string`[] | (at most 3 items) |
| `base_ids` | `string`[] | the knowledge these questions would be taught on top of (at most 2 items) |
| `context_ids` | `string`[] | loaded for comparison only (at most 3 items) |
| `facts` | [`TeachFact`](./schemas.md#teachfact)[] | (1–8 items) |
| `dataset_id` | `string` |   |
| `offset` | `integer` |   |
| `limit` | `integer` | (at most 8) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | per-correction status | `object` |
| `401` | invalid_signature |   |
| `403` | teaching_disabled \| banned \| not_owner |   |
| `429` | quota_key \| quota_ip |   |
| `503` | runtime unavailable |   |

**`200` response body**

| Field | Type |
|---|---|
| `facts` | `object`[] |
| `facts[].index` | `integer` |
| `facts[].status` | `"will_train"` \| `"already_known"` \| `"overlaps_listing"` \| `"invalid"` \| `"in_base"` \| `"base_conflict"` |
| `facts[].base_answer` | `string` |
| `facts[].base_id` | `string` |
| `facts[].detail` | `string` |
| `trainable` | `integer` |
| `bases` | `string`[] |
| `quota` | `object` |
| `quota.key_remaining` | `integer` |
| `quota.ip_remaining` | `integer` |

### `POST /api/teach/merge/preview`

What combining two knowledges would mean (design §9, §12.2)

Read-only. Unions the two published training sets by the parser key (NFC, whitespace collapsed, case-sensitive): `same` question with the same answer is one row, the same question with a DIFFERENT answer is a conflict a person must resolve before anything is built. Separately compares the two knowledge files row by row in bf16 (`shared` / `disagree` / `opposing`), which is what decides the build tier: `union` (just combine, no training — only when the rows cannot contradict each other), `retrain` (train the disagreeing questions on top of both) or `rebuild` (from the combined questions; REQUIRED when more than 20 % of the shared rows disagree). A parent whose training set is private returns `questions: null` — only a disjoint-rows union stays possible.

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Request body** — `application/json`, required

| Field | Type | Required |
|---|---|---|
| `a` | `string` | yes |
| `b` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | the merge as it would be | `object` |
| `401` | invalid_signature |   |
| `403` | teaching_disabled \| banned \| not_owner |   |
| `429` | quota_key \| quota_ip |   |

**`200` response body**

| Field | Type |
|---|---|
| `questions` | `object` \| `null` |
| `questions.a_only` | `integer` |
| `questions.b_only` | `integer` |
| `questions.same` | `integer` |
| `questions.conflicts` | `object`[] |
| `questions.conflicts[].key` | `string` |
| `questions.conflicts[].prompt` | `string` |
| `questions.conflicts[].a_answer` | `string` |
| `questions.conflicts[].b_answer` | `string` |
| `questions.conflicts[].a_row` | `integer` |
| `questions.conflicts[].b_row` | `integer` |
| `rows` | `object` |
| `rows.a_only` | `integer` |
| `rows.b_only` | `integer` |
| `rows.shared` | `integer` |
| `rows.disagree` | `integer` |
| `rows.opposing` | `integer` |
| `rows.before_differs` | `integer` |
| `merged` | `object` \| `null` |
| `merged.rows` | `integer` |
| `merged.from_a` | `integer` |
| `merged.from_b` | `integer` |
| `merged.targets` | `integer` |
| `tiers` | `object` |
| `tiers.union` | `object` |
| `tiers.retrain` | `object` |
| `tiers.rebuild` | `object` |
| `tiers.required` | `string` \| `null` |
| `tiers.disagree_ratio` | `number` |
| `licenses` | `object` |
| `licenses.a` | `string` \| `null` |
| `licenses.b` | `string` \| `null` |
| `licenses.child_min` | `string` \| `null` |
| `private_parent` | `string` |

### `POST /api/teach/jobs`

Queue a lesson (train the corrections into a knowledge file)

The body is `{dataset_id}` XOR the legacy `{facts}`. The legacy form materialises a dataset with `source: "chat"` server-side, so a lesson taught from the chat basket is exactly as re-trainable as one taught from an uploaded file. A dataset larger than `limits.rows_per_job` is not rejected: the first N are selected and the rest stay in the dataset for the next lesson (send `selected_indexes` to choose which N). `training.lr` is never accepted from a client.

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Request body** — `application/json`, required

| Field | Type | Description |
|---|---|---|
| `patch_ids` | `string`[] | (at most 3 items) |
| `builds_on_context` | `boolean` | legacy: record the loaded knowledge as sources (their creators share in sales). With `teach.lineage` on it becomes `base_ids: [patch_ids[0]]` and the response carries a Deprecation header. (default `false`) |
| `base_ids` | `string`[] | lineage: what this lesson is trained ON TOP OF — its rows are loaded as the keep-set, it is recorded as a base for good, its creators share every sale and buyers must load it first (design §12.1). Needs the `teach.lineage` flag. One base for extend; two is a merge (not on this node yet). (at most 2 items) |
| `context_ids` | `string`[] | loaded for COMPARISON only — never recorded as a base (at most 3 items) |
| `mode` | `"scratch"` \| `"extend"` \| `"fork"` \| `"merge"` |   |
| `inherit` | `boolean` | load the base’s questions as known answers so the lesson does not undo them (default `true`) |
| `export` | `"delta"` \| `"squash"` | delta = an add-on that needs its base; squash = a stand-alone build carrying the base rows (default `"delta"`) |
| `force` | `boolean` | build on a retired (superseded) base anyway |
| `dataset_id` | `string` |   |
| `selected_indexes` | `integer`[] |   |
| `known` | `object`[] | questions an interactive pre-flight found the model already answers, as {index, base_answer} against this dataset’s rows; each claim is re-checked against the row’s own answer and the accepted ones are recorded in job.preflight |
| `known[].index` | `integer` |   |
| `known[].base_answer` | `string` |   |
| `training` | `object` |   |
| `training.effort` | `"quick"` \| `"balanced"` \| `"thorough"` |   |
| `training.max_steps` | `integer` |   |
| `training.eval_every` | `integer` |   |
| `training.rows_limit` | `integer` |   |
| `training.row_offset` | `integer` |   |
| `training.check_side_effects` | `boolean` | (default `true`) |
| `training.use_alt` | `boolean` | (default `true`) |
| `facts` | [`TeachFact`](./schemas.md#teachfact)[] | (1–8 items) |
| `contributor` | `object` |   |
| `contributor.name` | `string` | (at most 40 characters) |
| `name` | `string` | (at most 80 characters) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `202` | queued | `object` |
| `400` | dataset_too_large (only when `training.rows_limit` is above the cap) \| invalid \| base_unknown \| base_private \| base_retired \| base_rejected \| too_many_bases \| base_stack_too_deep |   |
| `401` | invalid_signature |   |
| `403` | teaching_disabled \| banned \| not_owner |   |
| `404` | dataset_not_found \| dataset_unavailable (the base’s training set is on no node here) |   |
| `409` | already_known \| overlaps_listing |   |
| `429` | quota_key \| quota_ip \| quota_rows |   |
| `503` | trainer_paused (queue full, too many questions waiting, or trainer down) |   |

**`202` response body**

| Field | Type |
|---|---|
| `job` | [`TeachJob`](./schemas.md#teachjob) |
| `quota` | `object` |
| `quota.key_remaining` | `integer` |
| `quota.ip_remaining` | `integer` |
| `quota.rows_remaining` | `integer` |
| `quota.rows_ip_remaining` | `integer` |

### `GET /api/teach/jobs`

My lessons (signed key)

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |
| `mine` | `query` | `1` |   |   |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | lessons | `object` |

**`200` response body**

| Field | Type |
|---|---|
| `items` | [`TeachJob`](./schemas.md#teachjob)[] |

### `GET /api/teach/jobs/{id}`

Lesson status (poll every 5 s)

Full body for the owner (signed) or the operator; everyone else gets {id, status, position, eta_s}.

**Auth** — teaching key (optional)

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `x-ainize-auth` | `header` | `string` |   | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | lesson | [`TeachJob`](./schemas.md#teachjob) |

### `DELETE /api/teach/jobs/{id}`

Cancel / delete a lesson

Queued or training lessons are cancelled (the trainer process gets SIGTERM); private READY drafts are deleted with their files and links. 409 published_immutable once announced.

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | cancelled | `object` |
| `409` | published_immutable |   |

### `POST /api/teach/jobs/{id}/retry`

Improve & retry: queue a new lesson with edited corrections (same knowledge context)

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Request body** — `application/json`, required

| Field | Type | Required |
|---|---|---|
| `facts` | [`TeachFact`](./schemas.md#teachfact)[] | yes |

**Responses**

| Code | Description |
|---|---|
| `202` | new lesson with parent_job |

### `POST /api/teach/jobs/{id}/retrain`

Train the same dataset again (or a fork of it)

Re-runs the pipeline from the same dataset by default, one effort level higher; `parent_job` is set and the quota is charged again. A lesson taught before datasets existed gets one written from its questions first.

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Request body** — `application/json`, optional

| Field | Type |
|---|---|
| `dataset_id` | `string` |
| `selected_indexes` | `integer`[] |
| `training` | `object` |
| `name` | `string` |

**Responses**

| Code | Description |
|---|---|
| `202` | the new lesson |
| `404` | dataset_not_found |
| `429` | quota_key \| quota_ip \| quota_rows |

### `GET /api/teach/jobs/{id}/events`

This lesson’s log lines (poll every 2 s while it runs)

Owner or operator. Redacted for non-operators exactly as /api/events is.

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Default | Description |
|---|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |   |
| `x-ainize-auth` | `header` | `string` | yes |   | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |
| `since` | `query` | `integer` |   |   | last seen `cursor` |
| `limit` | `query` | `integer` |   | `200` |   |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | events | `object` |

**`200` response body**

| Field | Type |
|---|---|
| `events` | `object`[] |
| `events[].seq` | `integer` |
| `events[].ts` | `integer` |
| `events[].level` | `string` |
| `events[].message` | `string` |
| `events[].data` | `object` |
| `cursor` | `integer` |

### `POST /api/teach/jobs/{id}/recheck`

Measure again a lesson that was saved unchecked (model server was down, or the side-effect check was turned off)

Owner or operator. Allowed for READY / NEEDS_MORE lessons whose `checks.executed` is false; the lesson goes back to EXPORTED and keeps its draft id.

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | re-queued for checking | `object` |
| `409` | job_not_ready |   |

### `GET /api/teach/jobs/{id}/publish-challenge`

What to sign before publishing

claim = sha256(canonical({patch_sha256, benchmark_hash, address, share})). `address` is the payout address (defaults to the teaching key; `payout_address=none` = credit only, share 0).

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |
| `payout_address` | `query` | `string` |   | AIN address, or `none` for credit only |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | challenge | `object` |
| `403` | publish_disabled |   |
| `409` | job_not_ready \| checks_failed |   |

**`200` response body**

| Field | Type |
|---|---|
| `patch_sha256` | `string` |
| `benchmark_hash` | `string` |
| `address` | `string` |
| `signer` | `string` |
| `share` | `number` |
| `claim` | `string` |

### `POST /api/teach/jobs/{id}/publish`

Publish the lesson through this node as a credited data provider

The node writes `contributors[]` (with the signed claim) into the draft and either announces it (policy auto) or parks it for operator review (policy review).

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | yes |   |
| `description` | `string` |   |   |
| `price` | `string` |   |   |
| `license` | `string` |   | (default `"CC-BY-4.0"`) |
| `payout_address` | `string` \| `null` |   | null = credit only (share 0) |
| `claim_sig` | `string` | yes |   |
| `consent` | `object` | yes |   |
| `consent.permanent` | `boolean` |   |   |
| `consent.rights` | `boolean` |   |   |
| `dataset` | `object` |   | the training set: who may read it, under which licence (design §6.1, §6.4, §6.5) |
| `dataset.access` | `"public"` \| `"derivative"` \| `"private"` |   | public = anyone; derivative = people building on this knowledge; private = nobody (and nobody can build on it) (default `"derivative"`) |
| `dataset.license` | `"CC0-1.0"` \| `"CC-BY-4.0"` \| `"CC-BY-SA-4.0"` \| `"ODC-By-1.0"` \| `"Proprietary"` |   | (default `"CC-BY-4.0"`) |
| `dataset.include_notes` | `boolean` |   | include my per-row notes in the shared questions (default `false`) |
| `dataset.declaration` | `object` \| `null` |   | required at or above `limits.declaration_rows` questions |
| `dataset.declaration.source` | `"own"` \| `"public"` \| `"licensed"` | yes |   |
| `dataset.declaration.license` | `string` |   |   |
| `dataset.declaration.no_pii` | `boolean` | yes |   |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | PENDING_REVIEW or ANNOUNCED | `object` |
| `400` | consent_required \| parent_not_listed \| bad_license \| license_incompatible \| dataset_pii \| dataset_declaration |   |
| `401` | invalid_signature |   |
| `403` | publish_disabled |   |
| `409` | job_not_ready \| checks_failed |   |

**`200` response body**

| Field | Type |
|---|---|
| `status` | `"PENDING_REVIEW"` \| `"ANNOUNCED"` |
| `patch_id` | `string` |
| `url` | `string` |

### `POST /api/teach/jobs/{id}/save`

Keep it private: 7-day download links for the knowledge file, recipe.json and RUN-LOCALLY.md

**Auth** — teaching key

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `x-ainize-auth` | `header` | `string` | yes | teaching-key signature. Request-bound (recommended): `<address>:<ts>:<sig>:v2` where sig = signMessage("teach:\<nodeAddress>:\<METHOD>:\<path+query>:\<ts>[:\<sha256(body)>]"); legacy: `<address>:<ts>:<sig>` over "teach:\<ts>". 5-minute window, every header is single-use (replays are refused). |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | download links | `object` |

**`200` response body**

| Field | Type |
|---|---|
| `download` | `object` |
| `download.npz_url` | `string` |
| `download.recipe_url` | `string` |
| `download.readme_url` | `string` |
| `download.expires_at` | `integer` |
| `sha256` | `string` |
| `rows` | `integer` |
| `size_bytes` | `integer` |
| `filename` | `string` |

### `GET /api/teach/jobs/{id}/recipe`

recipe.json (token link from save)

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `token` | `query` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | recipe | `object` |

### `GET /api/teach/jobs/{id}/local-run`

RUN-LOCALLY.md (token link from save)

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `token` | `query` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | text/markdown |

### `GET /api/teacher/{address}`

Public data-provider page: lessons and earnings (owed / paid / pending from settle records)

Earnings reconcile OWED (settle records, readable on any node) against PAID (this node’s payouts rows). A slice sold by another node shows as pending here until that node pays — the settle record is the evidence.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `address` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | profile | [`TeacherProfile`](./schemas.md#teacherprofile) |

## Automatic payment & download

the x402 flow and blob download

### `GET /x402/patch/{id}`

Buy knowledge (x402)

Without a header: 402 + `x-payment-required` (base64 JSON `X402Requirement[]`). The requirement carries `requires[]` and `total` — the bases this knowledge needs underneath it and what the family costs — plus `single_use: true`, and in AIN mode `transfer_key`. Repeat with the payment proof in `X-PAYMENT`: 200 + manifest (JSON text, `x-content-sha256`). **local-credit**: `{nonce, from, amount, proof}` where `proof` signs sha256(canonical {resource, amount, nonce, payTo, from}). Amount, nonce, signature and balance are all checked BEFORE the nonce is spent, so a rejected attempt leaves the quote usable. **ain-transfer**: transfer with the requirement's `transfer_key` (= `x402_<nonce>_<resource>`) and send `{txHash, nonce, transfer_key, proof}` where `proof` signs sha256("x402-ain:\<txHash>:\<nonce>") with the PAYING key. A transfer that answers no quote, or a hash presented by anyone but the payer, buys nothing. **Presenting a payment twice is safe**: the payer gets the manifest again with `x-payment-response {"replayed": true}` and is not charged — a lost response is recovered by repeating the request (or `ainize patch download <id>`). Only a stranger replaying someone else's payment is refused.

**Auth** — payment (x402)

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `X-PAYMENT` | `header` | `string` |   | base64(JSON X402Payload) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | manifest | [`Manifest`](./schemas.md#manifest) |
| `402` | payment required / rejected |   |
| `423` | not for sale: verification quorum not met, or a verifier has challenged it (re-verification pending) |   |

### `GET /p2p/datasets`

Training sets this node holds (sha256, rows, access, licence)

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | list | `object` |

### `GET /p2p/dataset/{sha256}`

Download a published training set (.jsonl)

Same gate as `/p2p/blob` (`x-ainize-auth` over `dataset:<sha256>`, 5-minute skew) plus the access level: a `derivative` set needs a derive token in `x-ainize-derive` (or `?token=`), from `POST /api/patches/{id}/derive-intent`.

**Auth** — teaching key (optional)

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `sha256` | `path` | `string` | yes |
| `x-ainize-auth` | `header` | `string` |   |
| `x-ainize-derive` | `header` | `string` |   |
| `token` | `query` | `string` |   |

**Responses**

| Code | Description |
|---|---|
| `200` | application/x-ndjson |
| `403` | dataset_private \| dataset_derivative_only |
| `404` | not held by this node |

### `GET /p2p/dataset/{sha256}/manifest`

Manifest of a held training set

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `sha256` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | manifest | `object` |
| `403` | dataset_private \| dataset_derivative_only |   |

### `GET /p2p/dataset/{sha256}/benchmark`

The full benchmark list of a training set (the `answers_hash` preimage)

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `sha256` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | application/x-ndjson |
| `403` | dataset_private \| dataset_derivative_only |

### `GET /p2p/blob/{sha256}`

Download the knowledge body (.npz)

**Auth** — teaching key (optional) + payment (x402)

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `sha256` | `path` | `string` | yes |   |
| `token` | `query` | `string` |   | download_token from the manifest |
| `x-ainize-auth` | `header` | `string` |   | `<address>:<ts>:<sig>` — buyer / creator / verifier signature |

**Responses**

| Code | Description |
|---|---|
| `200` | application/octet-stream |
| `402` | purchase required |

### `GET /api/patches/{id}/quote`

What this purchase would cost — the item and the bases it needs

Answers price, currency, requires[], missing[], unknown[], totals[], optional total, self_contained and export. requires is the full base stack deepest first, with each price, currency, seller and current licence. totals groups exact decimal prices by currency, excluding already licensed/owned bases. A scalar total exists only for zero cost or a single total in the root currency. Unknown bases mean the quote is incomplete; never interpret its known subtotal as the complete cost. This read does not reserve a price.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | quote | `object` |

### `GET /api/credit/{address}`

Where an address's local credit came from

Local credit is ISSUED by this node — one recorded grant per address, capped at `market.creditGrants` — so a balance is the sum of records that exist, not a number every new keypair is born with. Answers `{balance, grant, would_grant, issued_by, issuance, note}`. It is not money and is worthless on any other node.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `address` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | credit | `object` |

## Register & sell knowledge

operator: register → announce → verified → sold

### `PATCH /api/patches/{id}`

Edit a DRAFT

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type | Description |
|---|---|---|
| `name` | `string` |   |
| `description` | `string` |   |
| `price` | `string` |   |
| `branch` | `string` |   |
| `benchmark` | `object` |   |
| `license` | `string` |   |
| `visibility` | `"public"` \| `"test"` |   |
| `contributors` | [`Contributor`](./schemas.md#contributor)[] | (at most 4 items) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | updated | `object` |

### `DELETE /api/patches/{id}`

Delete a DRAFT

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | deleted | `object` |

### `POST /api/patches`

Register knowledge (created as a DRAFT)

**Auth** — operator

**Request body** — `multipart/form-data`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | yes |   |
| `id` | `string` |   |   |
| `description` | `string` |   |   |
| `model_id` | `string` | yes |   |
| `benchmark` | `string` | yes | JSON string {schema, queries, format, samples:[{prompt,expect}]} |
| `price` | `string` |   |   |
| `parents` | `string` |   | comma-separated ids |
| `dataset_file` | `string` |   | lineage: a .jsonl/.csv on the node machine — the questions this knowledge was made from, pinned under their canonical sha256 and served under `dataset_access` |
| `dataset_access` | `"public"` \| `"derivative"` \| `"private"` |   | (default `"private"`) |
| `dataset_license` | `"CC0-1.0"` \| `"CC-BY-4.0"` \| `"CC-BY-SA-4.0"` \| `"ODC-By-1.0"` \| `"Proprietary"` |   |   |
| `branch` | `string` |   |   |
| `topic_path` | `string` |   |   |
| `visibility` | `"public"` \| `"test"` |   |   |
| `contributors` | `string` |   | JSON array of Contributor (≤ 4, Σ share ≤ 1) |
| `file` | `string (binary)` |   |   |
| `path` | `string` |   | .npz path on the node machine (instead of upload) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | draft | `object` |

### `POST /api/patches/{id}/announce`

Announce — record on the ledger and request verification

Answers `{record, verifiers:{known,reachable,verifiers,quorum,self_attest}, visibility}`: with fewer reachable verifier peers than the quorum, nothing announced here can ever be VERIFIED. 409 `lesson_draft` for a visitor-taught draft — those are published from the lesson page, where the teacher signs the claim.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | ledger record + verifier reach | `object` |

### `POST /api/patches/{id}/retire`

Retire — take your own published knowledge off sale for good

Appends an author-signed `retire` record. The anchor stays on the permanent record; the entry leaves `/api/catalog` (unless `?status=RETIRED`), `/x402/patch/{id}` answers 410 Gone, and everyone who already bought it keeps their download rights. Body: `{reason?}`. Only the author may retire, and only a non-draft.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | patch_id, retired_at, reason | `object` |

### `POST /api/patches/{id}/verify`

Run and record verification on this node (verifier role)

Operator-only. Legacy synchronous calls return {attestation}. async:true requires a caller-generated request_id, current instance and expected selected target; HTTP 202 returns a recoverable kind:verify job. Poll /api/runtime/jobs/{id}. The same request and target/options return the original job even after the item disappears; different recheck or expected fields conflict. The target is reread and matched before preparation; private drafts are refused. Self-attestation and existing results follow verifier policy; recheck:true explicitly records a new measurement without challenging the listing. Concurrent identical background/manual attempts share one verification; different artifacts/recheck options are refused while it runs. A running job may be preparing files or waiting for the model queue. Completion means an attestation was recorded, not that its benchmark passed or even ran: inspect passed and verified_on. Runtime fallback may produce hash-only evidence. Check capabilities.verification_jobs before using recovery.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type | Required | Description |
|---|---|---|---|
| `async` | `boolean` |   | Answer 202 with a job; poll /api/runtime/jobs/{id} for completion. |
| `request_id` | `string` |   | Optional recovery ID: capabilities.server_time + "-" + 128 random bits in lowercase hex. Supply together with instance and async:true. Reuse exactly this ID and parameters after a lost response; never generate a replacement automatically. |
| `instance` | `string` |   | The boot identity from GET /api/runtime/jobs/capabilities. Recovery IDs from a previous node instance are refused. (at most 64 characters) |
| `recheck` | `boolean` |   | Intentionally remeasure an existing result; a new FAIL can withdraw this node’s earlier PASS. |
| `expected` | `object` |   | Required for async verification. Exact selected fields from the anchor; included in recovery deduplication. |
| `expected.id` | `string` | yes |   |
| `expected.name` | `string` | yes |   |
| `expected.author` | `string` | yes |   |
| `expected.patch_sha256` | `string` | yes |   |
| `expected.benchmark_hash` | `string` | yes |   |
| `expected.created_at` | `integer` | yes | (at least 0) |
| `expected.model` | `object` | yes |   |
| `expected.model.id_M` | `string` | yes |   |
| `expected.base` | `object` |   |   |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | attestation | `object` |
| `202` | {job}: accepted or an existing job for this request ID. Completion can be done or failed; a missing target fails inside the job. A done job includes result text and outcome {result, stack, order?, loaded?, aliases?} for load/remove, or {result, attestation} for verification. A done verification may record PASS or FAIL; inspect passed and verified_on instead of treating done as benchmark success. |   |
| `400` | Malformed recovery ID, or request_id/instance supplied without each other and async:true. |   |
| `409` | verification_target_changed, verification_private_draft, verification_in_progress, self-attestation policy, already-attested without recheck or no clean baseline; async execution refusals are retained as failed jobs. |   |
| `429` | runtime_job_capacity: active/recent receipts fill the log; no new job was accepted. |   |

**`200` response body**

| Field | Type |
|---|---|
| `attestation` | [`Attestation`](./schemas.md#attestation) |

### `POST /api/patches/{id}/challenge`

Request re-verification (challenge)

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type |
|---|---|
| `reason` | `string` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | ok | `object` |

## Public record

ledger, provenance graph, network

### `GET /api/patches/{id}/records`

Ledger records about this knowledge

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | records | `object` |

### `GET /api/ledger`

Ledger records

Returns the NEWEST `limit` records (default 200, max 5000) plus `info`. There is no backward paging: when `info.records` is larger than the array you were given, you are looking at part of the record — say so rather than presenting it as the whole ledger.

**Auth** — none

**Parameters**

| Name | In | Type | Default | Description |
|---|---|---|---|---|
| `kind` | `query` | `"anchor"` \| `"attest"` \| `"settle"` \| `"challenge"` \| `"branch"` \| `"node"` \| `"supersede"` \| `"subscribe"` |   | filter server-side, over the WHOLE ledger (not over the window) |
| `limit` | `query` | `integer` | `200` |   |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | records | `object` |

### `GET /api/ledger/verify`

Ledger integrity check

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | result | `object` |

### `GET /api/ledger/graph`

Sources → derivatives graph (+ AIN knowledge graph)

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | graph | `object` |

### `GET /api/branches`

Knowledge tracks (branches)

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | list | `object` |

### `GET /api/route`

Find the branch and serving nodes for a context (e.g. jurisdiction=KR)

Every query parameter is one `key=value` attribute of the request. The track whose `context` matches the most of them wins (no match at all → `{branch: null, nodes: []}`), and `nodes` is the nodes CURRENTLY subscribed to that track according to the public subscribe/unsubscribe records — the ones that have bought and loaded its knowledge, so a request routed there is answered by a model that has it. Nothing is loaded or bought by this call; it only answers where to send the request. CLI: `ainize route jurisdiction=KR`.

**Auth** — none

**Parameters**

| Name | In | Type |
|---|---|---|
| `key=value` | `query` | `string` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | branch + nodes | `object` |

### `GET /api/nodes`

Known nodes and peers

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | list | `object` |

### `GET /api/events`

Node event log

**Auth** — none

**Parameters**

| Name | In | Type |
|---|---|---|
| `kind` | `query` | `string` |
| `limit` | `query` | `integer` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | events | `object` |

### `GET /api/docs`

OpenAPI + CLI reference bundle for the web /docs page

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | docs | `object` |

### `GET /api/patches/{id}/events`

Node events about this knowledge (verification logs, sales, live tests)

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `limit` | `query` | `integer` |   |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | events | `object` |

### `GET /api/openapi.json`

This document

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | OpenAPI | `object` |

### `GET /healthz`

Liveness: 200 while the process is up

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | ok, node, address, version, commit, deploymentManager, uptime_s | `object` |

**`200` response body**

| Field | Type | Description |
|---|---|---|
| `ok` | `boolean` |   |
| `node` | `string` |   |
| `address` | `string` |   |
| `version` | `string` |   |
| `commit` | `string` \| `null` | Git commit SHA this node was built from; null when unknown |
| `deploymentManager` | `"host"` \| `"kubernetes"` | Configured deployment manager, not proof of cluster membership |
| `uptime_s` | `integer` |   |

### `GET /readyz`

Readiness: 200 when the ledger is reachable and, for a serving/verifier node, the runtime is available; 503 with the failing check otherwise

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | ready — commit, deploymentManager, checks.ledger / checks.runtime / checks.peers | `object` |
| `503` | not ready — the same body, with the failing check |   |

## Organizations

a team's page on this node — README, members and roles (read \< contributor \< write \< admin), invites and join requests, resource groups, audit log. Membership by explicit row, the sign-in's email domain, or a linked AIN SSO organization; the role decides what a member may do with the agents shared with it (`visibility: org`, `orgId`)

### `GET /api/orgs`

The organizations the caller is in

Explicit membership, the sign-in's email domain (an AIN SSO session on `@comcom.ai` is in the organization that holds `comcom.ai`), or a linked AIN SSO organization the session is active in. A row written down for a domain or SSO member lasts only while that still holds. Anonymous callers get an empty list. `email_domain` / `domain_org` say whether the caller could create the organization for their own domain.

**Auth** — operator

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | list | `object` |

### `POST /api/orgs`

Create an organization

Anyone signed in. A domain can only be claimed by someone whose own verified email is on it, and belongs to one organization. The creator is the first admin.

**Auth** — none

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | yes |   |
| `name` | `string` | yes | (at most 80 characters) |
| `description` | `string` |   | (at most 500 characters) |
| `readme` | `string` |   | markdown shown at the top of the organization page (at most 20000 characters) |
| `domains` | `string`[] |   |   |
| `domainRole` | `"read"` \| `"contributor"` \| `"write"` \| `"admin"` |   | (default `"write"`) |

**Responses**

| Code | Description |
|---|---|
| `201` | the organization |
| `400` | `invalid_request` |
| `401` | `not_signed_in` |
| `403` | `domain_not_yours` |
| `409` | `id_taken` · `domain_taken` |
| `429` | `limit_reached` |

### `GET /api/orgs/{id}`

The organization page — members only

README, members (emails to admins only), the resource groups you are in, and the agents shared with it — hosted and linked agents whose `visibility` is `org` and whose `orgId` is this organization's id or one of its `ssoOrgIds` (`kind` says which; `groups` labels them, `hidden_agents` is always 0). Roles over those agents: `read` sees them \< `contributor` shares agents into it \< `write` changes any hosted one (spec, secrets, logs) \< `admin` also removes any of them and changes who sees them; and over the organization: `write` manages resource groups, `admin` members, invites, requests, settings, billing, security. A non-member gets 403 `not_member` with `can_request`.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | organization | `object` |
| `403` | `not_member` |   |
| `404` | `not_found` |   |

### `PUT /api/orgs/{id}`

Change settings — admin

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Description |
|---|---|---|
| `name` | `string` |   |
| `description` | `string` |   |
| `readme` | `string` |   |
| `domains` | `string`[] |   |
| `domainRole` | `"read"` \| `"contributor"` \| `"write"` \| `"admin"` |   |
| `ssoOrgIds` | `string`[] | AIN SSO organization ids (`org_…`) whose members are members here (at `domainRole`), whose API keys are the organization's (`write`), and whose shared agents fall under this organization's roles. Linking a new one needs a session that is an active member of it, and each AIN organization is linked to one organization only. |
| `spendCapCredits` | `integer` \| `null` |   |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | organization | `object` |
| `403` | `insufficient_role` · `domain_not_yours` · `sso_org_not_yours` |   |
| `409` | `domain_taken` · `sso_org_taken` |   |

### `DELETE /api/orgs/{id}`

Delete — admin; refused while agents are shared with it (`has_agents`)

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | deleted | `object` |
| `409` | `has_agents` |   |

### `GET /api/orgs/{id}/members`

Members and roles

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | members | `object` |

### `POST /api/orgs/{id}/members`

Add a member by principal — admin

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `principal` | `string` | yes | a wallet address or `sso:<sub>` |
| `role` | `"read"` \| `"contributor"` \| `"write"` \| `"admin"` |   |   |

**Responses**

| Code | Description |
|---|---|
| `201` | the member |

### `PUT /api/orgs/{id}/members/{principal}`

Change a member's role — admin; the last admin stays (`last_admin`)

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `principal` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required |
|---|---|---|
| `role` | `"read"` \| `"contributor"` \| `"write"` \| `"admin"` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | member | `object` |

### `DELETE /api/orgs/{id}/members/{principal}`

Remove a member (admin) or leave (anyone)

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `principal` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | removed | `object` |

### `POST /api/orgs/{id}/join`

Ask to join

Signed in, not a member. Admins see requests at `/requests` and approve with a role or reject.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type | Description |
|---|---|---|
| `message` | `string` | (at most 500 characters) |

**Responses**

| Code | Description |
|---|---|
| `202` | request recorded |
| `409` | `already_member` |

### `GET /api/orgs/{id}/requests`

Pending join requests — admin

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | requests | `object` |

### `POST /api/orgs/{id}/requests/{principal}/approve`

Approve a request — admin

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `principal` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type | Description |
|---|---|---|
| `role` | `"read"` \| `"contributor"` \| `"write"` \| `"admin"` | (default `"read"`) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | member | `object` |

### `DELETE /api/orgs/{id}/requests/{principal}`

Reject a request — admin

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `principal` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | rejected | `object` |

### `GET /api/orgs/{id}/invites`

Open invites (token prefixes only) — admin

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | invites | `object` |

### `POST /api/orgs/{id}/invites`

Make an invite link — admin

The link (`/org/join/{token}` on the site) is returned once; the list shows a prefix. Optional `email` pins it to one sign-in. One use.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type | Description |
|---|---|---|
| `role` | `"read"` \| `"contributor"` \| `"write"` \| `"admin"` | (default `"read"`) |
| `email` | `string` \| `null` |   |
| `ttlHours` | `integer` | (default `168`; at most 720) |

**Responses**

| Code | Description |
|---|---|
| `201` | the invite, with `url` |

### `DELETE /api/orgs/{id}/invites/{token}`

Revoke an invite — admin

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `token` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | revoked | `object` |

### `GET /api/orgs/join/{token}`

What an invite leads to

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `token` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | organization name and role | `object` |
| `404` | unknown, used or expired |   |

### `POST /api/orgs/join/{token}`

Accept an invite

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `token` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | the organization | `object` |
| `403` | `invite_for_someone_else` |   |
| `404` | unknown, used or expired |   |

### `GET /api/orgs/{id}/groups`

Resource groups (all for write+, else the ones you are in)

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | groups | `object` |

### `POST /api/orgs/{id}/groups`

Make a resource group — write

A label over members and agents (agent ids) for the organization page. It does not narrow who sees an agent: every member sees every agent shared with the organization.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required |
|---|---|---|
| `name` | `string` | yes |
| `members` | `string`[] |   |
| `agents` | `string`[] |   |

**Responses**

| Code | Description |
|---|---|
| `201` | the group |

### `PUT /api/orgs/{id}/groups/{groupId}`

Change a resource group — write

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `groupId` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | group | `object` |

### `DELETE /api/orgs/{id}/groups/{groupId}`

Delete a resource group — write

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `groupId` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | deleted | `object` |

### `GET /api/orgs/{id}/audit`

Audit log — admin

Who changed what: members, roles, invites, requests, groups, settings, and the agents shared with it (`agent.create`, `agent.update`, `agent.sharing`, `agent.secret` — names only, `agent.delete`). Newest first; the last 2000 entries are kept.

**Auth** — none

**Parameters**

| Name | In | Type | Required | Default |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `limit` | `query` | `integer` |   | `200` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | audit | `object` |

### `GET /api/orgs/{id}/billing`

Billing — admin

The API keys members made for the organization's AIN SSO organizations (`ssoOrgIds`), calls to each of the organization's agents, and the recorded spend cap. `spend_metered: false` — this node does not meter per-key inference spend yet; the page says so rather than drawing zeros.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | billing | `object` |

### `GET /api/orgs/{id}/security`

Security & SSO — admin

The AIN SSO issuer this node signs people in with and the AIN organizations linked, the domains that admit people, how each member got in, the admins, how many agents are shared with it (`private_agents` — listed to members only), and the newest audit entries.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | security | `object` |

## Agents

the A2A agents this node lists and serves at `/agents/{id}`: the operator's config agents, agents the node runs, agents people linked by URL, and peers' agents — one catalogue, which AIN Teams imports from; `/api/shared-agents` is the same catalogue in the ain-integration contract 1.0 shape

### `GET /git/{id}.git/info/refs`

Discover Git refs (smart HTTP)

Visibility is the same as reading the agent. Owner/organization writers may push and merge. A project-bound or mirrored source refuses local writes with read_only_source; edit and push its original repository instead. Git clients use HTTP Basic with an ainize API key as the password. Workspace sessions and bearer credentials also work.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `service` | `query` | `"git-upload-pack"` \| `"git-receive-pack"` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | Git service advertisement; application/x-git-*-advertisement |
| `401` | Git credential challenge |
| `404` | Unknown or unreadable repository |

### `POST /git/{id}.git/git-upload-pack`

Clone or fetch an agent repository

Visibility is the same as reading the agent. Owner/organization writers may push and merge. A project-bound or mirrored source refuses local writes with read_only_source; edit and push its original repository instead. Packs are binary. Incoming packs are limited to 64 MiB; repository objects are limited to 256 MiB by default (operator AINIZE_AGENT_GIT_MAX_BYTES override). All proposed refs are checked before they move, including non-deploying branches. A rejected pre-receive validation leaves refs unchanged. Main application finishes before receive-pack responds. Proposal branches do not deploy.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/x-git-upload-pack-request`, required

`{"type":"string","format":"binary"}`

**Responses**

| Code | Description |
|---|---|
| `200` | application/x-git-upload-pack-result (Git protocol reports accepted/rejected refs) |
| `401` | Git credential challenge |
| `404` | Unknown or unreadable repository |

### `POST /git/{id}.git/git-receive-pack`

Push an agent repository and apply main

Visibility is the same as reading the agent. Owner/organization writers may push and merge. A project-bound or mirrored source refuses local writes with read_only_source; edit and push its original repository instead. Packs are binary. Incoming packs are limited to 64 MiB; repository objects are limited to 256 MiB by default (operator AINIZE_AGENT_GIT_MAX_BYTES override). All proposed refs are checked before they move, including non-deploying branches. A rejected pre-receive validation leaves refs unchanged. Main application finishes before receive-pack responds. Proposal branches do not deploy.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/x-git-receive-pack-request`, required

`{"type":"string","format":"binary"}`

**Responses**

| Code | Description |
|---|---|
| `200` | application/x-git-receive-pack-result (Git protocol reports accepted/rejected refs) |
| `401` | Git credential challenge |
| `404` | Unknown or unreadable repository |

### `GET /api/hosted-agents/{id}/executions`

Read persisted runtime execution history

Visibility is the same as reading the agent. Owner/organization writers may push and merge. A project-bound or mirrored source refuses local writes with read_only_source; edit and push its original repository instead. Newest first; previous successful and failed executions survive restart. Private/no-store.

**Auth** — operator

**Parameters**

| Name | In | Type | Required | Default |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `limit` | `query` | `integer` |   | `50` |
| `offset` | `query` | `integer` |   | `0` |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `GET /api/hosted-agents/{id}/commits`

Read commit history

Visibility is the same as reading the agent. Owner/organization writers may push and merge. A project-bound or mirrored source refuses local writes with read_only_source; edit and push its original repository instead.

**Auth** — operator

**Parameters**

| Name | In | Type | Required | Default |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `ref` | `query` | `string` |   |   |
| `limit` | `query` | `integer` |   | `50` |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `GET /api/hosted-agents/{id}/refs`

Read branches and clone URL

Visibility is the same as reading the agent. Owner/organization writers may push and merge. A project-bound or mirrored source refuses local writes with read_only_source; edit and push its original repository instead.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `GET /api/hosted-agents/{id}/tree`

Read a file or paths at a ref

Visibility is the same as reading the agent. Owner/organization writers may push and merge. A project-bound or mirrored source refuses local writes with read_only_source; edit and push its original repository instead.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `ref` | `query` | `string` |   |
| `path` | `query` | `string` |   |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `GET /api/hosted-agents/{id}/diff`

Review a proposal diff

Three-dot diff from base to head. Cross-repository proposals expose their imported, pinned headCommit in the original repository.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `base` | `query` | `string` |   |
| `head` | `query` | `string` |   |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `POST /api/hosted-agents/{id}/forks`

Create a private source fork

Any authenticated reader may fork. The resulting fork is owner-only and creates no runtime or secrets. Ten forks per owner, one thousand total.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Description |
|---|---|---|
| `ref` | `string` | (default `"main"`) |

**Responses**

| Code | Description |
|---|---|
| `201` | { fork, clonePath } |
| `400` | Invalid source or fork quota reached |
| `401` | Sign in |
| `404` | No readable repository |

### `GET /api/agent-forks`

List your private repository forks

Authenticated owner only.

**Auth** — operator

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `DELETE /api/agent-forks/{id}`

Delete your private source fork

Owner only; an imported proposal SHA remains available for review and merge.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `GET /api/hosted-agents/{id}/pulls`

List repository proposals

Visibility is the same as reading the agent. Owner/organization writers may push and merge. A project-bound or mirrored source refuses local writes with read_only_source; edit and push its original repository instead.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `state` | `query` | `"open"` \| `"merged"` \| `"closed"` |   |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `POST /api/hosted-agents/{id}/pulls`

Open a branch or cross-repository proposal

An authenticated reader may propose an existing branch or their private fork via headAgent. Fork ownership and parent must match. The imported cross-repository head SHA is pinned when the proposal opens.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `head` | `string` | yes |   |
| `headAgent` | `string` |   |   |
| `base` | `string` |   | (default `"main"`) |
| `title` | `string` | yes | (1–120 characters) |
| `body` | `string` |   | (at most 4000 characters) |

**Responses**

| Code | Description |
|---|---|
| `201` | { pull } |
| `400` | Invalid branch or proposal |
| `401` | Sign in |
| `403` | Not your fork of this repository |
| `409` | Source is read-only |

### `GET /api/hosted-agents/{id}/pulls/{number}`

Read a proposal

Visibility is the same as reading the agent. Owner/organization writers may push and merge. A project-bound or mirrored source refuses local writes with read_only_source; edit and push its original repository instead.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `number` | `path` | `integer` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `POST /api/hosted-agents/{id}/pulls/{number}/merge`

Validate and merge a proposal

Visibility is the same as reading the agent. Owner/organization writers may push and merge. A project-bound or mirrored source refuses local writes with read_only_source; edit and push its original repository instead. Validates the merged result before refs move. Conflicts and invalid resulting specs are refused. Cross-repository merges use the reviewed SHA even after the fork changes or is deleted.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `number` | `path` | `integer` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `POST /api/hosted-agents/{id}/pulls/{number}/close`

Close a proposal

Proposal author or someone who may merge only.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `number` | `path` | `integer` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `GET /api/hosted-agents/{id}/pulls/{number}/comments`

Read proposal review comments

Same proposal visibility. Deleted comments retain author, anchor and deletion timestamp but their body is removed.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `number` | `path` | `integer` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `POST /api/hosted-agents/{id}/pulls/{number}/comments`

Add a general or source-anchored review comment

Authenticated proposal reader. An anchor requires an existing full commit SHA, path and line; comments are stored durably.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `number` | `path` | `integer` | yes |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `body` | `string` | yes | (1–8000 characters) |
| `commit` | `string` |   |   |
| `path` | `string` |   |   |
| `line` | `integer` |   | (at least 1) |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `PATCH /api/hosted-agents/{id}/pulls/{number}/comments/{comment}`

Edit your review comment

Comment author only.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `number` | `path` | `integer` | yes |
| `comment` | `path` | `integer` | yes |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `body` | `string` | yes | (1–8000 characters) |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `DELETE /api/hosted-agents/{id}/pulls/{number}/comments/{comment}`

Remove a review comment

Author or someone who may merge; retains a tombstone.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `number` | `path` | `integer` | yes |
| `comment` | `path` | `integer` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `GET /api/hosted-agents/{id}/mirror`

Read GitHub mirror state

Same agent visibility; includes last sync commit and error.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `PUT /api/hosted-agents/{id}/mirror`

Attach an agent to a GitHub source

Visibility is the same as reading the agent. Owner/organization writers may push and merge. A project-bound or mirrored source refuses local writes with read_only_source; edit and push its original repository instead. Fetches once, then periodically reconciles. Repository path selects the agent folder.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `url` | `string` | yes |   |
| `branch` | `string` |   | (default `"main"`) |
| `path` | `string` |   | (default `""`) |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `DELETE /api/hosted-agents/{id}/mirror`

Detach a GitHub mirror

Writers only. Stops following without reverting the current agent.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `POST /api/hosted-agents/{id}/mirror/sync`

Reconcile a GitHub mirror now

Writers only; sync shares the same serialized pipeline as automatic reconciliation.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `POST /api/agent-mirrors/webhook`

Reconcile mirrors after a signed GitHub push

AINIZE_AGENT_MIRROR_WEBHOOK_SECRET must be configured. X-Hub-Signature-256 is HMAC-SHA256 over the original request bytes. Only matching source/branch mirrors sync; the periodic timer recovers missed events.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `X-Hub-Signature-256` | `header` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | { synced } |
| `401` | Invalid signature |
| `404` | Webhook secret not configured |

### `POST /api/hosted-agents/{id}/preview-runs/{run}/export`

Export your proposal conversation

Current source visibility and record ownership required. Returns {run} and records the export receipt.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `run` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `DELETE /api/hosted-agents/{id}/preview-runs/{run}`

Delete your exported proposal conversation

Record owner only. A finished request and a prior export are required; otherwise 409.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `run` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `GET /api/hosted-agents/{id}/preview-runs`

Read your persisted proposal conversations

Authenticated reader and record owner only. Fixed source commit, model, request and bounded response survive preview expiry. Private/no-store.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `POST /api/hosted-agents/{id}/previews`

Start an isolated proposal runtime at a fixed SHA

Authenticated repository readers. The preview is owner-only, expires after fifteen minutes, inherits no production secrets/allowlist/media permissions, and never updates the source runtime. Two per person, eight total.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required |
|---|---|---|
| `ref` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `202` | { preview: { id, agent, commit, owner, createdAt, expiresAt, status, error } } |
| `401` | Sign in |
| `404` | No readable repository |
| `409` | Invalid source or preview quota/build failure |

### `GET /api/agent-previews/{preview}`

Read your temporary proposal runtime

Owner must still be able to read the source. Private/no-store; expired previews return 404.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `preview` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `DELETE /api/agent-previews/{preview}`

Stop your temporary proposal runtime

Owner only. Aborts active requests, revokes gateway authority and removes the temporary runtime and images.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `preview` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `POST /api/agent-previews/{preview}/rpc`

Talk to your proposal before merging

Owner/source-reader only, ready preview required. A2A JSON-RPC message/send, message/stream, tasks/get and tasks/cancel; maximum 64 KiB. JSON or SSE response. Expiry and client cancellation abort the upstream request.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `preview` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required |
|---|---|---|
| `jsonrpc` | `string` |   |
| `id` | `object` |   |
| `method` | `"message/send"` \| `"message/stream"` \| `"tasks/get"` \| `"tasks/cancel"` | yes |
| `params` | `object` |   |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `GET /api/shared-agents`

Agents this node runs or proxies, in the cross-product registry shape (contract 1.0)

The same list every product reads from every origin — hosted agents, linked agents and the operator's config agents alike. `public` needs no sign-in; `mine` and `shared_with_me` need a wallet or AIN SSO session; `shared_with_org` needs an AIN SSO session or an ORGANIZATION API KEY (`POST /api/keys {org_id}`, sent as `Authorization: Bearer ainize-sk-…`) and lists what is shared with that organization — the way a product with no browser session (AIN Teams) reads its organization's list. Sorted by `updatedAt` descending, then id.

**Auth** — operator

**Parameters**

| Name | In | Type | Required | Default | Description |
|---|---|---|---|---|---|
| `scope` | `query` | `"mine"` \| `"shared_with_me"` \| `"shared_with_org"` \| `"public"` | yes |   |   |
| `q` | `query` | `string` |   |   | case-insensitive substring over name and description |
| `org` | `query` | `string` |   |   | restrict to this organization; the caller must be a member |
| `cursor` | `query` | `string` |   |   | the `nextCursor` of the previous page |
| `limit` | `query` | `integer` |   | `50` |   |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | a page of agents | [`AgentListResponse`](./schemas.md#agentlistresponse) |
| `400` | malformed query |   |
| `401` | auth_required | [`ContractError`](./schemas.md#contracterror) |
| `403` | forbidden (not a member, or no SSO session for an organization listing) | [`ContractError`](./schemas.md#contracterror) |
| `429` | rate_limited |   |
| `503` | temporary_failure |   |

### `PUT /api/shared-agents/{id}/visibility`

Change who sees an agent (owner or organization admin, into organizations where they are contributor+; the node's operator anywhere)

Sets `visibility` and, for `org`, `orgId` on a hosted or linked agent without touching what it runs or where it points. The owner may share with an organization they belong to (an AIN SSO session's memberships, or the organization an API key was issued for); the operator may share ANY agent with ANY organization — that is how the agents already on a node become an organization's list. A config agent's sharing lives in config.json (`agents[].visibility`, `agents[].orgId`) and is refused here with that field named. An agent the caller may not see is `resource_deleted` (410), never 403. The change is a new release (`v<n>` / `linked-v<n>`) and appears in the events feed.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `visibility` | `"public"` \| `"org"` \| `"private"` \| `"unlisted"` | yes |   |
| `orgId` | `string,null` |   | required with `org`; must be absent otherwise |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | the agent as the registry now lists it | `object` |
| `400` | invalid_request — malformed, or a config agent (edit config.json) |   |
| `401` | auth_required |   |
| `403` | forbidden — not the owner or the operator, or not a member of `orgId` |   |
| `410` | resource_deleted — no such agent, or one the caller may not see |   |

**`200` response body**

| Field | Type |
|---|---|
| `agent` | [`AgentRef`](./schemas.md#agentref) |

### `GET /api/agent-aliases/{name}`

Resolve an agent alias (or id) to the agent's canonical id

An alias is a readable second address for an agent whose id is not one (`external-e20458854c448acf7809` → `agent-m`). `name` may be an alias or an id; the answer is the canonical `id` and its `alias` (null when it has none). An agent the caller may not see is 404, the same as by id — an alias never confirms an agent its id would not. `/agents/{alias}` (card and JSON-RPC) reaches the same agent; its card `url` stays the canonical id.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `name` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | the agent behind the name | `object` |
| `404` | not_found — no such alias or id, or one the caller may not see |   |

**`200` response body**

| Field | Type | Required |
|---|---|---|
| `id` | `string` | yes |
| `alias` | `string,null` | yes |

### `PUT /api/agents/{id}/alias`

Give an agent a readable alias (replaces its current one)

The id never changes; the alias is an extra address. Rules: 1–40 of `[a-z0-9-]`, not starting with a hyphen; not any agent's id (config, hosted, linked) and not another agent's alias; one per agent. Who: a hosted agent's owner or a `write` member of the organization it is shared with; a linked agent's registrant; the node's operator for any agent (a config agent only by the operator). A new agent cannot be created with an id that is a live alias (`id_taken`).

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required |
|---|---|---|
| `alias` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | the alias now set | `object` |
| `400` | invalid_request — breaks the id rule, or is the agent's own id |   |
| `401` | not_signed_in |   |
| `403` | not_owner |   |
| `404` | not_found — no such agent, or one the caller may not see |   |
| `409` | alias_taken — another agent's id or alias |   |

**`200` response body**

| Field | Type |
|---|---|
| `id` | `string` |
| `alias` | `string` |

### `DELETE /api/agents/{id}/alias`

Remove an agent's alias

Same permissions as setting one. The agent keeps its id; `/agents/{alias}` stops reaching it and the name is free again.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | the alias removed | `object` |
| `401` | not_signed_in |   |
| `403` | not_owner |   |
| `404` | not_found |   |

**`200` response body**

| Field | Type |
|---|---|
| `id` | `string` |
| `alias` | `null` |

### `GET /api/shared-agents/events`

Changes to the shared agent registry since a cursor (contract 1.0)

An in-memory feed of the last 1000 changes: `agent.published` on create, `agent.updated` on change, `agent.unpublished` when visibility leaves public/org, `agent.deleted` on delete. Apply an event only when its `version` is newer than what you hold; on `gap: true`, re-list.

**Auth** — operator

**Parameters**

| Name | In | Type | Description |
|---|---|---|---|
| `cursor` | `query` | `string` | the `nextCursor` of the previous page; absent = everything held |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | a page of events | [`AgentEventPage`](./schemas.md#agenteventpage) |
| `400` | malformed cursor |   |
| `429` | rate_limited |   |

### `GET /api/agents`

The agent catalogue

Every agent this node lists, whoever runs it: config agents (health-probed), agents the node runs, agents people linked by URL, and agents on peers (from gossip; `node` names the peer, `call_url` is the mesh path through this node). `?model=` narrows to the agents built on one model. Without `?org=` it lists public agents only; `?org=<id>` lists one organization's agents — those shared with it (`visibility: org`), by an ainize organization id or an AIN SSO org id it links — to its members, and nothing to anyone else (peers' agents are left out). This is the list AIN Teams imports from — a workspace never receives an agent that is not a row here.

**Auth** — operator

**Parameters**

| Name | In | Type |
|---|---|---|
| `model` | `query` | `string` |
| `org` | `query` | `string` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | catalogue | `object` |

**`200` response body**

| Field | Type | Description |
|---|---|---|
| `agents` | `object`[] |   |
| `agents[].id` | `string` |   |
| `agents[].name` | `string` |   |
| `agents[].description` | `string,null` |   |
| `agents[].skills` | `object`[] |   |
| `agents[].protocols` | `string`[] |   |
| `agents[].a2a_url` | `string` | the address to hand to an A2A client — this node's, never the upstream |
| `agents[].card_url` | `string` |   |
| `agents[].call_url` | `string` |   |
| `agents[].reachable` | `boolean,null` |   |
| `agents[].kind` | `"upstream"` \| `"prompt"` \| `"tools"` \| `"handler"` |   |
| `agents[].owner` | `string,null` | the principal that registered or built it (a lower-case wallet address, or `sso:<sub>`); null for the operator's config agents and unknown for peers' that do not say |
| `agents[].model` | `string,null` |   |
| `agents[].visibility` | `"public"` \| `"org"` \| `"private"` \| `"unlisted"` |   |
| `agents[].org_id` | `string,null` |   |
| `agents[].node` | `object,null` | set for a peer's agent: who runs it, never where |

### `GET /api/linked-agents`

Linked agents — external A2A agents people registered by URL

What the caller may see: everyone the `public` ones; a signed-in caller also their own and the `org` ones of organizations they belong to. Rows carry `visibility` and `org_id`.

**Auth** — operator

**Parameters**

| Name | In | Type | Description |
|---|---|---|---|
| `mine` | `query` | `boolean` | only the caller's own (needs a session) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | list | `object` |

### `POST /api/linked-agents`

Register an external A2A agent

Anyone signed in — a wallet session, an AIN SSO session, or an Ainize API key as `Authorization: Bearer` (an organization key may share with its organization: how AIN Teams registers the agents built in it). The node fetches the card once (`reachable` and `card` in the answer say what it found; an agent that is not up yet may still be registered), then lists the agent at `/agents/{id}` and proxies JSON-RPC to `upstream`. Only the registering account may change or remove it.

**Auth** — none

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | yes | becomes the public address `/agents/{id}`; cannot change |
| `name` | `string` |   | omitted → the card's name (at most 80 characters) |
| `description` | `string` |   | (at most 500 characters) |
| `upstream` | `string (uri)` | yes | where the agent listens; must resolve to a public address; never published |
| `visibility` | `"public"` \| `"org"` \| `"private"` \| `"unlisted"` |   | who sees it listed — the same four values a hosted agent has (default `"public"`) |
| `orgId` | `string,null` |   | with `org`: the AIN SSO organization to share with; the caller must belong to it (an SSO session, or an organization API key) |

**Responses**

| Code | Description |
|---|---|
| `201` | registered |
| `400` | `invalid_request` · `upstream_not_public` · `name_required` |
| `401` | `not_signed_in` |
| `409` | `id_taken` — a config, hosted or linked agent already has the id |
| `429` | `limit_reached` |

### `GET /api/linked-agents/{id}`

One linked agent — the owner sees the upstream too; anyone it is visible to sees the listing view; 404 otherwise

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | agent | `object` |
| `403` | `not_owner` |   |
| `404` | `not_found` |   |

### `PUT /api/linked-agents/{id}`

Change a linked agent — owner only; the id cannot change

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | yes | becomes the public address `/agents/{id}`; cannot change |
| `name` | `string` |   | omitted → the card's name (at most 80 characters) |
| `description` | `string` |   | (at most 500 characters) |
| `upstream` | `string (uri)` | yes | where the agent listens; must resolve to a public address; never published |
| `visibility` | `"public"` \| `"org"` \| `"private"` \| `"unlisted"` |   | who sees it listed — the same four values a hosted agent has (default `"public"`) |
| `orgId` | `string,null` |   | with `org`: the AIN SSO organization to share with; the caller must belong to it (an SSO session, or an organization API key) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | agent | `object` |
| `400` | invalid, or the id differs |   |
| `403` | `not_owner` |   |

### `DELETE /api/linked-agents/{id}`

Remove a linked agent — its registrant, or an admin of the organization it is shared with

The address stops answering. A workspace that imported it keeps its member row and sees the agent go offline; it is that workspace's to remove.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | deleted | `object` |
| `403` | `not_owner` |   |

### `GET /api/agent-archives`

List your privately retained deleted agents

Owner only; private/no-store. Lists summaries with total, limit and offset; another owner sees no records. Runtime secret values are never archived.

**Auth** — none

**Parameters**

| Name | In | Type | Default |
|---|---|---|---|
| `limit` | `query` | `integer` | `10` |
| `offset` | `query` | `integer` | `0` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | archives, total, limit, offset | `object` |
| `400` | Invalid pagination |   |
| `401` | Sign-in required |   |

### `GET /api/agent-archives/{id}`

Read your archived spec, reviews and execution evidence

Owner only; private/no-store. Includes mirror/source metadata and whether a Git bundle exists. Other owners receive 404.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | archive | `object` |
| `401` | Sign-in required |   |
| `404` | Archive not found |   |

### `DELETE /api/agent-archives/{id}`

Permanently remove an exported archive

Owner only. Requires successful complete export first; serialized with export and repository mutations. Does not delete an independently restored repository.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | deleted | `object` |
| `401` | Sign-in required |   |
| `404` | Archive not found |   |
| `409` | export_required |   |

### `POST /api/agent-archives/{id}/restore`

Restore your deleted agent at the same address

Owner only. No body overrides. Restores the last successful active version when recorded, preserving newer failed history under an archive branch. Retains review/execution history and original source identity; project source SHAs remain distinct from projection SHAs. Reinstalls Git validation hooks, issues a fresh PoP key and waits for the runtime to be ready. Hosted-agent secret values are not restored; secretsRequired names what the owner must set again. Project-agent environment snapshots are excluded from archives and removed on agent deletion. A project agent with a snapshot reference requires the matching readable encrypted snapshot and active version before any restore mutation; otherwise 409 project_environment_required directs the owner to recover the snapshot or redeploy from project settings. Current model/media/Docker availability and organization contributor permission are revalidated. A collision never overwrites an existing agent. Failed application removes the attempted restored state while retaining the archive for retry.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `201` | agentId, version, commit, sourceCommit, status=ready, secretsRequired |
| `400` | invalid_request or model_not_served |
| `401` | Sign-in required |
| `403` | Current organization sharing permission required |
| `404` | Archive not found |
| `409` | id_taken, state_exists, active_version_missing, project_binding_conflict or project_environment_required |
| `429` | Hosted agent quota reached |
| `501` | docker_unavailable |
| `502` | restore_failed or restore_cleanup_failed |

### `POST /api/agent-archives/{id}/export`

Download your complete deleted-agent archive

Owner only; private/no-store. A gzip tar containing metadata.json (format ainize.agent-archive, version 1) and repository.bundle for complete Git repositories, or repository.tar.gz for shallow mirrors. Bundles are independently cloneable; shallow archives preserve objects, refs and shallow boundaries for extraction into an initialized bare repository. Repository configuration and hooks are excluded. Metadata-only legacy agents omit the repository artifact. Runtime secret values and PoP private keys are excluded. A completed export permits permanent archive removal; an interrupted or failed export does not.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | Download attachment | `object` |
| `401` | Sign-in required |   |
| `404` | Archive not found |   |
| `502` | export_failed |   |

### `GET /api/hosted-agents`

Hosted agents — agents this node runs

What the caller may see: everyone the `public` ones; a signed-in caller also their own and the `org` ones of organizations they belong to. Rows carry `visibility`, `org_id` and `updated_by`; with `mine` or `manageable` also `can_manage` and `can_delete`.

**Auth** — operator

**Parameters**

| Name | In | Type | Description |
|---|---|---|---|
| `mine` | `query` | `boolean` | only the caller's own (needs a session) |
| `manageable` | `query` | `boolean` | the caller's own plus those shared (`org`) with an organization where they are `write` or above — what a sync client such as AinCode works on (needs a session) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | list | `object` |
| `401` | `not_signed_in` (with `mine` or `manageable`) |   |

### `POST /api/hosted-agents`

Create a hosted agent

Anyone signed in — a wallet session, an AIN SSO session, or an Ainize API key. The body is the agent spec (`id`, `name`, `description`, `model`, `systemPrompt`, `mode` prompt|tools|handler, `files`, `a2ui`, `allowedHosts`, `secretNames`, `media`, `skills`, `visibility`, `orgId`). `org` visibility needs a caller who belongs to `orgId`.

**Auth** — none

**Request body** — `application/json`, required

`{"type":"object","required":["id","name","model"]}`

**Responses**

| Code | Description |
|---|---|
| `201` | created |
| `400` | `invalid_request` · `model_not_served` |
| `401` | `not_signed_in` |
| `409` | `id_taken` |
| `413` | `repository_storage_limit`; attempted creation is removed before publication |
| `429` | `limit_reached` |
| `501` | `docker_unavailable` (code modes) |

### `GET /api/hosted-agents/{id}`

One hosted agent — its owner and `write` members of the organization it is shared with see the whole spec (prompt, files, secret names); anyone else it is visible to sees the listing view; 404 otherwise

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | agent | `object` |
| `404` | `not_found` |   |

### `PUT /api/hosted-agents/{id}`

Change a hosted agent — its owner, or a `write` member of the organization it is shared with; only the owner or an organization `admin` may change `visibility`/`orgId` (sharing into an organization takes `contributor` there); the id cannot change

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, required

`{"type":"object","required":["id","name","model"]}`

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | agent (records `updated_by`) | `object` |
| `400` | invalid, or the id differs |   |
| `403` | `not_owner` |   |
| `404` | `not_found` — not visible to the caller |   |
| `413` | `repository_storage_limit`; stored release and live runtime remain unchanged |   |

### `DELETE /api/hosted-agents/{id}`

Remove a hosted agent — its owner, or an `admin` of the organization it is shared with

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | deleted | `object` |
| `403` | `not_owner` |   |
| `404` | `not_found` |   |

### `PUT /api/hosted-agents/{id}/secrets/{name}`

Set (`{ value }`) or clear (`{ value: null }`) a secret — owner or `write` member of its organization; write-only

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `name` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | name, set | `object` |
| `403` | `not_owner` |   |
| `404` | `not_found` |   |

### `GET /agents/{id}/.well-known/agent-card.json`

Read the A2A card; bound AINFT agents advertise current-holder authentication

**Auth** — operator

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | A2A agent card | `object` |
| `404` | Agent not found |   |

### `POST /agents/{id}`

Call an A2A agent; a bound AINFT executes in the current holder’s private workspace

For bound native AINFT agents: A2A 0.3 JSON-RPC message/send, message/stream, tasks/get and tasks/cancel. Authenticate using the native wallet session or x-ainft-auth: \<address>:\<timestamp>:\<signature>:v2. Sign with purpose ainft, destination node, HTTP method, destination path and exact request body using the request-bound core authentication format. Replay is refused. Streaming sends the task, result artifact and final status. Tasks remain wallet-scoped after transfer. Unbound agents retain their existing protocol.

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | JSON-RPC task/result/error or server-sent events | `object` |
| `401` | Wallet session or native holder proof required |   |
| `403` | Current ownership cannot be verified |   |
| `409` | AINFT binding release differs from current agent release |   |

### `GET /api/hosted-agents/{id}/ainft-binding`

Read the verified AINFT registration snapshot for a visible agent

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | binding or null; registration indexing is not current holder authorization | `object` |
| `404` | `not_found` or not visible |   |

### `POST /api/hosted-agents/{id}/ainft-binding`

Verify Factory wallet indexing and persist a token binding — agent creator only

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required |
|---|---|---|
| `chainId` | `0` \| `1` | yes |
| `objectId` | `string` | yes |
| `tokenId` | `string` | yes |
| `address` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | binding | `object` |
| `400` | `invalid_request` |   |
| `401` | `not_signed_in` |   |
| `403` | `not_owner` |   |
| `409` | `ainft_not_verified` or `version_conflict` |   |
| `503` | `ainft_unavailable` |   |

### `GET /api/hosted-agents/{id}/holder-access`

Check the signed-in native wallet against current on-chain AINFT ownership

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | current holder access | `object` |
| `401` | Native wallet session required |   |
| `403` | Ownership cannot be verified |   |

### `GET /api/hosted-agents/{id}/companion`

Read the current holder’s private persisted tasks, memories and activity experience

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | wallet-scoped private workspace; no-store | `object` |
| `401` | Wallet session required |   |
| `403` | Current holder required |   |

### `POST /api/hosted-agents/{id}/companion/tasks`

Queue idempotent private chat or work; body: key, kind (chat/task), input

**Auth** — none

**Responses**

| Code | Description |
|---|---|
| `200` | Previously submitted task |
| `202` | Queued task |
| `403` | Current holder required |
| `409` | Conflicting key or outstanding task limit |

### `POST /api/hosted-agents/{id}/companion/tasks/{taskId}/cancel`

Cancel queued work; already running work cannot claim safe cancellation

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | task | `object` |
| `403` | Current holder required |   |
| `409` | Task missing or already executing |   |

### `POST /api/hosted-agents/{id}/companion/memories`

Propose private memory from a completed task; body: sourceTask, text

**Auth** — none

**Responses**

| Code | Description |
|---|---|
| `201` | Memory proposal; inactive until approved |
| `403` | Current holder required |
| `409` | Invalid source task or memory limit |

### `POST /api/hosted-agents/{id}/ainft-community`

Creator configures the existing Factory community and credit symbol for the current bound release. Body: expectedVersion, community:{appId,symbol} or null to disconnect. Persists a monotonically increasing configuration version; stale saves fail. Does not create balances, award credits or purchase benefits.

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | Binding with community and communityVersion | `object` |
| `400` | Invalid configuration |   |
| `403` | Agent creator required |   |
| `409` | Current binding required or configuration changed |   |

### `GET /api/hosted-agents/{id}/companion/credits`

Current holder reads the configured Factory credit community, binding chain and configuration version; no-store. Wallet-signed Factory auth/user and credit/balance reads independently verify the user-to-wallet mapping and balance. No purchase or reward is performed.

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | chainId, version and community or null | `object` |
| `403` | Current holder required |   |
| `409` | Bound release changed |   |

### `POST /api/hosted-agents/{id}/companion/learning/examples`

Save a holder-reviewed private question and answer sourced from approved memory; body: key, memoryId, prompt (up to 400 characters), answer (up to 200), optional altPrompt (a different reviewed evaluation question, up to 400), consent:true. Training requires altPrompt for every selected example. Does not start training or publish data. Read examples through the companion workspace.

**Auth** — none

**Responses**

| Code | Description |
|---|---|
| `200` | Idempotent retry |
| `201` | Reviewed private example |
| `400` | Review and consent required |
| `403` | Current holder required |
| `409` | Memory inactive, conflicting key or example limit |

### `GET /api/hosted-agents/{id}/companion/learning`

Read exact-model local training capability and this holder’s persisted training jobs; no-store. Job status is read from TeachWorker.

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | capability and private runs | `object` |
| `403` | Current holder required |   |

### `GET /api/hosted-agents/{id}/companion/learning/runs/{runId}/publication-challenge`

Get the existing Teach signed publication claim for this holder’s READY lesson. Source examples must still be approved. This companion flow publishes a free knowledge patch, keeps dataset rows private and takes no payout share.

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | Private publication challenge | `object` |
| `403` | Current holder required |   |
| `409` | Lesson not publishable or publication disabled |   |

### `POST /api/hosted-agents/{id}/companion/learning/runs/{runId}/publish`

Submit a private lesson for shared publication using TeachWorker’s signature verification and operator review policy. Body: key, name, description?, license, claim_sig, consent:{permanent:true,rights:true}. Publication intent persists before submission; unknown outcomes are never replayed. Free patch, private dataset, no payout share. Submission is not proof of announcement or a credit reward.

**Auth** — none

**Responses**

| Code | Description |
|---|---|
| `200` | Existing submission; may require reconciliation |
| `202` | Recorded Teach publication result, possibly pending review |
| `400` | Signature and both consent declarations required |
| `403` | Current holder required |
| `409` | Inactive lesson or conflicting submission key |
| `503` | Publication outcome unknown; operator reconciliation required |

### `POST /api/hosted-agents/{id}/companion/learning/select`

Choose a READY private lesson for subsequent holder conversations, or runId:null to restore base behavior; body: key, runId, model, consent:true. Each local model call applies the chosen lesson under an exclusive lease and restores all journaled rows afterwards. Missing or failed cleanup blocks shared generation. Revoked examples and changed releases invalidate the selection; prior lessons never become active automatically.

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | Persisted private selection | `object` |
| `400` | Selection and consent required |   |
| `403` | Current holder required |   |
| `409` | Lesson not ready, incompatible model, inactive examples or conflicting key |   |

### `POST /api/hosted-agents/{id}/companion/learning/train`

Submit reviewed examples to real compatible TeachWorker; body: key, exampleIds[], model, consent:true. Does not publish or permanently apply the draft. Training may record wallet address, state and dataset hash on the configured chain. Unknown submissions are never replayed.

**Auth** — none

**Responses**

| Code | Description |
|---|---|
| `200` | Existing submission; may require outcome reconciliation |
| `202` | Persisted TeachWorker job id |
| `400` | Selection, model and consent required |
| `403` | Current holder required |
| `409` | Incompatible runtime, inactive examples or conflicting key |
| `503` | Submission outcome unknown; operator reconciliation required |

### `POST /api/hosted-agents/{id}/companion/learning/examples/{exampleId}/withdraw`

Withdraw a private learning example. Revoking its source memory also withdraws it. Does not claim to undo an already trained model.

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | withdrawn example | `object` |
| `403` | Current holder required |   |
| `404` | Example not found in this holder workspace |   |

### `POST /api/hosted-agents/{id}/companion/memories/{memoryId}/revoke`

Withdraw approved private memory from future memory context; existing conversation records remain

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | memory | `object` |
| `403` | Current holder required |   |
| `404` | Memory not found |   |

### `POST /api/hosted-agents/{id}/companion/memories/{memoryId}/decision`

Approve or reject private memory; body: approve boolean

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | memory | `object` |
| `403` | Current holder required |   |
| `404` | Memory not found |   |

### `GET /api/hosted-agents/{id}/ainft-metadata`

Export wallet-compatible native AINFT metadata; does not mint or register a token

Uses the same visibility check as the agent detail. Returns public name, description, avatar, detail URL and versioned ainize extension; never prompt, code or secrets.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | name, description, image, external_url, ainize | `object` |
| `404` | `not_found` or not visible to the caller |   |

### `GET /api/ainft/avatar.svg`

Public default avatar for Ainize AINFT metadata

**Auth** — operator

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | SVG image | `object` |

### `GET /api/hosted-agents/{id}/logs`

Recent log lines — owner or `write` member of its organization

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | lines | `object` |
| `403` | `not_owner` |   |
| `404` | `not_found` |   |

## Projects

a deployment bound to a git repository that lives in an aindrive drive (`https://aindrive.ainetwork.ai/<org>/git/<repo>`) — ainize keeps no repository; aindrive calls the push hook, the node clones that commit and runs it (docs/PROJECTS.md)

### `GET /api/projects/{id}/source`

Read the manifest from an immutable execution source

Same project viewer/actor permission as Run. Deployed means last successful active deployment; a newer failure does not replace it. Returns {repoId,target,sha,sourcePath,manifest}, private/no-store. Use the returned SHA with target=commit to keep form and execution together.

**Auth** — operator

**Parameters**

| Name | In | Type | Required | Default |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `target` | `query` | `"head"` \| `"commit"` \| `"deployed"` |   | `"head"` |
| `sha` | `query` | `string` |   |   |

**Responses**

| Code | Description |
|---|---|
| `200` | Result; read responses use application/json unless described otherwise |
| `400` | Invalid request or ref |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Unknown or unreadable resource |
| `409` | Read-only source, conflict or runtime not ready |

### `POST /api/projects/{id}/ax-runs`

Create an AX run awaiting signed approval

Requires an existing project owner/member session and AINIZE_AX_PROJECT_ADMISSION=true. This is durable admission only; runtime dispatch requires the AX executor. No tenant or cluster can be supplied by the caller.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `dataRequired` | `boolean` |   | Wait for explicit data grant selection before execution |
| `target` | `object` | yes |   |
| `sha` | `string` | yes |   |
| `entry` | `string` |   | (at most 200 characters) |
| `inputs` | `object` |   |   |
| `env` | `object` |   |   |

**Responses**

| Code | Description |
|---|---|
| `202` | Persisted AX run/approval; not evidence of execution |
| `400` | Invalid request |
| `401` | Sign-in required |
| `403` | Project access or execution approval denied |
| `404` | Project/run absent or hidden |
| `409` | Registration or run state incompatible |
| `503` | AX admission disabled |

### `POST /api/projects/{id}/deployments/{deploymentId}/ax-approval`

Verify a run-scoped SSO delegation and enqueue the AX run

Requires an existing project owner/member session and AINIZE_AX_PROJECT_ADMISSION=true. This is durable admission only; runtime dispatch requires the AX executor. No tenant or cluster can be supplied by the caller.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `deploymentId` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `token` | `string` | yes | AIN SSO resource delegation; never stored verbatim (1–32768 characters) |
| `proof` | `string` | yes | PoP for POST to the configured origin and this exact approval path (1–8192 characters) |

**Responses**

| Code | Description |
|---|---|
| `202` | Persisted AX run/approval; not evidence of execution |
| `400` | Invalid request |
| `401` | Sign-in required |
| `403` | Project access or execution approval denied |
| `404` | Project/run absent or hidden |
| `409` | Registration or run state incompatible |
| `503` | AX admission disabled |

### `POST /api/projects/{id}/deployments/{deploymentId}/ax-data/key`

AX data key

Requires an active approved AX run, project owner/member access, and AINIZE_AX_AINDRIVE_ORIGIN. Subject and organization of data grants must match the immutable run approval. Local revocation does not revoke the token at SSO.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `deploymentId` | `path` | `string` | yes |

**Request body** — `application/json`, required

`{"type":"object","additionalProperties":false}`

**Responses**

| Code | Description |
|---|---|
| `200` | Public run PoP key, agent and product audience |
| `201` | Admitted delegation ID, expiry and stored file references; no token |
| `202` | Data selection persisted and run requeued; execution still checks current authorization |
| `204` | Local data grant retired |
| `400` | Invalid input |
| `401` | Sign-in required |
| `403` | Data admission denied |
| `404` | Project/run absent or hidden |
| `409` | Run is not active |
| `503` | Data admission disabled |

### `POST /api/projects/{id}/deployments/{deploymentId}/ax-data/grants`

AX data grants

Requires an active approved AX run, project owner/member access, and AINIZE_AX_AINDRIVE_ORIGIN. Subject and organization of data grants must match the immutable run approval. Local revocation does not revoke the token at SSO.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `deploymentId` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `token` | `string` | yes | SSO data delegation bound to this run PoP key; encrypted at rest (at most 32768 characters) |
| `resources` | `object`[] | yes | (1–64 items) |
| `resources[].resource` | `string` | yes |   |
| `resources[].actions` | `"read"` \| `"list"`[] | yes |   |
| `files` | `object`[] | yes | (1–64 items) |
| `files[].driveId` | `string` | yes |   |
| `files[].fileId` | `string` | yes |   |
| `files[].path` | `string` | yes | Canonical relative AinDrive path matching fileId |
| `files[].revision` | `string` |   |   |

**Responses**

| Code | Description |
|---|---|
| `200` | Public run PoP key, agent and product audience |
| `201` | Admitted delegation ID, expiry and stored file references; no token |
| `202` | Data selection persisted and run requeued; execution still checks current authorization |
| `204` | Local data grant retired |
| `400` | Invalid input |
| `401` | Sign-in required |
| `403` | Data admission denied |
| `404` | Project/run absent or hidden |
| `409` | Run is not active |
| `503` | Data admission disabled |

### `POST /api/projects/{id}/deployments/{deploymentId}/ax-data/revoke`

AX data revoke

Requires an active approved AX run, project owner/member access, and AINIZE_AX_AINDRIVE_ORIGIN. Subject and organization of data grants must match the immutable run approval. Local revocation does not revoke the token at SSO.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `deploymentId` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required |
|---|---|---|
| `delegationId` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | Public run PoP key, agent and product audience |
| `201` | Admitted delegation ID, expiry and stored file references; no token |
| `202` | Data selection persisted and run requeued; execution still checks current authorization |
| `204` | Local data grant retired |
| `400` | Invalid input |
| `401` | Sign-in required |
| `403` | Data admission denied |
| `404` | Project/run absent or hidden |
| `409` | Run is not active |
| `503` | Data admission disabled |

### `POST /api/projects/{id}/deployments/{deploymentId}/ax-data/ready`

AX data ready

Requires an active approved AX run, project owner/member access, and AINIZE_AX_AINDRIVE_ORIGIN. Subject and organization of data grants must match the immutable run approval. Local revocation does not revoke the token at SSO.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `deploymentId` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `grantIds` | `string`[] | yes | (1–64 items) |

**Responses**

| Code | Description |
|---|---|
| `200` | Public run PoP key, agent and product audience |
| `201` | Admitted delegation ID, expiry and stored file references; no token |
| `202` | Data selection persisted and run requeued; execution still checks current authorization |
| `204` | Local data grant retired |
| `400` | Invalid input |
| `401` | Sign-in required |
| `403` | Data admission denied |
| `404` | Project/run absent or hidden |
| `409` | Run is not active |
| `503` | Data admission disabled |

### `GET /api/ax/runs/{deploymentId}/data/{grantId}/files/{referenceId}`

Read an admitted AinDrive file from an AX workload

Bearer must be a native Substrate actor JWT. Checks live workload/run approval and data delegation, then reads the stored reference through the fixed AinDrive origin. No query parameters or destination overrides. Returns content, encoding, mime and decoded byte count.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `deploymentId` | `path` | `string` | yes |
| `grantId` | `path` | `string` | yes |
| `referenceId` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | Bounded file content envelope |
| `400` | Invalid identifier or query override |
| `401` | Missing workload JWT |
| `403` | Workload, grant or file access denied |
| `413` | File exceeds bounds |
| `429` | Four concurrent reads already active |
| `502` | Origin request or response failed |
| `503` | Origin offline or broker stopping |

### `POST /api/ax/runs/{deploymentId}/v1/chat/completions`

Invoke a delegated model from an authenticated AX workload

Bearer is a native Substrate actor JWT, not an operator token. Requires AINIZE_AX_BROKER_MODELS_FILE, fixed broker issuer/JWKS, an active UID-bound project run, and the exact model resource invoke grant. Supports bounded JSON responses with stream=false. User credentials stay inside the node; its existing model gateway applies account and usage checks. Gateway JWT injection must be configured separately.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `deploymentId` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required |
|---|---|---|
| `model` | `string` | yes |
| `messages` | `object`[] | yes |
| `stream` | `object` |   |

**Responses**

| Code | Description |
|---|---|
| `200` | Bounded model JSON response |
| `400` | Invalid request or streaming requested |
| `401` | Missing workload token |
| `403` | Workload, delegation or model permission denied |
| `429` | Broker concurrency limit or model quota |
| `502` | Model gateway failed or returned an unsafe/oversized response |

### `GET /api/projects`

The caller's projects

**Auth** — operator

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | projects | `object` |

### `POST /api/projects`

Bind an aindrive git repository as a project

Anyone signed in (AIN SSO, wallet session or API key) — but a repository whose `<org>` slug maps to an organization this node knows only by an active member of it (403 `not_member`); such a project is org-private. A repository the node cannot tie to an organization (another slug, the drive-id form) is public and cloned with `deployToken` or anonymously, never with the node's machine identity. Body `{ repo, branch?: "main", kind?, entry?, name?, deployToken? }`; `repo` is the aindrive URL (`https://aindrive.ainetwork.ai/<org>/git/<repo>` or `/api/drives/<id>/git/<path>`). `kind` and `entry` are hints for the row only — what deploys is always the commit's `ainize.json` (nextjs | service | script | agent; nextjs is the default when package.json depends on next). `deployToken` is an aindrive token (session JWT or `aind_aat_…` with `drives:read`) the clone presents — sealed at rest, never read back. The answer carries `webhookSecret` ONCE: aindrive signs the push hook with it. 409 `repo_taken` when the repo+branch is already a project here.

**Auth** — operator

**Request body** — `application/json`, optional

| Field | Type | Required | Description |
|---|---|---|---|
| `repo` | `string` | yes |   |
| `branch` | `string` |   | (default `"main"`) |
| `kind` | `"nextjs"` \| `"service"` \| `"script"` \| `"agent"` |   |   |
| `entry` | `string` |   |   |
| `name` | `string` |   |   |
| `deployToken` | `string` |   |   |

**Responses**

| Code | Description |
|---|---|
| `201` | project + webhookSecret |

### `GET /api/projects/{id}/domains`

List app domains and required DNS records (project owner only)

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | domains, addresses, cname and managedBase | `object` |

### `POST /api/projects/{id}/domains`

Claim a custom domain for a web app (project owner only)

Only nextjs/service projects. An org-private project's domain answers only active members of its organization (the member gate: `GET /api/projects/{id}/app-login`); a node without the gate answers 409 `org_private`. DNS ownership TXT and ingress A/AAAA verification precede HTTPS provisioning. Platform domains are reserved.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `hostname` | `string` | yes | (at most 253 characters) |

**Responses**

| Code | Description |
|---|---|
| `201` | domain with ownership verification token |
| `409` | `domain_unavailable` · `org_private` |

### `GET /api/projects/{id}/app-login`

Sign in to an org-private app on its own domain (the member gate)

Browser navigation on ainize's origin, reached by a 302 from the app domain. `return` must be an https URL on one of this project's own verified domains (400 `invalid_return`). No session: 302 to AIN SSO's silent sign-in, then to `/signing`, each coming back here. Signed in but not an active member of the project's organization (or no such project): 404. A member: 302 to `https://<domain>/__ainize_app_login?token=…&return=<path>` with a single-use login token (HMAC, ≤ 2 min, bound to the project, the hostname and the person); that path sets the host-only `__Host-ainize_app` cookie (≤ 12 h, HttpOnly, Secure, SameSite=Lax) and 302s to the path. The cookie is re-checked on every request (membership at most once a minute) and never reaches the container. A public project: 302 straight to `return`.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `return` | `query` | `string (uri)` | yes |

**Responses**

| Code | Description |
|---|---|
| `302` | to sign-in, or to the app domain's login hop |
| `400` | `invalid_return` |
| `404` | not a member, or no such project |

### `PATCH /api/projects/{id}/domains/default`

Change the automatically assigned app address (project owner only)

The managed platform domain needs no user DNS setup. Names are unique and reserved service names cannot be claimed.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `label` | `string` | yes | (at most 63 characters) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | managed domain | `object` |

### `POST /api/projects/{id}/domains/{hostname}/check`

Recheck app domain DNS (project owner only)

Custom domains require the exact TXT ownership token. Every resolved A/AAAA must point to configured ingress addresses. A verified domain is provisioned by the TLS worker.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `hostname` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | configuration status | `object` |

### `DELETE /api/projects/{id}/domains/{hostname}`

Remove a custom domain (project owner only)

Automatic addresses must be renamed instead. The TLS adapter removes the virtual host on its next reconciliation.

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `hostname` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `204` | removed |

### `GET /api/projects/by-repo`

The project bound to a repository (what aindrive's UI shows next to a repo)

No sign-in for a public project; CORS for `https://aindrive.ainetwork.ai`. A project whose repository's `<org>` slug maps to an organization this node knows is org-private (`visibility: "org"`): only an active member of that organization — a session, or an AIN SSO machine token + `X-AIN-Actor` naming them — sees it; anyone else gets 404 `not_found`, as for an unknown id. aindrive asks for an org-private project from its server, with its machine token and the viewer in `X-AIN-Actor`. Status, `pageUrl` (`https://ainize.ai/<org>/<repo>` — what aindrive's Inspect links to), the newest deployment and the manifest the last deploy read; no owner and no hook address. 404 when no project is bound to the URL.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `repo` | `query` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | project status | `object` |

### `GET /api/projects/by-name`

The project at `/<org>/<repo>` — the page's own lookup

A project whose repository's `<org>` slug maps to an organization this node knows is org-private (`visibility: "org"`): only an active member of that organization — a session, or an AIN SSO machine token + `X-AIN-Actor` naming them — sees it; anyone else gets 404 `not_found`, as for an unknown id. No sign-in for a public project; CORS for `https://aindrive.ainetwork.ai`. `org` and `repo` are matched case-insensitively against the repository's aindrive URL (`/<org>/git/<repo>`). The same view as `GET /api/projects/{id}`: public fields for everyone, plus `owner` and `hookUrl` for the owner; `canManage` / `canOperate` say what the caller may do. 404 `not_found` when no project of that name is bound here.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `org` | `query` | `string` | yes |
| `repo` | `query` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | project | `object` |
| `404` | `not_found` |   |

### `GET /api/orgs/{org}/projects`

Every project of an organization slug — the `/<org>` page

No sign-in; CORS for `https://aindrive.ainetwork.ai`. Case-insensitive on the slug. `{ org, projects: [...] }`: the public projects, plus the org-private ones when the viewer is an active member of the organization; an organization with no project here is an empty list — only a slug that is not even well-formed is 404.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `org` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | projects | `object` |
| `404` | `not_found` — malformed slug |   |

### `GET /api/orgs/{org}/repositories`

The organization's drive `repositories/` folder as aindrive lists it (so `/<org>` shows a repo before its first push)

Only an active member of an organization known under the slug (a session, or a machine token + `X-AIN-Actor`); anyone else — and any slug that maps to no organization here — is 404 `not_found`. The node asks aindrive `GET /api/orgs/<org>/repositories` with its own AIN SSO machine token (the same identity that clones a project's repository) and relays `{ org, known, driveId, driveUrl, repositories: [{ name, cloneUrl, headSha, headSubject, updatedAt, hasManifest }] }`; an organization aindrive does not resolve is `known: false` with an empty list. Cached 30 s per organization. 503 `aindrive_off` when the node has no machine identity, 502 when aindrive does not answer.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `org` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | repositories | `object` |
| `502` | `aindrive_unreachable` · `aindrive_error` |   |
| `503` | `aindrive_off` |   |

### `GET /api/projects/{id}`

One project — the view for whoever may see it, `owner` and `hookUrl` for its owner

A project whose repository's `<org>` slug maps to an organization this node knows is org-private (`visibility: "org"`): only an active member of that organization — a session, or an AIN SSO machine token + `X-AIN-Actor` naming them — sees it; anyone else gets 404 `not_found`, as for an unknown id. A public project reads to anyone. The view is `{ id, org, repoName, repo, branch, visibility, appAccess, kind, entry, name, status, url, pageUrl, lastDeployment, manifest, runnable, canManage, canOperate }`; `appAccess` is who reaches the running app — `members` (an org-private project's default) or `public` (a public project, or an org-private one whose `ainize.json` says `"access": "public"`). `manifest` is the `ainize.json` the newest deployment resolved (kind, entry, inputs, examples, and `envKeys` — the names of its env, never the values), `runnable` the repository's `.py`/`.js`/`.mjs` files. `aindrive` says where the project lives on aindrive: `{ repo: { url }, logStore }` — `logStore` is `{ driveId, basePath: "app-data/<id>/", urls: { base, logs, transcriptsToday, state } }` (drive links `https://<aindrive>/d/<driveId>/<path>`) for the owner and members once the project's durable log store was set up on a node that has one, otherwise null. 404 when there is no such project.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | project | `object` |

### `DELETE /api/projects/{id}`

Remove a project with its deployments, logs and secrets (owner only)

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | ok | `object` |

### `GET /api/projects/{id}/secrets`

A project's secrets — names and when each was set, never values (owner or org writer)

The owner (of an org-private project, while still a member), or an active member with role `write`/`admin` of the organization that owns the project or that its slug names. A `read`/`contributor` member gets 403 `not_writer`; anyone else 404 `not_found`. `{ secrets: [{ name, updatedAt }], declared, missing, unreadable }` — `declared` is the newest deployment's ainize.json `secrets` (names), `missing` the declared names with no value, and `unreadable` existing names whose ciphertext cannot be opened. Unreadable values remain listed for replacement/removal; container and script execution stops before starting when they cannot be read. 503 `secrets_off` on a node without the store.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | secret names | `object` |
| `403` | `not_writer` |   |
| `404` | `not_found` |   |

### `PUT /api/projects/{id}/secrets/{name}`

Set or replace one project secret (owner or org writer)

Sealed at rest (AES-256-GCM, node key) and delivered on the next container or code-agent deployment and to script runs, overriding ainize.json `env`. Body `{ value }`: one line, at most 32 KiB; name `^[A-Za-z_][A-Za-z0-9_]{0,63}$`, not one the node sets (`PORT`, `HOSTNAME`, proxy variables, `AINIZE_*`: 400 `reserved_name`); at most 64 per project (409 `too_many_secrets`). The value is never echoed, logged or shown in a view. Optional body `redeploy: { deploymentId, sha }` pins the reviewed source and full commit, validated before the secret write. Legacy `?redeploy=1` without that target is refused. 201 created / 200 replaced `{ name, updatedAt, created, redeploy: { deploymentId, status, projectId, redeployOf, sha } | null }`. A failure after writing starts returns 500 `secret_mutation_outcome_unknown`; the value or deployment may already have changed. The worker reads current values when preparing execution, not when the write is admitted. Project-agent deployment then seals an immutable revision tied to the agent and project; container restarts reuse that revision. Missing or unreadable revisions refuse execution. App/service/script execution does not yet retain a versioned environment snapshot.

**Auth** — operator

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `name` | `path` | `string` | yes |   |
| `redeploy` | `query` | `"1"` \| `"true"` |   | Requires the explicit target in the JSON body; cannot select latest. |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `value` | `string` | yes | (at most 32768 characters) |
| `redeploy` | `object` |   |   |
| `redeploy.deploymentId` | `string` | yes |   |
| `redeploy.sha` | `string` | yes |   |

**Responses**

| Code | Description |
|---|---|
| `200` | replaced |
| `201` | created |
| `400` | `invalid_name` · `reserved_name` · `invalid_value` · `invalid_request` |
| `403` | `not_writer` |
| `404` | `not_found` |
| `409` | `too_many_secrets` · `project_deleting` · `invalid_redeploy_target` · `redeploy_target_changed` |
| `413` | `value_too_large` |
| `500` | `secret_mutation_outcome_unknown` |

### `DELETE /api/projects/{id}/secrets/{name}`

Remove one project secret (owner or org writer)

Takes effect on the next deployment. Optional JSON body `redeploy: { deploymentId, sha }` requests the reviewed commit, validated before removal. Legacy `?redeploy=1` alone is refused. `{ ok, name, redeploy: { deploymentId, status, projectId, redeployOf, sha } | null }`; 404 when unset. A failure after writing starts returns 500 `secret_mutation_outcome_unknown`; inspect environment and history before retrying.

**Auth** — operator

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `name` | `path` | `string` | yes |   |
| `redeploy` | `query` | `"1"` \| `"true"` |   | Requires the explicit target in the JSON body; cannot select latest. |

**Request body** — `application/json`, optional

| Field | Type | Required |
|---|---|---|
| `redeploy` | `object` |   |
| `redeploy.deploymentId` | `string` | yes |
| `redeploy.sha` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | removed | `object` |
| `403` | `not_writer` |   |
| `404` | `not_found` |   |
| `409` | `project_deleting` · `invalid_redeploy_target` · `redeploy_target_changed` |   |
| `500` | `secret_mutation_outcome_unknown` |   |

### `PATCH /api/projects/{id}/rotate-secret`

A new webhook secret, shown once (owner only)

The old secret stops verifying at once; paste the new one into the repo's settings in aindrive. `{ id, webhookSecret, hookUrl }`.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | secret | `object` |

### `GET /api/projects/{id}/runs`

Ad-hoc runs of a script project, newest first (readable as the project is)

Each run is a deployment-shaped record with `trigger: "run"`, the `entry`, the NAMES of the inputs and env it was started with (`inputKeys`, `envKeys` — values are never read back, by members either), and `logUrl`. 404 for an org-private project the viewer may not see.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | runs | `object` |

### `POST /api/projects/{id}/runs`

Run the branch's HEAD now, with your entry, inputs and env — owner or a member of the repository's organization

Body `{ entry?, inputs?: { <name>: value }, env?: { <NAME>: value }, timeoutMs? }`. `entry` defaults to the manifest's; `inputs` are the `ainize.json` inputs (`INPUT_<NAME>`), `env` plain variables (never secrets). The run clones HEAD like a deploy, runs with the caller's own `aindrive run` key in `AINIZE_API_KEY`, and streams its log at `GET /api/deployments/{runId}/log`. 202 `{ runId, deploymentId, status }`. 401 `not_signed_in`, 403 `not_member`, 409 `not_a_script`.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type |
|---|---|
| `entry` | `string` |
| `inputs` | `object` |
| `env` | `object` |
| `timeoutMs` | `integer` |

**Responses**

| Code | Description |
|---|---|
| `202` | { runId, deploymentId, status } |
| `403` | `not_member` |
| `409` | `not_a_script` |

### `POST /api/deployments/{id}/redeploy`

Deploy this commit again (Redeploy; a service's roll-back to this one) — owner or organization member

A new deployment of the same sha and ref, `trigger: "redeploy"`, started by the caller. 202 `{ deploymentId, status }`.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `202` | { deploymentId, status } |
| `403` | `not_member` |

### `POST /api/projects/{id}/hook`

The push webhook aindrive calls after a successful git-receive-pack

Header `X-Ainize-Signature: sha256=<hex HMAC-SHA256 of the raw body with the project's webhookSecret>`. Body `{ ref, before?, after, pusher?: { subject, email? } }`. A push to the project's branch queues a deployment (202 `{deploymentId}`); any other ref, or a deleted branch, is 202 `{ignored: true}`. 401 `bad_signature`.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type | Required |
|---|---|---|
| `ref` | `string` | yes |
| `before` | `string` |   |
| `after` | `string` | yes |
| `pusher` | `object` |   |
| `pusher.subject` | `string` |   |
| `pusher.email` | `string` |   |

**Responses**

| Code | Description |
|---|---|
| `202` | {deploymentId, status} or {ignored, reason} |

### `GET /api/projects/{id}/deployments`

A project's deployments (pushes and redeploys), newest first — readable as the project is

Anyone for a public project; an active member for an org-private one (404 otherwise). `pusher` is `{ subject }` — never an email.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | deployments | `object` |

### `GET /api/deployments/{id}`

One deployment or run (readable as its project is)

Anyone for a public project; an active member for an org-private one (404 otherwise; also for `/log` and `/output`). `{ id, projectId, sha, ref, kind, status: queued|building|ready|error, trigger: push|redeploy|run, subject?, pusher, startedAt, finishedAt, ms, exitCode?, error?, logUrl, outputUrl? }`. `pusher` is `{ subject }`; a run carries `inputKeys` / `envKeys`, never their values. `outputUrl`: a script's stdout, a service's `/svc/<projectId>/`, an agent's `/agents/<id>`.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | deployment | `object` |

### `POST /api/projects/{id}/run`

Stream a selected repository version for the viewer

Viewer access through a session or trusted application token + X-AIN-Actor. target is head, commit or deployed (default deployed); sha is required only with commit. Read /api/projects/{id}/source first and pin its SHA to run exactly the displayed form. entry, inputs, env and timeoutMs override the selected commit manifest. The viewer’s own run key is injected. Runs share deployment FIFO and node concurrency limits, retain actor/source/input/log evidence, and never activate a deployment. Closing the stream cancels queued or active work. Events: stdout, stderr, error, exit. X-Ainize-Execution identifies the persisted run. Restart marks interrupted streamed runs failed; it does not replay their code.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type | Description |
|---|---|---|
| `target` | `"head"` \| `"commit"` \| `"deployed"` | (default `"deployed"`) |
| `sha` | `string` | Required only with target=commit. |
| `entry` | `string` | Repository-relative script file. (at most 200 characters) |
| `inputs` | `object` | Manifest input names; delivered as INPUT_\<NAME>. |
| `env` | `object` |   |
| `timeoutMs` | `integer` | (1000–300000) |

**Responses**

| Code | Description |
|---|---|
| `200` | text/event-stream with X-Ainize-Execution |
| `400` | Invalid target, commit, entry or inputs |
| `404` | Unknown or inaccessible project |
| `409` | No successful deployed version |
| `502` | Source checkout, manifest or runner failed before streaming |

### `POST /api/projects/{id}/redeploy`

Deploy the project's newest commit again (owner only)

The owner — a session, or a trusted application naming the owner in `X-AIN-Actor`. 202 `{ deploymentId, status: "queued" }`; 403 for a member, 404 for anyone else, 409 `no_deployment` before the first push.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `202` | {deploymentId, status} |

### `GET /api/ainui/snippet`

The AIN-UI link snippet of a project page URL (what a chat shows when the URL is pasted)

`url=<pasted ainize URL>` (`/projects/<id>` or `/<org>/<repo>`) or `path=`. The viewer is a session, or a trusted application's machine token + `X-AIN-Actor`. 200 `application/vnd.ain.ui+json` `{ ainui: 1, kind, title, subtitle, url, surface: <A2UI v0.9 messages>, actions, refresh }`; 403 the same envelope with `kind: "denied"`; 404 unknown. Contract: aindrive docs/AINUI-LINK-SNIPPETS.md.

**Auth** — operator

**Parameters**

| Name | In | Type |
|---|---|---|
| `url` | `query` | `string` |
| `path` | `query` | `string` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | snippet | `object` |

### `GET /api/deployments/{id}/log`

The captured log: text once over, SSE (`log` chunks, then `done`) while queued or building

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | text/plain or text/event-stream |

### `GET /api/deployments/{id}/output`

The script's stdout alone, for a ready deployment

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | text/plain |

### `GET /api/projects/{id}/requests`

What visitors asked the running app through this node (owner or member)

Owner or active member only, like runtime-logs. The last requests relayed to the app (app domain and `/svc`, local or peer-hosted): `{ projectId, tail, since?, fetchedAt, requests: [{ ts, method, path, status, ms, host, via }] }`, oldest first. Query values are redacted except diagnostic keys (`error`, `error_description`, …); no headers, cookies, bodies or client addresses are kept. `tail` 1–500 (default 100), `since` epoch ms.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `tail` | `query` | `integer` |   |
| `since` | `query` | `integer` |   |

**Responses**

| Code | Description |
|---|---|
| `200` | the request log |
| `401` | sign in |
| `403` | not a member |
| `404` | no such project, or not recorded on this node |

### `GET /api/projects/{id}/runtime-logs`

The running service's own stdout/stderr, wherever it was placed (owner or member)

Owner or active member of the project's organization only (a session, or a trusted application's machine token + `X-AIN-Actor`); never anonymous. Read from the container on this node, or from the deployment peer over the signed `project.logs` control command. Bounded: `tail` 1–1000 lines (default 200), 4 KiB per line, 256 KiB total. `{ projectId, deploymentId, sha, placement, tail, since?, fetchedAt, lines: [{ ts, stream, text }], truncated }`.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `tail` | `query` | `integer` |   |
| `since` | `query` | `string (date-time)` |   |

**Responses**

| Code | Description |
|---|---|
| `200` | runtime log lines |
| `401` | sign_in_required |
| `403` | not_member |
| `404` | not_found \| not_running |
| `502` | logs_unavailable |

### `GET /svc/{projectId}/{path}`

A project's running service or Next.js container (any method)

The node proxies the request to the container on its internal network; the `outputUrl` of a ready `service`/`nextjs` deployment. On ainize's origin the visitor's `Cookie`, `Authorization`, `X-Ainize-*` and `X-AIN-Actor` are never forwarded and the app's `Set-Cookie` is dropped; through the app's own domain its cookies and `Authorization` pass both ways. An org-private project answers only an active member of its organization (on its own app domain, behind the member gate) — unless its running `ainize.json` says `"access": "public"`: then anyone, with no gate, while the project, its deployments and logs stay members-only. 404 when no container runs for the project (or the viewer may not see it), 502 when it does not answer.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `projectId` | `path` | `string` | yes |
| `path` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `200` | whatever the service answers |

## Operator

wallet, settings, purchases, branches, peers, chain, drive

### `GET /api/ax`

Check Google AX connectivity and configured atespace

**Auth** — operator

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `GET /api/ax/tasks`

List AX tasks

**Auth** — operator

**Parameters**

| Name | In | Type | Default |
|---|---|---|---|
| `limit` | `query` | `integer` | `100` |
| `offset` | `query` | `integer` | `0` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `POST /api/ax/tasks`

Create an AX Task

Uses AINIZE_AX_ATESPACE. Task readiness is not command completion. Requires Kubernetes and Agent Substrate.

**Auth** — operator

**Request body** — `application/json`, required

| Field | Type | Required |
|---|---|---|
| `apiVersion` | `object` | yes |
| `kind` | `object` | yes |
| `metadata` | `object` | yes |
| `metadata.name` | `string` | yes |
| `metadata.atespace` | `string` |   |
| `spec` | `object` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `201` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `GET /api/ax/tasks/{name}`

Read an AX Task

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `name` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `DELETE /api/ax/tasks/{name}`

Delete an AX Task

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `name` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `204` | Deleted |
| `400` | Invalid resource or namespace |
| `403` | Node operator session required |
| `404` | Resource not found |
| `409` | Resource exists or lifecycle precondition failed |
| `503` | AX disabled or unavailable |
| `504` | AX RPC deadline exceeded |

### `GET /api/ax/workspaces`

List AX workspaces

**Auth** — operator

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `POST /api/ax/workspaces`

Upsert an AX Workspace

Uses AINIZE_AX_ATESPACE. Task readiness is not command completion. Requires Kubernetes and Agent Substrate.

**Auth** — operator

**Request body** — `application/json`, required

| Field | Type | Required |
|---|---|---|
| `apiVersion` | `object` | yes |
| `kind` | `object` | yes |
| `metadata` | `object` | yes |
| `metadata.name` | `string` | yes |
| `metadata.atespace` | `string` |   |
| `spec` | `object` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `GET /api/ax/workspaces/{name}`

Read an AX Workspace

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `name` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `DELETE /api/ax/workspaces/{name}`

Delete an AX Workspace

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `name` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `204` | Deleted |
| `400` | Invalid resource or namespace |
| `403` | Node operator session required |
| `404` | Resource not found |
| `409` | Resource exists or lifecycle precondition failed |
| `503` | AX disabled or unavailable |
| `504` | AX RPC deadline exceeded |

### `GET /api/ax/models`

List AX models

**Auth** — operator

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `POST /api/ax/models`

Upsert an AX Model

Uses AINIZE_AX_ATESPACE. Task readiness is not command completion. Requires Kubernetes and Agent Substrate.

**Auth** — operator

**Request body** — `application/json`, required

| Field | Type | Required |
|---|---|---|
| `apiVersion` | `object` | yes |
| `kind` | `object` | yes |
| `metadata` | `object` | yes |
| `metadata.name` | `string` | yes |
| `metadata.atespace` | `string` |   |
| `spec` | `object` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `GET /api/ax/models/{name}`

Read an AX Model

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `name` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `DELETE /api/ax/models/{name}`

Delete an AX Model

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `name` | `path` | `string` | yes |

**Responses**

| Code | Description |
|---|---|
| `204` | Deleted |
| `400` | Invalid resource or namespace |
| `403` | Node operator session required |
| `404` | Resource not found |
| `409` | Resource exists or lifecycle precondition failed |
| `503` | AX disabled or unavailable |
| `504` | AX RPC deadline exceeded |

### `POST /api/ax/tasks/{name}/suspend`

suspend an AX task

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `name` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `POST /api/ax/tasks/{name}/resume`

resume an AX task

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `name` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `GET /api/ax/tasks/{name}/egress`

Read the AX task actor egress policy

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `name` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `PUT /api/ax/tasks/{name}/egress`

Create or conditionally replace the AX task actor egress policy

Requires separately configured Substrate TLS/token access. Supports exact hostname and explicit port HTTP, intercepted HTTPS or TLS passthrough rules. HTTPS may replace the authorization header with a native actor JWT using one HTTPS audience and a 300-second lifetime; clients must send a placeholder header and trust the gateway CA. Without expected, creates only; replacement requires the current policy UID and version. Empty rules deny egress. Policy changes do not terminate existing connections.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `name` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `rules` | `object`[] | yes | (at most 256 items) |
| `expected` | `object` |   |   |
| `expected.uid` | `string (uuid)` | yes |   |
| `expected.version` | `string` | yes |   |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | AX resource | `object` |
| `201` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `GET /api/ax/tasks/{name}/runs/{runId}`

Inspect an AX command result

Requires AINIZE_AX_ROUTER_ADDRESS and a Running task with debug enabled. Reads workload-produced files, marked trusted:false; does not establish trusted job completion or billing evidence.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `name` | `path` | `string` | yes |
| `runId` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `413` | Artifact exceeds the bounded read limit |   |
| `502` | Invalid artifact or guest service error |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `GET /api/ax/tasks/{name}/runs/{runId}/output/{stream}`

Read bounded AX command output

Requires AINIZE_AX_ROUTER_ADDRESS and a Running task with debug enabled. Reads workload-produced files, marked trusted:false; does not establish trusted job completion or billing evidence.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `name` | `path` | `string` | yes |
| `runId` | `path` | `string` | yes |
| `stream` | `path` | `"stdout"` \| `"stderr"` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `413` | Artifact exceeds the bounded read limit |   |
| `502` | Invalid artifact or guest service error |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `GET /api/ax/tenants`

List registered AX tenant bindings

Requires AINIZE_AX_TENANT_REGISTRY=true, AIN SSO and AINIZE_AX_CLUSTER_UID. Administrative mapping only: does not provision Kubernetes or grant product data access. Issuer and cluster are fixed by server configuration.

**Auth** — operator

**Parameters**

| Name | In | Type | Default |
|---|---|---|---|
| `limit` | `query` | `integer` | `100` |
| `offset` | `query` | `integer` | `0` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `500` | Tenant registry unavailable |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `POST /api/ax/tenants`

Register an immutable SSO organization runtime binding

Requires AINIZE_AX_TENANT_REGISTRY=true, AIN SSO and AINIZE_AX_CLUSTER_UID. Administrative mapping only: does not provision Kubernetes or grant product data access. Issuer and cluster are fixed by server configuration.

**Auth** — operator

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `orgId` | `string` | yes |   |
| `policyVersion` | `string` | yes |   |
| `reason` | `string` | yes | (1–1024 characters) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `201` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `500` | Tenant registry unavailable |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `GET /api/ax/tenants/audit`

Read AX tenant registry audit events

Requires AINIZE_AX_TENANT_REGISTRY=true, AIN SSO and AINIZE_AX_CLUSTER_UID. Administrative mapping only: does not provision Kubernetes or grant product data access. Issuer and cluster are fixed by server configuration.

**Auth** — operator

**Parameters**

| Name | In | Type | Default |
|---|---|---|---|
| `limit` | `query` | `integer` | `100` |
| `offset` | `query` | `integer` | `0` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `500` | Tenant registry unavailable |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `GET /api/ax/tenants/{id}`

Read an AX tenant binding

Requires AINIZE_AX_TENANT_REGISTRY=true, AIN SSO and AINIZE_AX_CLUSTER_UID. Administrative mapping only: does not provision Kubernetes or grant product data access. Issuer and cluster are fixed by server configuration.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `500` | Tenant registry unavailable |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `PATCH /api/ax/tenants/{id}`

Activate or disable an AX tenant binding

Requires AINIZE_AX_TENANT_REGISTRY=true, AIN SSO and AINIZE_AX_CLUSTER_UID. Administrative mapping only: does not provision Kubernetes or grant product data access. Issuer and cluster are fixed by server configuration.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `state` | `"active"` \| `"disabled"` | yes |   |
| `reason` | `string` | yes | (1–1024 characters) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `500` | Tenant registry unavailable |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `POST /api/ax/tenants/{id}/projects`

Bind a provider project to an AX tenant

Requires AINIZE_AX_TENANT_REGISTRY=true, AIN SSO and AINIZE_AX_CLUSTER_UID. Administrative mapping only: does not provision Kubernetes or grant product data access. Issuer and cluster are fixed by server configuration.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `providerPeer` | `string` | yes |   |
| `projectId` | `string` | yes |   |
| `reason` | `string` | yes | (1–1024 characters) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `201` | AX resource | `object` |
| `400` | Invalid resource or namespace |   |
| `403` | Node operator session required |   |
| `404` | Resource not found |   |
| `409` | Resource exists or lifecycle precondition failed |   |
| `500` | Tenant registry unavailable |   |
| `503` | AX disabled or unavailable |   |
| `504` | AX RPC deadline exceeded |   |

### `GET /api/me/teach/policy`

Teaching policy (overrides + effective + trainer state)

**Auth** — operator

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | policy | `object` |

### `PATCH /api/me/teach/policy`

Change the teaching policy (persisted in the node store)

**Auth** — operator

**Request body** — `application/json`, optional

| Field | Type | Description |
|---|---|---|
| `enabled` | `boolean` |   |
| `publish` | `"review"` \| `"auto"` \| `"never"` |   |
| `facts_per_job` | `integer` |   |
| `jobs_per_key_per_day` | `integer` |   |
| `jobs_per_ip_per_day` | `integer` |   |
| `queue_max` | `integer` |   |
| `contributor_share` | `number` | (0–0.9) |
| `draft_ttl_days` | `integer` |   |
| `paused_reason` | `string` \| `null` |   |
| `blocked_topics` | `string` \| `null` | regular expression; matching corrections are refused |
| `dataset_max_bytes` | `integer` \| `null` |   |
| `dataset_max_rows` | `integer` \| `null` |   |
| `rows_per_job` | `integer` \| `null` | explicit override — DISABLES the measured derivation |
| `rows_per_key_per_day` | `integer` \| `null` |   |
| `rows_per_ip_per_day` | `integer` \| `null` |   |
| `datasets_per_key_per_day` | `integer` \| `null` |   |
| `dataset_ttl_days` | `integer` \| `null` |   |
| `declaration_rows` | `integer` \| `null` |   |
| `queued_rows_max` | `integer` \| `null` |   |
| `check_call_budget` | `integer` \| `null` |   |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | policy | `object` |

### `GET /api/me/teach/datasets`

What visitors uploaded to this machine (moderation view)

Owner address, IP, filename, size, question count, status, retention and expiry for every dataset on this node. An operator who hosts uploads must be able to see and delete them; opening this view writes an audit event.

**Auth** — operator

**Parameters**

| Name | In | Type | Default |
|---|---|---|---|
| `limit` | `query` | `integer` | `200` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | datasets | `object` |

**`200` response body**

| Field | Type |
|---|---|
| `items` | [`TeachDataset`](./schemas.md#teachdataset) & `object`[] |

### `GET /api/me/teach/jobs`

All lessons (with contributor and IP)

**Auth** — operator

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | lessons | `object` |

### `POST /api/me/teach/jobs/{id}/approve`

Approve a lesson in review → announce

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | announced | `object` |

### `POST /api/me/teach/jobs/{id}/reject`

Decline a lesson in review (reason is shown to the contributor)

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type | Required |
|---|---|---|
| `reason` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | rejected | `object` |

### `POST /api/me/teach/jobs/{id}/cancel`

Cancel a lesson

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | cancelled | `object` |

### `GET /api/me/teach/contributors`

Contributors seen on this node

**Auth** — operator

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | list | `object` |

### `POST /api/me/teach/contributors/{address}`

Hide / show a contributor name

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `address` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type |
|---|---|
| `hidden` | `boolean` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | contributor | `object` |

### `GET /api/me/teach/bans`

Blocked keys / IPs

**Auth** — operator

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | list | `object` |

### `POST /api/me/teach/bans`

Block a key or IP

**Auth** — operator

**Request body** — `application/json`, optional

| Field | Type | Required |
|---|---|---|
| `kind` | `"address"` \| `"ip"` | yes |
| `value` | `string` | yes |
| `reason` | `string` |   |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | ban | `object` |

### `DELETE /api/me/teach/bans/{id}`

Unblock

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `integer` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | ok | `object` |

### `POST /api/patches/{id}/buy-review`

Review the exact purchase family and per-currency maximums without purchasing

Read-only review: version:1, revision, node, patch_id, again, items[] and maximum[]. Includes full selected anchors and prerequisite order, current rights/file/pending state, and each buy/collect/keep decision. Missing/cyclic/deep prerequisites, unavailable purchases and unresolved prior payments refuse. Owned/purchased/licensed files are distinct from verification-only copies. Again authorizes a new payment only for the root. Prices and states are not reserved; confirmation must send the revision.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type | Description |
|---|---|---|
| `again` | `boolean` | (default `false`) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | {review} | `object` |
| `409` | purchase_review_changed or payment_pending; no purchase is started |   |

### `POST /api/patches/{id}/buy-reviewed`

Execute an exact reviewed purchase with a durable request identifier

Stores intent under the current operator and node before execution. The same request_id and parameters return its stored state, never repeat work; changed parameters conflict. Rechecks the full review while holding a process-local gate for all selected IDs, then checks each item immediately before its turn. Each seller payment must match the reviewed recipient/resource/method/currency and not exceed its price; amounts that cannot round-trip through the payment transport refuse. Acquires prerequisites first without loading a model. Writes partial progress after each completed item. An item failure stops remaining purchases and returns incomplete with completed receipts and confirmed_totals, which exclude unknown spend. Running/interrupted/failed outcomes are not proof of no charge. A refused request is specifically before any execution. There is no automatic resume across a restart; reread the stored request. This is not an atomic bundle, distributed lock or crash-atomic transaction with the remote seller.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `request_id` | `string` | yes | Random 128-bit ID saved by the client before POST. Never replace automatically after a lost response. |
| `again` | `boolean` | yes |   |
| `expected_review` | `string` | yes |   |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | {request}: version, id, node, subject, patch_id, again, revision, state (running/finished/failed/interrupted/refused), created_at, updated_at, result, error. Result identifies complete/incomplete, ordered item outcomes with receipts and confirmed_totals. | `object` |
| `409` | purchase_request_conflict; the same identifier was already used for another decision |   |

### `GET /api/purchases/requests/{id}`

Read this operator’s saved purchase request without resubmitting

Request IDs are scoped to node and operator. A running row with no active worker in this process is interrupted, never resumed. Durable progress may be incomplete if a process stopped after payment but before recording its result. Missing records do not prove no payment occurred. Reading does not pay, collect, load a model or cancel work.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | {request} | `object` |
| `404` | No request found for the current operator and node |   |

### `GET /api/purchases/requests/{id}/reconciliation`

Inspect request-specific payment evidence and current selected files without resubmitting

Read-only, scoped to the current node/operator/request. New requests persist evidence_version:1, the exact review and attempted item IDs before item work; new pending payment rows carry an opaque request association. Returns reconciliation version:1 with request_id, node, subject, patch_id, revision, evidence_revision, state and ordered items. Item states are complete, paid_missing_file, not_started, unconfirmed or changed. Payment evidence distinguishes a saved request result, an exact linked local purchase, a matching ledger settlement and free access. Older unrelated purchases or a pending status alone cannot complete Buy Again. Conflicting transactions/amounts/units remain unconfirmed. can_collect is true only for a missing file with current settlement/free collection access and non-running work; a local receipt alone does not advertise unsupported collection. Overall running cannot be completed or resumed by reading; legacy requests without item evidence return unavailable. This does not submit a payment, collect a file, load a model, cancel an intent or prove absence of a remote charge. A seller response lost before local purchase persistence may remain unconfirmed; continuation of missing purchases requires a separate explicit review, not a new automatic purchase.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | {reconciliation} | `object` |
| `404` | No request found for the current operator and node; absence is not proof of no payment |   |

### `POST /api/patches/{id}/buy`

Buy as this node (x402 handled automatically)

Resolves the current seller and records payment intent before presenting it. A lost response may recover the same recorded payment instead of starting another payment. Pending local-credit intent is not proof that a debit already happened. A recovered unresolved payment omits receipt_version and totals; inspect its record rather than claiming no charge. bundle/with_required buys missing bases deepest first. Unknown bases refuse before purchase. totals[] keeps exact decimal amounts separate by currency and excludes confirmed redemptions; scalar total is omitted for mixed currencies. max_total checks the current quote in the root currency and refuses mixed-currency bundles; this preflight is not an immutable price review or an atomic bundle transaction. Earlier base purchases may stand if a later step fails. Concurrent purchase/collection for the same item is refused within this process.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |
| `bundle` | `query` | `boolean` |   |

**Request body** — `application/json`, optional

| Field | Type | Description |
|---|---|---|
| `apply` | `boolean` | Load the whole stack after purchase, ancestors first. |
| `bundle` | `boolean` | Buy missing bases first. |
| `with_required` | `boolean` | Older alias for bundle. |
| `again` | `boolean` | Intentionally make another purchase despite existing purchase access. |
| `max_total` | `number` | Single-currency quote limit; mixed-currency bundles refuse. (at least 0) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | Purchase response: patch_id, manifest, path, amount, currency, scheme, tx_hash, steps, purchases[], totals[]; receipt_version:1 and node for confirmed charge accounting. This is not independent proof of model loading. | `object` |
| `409` | purchase_action_busy, purchase_plan_incomplete, purchase_budget_currency, purchase_budget_exceeded, purchase_receipt_unconfirmed, pending payment or unavailable item |   |

### `POST /api/patches/{id}/collect-reviewed`

Collect the exact selected file without submitting an unresolved payment

Requires an exact selected artifact snapshot. Checks it before file or payment work. Existing matching bytes return a read-only outcome; otherwise confirmed settlement/free access fetches the matching file. An existing settlement takes priority over unrelated pending payment intent. Unresolved pending payment alone refuses without presenting it to the seller. No fallback to legacy collect. Success identifies receipt_version:1, node, patch_id, matching manifest/path, redeemed:true, totals:[] and total:"0"; amount/currency describe the earlier receipt, not a new charge. Unknown historical currency remains absent. Clients must confirm fresh file presence before showing completion. This endpoint does not load a model.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required | Description |
|---|---|---|---|
| `expected` | `object` | yes |   |
| `expected.id` | `string` | yes | Must equal the path ID. (at least 1 characters) |
| `expected.author` | `string` | yes | (at least 1 characters) |
| `expected.patch_sha256` | `string` | yes | (at least 1 characters) |
| `expected.benchmark_hash` | `string` | yes | (at least 1 characters) |
| `expected.created_at` | `integer` | yes | (at least 0) |
| `expected.model` | `object` | yes |   |
| `expected.model.id_M` | `string` | yes |   |
| `expected.base` | `object` |   | Exact anchor base, or null/absent when no base is declared. |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | Confirmed no-charge collection receipt | `object` |
| `409` | collection_target_changed, collection_payment_pending, purchase_action_busy, own item or no collection rights |   |

### `POST /api/patches/{id}/collect`

Recover a purchased file or an unresolved recorded payment

Legacy recovery path: uses an existing settlement before any unrelated pending payment. When only recorded payment intent exists, it may present that intent again and complete its first debit. Such recovery omits receipt_version and totals: redeemed alone does not prove no charge occurred during this request. Prefer collect-reviewed for a selected-file/no-additional-charge UI. CLI: ainize patch download \<id>.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | Recovery steps and recorded receipt; inspect receipt_version before interpreting charge totals | `object` |
| `409` | No collection rights or purchase_action_busy |   |

### `GET /api/me/pending-payments`

Unresolved recorded payment requests

Rows in paid status without a completed manifest response. This status can mean an on-chain transfer or only signed local-credit intent; it is not universal proof that money left. Each row carries gateway, resource, amount, currency and available transaction hash; payload is withheld. Legacy collect may complete the recorded payment.

**Auth** — operator

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | items | `object` |

### `GET /api/patches/{id}/apply-preview`

Review the complete model load plan before applying

Read-only planner: expands all transitive bases, verifies held files/licences and pinned hashes/order, and preserves current recorded layers. Returns version:1, node, process instance, requested ids, with_base, revision, before/after id+hash records and ordered rows (compact anchor, requested, physical_id, action:load|reuse). Aliases name the physical record instead of pretending another copy will be loaded. No model weights are read or written. A concurrent stack change during the read returns 409; refresh rather than mixing snapshots. Submit revision as expected_preview on apply. The node recomputes and checks it under the actual model lock before writes. Older clients omitting expected_preview retain legacy behavior; UI clients must check capabilities.apply_preview.

**Auth** — operator

**Parameters**

| Name | In | Type | Required | Default |
|---|---|---|---|---|
| `id` | `path` | `string` | yes |   |
| `with_base` | `query` | `boolean` |   | `false` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | version, node, instance, requested, with_base, revision, before, after, order | `object` |
| `409` | Missing prerequisites/files/licences, invalid pinned base order or changed load records; no model write is performed by preview. |   |

### `POST /api/patches/{id}/apply`

Load into the model (with everything it was trained on top of)

Loads the ordered stack under one runtime lock: the bases first, then this knowledge. An add-on (`base.export: "delta"`) is written only after its `before` is compared to the live rows on EVERY row; a mismatch is 409 `base_mismatch` and that layer is not written; earlier layers may already have changed (`applied`/`removed` in the refusal). Without `with_base` an add-on whose base is not loaded is refused 409 `needs_base`. The answer carries `order` — the chain this knowledge now sits on, ancestors first — and `loaded`, the ids written by this call. `aliases` maps logical ids to existing physical layers with identical bytes. Planning happens after acquiring the model lock, preserving intervening work. Changed artifacts or missing retained files refuse rather than silently replacing/dropping layers.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type | Description |
|---|---|---|
| `async` | `boolean` | Answer 202 with a job; poll /api/runtime/jobs/{id} for completion. |
| `request_id` | `string` | Optional recovery ID: capabilities.server_time + "-" + 128 random bits in lowercase hex. Supply together with instance and async:true. Reuse exactly this ID and parameters after a lost response; never generate a replacement automatically. |
| `instance` | `string` | The boot identity from GET /api/runtime/jobs/capabilities. Recovery IDs from a previous node instance are refused. (at most 64 characters) |
| `with_base` | `boolean` | also load the knowledges this one was trained on top of |
| `expected_preview` | `string` | Revision from apply-preview. Checked against the complete resolved anchors, logical/physical order, options, node/process and current id/hash stack under the execution lock. A stale review fails with runtime_plan_changed before model writes. Included in async deduplication. |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | result, order[], loaded[], aliases + the ordered stack | `object` |
| `202` | {job}: accepted or an existing job for this request ID. Completion can be done or failed; a missing target fails inside the job. A done job includes result text and outcome {result, stack, order?, loaded?, aliases?} for load/remove, or {result, attestation} for verification. A done verification may record PASS or FAIL; inspect passed and verified_on instead of treating done as benchmark success. |   |
| `400` | Malformed recovery ID, or request_id/instance supplied without each other and async:true. |   |
| `409` | needs_base { missing } · base_not_held { missing } · base_mismatch { patch_id, rows_differ, applied, removed }; execution guards: runtime_plan_changed, base_artifact_changed, runtime_artifact_changed, runtime_stack_changed, runtime_stack_ambiguous, runtime_base_order. Recovery admission may refuse runtime_instance_changed, runtime_request_conflict or runtime_request_expired before running anything. |   |
| `429` | runtime_job_capacity: active/recent receipts fill the log; no new job was accepted. |   |

### `DELETE /api/patches/{id}/apply`

Unload from the model (journal replay)

Identical to `POST /api/patches/{id}/remove`. Replays the journal written when this knowledge was loaded, so the rows underneath come back exactly as they were; without a journal (a knowledge published before they existed) the model’s own rows are written back instead. Refused 409 `has_dependents` when something is loaded on top of it, unless `cascade` is set.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type | Description |
|---|---|---|
| `async` | `boolean` | Answer 202 with a job; poll /api/runtime/jobs/{id} for completion. |
| `request_id` | `string` | Optional recovery ID: capabilities.server_time + "-" + 128 random bits in lowercase hex. Supply together with instance and async:true. Reuse exactly this ID and parameters after a lost response; never generate a replacement automatically. |
| `instance` | `string` | The boot identity from GET /api/runtime/jobs/capabilities. Recovery IDs from a previous node instance are refused. (at most 64 characters) |
| `require_recorded` | `boolean` | Refuse with not_loaded if the id is not recorded at execution; never enter legacy raw restoration. The web uses true. Check capabilities.recorded_remove before relying on this flag. |
| `cascade` | `boolean` | also unload everything loaded on top of it |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | result + the ordered stack | `object` |
| `202` | {job}: accepted or an existing job for this request ID. Completion can be done or failed; a missing target fails inside the job. A done job includes result text and outcome {result, stack, order?, loaded?, aliases?} for load/remove, or {result, attestation} for verification. A done verification may record PASS or FAIL; inspect passed and verified_on instead of treating done as benchmark success. |   |
| `400` | Malformed recovery ID, or request_id/instance supplied without each other and async:true. |   |
| `409` | has_dependents { ids }; execution guards: not_loaded (require_recorded), runtime_plan_changed, runtime_artifact_changed, runtime_stack_changed, runtime_unwind_unavailable. Recovery admission may refuse runtime_instance_changed, runtime_request_conflict or runtime_request_expired. |   |
| `429` | runtime_job_capacity: active/recent receipts fill the log; no new job was accepted. |   |

### `POST /api/patches/{id}/remove`

Unload from the model (same as DELETE …/apply)

The same operation as `DELETE /api/patches/{id}/apply`, for clients that cannot send a body with DELETE. Body: `{cascade?, async?}` — `cascade` also unloads everything sitting on top of it, and `async: true` answers 202 with a job instead of holding the connection open behind the shared model lock (`GET /api/runtime/jobs/{id}`). What comes back underneath is the journal written when this knowledge was loaded; see "Loading several knowledges" above.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type | Description |
|---|---|---|
| `async` | `boolean` | Answer 202 with a job; poll /api/runtime/jobs/{id} for completion. |
| `request_id` | `string` | Optional recovery ID: capabilities.server_time + "-" + 128 random bits in lowercase hex. Supply together with instance and async:true. Reuse exactly this ID and parameters after a lost response; never generate a replacement automatically. |
| `instance` | `string` | The boot identity from GET /api/runtime/jobs/capabilities. Recovery IDs from a previous node instance are refused. (at most 64 characters) |
| `require_recorded` | `boolean` | Refuse with not_loaded if the id is not recorded at execution; never enter legacy raw restoration. The web uses true. Check capabilities.recorded_remove before relying on this flag. |
| `cascade` | `boolean` | also unload everything loaded on top of it |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | result + the ordered stack | `object` |
| `202` | {job}: accepted or an existing job for this request ID. Completion can be done or failed; a missing target fails inside the job. A done job includes result text and outcome {result, stack, order?, loaded?, aliases?} for load/remove, or {result, attestation} for verification. A done verification may record PASS or FAIL; inspect passed and verified_on instead of treating done as benchmark success. |   |
| `400` | Malformed recovery ID, or request_id/instance supplied without each other and async:true. |   |
| `409` | has_dependents { ids }; execution guards: not_loaded (require_recorded), runtime_plan_changed, runtime_artifact_changed, runtime_stack_changed, runtime_unwind_unavailable. Recovery admission may refuse runtime_instance_changed, runtime_request_conflict or runtime_request_expired. |   |
| `429` | runtime_job_capacity: active/recent receipts fill the log; no new job was accepted. |   |

### `GET /api/patches/{id}/check`

Are the rows this knowledge was trained on the ones on the table right now?

Reads every row of the body through the patch hook and compares it to `before` bf16-exact: `differ_before: 0` means its base stack is underneath, exactly. Nothing is written.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | rows, differ_before, differ_after, ok, applied | `object` |

### `POST /api/patches/{id}/forget`

Delete this node's copy of the knowledge file. NOT a takedown — the listing stays and the gateway keeps charging; POST /api/patches/{id}/retire is the takedown. 409 with `also_affects` when other items share the same file — repeat with `{"all_sharing": true}` to stop serving all of them

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | sha256, deleted_file, also_affects | `object` |

### `GET /api/ledger/inference`

Read native inference batch submissions and local receipts

Read-only operator journal, newest batches first. No submission, retry or flush is triggered. Submitted means acknowledged, not block inclusion. Receipt commitment validation checks the retained array, not inference quality or client delivery. Stored records remain readable when recording is disabled.

**Auth** — operator

**Parameters**

| Name | In | Type | Default | Description |
|---|---|---|---|---|
| `id` | `query` | `string (uuid)` |   | Optional local batch ID, not a blockchain transaction hash |
| `receipts` | `query` | `boolean` | `false` | Include retained receipts and receipt_commitment_valid; requires id |
| `offset` | `query` | `integer` | `0` |   |
| `limit` | `query` | `integer` | `50` |   |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | enabled, total, offset, limit, unbatched_receipts, entries and scope | `object` |
| `400` | Invalid pagination, ID or receipts without ID |   |
| `401` | Sign in required |   |
| `403` | Node operator required |   |
| `404` | Requested batch not found |   |
| `503` | Stored journal or receipt data invalid; preserve it for reconciliation |   |

### `POST /api/branches`

Create or replace an owned branch (legacy)

**Auth** — operator

**Request body** — `application/json`, optional

| Field | Type |
|---|---|
| `name` | `string` |
| `description` | `string` |
| `context` | `object` |
| `patch_ids` | `string`[] |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | branch | `object` |

### `POST /api/branches/create`

Create a new track without replacing an existing name

Rejects every existing name, including own, hidden and archived tracks. Initial knowledge must still be VERIFIED. Same-name creation is serialized with track actions. Legacy POST /api/branches retains its update behavior.

**Auth** — operator

**Request body** — `application/json`, optional

| Field | Type | Required |
|---|---|---|
| `name` | `string` | yes |
| `description` | `string` |   |
| `context` | `object` |   |
| `patch_ids` | `string`[] |   |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | new branch | `object` |

### `POST /api/branches/{name}/review`

Review track spending and the model transition without executing it

Returns a version 1 review with a revision, node, action, quote, exact decimal fee-inclusive maximum total, ordered before/after model records, prerequisite anchors and retained-layer overlaps. A fee read failure or unavailable prerequisite cannot become a free/empty review. Pass the revision as expected_review to subscribe or sync. The server rechecks it before any payment, bounds each actual purchase/curation request, and compares the reviewed model plan under the lock. Price, artifact, terms, account-node, serving-model or load-record changes require a new review. This is not a durable job or a rollback guarantee.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `name` | `path` | `string` | yes |

**Request body** — `application/json`, required

| Field | Type | Required |
|---|---|---|
| `action` | `"subscribe"` \| `"sync"` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | immutable reviewed spend, targets and model plan | `object` |
| `409` | Review unavailable or changed; no action was executed |   |

### `POST /api/branches/{name}/subscribe`

Subscribe to a track: buy its current knowledge, load it, and keep it up to date

Buys current items before writing a new subscription record. A partial acquisition is 409 `subscription_incomplete`; its response body includes acquired, failed, spent and the prior subscribed state. Earlier acquisitions and curation fees are not rolled back. Existing subscriptions are not registered twice. A 200 response includes receipt.version=1: subscribed and subscription_changed describe the ledger, while runtime.state (recorded/unavailable/failed), error, pending and records describe model load evidence. ok is false when model changes are incomplete even if the subscription was recorded. These are load records, not a live model-weight probe. Retired and unverified items are skipped. Quote before spending. Active subscriptions continue acquiring future updates until unsubscribed. Concurrent actions for one track return 409 track_action_busy.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `name` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type | Description |
|---|---|---|
| `expected_review` | `string` | Revision from the subscribe review; changed decisions refuse before spending |
| `replace` | `boolean` | Explicitly accept the reviewed retained-layer overlaps |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | acquisitions, spend and separate subscription/model receipt; inspect ok and receipt.runtime.state | `object` |
| `409` | track_review_changed, subscription_incomplete, overlaps_loaded or track_action_busy; acquisition errors retain actual reported spend and prior subscription state |   |

### `POST /api/branches/{name}/quote`

What subscribing to a track would spend, item by item, before anything is spent

Every id on the track with what this node would do with it (`buy` / `held` / `own` / `retired` / `blocked` / `wrong_model` / `unknown`), its published file hash when known, the price, item total per currency and this node’s balance. Subscription fee terms are separate from item totals. action_receipts:1 advertises separate subscription and model outcome receipts; it does not promise execution at a reviewed price or durable request recovery.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `name` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | quote | `object` |

### `POST /api/branches/{name}/sync`

Bring a subscribed track up to date now

Requires an active subscription before purchasing. Buys new items and transitions model layers under one lock. Failed or deferred purchases preserve existing model records. The receipt separates subscription state from model outcome; unavailable models or unresolved loads are not successful completion. Retained manual layers, physical aliases and dependent layers are preserved using lock-time records. The 20-second tick uses the same path. Concurrent same-track actions return 409 track_action_busy.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `name` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type | Description |
|---|---|---|
| `expected_review` | `string` | Revision from the sync review |
| `replace` | `boolean` | Explicitly allow reviewed overlaps; automatic sync never opts in |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | what changed | `object` |

### `GET /api/me/wallet`

Wallet: balance, sales, creator revenue share, pending payouts

**Auth** — operator

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | wallet (adds `payouts: { pending, failed, paid, items }` — the unpaid royalty transfers this node owes) | `object` |

### `GET /api/me/payouts`

Royalty payouts this node owes creators and data providers (AIN ledger)

One row per (settle record, address). `pending` = written, transfer not yet confirmed; `failed` = last attempt errored (retried every 60 s up to 20 times); `paid` = tx_hash on chain. Local-credit sales never appear here (credited by the settle record).

**Auth** — operator

**Parameters**

| Name | In | Type | Default |
|---|---|---|---|
| `status` | `query` | `"pending"` \| `"paying"` \| `"paid"` \| `"failed"` |   |
| `address` | `query` | `string` |   |
| `limit` | `query` | `integer` | `200` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | payouts | `object` |

**`200` response body**

| Field | Type | Description |
|---|---|---|
| `items` | [`Payout`](./schemas.md#payout)[] |   |
| `summary` | [`PayoutSummary`](./schemas.md#payoutsummary) |   |
| `max_attempts` | `integer` |   |
| `retry_ms` | `integer` |   |
| `wallet` | `boolean` | false on a local-ledger node (no chain wallet → rows cannot be paid) |

### `POST /api/me/payouts/{id}/retry`

Retry one failed / pending payout now (also after the 20 automatic attempts)

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `integer` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | payout after the attempt | `object` |
| `404` | unknown payout |   |
| `409` | already paid |   |

**`200` response body**

| Field | Type |
|---|---|
| `payout` | [`Payout`](./schemas.md#payout) |

### `GET /api/me/patches`

Knowledge I registered

**Auth** — operator

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | list | `object` |

### `GET /api/me/purchases`

Latest stored purchase or download per knowledge item

Each row includes payment evidence from a matching settlement or a coherent stored receipt; free downloads are explicit. payment=null means the historical amount/currency could not be confirmed and must not be inferred from the current listing. Seller-reported allocations are not proof of downstream transfers. Existing applied is an ID-based compatibility field; compare runtime file hashes for load-record standing.

**Auth** — operator

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | list | `object` |

### `GET /api/me/settings`

Read settings

**Auth** — operator

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | settings | `object` |

### `PATCH /api/me/settings`

Change settings

**Auth** — operator

**Request body** — `application/json`, optional

| Field | Type |
|---|---|
| `notifications` | `"all"` \| `"sales"` \| `"none"` |
| `display_name` | `string` |
| `payout_address` | `string` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | settings | `object` |

### `GET /api/chain`

Ledger / chain state and balance

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | state | `object` |

### `GET /api/drive`

aindrive state and file list

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | state | `object` |

### `POST /api/drive`

aindrive start / stop / sync

**Auth** — operator

**Request body** — `application/json`, optional

| Field | Type |
|---|---|
| `action` | `"up"` \| `"stop"` \| `"sync"` \| `"status"` \| `"login"` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | result | `object` |

### `GET /api/auth/me`

Who am I — `signedIn` + `subject` is a name, `isOwner` + `scope` is what it permits; `sso` is an AIN SSO session, `site` a Google account the site vouches for (x-ainize-site-subject)

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | auth state | `object` |

### `POST /api/auth/challenge`

A single-use nonce to sign for sign-in — `scheme` picks the signing rules and is fixed from here on

**Auth** — none

**Request body** — `application/json`, optional

| Field | Type | Description |
|---|---|---|
| `scheme` | `"ain"` \| `"eip191"` | ain = a key signs (CLI); eip191 = a person signs in a browser wallet (default `"ain"`) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | nonce + the exact message to sign, and the scheme it must be signed under | `object` |

### `POST /api/auth/wallet`

Sign in by signature, under the scheme the challenge was issued for — open to any address; owning the node is a separate question

**Auth** — none

**Request body** — `application/json`, optional

| Field | Type |
|---|---|
| `address` | `string` |
| `nonce` | `string` |
| `signature` | `string` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | token | `object` |
| `401` | bad or expired challenge |   |
| `403` | not an operator of this node |   |

### `POST /api/auth/enroll`

Become an owner of this node and sign in — needs the machine itself (loopback or x-setup-token) and a signature from the address

**Auth** — none

**Request body** — `application/json`, optional

| Field | Type |
|---|---|
| `address` | `string` |
| `nonce` | `string` |
| `signature` | `string` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | token | `object` |
| `403` | enroll_local_only |   |

### `GET /api/auth/owners`

Who owns this node — its own key, the config list, and grants made from a browser

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | owners[] with the source of each claim | `object` |

### `POST /api/auth/owners`

Grant ownership to an address (an owner vouches; no signature from the address)

**Auth** — none

**Request body** — `application/json`, optional

| Field | Type |
|---|---|
| `address` | `string` |
| `note` | `string` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | the new owner list | `object` |
| `401` | not signed in |   |
| `403` | signed in, but not an owner |   |

### `DELETE /api/auth/owners/{address}`

Revoke a granted ownership, ending that address's sessions

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `address` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | the new owner list | `object` |
| `400` | the node's own key, a config entry, or yourself |   |
| `404` | not an owner |   |

### `POST /api/auth/device`

Request wallet approval for a node link or explicit CLI delegation

kind=node requires a signed node-key session proving delegate possession; approval creates only a node-status credential, never a wallet delegation.

**Auth** — none

**Request body** — `application/json`, optional

| Field | Type | Required | Description |
|---|---|---|---|
| `kind` | `"cli"` \| `"node"` |   | (default `"cli"`) |
| `delegate` | `string` | yes | the requesting key's address |
| `label` | `string` |   | what the CLI calls itself; shown in quotes, never a claim the node stands behind |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | code, url, poll_secret, interval_ms, expires_at | `object` |

### `GET /api/auth/device/{code}`

What is being authorised, for the page that shows it — including the exact message the wallet will sign

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `code` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | status, delegate, label, message, expires | `object` |
| `404` | not a code this node issued |   |

### `POST /api/auth/device/{code}/approve`

Approve it: one wallet signature (eip191) over the message the node issued, from the address that is signed in

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `code` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type | Required |
|---|---|---|
| `signature` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | delegate, owner, expires | `object` |
| `401` | not signed in, or the signature is not the signed-in address over these bytes |   |
| `409` | already approved or already collected |   |
| `410` | the request timed out |   |

### `POST /api/auth/device/{code}/claim`

The CLI collecting its session — single use, and needs the poll secret it never printed

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `code` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type | Required |
|---|---|---|
| `poll_secret` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | pending, or approved with owner and token (CLI) / node_link_token (node status only) | `object` |
| `404` | unknown code or wrong poll secret — deliberately the same answer |   |
| `409` | already collected |   |
| `410` | nobody approved it in time |   |

### `POST /api/my/nodes/heartbeat`

Report a linked node online using its dedicated node-link Bearer token

This credential only updates node status. It is not an account session. Fields: address, name, roles[], version.

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | ok | `object` |
| `401` | expired, revoked or mismatched node link |   |

### `DELETE /api/my/nodes/{address}`

Disconnect one node from the signed-in wallet without stopping its process

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `address` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | ok | `object` |
| `401` | not signed in |   |
| `404` | not a node linked to this wallet |   |

### `GET /api/my/nodes`

Nodes linked to the signed-in wallet, including this node when operated by that wallet

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | nodes[], hub | `object` |
| `401` | not signed in |   |

### `GET /api/auth/bindings`

Every key that acts as you, and which one is acting now

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | bindings[], via | `object` |
| `401` | not signed in |   |

### `DELETE /api/auth/bindings/{delegate}`

End one, and the sessions it collected

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `delegate` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | sessions_ended, bindings[] | `object` |
| `404` | that key does not act as you |   |

### `POST /api/auth/logout`

Log out

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | ok | `object` |

### `POST /api/branches/{name}/patches/review`

Review adding knowledge to an owned active track

Read-only version 1 review binds node, full track metadata, artifact and status to revision; item identifies the exact file and current price, replaces lists existing superseded items, and already identifies a no-op. No purchase, model load or public write occurs.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `name` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type | Required |
|---|---|---|
| `patch_id` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | review | `object` |

### `POST /api/branches/{name}/patches`

Add knowledge to a branch (owner only)

expected_review binds the current track and artifact to a prior addition review. Changed state refuses before writing. Same-track local actions are gated, and already-present IDs do not append duplicate records. Legacy callers may omit expected_review.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `name` | `path` | `string` | yes |

**Request body** — `application/json`, optional

| Field | Type |
|---|---|
| `patch_id` | `string` |
| `expected_review` | `string` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | branch | `object` |

### `POST /api/branches/{name}/unsubscribe`

Stop a subscription and clean up its owned model layers

Records departure only if currently subscribed, then attempts cleanup under the model lock using current load reasons. Manual pins and other tracks are retained; missing retained files or retained dependents refuse cleanup. An inactive subscription may retry cleanup without appending another departure. receipt.subscribed=false does not mean cleanup succeeded: inspect ok, receipt.runtime.state, error and pending. Concurrent same-track actions return 409 track_action_busy.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `name` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | separate subscription departure and model cleanup receipt | `object` |

### `GET /api/runtime`

Serving runtime state (model, hook, the ordered stack of loaded knowledge)

`stack` is bottom-first: `position`, what each layer was trained on (`base_stack`, `export`) and whether the journal that would undo it is still on disk.

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | runtime | `object` |

### `GET /api/runtime/stack`

The ordered stack loaded in the serving model

Same `stack` as GET /api/runtime, on its own. Bottom first: a knowledge is always above everything it was trained on top of.

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | stack + journal_dir | `object` |

### `GET /api/runtime/jobs`

Recent runtime jobs

The latest 50 queued/running/terminal jobs, plus instance, server_time and request_window_ms. A job absent from this page may still exist; recover by its exact ID.

**Auth** — operator

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | jobs[], instance, server_time, request_window_ms | `object` |

### `GET /api/runtime/jobs/capabilities`

Runtime job recovery capabilities

Read the current process instance, server_time (milliseconds) and request_window_ms (600000) before creating an async request ID. verification_jobs:true advertises recoverable verification and is false when the verifier service is unavailable. verification_restoration:1 advertises exact saved restoration snapshots, retained failure evidence and restoration failure propagation; direct verification clients require both capabilities. This does not claim distributed crash atomicity or whole-model equality. apply_preview:true advertises apply-preview and enforcement of expected_preview at execution. recorded_remove:true advertises enforcement of require_recorded on unload; older nodes may silently ignore an unknown field. A new ID is accepted for 10 minutes after its timestamp, with at most 60 seconds of future clock skew. Retrying an existing ID with the same target, operation and flags returns its existing job.

**Auth** — operator

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | instance, server_time, request_window_ms, recorded_remove, apply_preview, verification_jobs, verification_restoration | `object` |

### `GET /api/runtime/jobs/{id}`

A queued apply/remove

Read queued/running/done/failed, timestamps, result text, error/status/details and the shared queue. Done jobs also have outcome {result, stack, order?, loaded?, aliases?}; this is an operation receipt, not proof of current model weights. Jobs live in memory and carry a process instance. Pending jobs are never evicted; terminal receipts expire after more than 11 minutes. A missing job or node restart does not prove that the operation did not execute: inspect the current load records, never automatically start a replacement.

**Auth** — operator

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `id` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | job | `object` |
| `404` | Unknown, expired or forgotten after restart; execution outcome is unknown. |   |

### `POST /api/runtime/complete`

Raw completion on the serving model (try the model)

Returns the shown answer plus the degeneracy flag `{truncated, shown_chars, raw_chars}` (and `raw_text` when it was cut). `raw: true` sends the pre-guard body: no stop sequences, no truncation.

**Auth** — operator

**Request body** — `application/json`, optional

| Field | Type | Description |
|---|---|---|
| `prompt` | `string` |   |
| `max_tokens` | `integer` | (default `16`) |
| `raw` | `boolean` | (default `false`) |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | text + truncation flag | `object` |

### `POST /api/peers`

Add a peer

**Auth** — operator

**Request body** — `application/json`, optional

| Field | Type |
|---|---|
| `endpoint` | `string` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | ok | `object` |

### `DELETE /api/peers`

Remove a peer

**Auth** — operator

**Request body** — `application/json`, optional

| Field | Type |
|---|---|
| `endpoint` | `string` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | ok | `object` |

### `POST /api/chain/setup`

Create the knowledge app on the AIN chain, set market rules, stake (AIN ledger only)

**Auth** — operator

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | result | `object` |

### `GET /api/drive/changes`

Change history of a drive file (aindrive Willow store)

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `path` | `query` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | changes | `object` |

## P2P

node-to-node protocol

### `POST /p2p/hello`

Peer introduction (exchange PeerInfo)

The body is a claim. Sign `hello:<your endpoint>` in `x-ainize-auth` (`<address>:<ts>:<sig>`, 5-minute window) or the address and roles in it are not recorded — an unsigned hello only makes the endpoint known (item 326).

**Auth** — teaching key (optional)

**Parameters**

| Name | In | Type | Description |
|---|---|---|---|
| `x-ainize-auth` | `header` | `string` | signature over `hello:<endpoint>` by the address the body claims |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | PeerInfo | `object` |

### `GET /p2p/payouts/{hash}`

What this node did about one settlement's royalties

The seller's own payout rows for one settle record — status, attempts and tx hash — so an ancestor can tell a promise from a payment (item 311).

**Auth** — none

**Parameters**

| Name | In | Type | Required |
|---|---|---|---|
| `hash` | `path` | `string` | yes |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | payout rows for that settlement | `object` |

### `GET /p2p/peers`

Peer list for peer exchange

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | endpoints | `object` |

### `GET /p2p/blobs`

Knowledge bodies held by this node (sha256 list)

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | blobs | `object` |

### `GET /p2p/info`

Node info

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | PeerInfo | `object` |

### `GET /p2p/records`

Ledger record sync (local-ledger mode)

**Auth** — none

**Parameters**

| Name | In | Type |
|---|---|---|
| `since` | `query` | `number` |

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | records + cursor | `object` |

### `POST /p2p/records`

Push records

**Auth** — none

**Responses**

| Code | Description | Body |
|---|---|---|
| `200` | added/rejected | `object` |

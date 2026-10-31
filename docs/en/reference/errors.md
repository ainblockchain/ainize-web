---
title: Error codes
summary: The error envelope, and every machine-readable code a node can answer with
---

# Error codes

> [!NOTE]
> **This page is generated — do not edit it by hand.** It is written by `scripts/docs-gen.mjs` from `ainize-node/src` and `ainize-core/src`.
> Regenerate with `npm run docs:gen`; `npm run docs:check` fails when this page and the source disagree.

What an error body looks like, how a thrown error becomes an HTTP status, and the 85 codes a client can match on.

## The error envelope

Every failed request answers with `{"error": "<message>"}` and one of the statuses below. Some errors add fields to that object; the endpoint that raises them says so in the [HTTP API reference](./http-api.md).

Where the message begins with a lower-case word and a colon — `dataset_not_found: no such dataset on this node` — **that prefix is the machine-readable code**. There is no separate `code` field: match on the prefix, show the sentence.

### How a thrown error becomes a status

| Error | HTTP status | Also in the body |
|---|---|---|
| `ChatCancelledError` | `499` | `cancelled`, `charged` |
| `Error` whose message matches `/shared runtime busy/` | `503` and the header `retry-after: 30` | `busy` |
| `TeachError` | the error's own status | `(err.details ?? {})` |
| `ChainSetupError`, `WalletSendError` | the error's own status |   |
| `HttpError` | the error's own status | `err.body` |
| `PayoutError` | the error's own status |   |
| `z.ZodError` | `400` | `issues` |
| `ValidationError` | `400` |   |
| `ConflictError` | `409` | `(err.details ?? {})` |
| `NotFoundError` | `404` |   |
| `TrackReviewError` | the error's own status |   |
| `MarketError`, `RuntimeStackPlanError` | the error's own status | `(err.details ?? {})` |

Anything else is a fault in the node and comes back as `500` with the raw message.

## Codes

85 codes are raised by name, in 144 distinct messages: a code that can come back with more than one status, or with more than one sentence, has a row for each. An ellipsis or a `<name>` in a sentence is a value filled in at the time — the code before the colon is the part to match on.

| Code | HTTP | What it means | Raised in |
|---|---|---|---|
| `already_approved` | `409` | that request has already been answered | `src/api.ts` |
| `already_known` | `409` | … already answers every one of these questions the same way | `src/teach.ts` |
| `already_used` | `409` | that request was already collected | `src/api.ts` |
| `approval_expired` | `410` | sign in and run `ainize login` again | `src/api.ts` |
| `bad_license` | `400` | "\<license>" is not a licence this network knows (CC0-1.0, CC-BY-4.0, CC-BY-SA-4.0, ODC-By-1.0, Proprietary) | `src/teach.ts` |
| `banned` | `403` | this node is not accepting lessons from this address | `src/teach.ts` |
| `banned` | `403` | this node is not accepting lessons from this key | `src/teach.ts` |
| `base_artifact_changed` | `409` | \<row.id> requires a different file for \<base.patch_id>; review the knowledge before applying it | `src/runtime-stack-plan.ts` |
| `base_not_available` | `403` | \<id> is someone else's private draft | `src/teach.ts` |
| `base_not_held` | `409` | \<a.patch_id> is held under a different body than \<id> was trained on | `src/teach.ts` |
| `base_not_held` | `409` | this node does not hold the body of \<id> — buy or download it first | `src/teach.ts` |
| `base_private` | `400` | the creator of \<id> kept its questions private, so nobody can build on it (you can still load it for comparison) | `src/teach.ts` |
| `base_rejected` | `400` | \<id> is … — it cannot be built on | `src/teach.ts` |
| `base_retired` | `400` | \<id> is retired — build on its newer version…, or pass force to proceed anyway | `src/teach.ts` |
| `base_stack_too_deep` | `400` | \<stack.length> knowledges would have to be loaded under this lesson (at most 8) | `src/teach.ts` |
| `base_unknown` | `400` | \<b.patch_id> is no longer on this node | `src/teach.ts` |
| `base_unknown` | `400` | no knowledge called \<id> on this node | `src/teach.ts` |
| `base_unknown` | `404` | no knowledge called \<id> on this node | `src/teach.ts` |
| `base_unresolved_conflicts` | `400` | \<conflicts.length> of your answers differ from …'s answer to the same question — confirm that you mean to change them (they will be published as changes to it) or take them out | `src/teach.ts` |
| `checks_failed` | `409` | the side-effect check was turned off for this lesson — run the check now before publishing | `src/teach.ts` |
| `checks_failed` | `409` | this lesson changed answers to unrelated questions or to the knowledge it builds on | `src/teach.ts` |
| `collection_target_changed` | `409` | the selected artifact changed | `src/purchase-result.ts` |
| `consent_required` | `400` | both consent boxes are required | `src/teach.ts` |
| `dataset_declaration` | `400` | tell us where these \<rows> questions come from (own work, a public source, or licensed to you) | `src/teach.ts` |
| `dataset_derivative_only` | `403` | sign the request with a teaching key | `src/api.ts` |
| `dataset_derivative_only` | `403` | this training set is available to people building on this knowledge — sign the request with a teaching key to preview it, and ask for a derive token to fetch it | `src/api.ts` |
| `dataset_empty` | `400` | a dataset needs at least one question | `src/teach-datasets.ts` |
| `dataset_empty` | `400` | a dataset needs at least one question and answer | `src/teach-datasets.ts` |
| `dataset_empty` | `400` | after that change the dataset has no usable questions | `src/teach-datasets.ts` |
| `dataset_empty` | `400` | read that way, the file has no usable questions | `src/teach-datasets.ts` |
| `dataset_empty` | `400` | this dataset has no questions left on this node | `src/teach.ts` |
| `dataset_format` | `409` | the original file is no longer on this node — upload it again | `src/teach-datasets.ts` |
| `dataset_hash` | `400` | the file changed while it was being uploaded — try again | `src/teach-datasets.ts` |
| `dataset_in_use` | `409` | only a dataset that has never been trained can be re-read — make a copy instead | `src/teach-datasets.ts` |
| `dataset_in_use` | `409` | this dataset is being trained right now — make a copy to edit it | `src/teach-datasets.ts` |
| `dataset_moved` | `409` | "\<dataset.id>" has been edited since this lesson was trained (it is revision \<dataset.revision> now, and the lesson holds the bytes it was trained on). What would be published is the frozen copy, which the current checks — personal information among them — have not looked at. Train again on the current questions, then publish. | `src/teach.ts` |
| `dataset_not_found` | `404` | no sample dataset called "\<kind>" | `src/teach-datasets.ts` |
| `dataset_not_found` | `404` | no such dataset on this node | `src/teach-datasets.ts` |
| `dataset_not_found` | `404` | that dataset was deleted | `src/teach.ts` |
| `dataset_not_found` | `404` | the questions of this dataset are no longer on this node | `src/teach-datasets.ts` |
| `dataset_not_found` | `409` | this lesson has no dataset to train again | `src/teach.ts` |
| `dataset_not_text` | `400` | this does not look like a text file — read as \<parsed.encoding>, \<why>. If it is a spreadsheet, export it as CSV first; if the encoding is the problem, name it and try again. | `src/teach-datasets.ts` |
| `dataset_pii` | `400` | rows … look like personal information (…) — remove them, or keep the training set private | `src/teach.ts` |
| `dataset_private` | `403` | the creator kept the training set private | `src/api.ts` |
| `dataset_private` | `403` | the creator kept the training set private — only the verification questions on the record are public | `src/api.ts` |
| `dataset_private` | `403` | the creator kept the training set private, so nobody can build on it | `src/api.ts` |
| `dataset_private` | `403` | the creator of \<id> kept the questions private, so nobody can copy or build on them | `src/teach.ts` |
| `dataset_too_large` | `400` | this node teaches up to \<cap> questions in one lesson | `src/teach.ts` |
| `dataset_too_large` | `413` | this node accepts files up to … MB | `src/teach-datasets.ts` |
| `dataset_unavailable` | `404` | \<id> has no published training set — there is nothing to copy | `src/teach.ts` |
| `dataset_unavailable` | `404` | the training set of \<entry.anchor.id> is not on this node and no peer holds it (…) | `src/teach.ts` |
| `dataset_unavailable` | `404` | the training set of \<input.patchId> has no questions on this node | `src/teach-datasets.ts` |
| `dataset_unavailable` | `404` | this knowledge has no published training set | `src/api.ts` |
| `dataset_unavailable` | `404` | training set not available on this node (no peer holds it) | `src/api.ts` |
| `enroll_local_only` | `403` | an address is added to this node's operators from the machine it runs on (`ainize operators --add <address>`), or with the one-time token in its AINIZE_HOME/setup-token as the x-setup-token header | `src/api.ts` |
| `expired` | `410` | nobody approved it in time — run `ainize login` again | `src/api.ts` |
| `expired` | `410` | the request timed out — run `ainize login` again | `src/api.ts` |
| `invalid` | `400` | \<bad> | `src/teach.ts` |
| `invalid` | `400` | \<badName> | `src/teach.ts` |
| `invalid` | `400` | 1..\<c.factsPerJob> corrections per lesson | `src/teach.ts` |
| `invalid` | `400` | at most 3 context knowledges | `src/teach.ts` |
| `invalid` | `400` | child_key must be the teaching key that signed this request | `src/api.ts` |
| `invalid` | `400` | declaration.source must be own, public or licensed | `src/teach.ts` |
| `invalid` | `400` | payout_address cannot be this node's own address | `src/teach.ts` |
| `invalid` | `400` | payout_address must be an AIN address | `src/teach.ts` |
| `invalid` | `400` | price must be a non-negative number | `src/teach.ts` |
| `invalid` | `400` | there is no question #\<op.index> in this dataset | `src/teach-datasets.ts` |
| `invalid` | `400` | those are the same knowledge | `src/teach.ts` |
| `invalid` | `400` | two knowledges are needed to combine | `src/teach.ts` |
| `invalid_purchase_request` | `400` | expected a random 128-bit identifier | `src/purchase-requests.ts` |
| `invalid_runtime_request_id` | `400` | expected server timestamp and a random 128-bit suffix | `src/runtime-jobs.ts` |
| `invalid_signature` | `401` | download token missing, wrong or expired — make a new link from Your knowledge | `src/api.ts` |
| `invalid_signature` | `401` | the claim signature does not verify for this teaching key | `src/teach.ts` |
| `invalid_signature` | `401` | x-ainize-auth header missing, expired or invalid | `src/api.ts` |
| `invalid_signature` | `401` | x-ainize-auth header missing, expired, replayed or invalid (`<address>:<ts>:<sig>:v2` over "teach:\<node>:\<METHOD>:\<path>:\<ts>[:\<sha256 body>]", or the legacy `teach:<ts>` form) | `src/api.ts` |
| `job_not_ready` | `409` | draft is missing | `src/teach.ts` |
| `job_not_ready` | `409` | knowledge file is missing | `src/teach.ts` |
| `job_not_ready` | `409` | knowledge file is not registered on this node | `src/teach.ts` |
| `job_not_ready` | `409` | lesson is \<j.status> | `src/teach.ts` |
| `job_not_ready` | `409` | lesson is \<j.status> and cannot be re-checked | `src/teach.ts` |
| `job_not_ready` | `409` | the draft carries no verified claim by the owner's teaching key | `src/teach.ts` |
| `job_not_ready` | `409` | the owner has not published this lesson (it is \<j.status>) — only lessons submitted for review can be approved | `src/teach.ts` |
| `job_not_ready` | `409` | this lesson has no knowledge file yet | `src/teach.ts` |
| `job_not_ready` | `409` | this lesson has not been measured in the live model yet — run a re-check first | `src/teach.ts` |
| `job_not_ready` | `409` | this lesson was already checked in the live model | `src/teach.ts` |
| `knowledge_not_held` | `400` | "\<id>" is listed on this node but its file is not here — get it first (\<price>), then teach on top of it | `src/teach.ts` |
| `knowledge_request_changed` | `409` | the selected item or requester changed; check its current status | `src/knowledge-demand.ts` |
| `lineage_disabled` | `403` | building on top of another knowledge is not enabled on this node yet (config teach.lineage) | `src/teach.ts` |
| `lineage_disabled` | `403` | combining two knowledges is not enabled on this node yet (config teach.lineage) | `src/teach.ts` |
| `lineage_disabled` | `403` | copying another knowledge's questions is not enabled on this node yet (config teach.lineage) | `src/teach.ts` |
| `merge_not_available` | `400` | combining two knowledges is not available on this node yet — build on one of them | `src/teach.ts` |
| `merge_unresolved` | `409` | \<unresolved.length> question(s) are answered differently by \<A.id> and \<B.id> — choose an answer for each one before building | `src/teach.ts` |
| `no_such_request` | `404` | that authorisation link is not one this node issued | `src/api.ts` |
| `not_owner` | `403` | this lesson belongs to a different teaching key | `src/api.ts` |
| `nothing_to_add` | `400` | combining these two would leave no questions at all | `src/teach.ts` |
| `nothing_to_add` | `400` | combining these two would teach nothing new | `src/teach.ts` |
| `parent_not_listed` | `400` | publish \<b.patch_id> first — it is the base of this lesson | `src/teach.ts` |
| `payment_pending` | `409` | \<key> has an unresolved payment; inspect it before purchasing | `src/purchase-review.ts` |
| `publish_disabled` | `403` | this node accepts lessons but does not publish them | `src/teach.ts` |
| `published_immutable` | `409` | published knowledge cannot be deleted | `src/teach.ts` |
| `purchase_action_busy` | `409` | another purchase or collection for a selected item is running | `src/purchase-result.ts` |
| `purchase_request_conflict` | `409` | this request identifier belongs to another purchase | `src/purchase-requests.ts` |
| `purchase_review_changed` | `409` | \<message>; refresh the purchase review | `src/purchase-review.ts` |
| `quota_bytes` | `429` | you have uploaded as much as this node accepts from one teaching key today | `src/teach-datasets.ts` |
| `quota_chat` | `429` | free live-test quota exhausted for this hour (this pre-flight needs \<units> unit(s)) — try again later | `src/api.ts` |
| `quota_dataset` | `429` | \<c.perKeyPerDay> new datasets per day for one teaching key | `src/teach-datasets.ts` |
| `quota_dataset` | `429` | this node keeps \<c.keptPerKey> datasets for one teaching key — delete one first | `src/teach-datasets.ts` |
| `quota_ip` | `429` | daily lesson limit (\<c.jobsPerIpPerDay>) reached for this address — resets … | `src/teach.ts` |
| `quota_key` | `429` | daily lesson limit (\<c.jobsPerKeyPerDay>) reached for this key — resets … | `src/teach.ts` |
| `quota_key` | `429` | you already have \<mineActive> lesson(s) in progress on this node — wait for them to finish | `src/teach.ts` |
| `quota_requests` | `429` | too many requests from here this hour | `src/api.ts` |
| `quota_rows` | `429` | this address has \<q.rows_ip_remaining> of … questions left to teach on this node today | `src/teach.ts` |
| `quota_rows` | `429` | you have \<q.rows_remaining> of … questions left to teach on this node today | `src/teach.ts` |
| `rate_limited` | `429` | too many datasets from this address in the last minute | `src/teach-datasets.ts` |
| `rate_limited` | `429` | too many policy calls from this address | `src/teach.ts` |
| `relay_disabled` | `403` | this node does not hold blobs for other nodes (p2p.relayBlobs) | `src/api.ts` |
| `row_not_found` | `404` | none of those lines are refused rows of this dataset | `src/teach-datasets.ts` |
| `runtime_artifact_changed` | `409` | \<layer.id> is recorded with another file; inspect the stack before applying it | `src/runtime-stack-plan.ts` |
| `runtime_base_order` | `409` | \<base.patch_id> is not recorded underneath \<layer.id>; review the existing stack instead of reordering it automatically | `src/runtime-stack-plan.ts` |
| `runtime_instance_changed` | `409` | the node restarted; inspect the operation’s current records before starting another operation | `src/runtime-jobs.ts` |
| `runtime_job_capacity` | `429` | active or recent jobs fill the operation log; retry after existing work finishes and receipts expire | `src/runtime-jobs.ts` |
| `runtime_request_conflict` | `409` | this request id belongs to different operation parameters | `src/runtime-jobs.ts` |
| `runtime_request_expired` | `409` | this request can no longer be started; inspect the operation’s current records before creating another request | `src/runtime-jobs.ts` |
| `runtime_stack_ambiguous` | `409` | duplicate layer identities or files are recorded; inspect the stack before applying more knowledge | `src/runtime-stack-plan.ts` |
| `runtime_stack_changed` | `409` | a recorded layer cannot be resolved to the same file; inspect the current stack before changing it | `src/runtime-stack-plan.ts` |
| `subscription_incomplete` | `409` | \<failed.length> of … item(s) could not be acquired; no new subscription record was written. …… | `src/market.ts` |
| `subscription_unpaid` | `402` | … | `src/market.ts` |
| `teaching_disabled` | `403` | this node does not accept lessons | `src/teach.ts` |
| `teaching_disabled` | `503` | the teach worker is not running on this node | `src/api.ts` |
| `tier_not_allowed` | `400` | … | `src/teach.ts` |
| `tier_not_allowed` | `400` | … % of the \<rows.shared> rows these two both write hold different values — combining them has to be a full rebuild from the combined questions | `src/teach.ts` |
| `too_many_attempts` | `429` | \<rec.n> signatures from this address did not check out — wait \<wait>s before trying again. | `src/api.ts` |
| `too_many_bases` | `400` | one base to build on (two only for a merge) | `src/teach.ts` |
| `track_action_busy` | `409` | another action for this track is still running; inspect it before trying again | `src/track-action.ts` |
| `track_review_changed` | `409` | \<message>; review the current track before continuing | `src/track-review.ts` |
| `trainer_paused` | `503` | … | `src/teach.ts` |
| `trainer_paused` | `503` | \<rowsWaiting> questions are already waiting on this node — try again later | `src/teach.ts` |
| `trainer_paused` | `503` | the training queue is full — try again later | `src/teach.ts` |
| `turn_unknown` | `404` | that live test is not one this node remembers for you (it may have been restarted) | `src/api.ts` |
| `undeclared_parent` | `400` | the questions of this lesson came from \<dataset.parent_patch>; a lesson built on them must name it as its base. Re-train the dataset with that knowledge as the base before publishing. | `src/teach.ts` |
| `undeclared_parent` | `400` | these questions came from … — a lesson trained on them has to say so, or its creator is paid nothing. Train it on top of that knowledge (`--on <dataset.parent_patch>`, or "builds on" in the browser). | `src/teach.ts` |
| `unknown_knowledge` | `400` | this node does not have "\<id>" — check the id, or teach on a node that holds it | `src/teach.ts` |
| `verification_in_progress` | `409` | a different verification of this knowledge is still running | `src/verification-request.ts` |
| `verification_target_changed` | `409` | the selected knowledge changed; reread it before verifying | `src/verification-request.ts` |

## Messages without a code

Not every error carries a code. 220 raise a plain sentence and are told apart by their status — these are written for a person reading them, so match on the status, never on the words.

A further 116 throw sites build their message at the time (a validator's own wording, a peer's answer); they answer with the statuses above.

| HTTP | Message | Raised in |
|---|---|---|
| `null` | … (retrying for … more min before hash-only fallback) | `src/verifier.ts` |
| `null` | … did not answer: … | `src/peer-models.ts` |
| `null` | … refused: … | `src/peer-models.ts` |
| `null` | "\<alias>" is another agent's alias | `src/agent-aliases.ts` |
| `null` | "\<alias>" is another agent's id | `src/agent-aliases.ts` |
| `null` | \<AGENT_GIT_SPEC_FILE> is missing — an agent's repository has one at its root | `src/agent-git.ts` |
| `null` | \<AGENT_GIT_SPEC_FILE> is not valid JSON: … | `src/agent-git.ts`, `src/project-agents.ts` |
| `null` | \<AGENT_GIT_SPEC_FILE> sets …, which the node owns — remove … | `src/project-agents.ts` |
| `null` | \<d> already belongs to the organization "\<holder.id>" | `src/organization-store.ts` |
| `null` | \<id> is already linked to the organization "\<holder.id>" | `src/organization-store.ts` |
| `null` | \<input.repo.url> (\<input.branch>) is already a project on this node | `src/projects.ts` |
| `null` | \<PROJECT_MANIFEST_FILE> has no "kind" and package.json does not depend on next — set kind to nextjs, service, script or agent | `src/project-manifest.ts` |
| `null` | \<PROJECT_MANIFEST_FILE> is not valid JSON: … | `src/project-manifest.ts` |
| `null` | \<PROJECT_MANIFEST_FILE>: …: … | `src/project-manifest.ts` |
| `null` | \<PROJECT_MANIFEST_FILE>: "media" is for a service project, not \<kind> | `src/project-manifest.ts` |
| `null` | \<PROJECT_MANIFEST_FILE>: "runtime" is needed for an entry that is not .py/.js/.mjs | `src/project-manifest.ts` |
| `null` | \<PROJECT_MANIFEST_FILE>: "websocket" is for a service or nextjs project, not \<kind> | `src/project-manifest.ts` |
| `null` | \<PROJECT_MANIFEST_FILE>: a script names its "entry" | `src/project-manifest.ts` |
| `null` | \<PROJECT_MANIFEST_FILE>: examples."\<ex.name>" answers an input that does not exist: \<unknown> | `src/project-manifest.ts` |
| `null` | \<PROJECT_MANIFEST_FILE>: run "\<target.entry>" example "\<ex.name>" answers an input that does not exist: \<unknown> | `src/project-manifest.ts` |
| `null` | \<PROJECT_MANIFEST_FILE>: run "\<target.entry>" needs a "runtime" (not .py/.js/.mjs) | `src/project-manifest.ts` |
| `null` | \<PROJECT_MANIFEST_FILE>: run lists "\<target.entry>" twice | `src/project-manifest.ts` |
| `null` | \<rel> is a binary file | `src/hosted-qa-engine.ts` |
| `null` | \<rel> is a directory | `src/hosted-qa-engine.ts` |
| `null` | \<rel> is a directory; use list_dir | `src/hosted-qa-engine.ts` |
| `null` | \<rel> is larger than 1 MiB | `src/hosted-qa-engine.ts` |
| `null` | \<rel> is not a directory | `src/hosted-qa-engine.ts` |
| `null` | \<rel> is not a regular file | `src/hosted-qa-engine.ts` |
| `null` | a file path is required | `src/hosted-qa-engine.ts` |
| `null` | a self-contained archive cannot depend on an external object store | `src/agent-git.ts` |
| `null` | agent source exists without its spec; reconcile before deployment | `src/project-agents.ts` |
| `null` | agent spec names another project target | `src/project-agents.ts` |
| `null` | AIN SSO discovery answered \<res.status> | `src/sso-service-token.ts` |
| `null` | AIN SSO discovery: bad token_endpoint | `src/sso-service-token.ts` |
| `null` | AIN SSO discovery: issuer mismatch | `src/sso-service-token.ts` |
| `null` | AIN SSO issued a \<json.token_type> token; only Bearer is usable | `src/sso-service-token.ts` |
| `null` | AIN SSO refused a machine token for \<resource> (\<what>) | `src/sso-service-token.ts` |
| `null` | AIN SSO token endpoint unreachable: … | `src/sso-service-token.ts` |
| `null` | an account may have \<this.limits.perOwner> projects on this node | `src/projects.ts` |
| `null` | an address may run \<this.limits.perOwner> agents on this node | `src/hosted-agent-store.ts` |
| `null` | an alias is 1–40 lower-case letters, digits and hyphens, starting with a letter or digit | `src/agent-aliases.ts` |
| `null` | an organization keeps at least one admin | `src/organization-store.ts` |
| `null` | an organization may have \<perOrg> projects on this node | `src/projects.ts` |
| `null` | an organization may have \<this.limits.groups> resource groups | `src/organization-store.ts` |
| `null` | an organization may have \<this.limits.members> members on this node | `src/organization-store.ts` |
| `null` | Audio response is too large | `src/peer-models.ts` |
| `null` | binary content is not supported | `src/hosted-qa-engine.ts` |
| `null` | cannot access \<rel> | `src/hosted-qa-engine.ts` |
| `null` | content is larger than 1 MiB | `src/hosted-qa-engine.ts` |
| `null` | content must be a string | `src/hosted-qa-engine.ts` |
| `null` | could not fetch \<mirror.url>: … | `src/agent-mirror.ts` |
| `null` | hosted agent quota reached | `src/hosted-agent-store.ts` |
| `null` | invalid agent source path | `src/agent-git.ts` |
| `null` | invalid regular expression: … | `src/hosted-qa-engine.ts` |
| `null` | invalid repository storage limit | `src/agent-git.ts` |
| `null` | invalid_redeploy_target | `src/project-redeploy.ts`, `src/project-routes.ts` |
| `null` | mirror permission changed while waiting | `src/agent-mirror-sync.ts` |
| `null` | Model backend failed | `src/peer-models.ts` |
| `null` | no such file or directory: \<rel> | `src/hosted-qa-engine.ts` |
| `null` | not a directory: … | `src/hosted-qa-engine.ts` |
| `null` | not_found | `src/project-redeploy.ts`, `src/project-routes.ts` |
| `null` | not_yet_cloned | `src/project-redeploy.ts` |
| `null` | old_string and new_string are identical | `src/hosted-qa-engine.ts` |
| `null` | old_string and new_string must be strings | `src/hosted-qa-engine.ts` |
| `null` | old_string must not be empty; use write_file to create a file | `src/hosted-qa-engine.ts` |
| `null` | old_string occurs \<count> times in \<rel>; include more surrounding lines to make it unique, or set replace_all | `src/hosted-qa-engine.ts` |
| `null` | old_string was not found in \<rel>; read the file again and copy the text exactly (without the line-number prefix) | `src/hosted-qa-engine.ts` |
| `null` | one account may create \<this.limits.perCreator> organizations on this node | `src/organization-store.ts` |
| `null` | one account may link \<this.limits.perOwner> agents on this node | `src/linked-agent-store.ts` |
| `null` | only a signed-in member of the AIN organization \<id> can link it | `src/organization-store.ts` |
| `null` | only someone signed in with an @\<d> address can claim \<d> | `src/organization-store.ts` |
| `null` | path must be a string | `src/hosted-qa-engine.ts` |
| `null` | path refused | `src/hosted-qa-engine.ts` |
| `null` | path refused: … is a symbolic link | `src/hosted-qa-engine.ts` |
| `null` | path refused: \<raw> (paths are relative to the repository root; .., .git, .env files and absolute paths outside the repository are not allowed) | `src/hosted-qa-engine.ts` |
| `null` | pattern is required | `src/hosted-qa-engine.ts` |
| `null` | project agent binding changed while waiting; retry deployment | `src/project-agents.ts` |
| `null` | project agent environment delivery is unavailable | `src/project-agents.ts` |
| `null` | project_deleting | `src/project-redeploy.ts` |
| `null` | redeploy_target_changed | `src/project-redeploy.ts` |
| `null` | repository id already exists | `src/agent-git.ts` |
| `null` | repository objects must not be symlinks | `src/agent-git.ts` |
| `null` | repository storage limit exceeded (\<bytes> > \<this.storageLimitBytes> bytes); export history or ask the operator to raise the limit | `src/agent-git.ts` |
| `null` | result is larger than 1 MiB | `src/hosted-qa-engine.ts` |
| `null` | runtime unavailable (…) — waiting up to … min before hash-only fallback | `src/verifier.ts` |
| `null` | shared workspace agents must stay in their organization | `src/agent-git-http.ts` |
| `null` | the alias is the agent's own id | `src/agent-aliases.ts` |
| `null` | the decision backend answered \<up.status> | `src/peer-models.ts` |
| `null` | the id "\<id>" is taken | `src/organization-store.ts` |
| `null` | the id "\<input.id>" is taken | `src/hosted-agent-store.ts`, `src/linked-agent-store.ts`, `src/organization-store.ts` |
| `null` | the image backend answered \<up.status> | `src/peer-models.ts` |
| `null` | the transcription backend answered \<up.status> | `src/peer-models.ts` |
| `null` | this node holds its maximum of \<this.limits.total> organizations | `src/organization-store.ts` |
| `null` | this node holds its maximum of \<this.limits.total> projects | `src/projects.ts` |
| `null` | this node lists its maximum of \<this.limits.total> linked agents | `src/linked-agent-store.ts` |
| `null` | this node runs its maximum of \<this.limits.total> agents | `src/hosted-agent-store.ts` |
| `null` | this organization has too many open invites | `src/organization-store.ts` |
| `null` | this organization has too many pending requests | `src/organization-store.ts` |
| `null` | This peer is managed by Kubernetes; use the shared cluster deployment workflow for node updates and model operations | `src/node-control.ts` |
| `null` | this repository is not a valid agent: … | `src/project-agents.ts` |
| `null` | this session is read-only | `src/hosted-qa-engine.ts` |
| `null` | this tree is not a valid agent: … | `src/agent-git.ts` |
| `400` | \<address> is listed in operatorAddresses in this node's config file — remove it there, on the machine this node runs on (`ainize operators remove <address>`), and restart | `src/api.ts` |
| `400` | \<label> must be a non-negative number (e.g. "0", "0.1", "25") | `../ainize-core/src/catalog.ts` |
| `400` | a dispute has to say what did not work — at least \<DISPUTE_MIN_REASON> characters (this is a permanent public record, and the seller answers it on the same record) | `src/market.ts` |
| `400` | answering a dispute needs the settle_hash of the sale it is about | `src/market.ts` |
| `400` | at most \<MAX_CHAT_PATCHES> knowledges can be loaded together | `src/market.ts` |
| `400` | at most \<MAX_CONTRIBUTORS> contributors per patch | `../ainize-core/src/catalog.ts` |
| `400` | contributor must be an object | `../ainize-core/src/catalog.ts` |
| `400` | contributor shares add up to more than 1 | `../ainize-core/src/catalog.ts` |
| `400` | contributor.address must be an AIN address (0x + 40 hex) | `../ainize-core/src/catalog.ts` |
| `400` | contributor.address must not be this node's own address | `src/market.ts` |
| `400` | contributor.name must be a string of at most 40 chars | `../ainize-core/src/catalog.ts` |
| `400` | contributor.share must be a number between 0 and 1 | `../ainize-core/src/catalog.ts` |
| `400` | contributor.sig must be a string | `../ainize-core/src/catalog.ts` |
| `400` | contributor.signer must be an AIN address | `../ainize-core/src/catalog.ts` |
| `400` | contributors must be an array | `../ainize-core/src/catalog.ts` |
| `400` | duplicate contributor address: \<c.address> | `../ainize-core/src/catalog.ts` |
| `400` | history cursor belongs to another node or is invalid | `src/wallet-send-operations.ts` |
| `400` | history limit must be an integer from 1 to 50 | `src/wallet-send-operations.ts` |
| `400` | invalid send request identifier | `src/wallet-send-operations.ts` |
| `400` | invalid transfer history cursor | `src/wallet-send-operations.ts` |
| `400` | invalid_actor | `src/run-actor.ts` |
| `400` | invalid_request | `src/agent-archive-operations.ts`, `src/server.ts` |
| `400` | memo must be at most 200 characters | `src/wallet-send-operations.ts` |
| `400` | model_not_served | `src/server.ts` |
| `400` | node address required | `src/api.ts` |
| `400` | origin must be "operator" or "teach" | `src/market.ts` |
| `400` | recipient is this node’s own address | `src/wallet-send-operations.ts` |
| `400` | request identifier must be 32 lowercase hex characters | `src/chain-setup-operations.ts` |
| `400` | request_id, reviewed chain, recipient and an exact positive decimal amount (up to six places) are required | `src/wallet-send-operations.ts` |
| `400` | reviewed chain context, expected_request and request_id are required | `src/chain-setup-operations.ts` |
| `400` | this is the node's own key: it owns what this node published, and revoking it would only stop the node acting for itself | `src/api.ts` |
| `400` | unsupported contributor proof: … | `../ainize-core/src/catalog.ts` |
| `400` | unsupported contributor role: … | `../ainize-core/src/catalog.ts` |
| `400` | visibility must be "public" or "test" | `src/market.ts` |
| `400` | you cannot revoke your own ownership — ask another owner, or remove the address from the config file on the machine this node runs on | `src/api.ts` |
| `401` | node link expired or disconnected; run ainize login again | `src/api.ts` |
| `401` | sign in to disconnect your node | `src/api.ts` |
| `401` | sign in with AIN SSO or a wallet to see your nodes | `src/api.ts` |
| `401` | sign in with your wallet before authorising anything to act as you | `src/api.ts` |
| `401` | sign in with your wallet to do this | `src/api.ts` |
| `401` | sign in with your wallet to end what acts as you | `src/api.ts` |
| `401` | Sign in with your wallet to query live sources | `src/api.ts` |
| `401` | sign in with your wallet to see what acts as you | `src/api.ts` |
| `401` | that signature does not come from the address it claims | `src/api.ts` |
| `401` | that signature does not come from the address that is signed in | `src/api.ts` |
| `401` | the sign-in challenge has expired — ask for a new one | `src/api.ts` |
| `402` | payment required: buy the patch via /x402/patch/:id (its author, a buyer holding a download token, and a verifier while it is being verified can fetch it) | `src/api.ts` |
| `403` | … does not own this node — this is for whoever runs it | `src/api.ts` |
| `403` | account_suspended | `src/run-actor.ts` |
| `403` | not_allowed | `src/agent-archive-routes.ts` |
| `403` | only the author of \<entry.anchor.id> may place its body here | `src/api.ts` |
| `403` | only the branch owner can add patches | `src/market.ts` |
| `403` | only the operator who reviewed this request can submit it | `src/wallet-send-operations.ts` |
| `403` | only the owner of \<name> (\<b.owner>) can archive it | `src/market.ts` |
| `403` | only the owner of \<name> (\<b.owner>) can set what it costs | `src/market.ts` |
| `403` | prove possession of the node key before requesting a node link | `src/api.ts` |
| `403` | this payout is owed to a different address | `src/payouts.ts` |
| `404` | \<address> does not own this node | `src/api.ts` |
| `404` | \<delegate> does not act as you | `src/api.ts` |
| `404` | not_found | `src/agent-archive-routes.ts` |
| `404` | patch not found | `src/api.ts` |
| `404` | payout \<id> not found | `src/payouts.ts` |
| `404` | send request not found | `src/wallet-send-operations.ts` |
| `404` | setup request not found on this node | `src/chain-setup-operations.ts` |
| `409` | \<name> is curated by \<b.owner>, not by this node | `src/api.ts` |
| `409` | \<name> is free to follow: it has no curation fee | `src/api.ts` |
| `409` | a setup request is unresolved; inspect its status before another attempt | `src/chain-setup-operations.ts` |
| `409` | active_version_missing | `src/agent-archive-restore.ts` |
| `409` | another send is unresolved; inspect or cancel it before preparing another | `src/wallet-send-operations.ts` |
| `409` | archive_context_changed | `src/agent-archive-routes.ts` |
| `409` | archive_operation_conflict | `src/agent-archive-operations.ts` |
| `409` | archive_operation_pending | `src/agent-archive-operations.ts` |
| `409` | archive_target_changed | `src/agent-archive-routes.ts` |
| `409` | chain configuration changed; refresh | `src/chain-setup-operations.ts` |
| `409` | export_required | `src/agent-archive-routes.ts` |
| `409` | id_taken | `src/agent-archive-restore.ts` |
| `409` | insufficient AIN balance; fees may require additional funds | `src/wallet-send-operations.ts` |
| `409` | local development credit cannot be sent on the AIN chain | `src/api.ts` |
| `409` | node link was revoked or replaced | `src/api.ts` |
| `409` | not sold here; gateway is … | `src/api.ts` |
| `409` | patch body not present on this node | `src/api.ts` |
| `409` | payout \<id> is already paid (\<row.tx_hash>) | `src/payouts.ts` |
| `409` | project_binding_conflict | `src/agent-archive-restore.ts` |
| `409` | project_environment_required | `src/agent-archive-restore.ts` |
| `409` | request identifier belongs to another chain | `src/chain-setup-operations.ts` |
| `409` | reviewed setup required; use GET /api/chain/setup and POST /api/chain/setup/requests. Automatic funding and staking are not part of setup. | `src/api.ts` |
| `409` | saved setup request belongs to another chain configuration | `src/chain-setup-operations.ts` |
| `409` | send request identifier belongs to another intent | `src/wallet-send-operations.ts` |
| `409` | setup receipt changed; inspect the stored request | `src/chain-setup-operations.ts` |
| `409` | state_exists | `src/agent-archive-restore.ts` |
| `409` | this payout was already sent (\<row.tx_hash>) | `src/payouts.ts` |
| `409` | transfer review is required: prepare /api/me/wallet/send-requests, inspect the receipt, then explicitly submit its ID; use /account in the web UI | `src/api.ts` |
| `409` | wallet chain context changed; inspect the retained request | `src/wallet-send-operations.ts` |
| `413` | blob is \<file.size> bytes; this node relays at most \<max> (p2p.maxRelayBytes) | `src/api.ts` |
| `423` | patch not listed yet (verification \<e.passed>/\<e.quorum>) | `src/api.ts` |
| `429` | archive_operation_capacity | `src/agent-archive-operations.ts` |
| `429` | Live source capacity reached; retry in one minute | `src/api.ts` |
| `499` | live test cancelled while it was still queued — the model was never called, so no free try was used | `src/market.ts` |
| `501` | docker_unavailable | `src/server.ts` |
| `502` | Live provider lookup failed. No cached or invented result was substituted. Check the name/symbol and server provider configuration. | `src/api.ts` |
| `502` | restore_cleanup_failed | `src/agent-archive-restore.ts` |
| `503` | active chain connection could not be inspected | `src/chain-setup-operations.ts` |
| `503` | archive_operation_unavailable | `src/agent-archive-operations.ts` |
| `503` | chain could not be inspected; setup was not started | `src/chain-setup-operations.ts` |
| `503` | model unavailable, try again in a few minutes | `src/free-tier-routes.ts`, `src/openai-surface.ts`, `src/runtime.ts` |
| `503` | recipient could not be normalized | `src/wallet-send-operations.ts` |
| `503` | runtime unavailable: … | `src/teach.ts` |
| `503` | runtime_restore_\<code>: \<detail> | `src/market.ts`, `src/runtime-restoration.ts`, `src/verifier.ts` |
| `503` | seller file unavailable; no payment accepted | `src/api.ts` |
| `503` | send request history is unavailable | `src/wallet-send-operations.ts` |
| `503` | setup request history is unavailable | `src/chain-setup-operations.ts` |
| `503` | Stored inference journal is invalid; preserve it for operator reconciliation | `src/api.ts` |
| `503` | the \<modality> backend stopped accepting work before this request started | `src/modality-gate.ts` |
| `503` | the patch hook could not be reached (ENGRAM_HOOK=1?) | `src/api.ts` |
| `503` | transfer history contains an invalid record | `src/wallet-send-operations.ts` |
| `503` | wallet balance could not be inspected | `src/wallet-send-operations.ts` |
| `503` | wallet chain context is unavailable | `src/wallet-send-operations.ts` |
| `503` | wallet could not prepare a transaction | `src/wallet-send-operations.ts` |

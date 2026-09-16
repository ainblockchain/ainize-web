---
title: Error codes
summary: The error envelope, and every machine-readable code a node can answer with
---

# Error codes

> [!NOTE]
> **This page is generated — do not edit it by hand.** It is written by `scripts/docs-gen.mjs` from `ainize-node/src` and `ainize-core/src`.
> Regenerate with `npm run docs:gen`; `npm run docs:check` fails when this page and the source disagree.

What an error body looks like, how a thrown error becomes an HTTP status, and the 64 codes a client can match on.

## The error envelope

Every failed request answers with `{"error": "<message>"}` and one of the statuses below. Some errors add fields to that object; the endpoint that raises them says so in the [HTTP API reference](./http-api.md).

Where the message begins with a lower-case word and a colon — `dataset_not_found: no such dataset on this node` — **that prefix is the machine-readable code**. There is no separate `code` field: match on the prefix, show the sentence.

### How a thrown error becomes a status

| Error | HTTP status | Also in the body |
|---|---|---|
| `ChatCancelledError` | `499` | `cancelled`, `charged` |
| `Error` whose message matches `/shared runtime busy/` | `503` and the header `retry-after: 30` | `busy` |
| `TeachError` | the error's own status | `(err.details ?? {})` |
| `HttpError` | the error's own status | `err.body` |
| `PayoutError` | the error's own status |   |
| `z.ZodError` | `400` | `issues` |
| `ValidationError` | `400` |   |
| `ConflictError` | `409` | `(err.details ?? {})` |
| `NotFoundError` | `404` |   |
| `MarketError` | the error's own status | `(err.details ?? {})` |

Anything else is a fault in the node and comes back as `500` with the raw message.

## Codes

64 codes are raised by name, in 123 distinct messages: a code that can come back with more than one status, or with more than one sentence, has a row for each. An ellipsis or a `<name>` in a sentence is a value filled in at the time — the code before the colon is the part to match on.

| Code | HTTP | What it means | Raised in |
|---|---|---|---|
| `already_approved` | `409` | that request has already been answered | `src/api.ts` |
| `already_known` | `409` | … already answers every one of these questions the same way | `src/teach.ts` |
| `already_used` | `409` | that request was already collected | `src/api.ts` |
| `bad_license` | `400` | "\<license>" is not a licence this network knows (CC0-1.0, CC-BY-4.0, CC-BY-SA-4.0, ODC-By-1.0, Proprietary) | `src/teach.ts` |
| `banned` | `403` | this node is not accepting lessons from this address | `src/teach.ts` |
| `banned` | `403` | this node is not accepting lessons from this key | `src/teach.ts` |
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
| `publish_disabled` | `403` | this node accepts lessons but does not publish them | `src/teach.ts` |
| `published_immutable` | `409` | published knowledge cannot be deleted | `src/teach.ts` |
| `quota_bytes` | `429` | you have uploaded as much as this node accepts from one teaching key today | `src/teach-datasets.ts` |
| `quota_chat` | `429` | free live-test quota exhausted for this hour (this pre-flight needs \<units> unit(s)) — try again later | `src/api.ts` |
| `quota_chat_network` | `429` | this network has used all … free live tests for this hour — everyone sharing this address shares them | `src/api.ts` |
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
| `subscription_incomplete` | `409` | \<failed.length> of … item(s) could not be acquired, so \<branch> was NOT subscribed to and this node is not advertised as serving it. …… | `src/market.ts` |
| `subscription_unpaid` | `402` | … | `src/market.ts` |
| `teaching_disabled` | `403` | this node does not accept lessons | `src/teach.ts` |
| `teaching_disabled` | `503` | the teach worker is not running on this node | `src/api.ts` |
| `tier_not_allowed` | `400` | … | `src/teach.ts` |
| `tier_not_allowed` | `400` | … % of the \<rows.shared> rows these two both write hold different values — combining them has to be a full rebuild from the combined questions | `src/teach.ts` |
| `too_many_attempts` | `429` | \<rec.n> signatures from this address did not check out — wait \<wait>s before trying again. | `src/api.ts` |
| `too_many_bases` | `400` | one base to build on (two only for a merge) | `src/teach.ts` |
| `trainer_paused` | `503` | … | `src/teach.ts` |
| `trainer_paused` | `503` | \<rowsWaiting> questions are already waiting on this node — try again later | `src/teach.ts` |
| `trainer_paused` | `503` | the training queue is full — try again later | `src/teach.ts` |
| `turn_unknown` | `404` | that live test is not one this node remembers for you (it may have been restarted) | `src/api.ts` |
| `undeclared_parent` | `400` | the questions of this lesson came from \<dataset.parent_patch>; a lesson built on them must name it as its base. Re-train the dataset with that knowledge as the base before publishing. | `src/teach.ts` |
| `undeclared_parent` | `400` | these questions came from … — a lesson trained on them has to say so, or its creator is paid nothing. Train it on top of that knowledge (`--on <dataset.parent_patch>`, or "builds on" in the browser). | `src/teach.ts` |
| `unknown_knowledge` | `400` | this node does not have "\<id>" — check the id, or teach on a node that holds it | `src/teach.ts` |

## Messages without a code

Not every error carries a code. 58 raise a plain sentence and are told apart by their status — these are written for a person reading them, so match on the status, never on the words.

A further 27 throw sites build their message at the time (a validator's own wording, a peer's answer); they answer with the statuses above.

| HTTP | Message | Raised in |
|---|---|---|
| `null` | … (retrying for … more min before hash-only fallback) | `src/verifier.ts` |
| `null` | runtime unavailable (…) — waiting up to … min before hash-only fallback | `src/verifier.ts` |
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
| `400` | origin must be "operator" or "teach" | `src/market.ts` |
| `400` | this is the node's own key: it owns what this node published, and revoking it would only stop the node acting for itself | `src/api.ts` |
| `400` | unsupported contributor proof: … | `../ainize-core/src/catalog.ts` |
| `400` | unsupported contributor role: … | `../ainize-core/src/catalog.ts` |
| `400` | visibility must be "public" or "test" | `src/market.ts` |
| `400` | you cannot revoke your own ownership — ask another owner, or remove the address from the config file on the machine this node runs on | `src/api.ts` |
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
| `403` | only the author of \<entry.anchor.id> may place its body here | `src/api.ts` |
| `403` | only the branch owner can add patches | `src/market.ts` |
| `403` | only the owner of \<name> (\<b.owner>) can archive it | `src/market.ts` |
| `403` | only the owner of \<name> (\<b.owner>) can set what it costs | `src/market.ts` |
| `403` | this payout is owed to a different address | `src/payouts.ts` |
| `404` | \<address> does not own this node | `src/api.ts` |
| `404` | \<delegate> does not act as you | `src/api.ts` |
| `404` | patch not found | `src/api.ts` |
| `404` | payout \<id> not found | `src/payouts.ts` |
| `409` | \<name> is curated by \<b.owner>, not by this node | `src/api.ts` |
| `409` | \<name> is free to follow: it has no curation fee | `src/api.ts` |
| `409` | not sold here; gateway is … | `src/api.ts` |
| `409` | patch body not present on this node | `src/api.ts` |
| `409` | payout \<id> is already paid (\<row.tx_hash>) | `src/payouts.ts` |
| `409` | this payout was already sent (\<row.tx_hash>) | `src/payouts.ts` |
| `413` | blob is \<file.size> bytes; this node relays at most \<max> (p2p.maxRelayBytes) | `src/api.ts` |
| `423` | patch not listed yet (verification \<e.passed>/\<e.quorum>) | `src/api.ts` |
| `429` | Live source capacity reached; retry in one minute | `src/api.ts` |
| `499` | live test cancelled while it was still queued — the model was never called, so no free try was used | `src/market.ts` |
| `502` | Live provider lookup failed. No cached or invented result was substituted. Check the name/symbol and server provider configuration. | `src/api.ts` |
| `503` | model unavailable, try again in a few minutes | `src/runtime.ts` |
| `503` | runtime unavailable: … | `src/teach.ts` |
| `503` | Stored inference journal is invalid; preserve it for operator reconciliation | `src/api.ts` |
| `503` | the patch hook could not be reached (ENGRAM_HOOK=1?) | `src/api.ts` |

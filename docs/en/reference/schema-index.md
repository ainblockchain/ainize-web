# Schema index

Reusable shapes as a **running** node declares them, from its [OpenAPI document](/api/openapi.json). For the full definitions, with nested constraints and unions, see [Schemas](./schemas.md).

## `Anchor`

Public description of a knowledge item (patch).

| Field | Type | Required |
|---|---|---|
| `id` | string | no |
| `name` | string | no |
| `description` | string | no |
| `author` | string | no |
| `model` | object | no |
| `patch_sha256` | string | no |
| `size_bytes` | integer | no |
| `rows` | integer | no |
| `benchmark` | object | no |
| `price` | string | no |
| `currency` | AIN, CREDIT, USDC | no |
| `billing` | per_download, per_apply_hour, per_hit | no |
| `parents` | array of string | no |
| `branch` | string | no |
| `topic_path` | string | no |
| `created_at` | integer | no |
| `visibility` | public, test | no |
| `contributors` | array of Contributor | no |
| `origin` | operator, teach | no |
| `dataset` | object | no |
| `derivation` | object | no |
| `base` | object | no |

## `CanonicalRow`

One question and answer as stored in a training set (`rows.jsonl`, canonical bytes — the sha256 of the file is the set’s identity).

| Field | Type | Required |
|---|---|---|
| `prompt` | string | yes |
| `answer` | string | yes |
| `alt_prompt` | string | no |
| `note` | string | no |
| `from` | string | no |
| `replaces` | string | no |

## `Contributor`

A data provider credited on an anchor.

| Field | Type | Required |
|---|---|---|
| `address` | string | yes |
| `signer` | string | no |
| `name` | string | no |
| `share` | number | yes |
| `role` | data_provider | yes |
| `proof` | signed, declared | yes |
| `sig` | string | no |

## `Attestation`



| Field | Type | Required |
|---|---|---|
| `patch_id` | string | no |
| `verifier` | string | no |
| `verifier_name` | string | no |
| `passed` | boolean | no |
| `verified_on` | string | no |
| `score` | object | no |
| `restarts_detected` | integer | no |
| `stake` | string | no |
| `created_at` | integer | no |

## `Challenge`

A verifier disputing a listed knowledge.

| Field | Type | Required |
|---|---|---|
| `patch_id` | string | no |
| `challenger` | string | no |
| `reason` | string | no |
| `created_at` | integer | no |

## `CatalogEntry`



| Field | Type | Required |
|---|---|---|
| `anchor` | Anchor | no |
| `status` | DRAFT, ANNOUNCED, VERIFYING, VERIFIED, REJECTED, CHALLENGED, SUPERSEDED, RETIRED | no |
| `attestations` | array of Attestation | no |
| `passed` | integer | no |
| `integrity_checks` | integer | no |
| `self_checks` | integer | no |
| `quorum` | integer | no |
| `quorum_ok` | boolean | no |
| `sellable` | boolean | no |
| `body_available` | boolean,null | no |
| `open_challenge` | Challenge | no |
| `downloads` | integer | no |
| `revenue` | string | no |
| `superseded_by` | array of string | no |
| `children` | array of string | no |

## `Manifest`

Document returned after payment.

| Field | Type | Required |
|---|---|---|
| `id` | string | no |
| `patch_sha256` | string | no |
| `size_bytes` | integer | no |
| `rows` | integer | no |
| `blob_urls` | array of string | no |
| `download_token` | string | no |
| `issued_to` | string | no |

## `X402Requirement`



| Field | Type | Required |
|---|---|---|
| `scheme` | ain-transfer, local-credit | no |
| `network` | string | no |
| `asset` | string | no |
| `payTo` | string | no |
| `maxAmountRequired` | string | no |
| `resource` | string | no |
| `nonce` | string | no |
| `expires_at` | integer | no |

## `X402Payload`

Sent base64(JSON) in the X-PAYMENT header.

| Field | Type | Required |
|---|---|---|
| `scheme` | string | no |
| `network` | string | no |
| `txHash` | string | no |
| `from` | string | no |
| `to` | string | no |
| `amount` | string | no |
| `nonce` | string | no |
| `proof` | string | no |

## `ChatMessage`



| Field | Type | Required |
|---|---|---|
| `role` | system, user, assistant | yes |
| `content` | string | yes |

## `ChatRequest`

Exactly one of `patch_id` (one knowledge) or `patch_ids` (0–3 knowledges, loaded in list order; the last one wins on overlapping memory entries).

| Field | Type | Required |
|---|---|---|
| `model` | string | no |
| `stream` | boolean | no |
| `patch_id` | string | no |
| `patch_ids` | array of string | no |
| `mode` | base, patched, compare | no |
| `messages` | array of ChatMessage | yes |
| `messages_base` | array of ChatMessage | no |
| `messages_patched` | array of ChatMessage | no |
| `max_tokens` | integer | no |
| `thinking` | boolean | no |
| `request_id` | string | no |

## `ChatAnswer`

One generated answer.

| Field | Type | Required |
|---|---|---|
| `content` | string | no |
| `latency_ms` | integer | no |
| `model` | string | no |
| `finish_reason` | string | no |
| `truncated` | repetition, length, null | no |
| `shown_chars` | integer | no |
| `raw_chars` | integer | no |
| `raw_content` | string | no |

## `ChatStatus`

Where one live test is in the queue behind the shared serving model.

| Field | Type | Required |
|---|---|---|
| `state` | queued, running, gone | no |
| `queued_ms` | integer | no |
| `running_ms` | integer | no |
| `position` | integer | no |
| `cancelled` | boolean | no |
| `lock` | object | no |
| `waiting` | integer | no |
| `now` | integer | no |

## `ChatResponse`



| Field | Type | Required |
|---|---|---|
| `inference_receipt` | object | no |
| `patch_id` | string | no |
| `mode` | string | no |
| `base` | ChatAnswer | no |
| `patched` | ChatAnswer | no |
| `applied_ms` | integer | no |
| `was_applied` | boolean | no |
| `benchmark_hit` | boolean | no |
| `patch_ids` | array of string | no |
| `applied` | array of ChatApplied | no |
| `benchmark_hits` | object | no |
| `model` | string | no |
| `remaining_quota` | integer | no |
| `quota_limit` | integer | no |
| `history` | object | no |

## `ChatApplied`



| Field | Type | Required |
|---|---|---|
| `patch_id` | string | no |
| `applied_ms` | integer | no |
| `was_applied` | boolean | no |

## `ChatPatches`



| Field | Type | Required |
|---|---|---|
| `items` | array of object | no |
| `runtime` | object | no |
| `lock` | object | no |
| `now` | integer | no |
| `queue` | object | no |
| `applied` | array of string | no |
| `dirty` | array of string | no |
| `elsewhere` | array of object | no |
| `overlaps` | array of object | no |
| `lessons` | array of object | no |
| `teacher` | string | no |

## `Error`



| Field | Type | Required |
|---|---|---|
| `error` | string | no |

## `Payout`

One royalty transfer owed by this node for one settle record (spec §7.5 / §9.3).

| Field | Type | Required |
|---|---|---|
| `id` | integer | no |
| `patch_id` | string | no |
| `settle_hash` | string | no |
| `address` | string | no |
| `amount` | string | no |
| `currency` | string | no |
| `status` | pending, paying, paid, failed | no |
| `tx_hash` | string | no |
| `attempts` | integer | no |
| `last_error` | string | no |
| `created_at` | integer | no |
| `updated_at` | integer | no |

## `PayoutSummary`



| Field | Type | Required |
|---|---|---|
| `pending` | integer | no |
| `failed` | integer | no |
| `paid` | integer | no |

## `TeacherProfile`



| Field | Type | Required |
|---|---|---|
| `address` | string | no |
| `name` | string | no |
| `hidden` | boolean | no |
| `lessons` | array of object | no |
| `earnings` | object | no |

## `TeachFact`

One correction: the question, the right answer (single line, ≤ 200 chars) and an optional paraphrase used as a held-out check.

| Field | Type | Required |
|---|---|---|
| `prompt` | string | yes |
| `answer` | string | yes |
| `alt_prompt` | string | no |
| `base_answer` | string | no |
| `after_answer` | string | no |
| `hit` | boolean | no |
| `heldout_hit` | boolean | no |

## `TeachChecks`

Measured in the live model after training.

| Field | Type | Required |
|---|---|---|
| `executed` | boolean | no |
| `taught` | object | no |
| `skipped` | boolean | no |
| `heldout` | object | no |
| `parent_regression` | object | no |
| `locality` | object | no |
| `reverted_and_reapplied` | boolean | no |
| `ok` | boolean | no |
| `note` | string | no |

## `TeachJob`

A lesson (teach job).

| Field | Type | Required |
|---|---|---|
| `id` | string | no |
| `status` | QUEUED, PREFLIGHT, LOADING, TRAINING, EXPORTED, CHECKING, READY, NEEDS_MORE, FAILED, CANCELLED, PENDING_REVIEW, REJECTED, ANNOUNCED, EXPIRED | no |
| `contributor` | object | no |
| `context_patch_ids` | array of string | no |
| `builds_on_context` | boolean | no |
| `facts` | array of TeachFact | no |
| `name` | string | no |
| `position` | integer | no |
| `eta_s` | integer | no |
| `blocked` | slot, lock, runtime, container, null | no |
| `dataset` | TeachDatasetRef | no |
| `training` | object | no |
| `progress` | object | no |
| `checks` | TeachChecks | no |
| `result` | object | no |
| `draft_id` | string | no |
| `patch_id` | string | no |
| `publish_status` | none, pending_review, rejected, announced, listed | no |
| `reject_reason` | string | no |
| `error` | string | no |
| `parent_job` | string | no |
| `created_at` | integer | no |
| `updated_at` | integer | no |
| `started_at` | integer | no |
| `finished_at` | integer | no |
| `expires_at` | integer | no |

## `TeachDataset`

A dataset: the durable artifact a lesson is trained from.

| Field | Type | Required |
|---|---|---|
| `id` | string | no |
| `owner_address` | string | no |
| `name` | string | no |
| `status` | staged, ready, in_use, deleted | no |
| `source` | chat, upload, derived, sample | no |
| `sha256` | string | no |
| `revision` | integer | no |
| `rows` | integer | no |
| `invalid_rows` | integer | no |
| `size_bytes` | integer | no |
| `source_bytes` | integer | no |
| `source_name` | string | no |
| `format` | jsonl, json, csv, tsv, txt | no |
| `encoding` | string | no |
| `layout` | tsv, qa, blocks, prompts | no |
| `delimiter` | string | no |
| `has_header` | boolean | no |
| `columns` | object | no |
| `summary` | TeachDatasetSummary | no |
| `parent_dataset` | string | no |
| `retention` | keep, delete_after_training | no |
| `job_ids` | array of string | no |
| `created_at` | integer | no |
| `updated_at` | integer | no |
| `expires_at` | integer | no |
| `deleted_at` | integer | no |

## `TeachDatasetSummary`

Counts over the SOURCE rows.

| Field | Type | Required |
|---|---|---|
| `source_rows` | integer | no |
| `accepted` | integer | no |
| `fixed` | integer | no |
| `rejected` | integer | no |
| `duplicates` | integer | no |
| `conflicts` | integer | no |
| `blocked` | integer | no |
| `too_long` | integer | no |
| `empty` | integer | no |
| `not_parsed` | integer | no |
| `over_cap` | integer | no |
| `shared_ending` | integer | no |
| `langs` | object | no |

## `TeachDatasetRow`

One SOURCE row, accepted or not.

| Field | Type | Required |
|---|---|---|
| `index` | integer | no |
| `line` | integer | no |
| `status` | ok, fixed, duplicate, conflict, too_long, empty, blocked, not_parsed, over_cap | no |
| `prompt` | string | no |
| `answer` | string | no |
| `alt_prompt` | string | no |
| `note` | string | no |
| `fixes` | array of whitespace_collapsed, answer_flattened, controls_stripped, qa_prefix_stripped, note_truncated | no |
| `advisory` | array of shared_ending | no |
| `detail` | string | no |
| `raw` | string | no |
| `lang` | hangul, latin, han, kana, other | no |

## `TeachDatasetRef`

What a lesson was trained from.

| Field | Type | Required |
|---|---|---|
| `id` | string | no |
| `sha256` | string | no |
| `revision` | integer | no |
| `rows` | integer | no |
| `trained_rows` | integer | no |
| `source` | chat, upload, derived, sample | no |
| `name` | string | no |
| `selected_indexes` | array of integer | no |
| `sampled` | object | no |
| `deleted` | boolean | no |

## `TeachPolicy`



| Field | Type | Required |
|---|---|---|
| `enabled` | boolean | no |
| `publish` | review, auto, never | no |
| `trainer` | ready, busy, paused | no |
| `paused_reason` | string | no |
| `backend` | gradient, stub | no |
| `queue` | object | no |
| `limits` | object | no |
| `timing` | object | no |
| `effort` | array of object | no |
| `samples` | array of object | no |
| `shares` | object | no |
| `model` | object | no |
| `applied` | array of string | no |
| `draft_ttl_days` | integer | no |

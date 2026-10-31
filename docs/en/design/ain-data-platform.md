---
title: "Design (draft): AIN Store — a web3 Firestore"
summary: Status — awaiting approval. A Firestore replacement where AIN Blockchain carries the authority (rules, triggers, the ordered write log and a commitment to the database), AinDrive holds the documents and the log archive, the per-project SQLite is the only index, AIN SSO is the identity behind every permission, and ainize Runs execute triggers under that identity.
---

# Design (draft): AIN Store — a web3 Firestore

**Status: awaiting approval (2026-10-31).**

AIN Store is the database apps on ainize use in place of Firestore. It keeps what made Firestore easy: documents and collections, queries, realtime listeners, security rules and triggers. The difference is where the authority lives. Firestore's rules and triggers run inside Google, and you trust Google to apply them. In AIN Store they run in **AIN Blockchain consensus**: every node checks every write against the rules, and every trigger fires from a finalized transaction. Nobody, the operator included, can skip a rule or bypass a trigger unnoticed.

| Part | Role | Firestore equivalent |
| --- | --- | --- |
| AIN Blockchain | **Authority**: rules (`.rule`), triggers (`.function`), the **ordered write log** (bounded), and one **commitment** to the database's current state | Security rules, function triggers, the commit order Google keeps internally |
| AinDrive | **Document bodies and files** stored under their hash, plus the **log archive** | Document contents, Cloud Storage |
| Store (per project) | **SQLite: the only index.** Built by replaying the chain log and AinDrive bodies; answers gets, queries and realtime | Firestore's storage and indexes |
| AIN SSO | **Identity and roles** for users, orgs and services; delegations to sessions, agents and Runs | Firebase Auth, custom claims |
| ainize Runs | **Executes triggers** under a scoped identity issued by SSO | Cloud Functions |

## Principles

1. **Index once.** Looking up a document by id or field is the database's job, and SQLite already does it. The chain never stores a per-document copy of that index; it stores what only a chain can give.
2. **The chain orders and authorizes every write.** Each write is a log entry on chain, checked by consensus rules and able to fire triggers. The order of the log is the order of the database.
3. **The database is a deterministic function of the log.** Replaying the log, with bodies from AinDrive, rebuilds the same SQLite, so the Store holds no authority of its own.
4. **One commitment, not one entry per document.** The Store publishes the Merkle root of its current state. Any document can be proven against it, and anyone can recompute it by replay.
5. **One identity end to end.** The SSO account that signs a write is the `auth` its rules see. The trigger that write fires runs with permissions derived from that account or from the app's own account, never wider.

## Data model

```text
chain    /apps/<app>/log/<collection>/<key>   = { id, op, base, h }   write log, oldest entries garbage-collected
         /apps/<app>/log/<collection>/.rule   write rule (consensus) + state rule { gc_max_siblings, max_bytes }
         /apps/<app>/log/<collection>/$key/.function   trigger → ainize Runs
         /apps/<app>/commit                   = { upTo, root, segment }   one value, overwritten
AinDrive <org drive>/store/<app>/objects/<sha256>     document body (JSON) or file bytes
         <org drive>/store/<app>/log/<segment>        archived log entries, in chain order
Store    SQLite: documents (collection, id, version, hash, data) + declared indexes
```

- **Log entries:** `{ id, op: "set" | "merge" | "delete", base: <version it was written against>, h: <body hash> }`, about 400 bytes. `<key>` is a time-ordered push id, so the chain's state rule (`gc_max_siblings`, for example 1,000) drops the oldest entries automatically. Chain state per collection is bounded whatever the number of documents.
- **Bodies:** JSON on AinDrive under its sha256. The log entry carries only the hash.
- **Applying the log:** the Store tails finalized log entries in chain order, fetches each body, and applies it to SQLite. An entry whose `base` is not the document's current version is rejected the same way on every replay; that is optimistic concurrency, decided by log order.
- **Commitment:** every N entries or minutes, the Store builds a Merkle root over `(collection, id, version, hash)`, which are the rows SQLite already holds. It overwrites `/apps/<app>/commit` with the root, the last log position it covers, and the AinDrive log segment it archived.
- **History:** nodes keep bounded history, so the Store archives log entries to AinDrive segments before the chain garbage-collects them. Archive plus bodies is the complete original. A lost Store is rebuilt from it, and its rebuilt root must equal the committed one.
- **Private collections:** document ids in log entries are HMACs under an org key; bodies stay behind AinDrive permissions.
- **Public collections:** game scores and NFT metadata may put the value itself in the log entry and keep a small public mirror on chain for other apps to read.

## Write path

```text
SDK ─► Store ─► AinDrive: put body → sha256
               └► chain tx: SET_VALUE /apps/<app>/log/<col>/<key> = { id, op, base, h }   (signed by the user's session key)
                     ├ .rule checks auth (SSO account, org role) and the entry's shape   — consensus
                     ├ .function → ainize Runs (trigger)
                     └ finalized → Store applies it to SQLite → realtime listeners
```

1. The SDK applies the write locally at once and marks it pending, like Firestore's latency compensation.
2. The Store puts the body on AinDrive. The chain transaction is signed with the user's **session key**; a batch goes in one transaction.
3. Consensus checks the rule. A rejected write rolls back on the client with the rule's error.
4. When the entry is finalized, the Store applies it. A stale `base` is reported to the client as a conflict, as Firestore reports a failed transaction.

**What rules can check.**
- **Enforced by consensus:** who is writing (SSO account, org, role, session expiry), what is written (shape, sizes, allowed ops), and the collection's limits.
- **Enforced on replay:** conditions on the document's existing contents, such as "only the owner may edit". The chain does not hold per-document state, so these rules run deterministically when the log is applied. A violation is rejected identically on every replay, and anyone can check it by replaying.
- A collection that needs such a condition enforced by consensus can opt in to a small per-document field on chain, for example the owner.

## Read path

- **Gets, queries, realtime:** all served by the Store's SQLite: `where`, `orderBy`, `limit`, cursors and `onSnapshot`. It is the one index, kept current by the log.
- **Verification:** the SDK can ask for a Merkle proof with any document and check it against `/apps/<app>/commit`. It also checks the body's hash.
- **Read permission:** the log holds hashes, not contents. Bodies are protected by AinDrive permissions under SSO roles and shares, and the Store applies each collection's `read` rule to queries and listeners.

## Permissions through AIN SSO

### Identity on chain

- **Accounts:** each SSO account has an AIN address. Either the user links their own wallet, or SSO derives one from the account's passkey (AIN WebAuthn-P256).
- **Directory:** SSO publishes what rules need under its own chain app, using the push model it already uses for apps:
  - `/apps/ain_sso/orgs/<org>/members/<addr> = "<role>"`
  - `/apps/ain_sso/sessions/<sessionAddr> = { addr, org, exp }`
- **Sessions:** signing in creates a short-lived session key (the device-delegation `cnf` key). SSO registers it under `sessions/`. The browser signs with it, so users never handle chain keys.
- **Lifecycle:** suspension, offboarding and session revocation remove those entries. From the next block on, every rule that checks them denies.

### Rules

```text
/apps/donga/log/articles/.rule.write:
  getValue('/apps/ain_sso/sessions/' + auth.addr + '/org') === 'org_donga'
  && ['editor','admin'].includes(getValue('/apps/ain_sso/orgs/org_donga/members/'
       + getValue('/apps/ain_sso/sessions/' + auth.addr + '/addr')))
  && util.isDict(newData) && ['set','merge','delete'].includes(newData.op)
```

The SDK ships helpers that compile `role in ['editor','admin']` to this form. Rules are reviewed and deployed with the app, like Firestore rules.

### Triggers and ainize Runs

```text
finalized tx ─► chain .function (REST, whitelisted URL) ─► ainize node
   node: fetch the tx by hash, confirm it is finalized and wrote this path   (no forged events)
   node: ask SSO for a resource-scoped delegation (ain-rdlg+jwt) for this run
   Run executes with that delegation + an ephemeral session key registered under /apps/ain_sso/sessions
   Run's writes go through the same chain rules
```

- **Declaring a trigger:** `ainize.json` declares, per trigger, the paths it may write and the AinDrive objects it may read. For example: `"on-article": { "type": "ain", "path": "/apps/donga/log/articles/$key", "as": "app", "writes": ["/apps/donga/log/translations"] }`.
- **Running as the app (`as: "app"`):** the Run acts as the project's own SSO service account, owned by the org. Its permission is the declared scope, limited to the roles the org grants that account.
- **Running as the caller (`as: "caller"`):** the Run acts for the account that signed the triggering transaction. It can never do more than that user could.
- **Verified events:** the node checks the event against the chain before running anything. The per-trigger URL token stays only as rate-limit protection.
- **Ephemeral keys:** the Run's session key expires with the run's timeout. Revoking the org's delegations stops its Runs.
- **Schedule and webhook triggers:** these always run as `as: "app"`.

## Capacity and cost

Chain state is now bounded by the log window, not by the number of documents.

| Project | Documents (measured 2026-10-31) | Write rate | Chain state |
| --- | --- | --- | --- |
| Donga Science | 214,566 | About 440 new articles in October 2026, each with a translation and an evaluation | Log window 1,000 entries per collection × about 400 B ≈ 0.4 MB per collection, plus one commit value |
| Baby Shark | 8,669 top-level | Low | Under 0.5 MB |
| a2a orchestrator | About 6,000 | Low | Under 0.5 MB |

- With per-document entries Donga would have needed about 64 MB; with the log it needs well under 5 MB. The budget increase approved for Donga covers it with a wide margin.
- **Per-app budgets** (decision D2) remain the isolation mechanism. The chain's existing state rule `max_bytes` caps each log path as well.
- **Writes:** one transaction per write or batch, acknowledged at finality (a few seconds) behind the SDK's pending state.
- **Reads** never touch the chain.
- **Monitoring:** every 5 minutes, check per-app budget use, log lag (the Store's applied position against the chain), archive lag (it must stay ahead of garbage collection), and trigger failures. Alert AIN Teams #comcom at 70% and 85%.

## Moving off Firebase

| Firebase | AIN Store |
| --- | --- |
| Firestore documents and collections | SQLite in the Store, bodies on AinDrive, writes as chain log entries |
| Queries, `onSnapshot` | Store queries and SSE listeners |
| Security rules | Chain `.rule`, with SSO roles through `/apps/ain_sso` |
| Cloud Functions triggers | Chain `.function` to ainize Runs, with SSO delegations |
| Firebase Auth | AIN SSO; existing Firebase Auth users are exported and kept |
| Cloud Storage | AinDrive objects |

| Project | Gate before billing is unlinked |
| --- | --- |
| Baby Shark (`babyshark-187c9`) | A game on https://nft.babyshark.com/game grants its reward; the utility page loads images |
| nft-server (`nft-server-prod`) | Every hosted token URI returns byte-identical JSON |
| Donga Science (`donga-science-prod`) | New articles flow from collection through translation and review to publication on https://dongascience.com/en; the admin dashboard works |
| a2a orchestrator | ainspace report and chat flows give identical results; its encrypted state is removed from chain |

Each move follows the same steps: export → import → dual-run and compare → switch → verify the live service → remove the old copy → unlink billing.

## What ainize Runs still needs

The pieces in the "Triggers and ainize Runs" section that do not exist yet:

- Add the ainize fire URL to the chain's REST function whitelist.
- Wire ain-js into the node, so "Install on chain" works instead of returning 503.
- Verify events against the chain.
- Issue SSO resource-scoped delegations per run and register ephemeral session keys.
- Add `as` and `writes` to the trigger manifest.

Today a triggered Run runs with the key of whoever last pushed the project, which is what this replaces.

## Build order

1. Chain: per-app budgets, deletions always accepted, the REST whitelist entry for ainize.
2. SSO: publish the directory (`/apps/ain_sso` orgs, members, sessions); session keys at sign-in.
3. Store: SDK, log tailer and deterministic apply, SQLite indexes, commitment and proofs, AinDrive bodies and log archive, SSE, rule helpers.
4. Runs: verified events, delegations, `as` and `writes`, on-chain install.
5. Migrate Baby Shark, then nft-server, then Donga Science with one week of dual-run, then the orchestrator.

## Decisions for approval

- **D1. No per-document index on chain.** The chain holds rules, triggers, a bounded write log and one commitment; SQLite is the only index; AinDrive holds bodies and the log archive.
- **D2. Per-app state budgets** set by governance replace the shared free pool, and deletions are always accepted. This is a mainnet consensus change. Donga's increase is approved.
- **D3. SSO publishes orgs, members and sessions on chain, and users sign with SSO-issued session keys.**
- **D4. Runs execute `as: "app"` (default) or `as: "caller"`, scoped by SSO resource delegations to declared paths.**
- **D5. Data-dependent rules run on deterministic replay by default, and opt in to consensus with a per-document field.**

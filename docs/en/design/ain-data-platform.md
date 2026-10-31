---
title: "Design: AIN Store"
summary: Status — approved 2026-10-31. The document database for apps on ainize: AIN Blockchain carries the authority (rules, triggers, an O(log n) Merkle Mountain Range over every write, and a state root), AinDrive holds the documents and the write records, the per-project SQLite is the only index, AIN SSO is the identity behind every permission, and ainize Runs execute triggers under that identity.
---

# Design: AIN Store

**Status: approved 2026-10-31.**

AIN Store is the document database for apps on ainize: documents and collections, queries, realtime listeners, security rules and triggers, with no backend to write. Its rules and triggers run in **AIN Blockchain consensus**. Every node checks every write against the rules, and every trigger fires from a finalized transaction. Nobody, the operator included, can skip a rule or bypass a trigger unnoticed.

| Part | Role |
| --- | --- |
| AIN Blockchain | **Authority**: rules (`.rule`), triggers (`.function`), a consensus-maintained **Merkle Mountain Range** over every write (O(log n) state), and the database's **state root** |
| AinDrive | **Document bodies and files** stored under their hash, plus the **write records** |
| Store (per project) | **SQLite: the only index.** Built by replaying the write records and AinDrive bodies; answers gets, queries and realtime |
| AIN SSO | **Identity and roles** for users, orgs and services; delegations to sessions, agents and Runs |
| ainize Runs | **Executes triggers** under a scoped identity issued by SSO |

## Principles

1. **Index once.** Looking up a document by id or field is the database's job, and SQLite already does it. The chain never stores a per-document copy of that index; it stores what only a chain can give.
2. **The chain orders and authorizes every write.** Each write is a transaction on chain, checked by consensus rules and able to fire triggers. Chain order is the order of the database.
3. **The database is a deterministic function of the write records.** Replaying them, with bodies from AinDrive, rebuilds the same SQLite, so the Store holds no authority of its own.
4. **On-chain index grows as log₂ n.** Consensus folds every write into a Merkle Mountain Range: at most ⌊log₂ n⌋ + 1 peaks after n writes. Every write ever made, and every document's current state, can be proven with an O(log n) path. Nothing is garbage-collected away.
5. **One identity end to end.** The SSO account that signs a write is the `auth` its rules see. The trigger that write fires runs with permissions derived from that account or from the app's own account, never wider.

## Data model

```text
chain    /apps/<app>/writes/<collection>/$key            write slot: { id, op, base, h }; erased in the same transaction
         /apps/<app>/writes/<collection>/.rule           write rule (consensus)
         /apps/<app>/writes/<collection>/$key/.function  _storeAppend (native) + trigger → ainize Runs
         /apps/<app>/store/mmr                         = { n, peaks: [≤ ⌊log₂ n⌋ + 1 hashes] }   consensus-maintained
         /apps/<app>/store/state                       = { upTo, root }   state root posted by the Store
AinDrive <org drive>/store/<app>/objects/<sha256>     document body (JSON) or file bytes
         <org drive>/store/<app>/writes/<segment>     every write record, in MMR order (the leaves)
Store    SQLite: documents (collection, id, version, hash, data) + declared indexes
         sparse Merkle tree over (collection, id) → (version, hash)
```

- **Write records:** `{ id, op: "set" | "merge" | "delete", base: <version it was written against>, h: <body hash> }`. A write sets its slot; the slot's rule checks it; then a new native function, `_storeAppend`, hashes the record together with the transaction hash into a leaf, merges it into the app's MMR peaks, and erases the slot. All of that happens in the same transaction. The chain keeps only `n` and the peaks: 20 peaks cover a million writes, 30 cover a billion.
- **Why an MMR:** appending costs O(log n) hash merges, and the peaks commit to every record ever written, in order. A record's inclusion proof is its O(log n) Merkle path from the archived leaves to a peak. Because consensus computes the peaks, the Store cannot drop, reorder or alter a past write without every proof against the chain failing.
- **Bodies:** JSON on AinDrive under its sha256. The write record carries only the hash.
- **Applying writes:** the Store follows finalized writes in chain order, fetches each body, and applies it to SQLite. A write whose `base` is not the document's current version is rejected the same way on every replay; that is optimistic concurrency, decided by chain order.
- **State root:** SQLite holds the current documents; the Store also keeps a sparse Merkle tree over `(collection, id) → (version, hash)`. Every N writes or minutes it posts `/apps/<app>/store/state = { upTo: <MMR position>, root }`, one value overwritten. Proving a document's current state is an O(log n) path to that root. Anyone can recompute the root by replaying the leaves up to `upTo`, and every leaf is provable against the MMR.
- **History:** the leaves (write records) are archived on AinDrive in MMR order. Leaves plus bodies are the complete original. A lost Store is rebuilt from them, and its rebuilt roots must equal the MMR peaks and the posted state root.
- **Private collections:** document ids in write records are HMACs under an org key; bodies stay behind AinDrive permissions.
- **Public collections:** game scores and NFT metadata may put the value itself in the write record and keep a small public mirror on chain for other apps to read.

## Write path

```text
SDK ─► Store ─► AinDrive: put body → sha256
               └► chain tx: SET_VALUE /apps/<app>/writes/<col>/<key> = { id, op, base, h }   (signed by the user's session key)
                     ├ .rule checks auth (SSO account, org role) and the entry's shape   — consensus
                     ├ _storeAppend folds it into the MMR peaks, erases the slot      — consensus
                     ├ .function → ainize Runs (trigger)
                     └ finalized → Store applies it to SQLite → realtime listeners
```

1. The SDK applies the write locally at once and marks it pending.
2. The Store puts the body on AinDrive. The chain transaction is signed with the user's **session key**; a batch goes in one transaction.
3. Consensus checks the rule. A rejected write rolls back on the client with the rule's error.
4. When the entry is finalized, the Store applies it. A stale `base` is reported to the client as a conflict.

**What rules can check.**
- **Enforced by consensus:** who is writing (SSO account, org, role, session expiry), what is written (shape, sizes, allowed ops), and the collection's limits.
- **Enforced on replay:** conditions on the document's existing contents, such as "only the owner may edit". The chain does not hold per-document state, so these rules run deterministically when writes are applied. A violation is rejected identically on every replay, and anyone can check it by replaying.
- A collection that needs such a condition enforced by consensus can opt in to a small per-document field on chain, for example the owner.

## Read path

- **Gets, queries, realtime:** all served by the Store's SQLite: `where`, `orderBy`, `limit`, cursors and `onSnapshot`. It is the one index, kept current by the write records.
- **Verification:** the SDK can ask for two O(log n) proofs with any document: one that its current version is in the state root at `/apps/<app>/store/state`, and one that the write that produced it is in the chain's MMR. It also checks the body's hash.
- **Read permission:** write records hold hashes, not contents. Bodies are protected by AinDrive permissions under SSO roles and shares, and the Store applies each collection's `read` rule to queries and listeners.

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
/apps/donga/writes/articles/.rule.write:
  getValue('/apps/ain_sso/sessions/' + auth.addr + '/org') === 'org_donga'
  && ['editor','admin'].includes(getValue('/apps/ain_sso/orgs/org_donga/members/'
       + getValue('/apps/ain_sso/sessions/' + auth.addr + '/addr')))
  && util.isDict(newData) && ['set','merge','delete'].includes(newData.op)
```

The SDK ships helpers that compile `role in ['editor','admin']` to this form. Rules are reviewed and deployed with the app.

### Triggers and ainize Runs

```text
finalized tx ─► chain .function (REST, whitelisted URL) ─► ainize node
   node: fetch the tx by hash, confirm it is finalized and wrote this path   (no forged events)
   node: ask SSO for a resource-scoped delegation (ain-rdlg+jwt) for this run
   Run executes with that delegation + an ephemeral session key registered under /apps/ain_sso/sessions
   Run's writes go through the same chain rules
```

- **Declaring a trigger:** `ainize.json` declares, per trigger, the paths it may write and the AinDrive objects it may read. For example: `"on-article": { "type": "ain", "path": "/apps/donga/writes/articles/$key", "as": "app", "writes": ["/apps/donga/writes/translations"] }`.
- **Running as the app (`as: "app"`):** the Run acts as the project's own SSO service account, owned by the org. Its permission is the declared scope, limited to the roles the org grants that account.
- **Running as the caller (`as: "caller"`):** the Run acts for the account that signed the triggering transaction. It can never do more than that user could.
- **Verified events:** the node checks the event against the chain before running anything. The per-trigger URL token stays only as rate-limit protection.
- **Ephemeral keys:** the Run's session key expires with the run's timeout. Revoking the org's delegations stops its Runs.
- **Schedule and webhook triggers:** these always run as `as: "app"`.

## Capacity and cost

Chain state grows with log₂ of the number of writes, not with the number of documents.

| Project | Documents (measured 2026-10-31) | Writes | Chain state |
| --- | --- | --- | --- |
| Donga Science | 214,566 | About 440 new articles in October 2026, each with a translation and an evaluation | MMR over all past writes: ⌊log₂ n⌋ + 1 ≤ 20 peaks while n < 1M, about 4 KB; plus one state root |
| Baby Shark | 8,669 top-level | Low | Under 4 KB |
| a2a orchestrator | About 6,000 | Low | Under 4 KB |

- Per-document entries would have needed about 64 MB for Donga. The MMR needs about 4 KB, and only about 6 KB at a billion writes.
- The write slot is erased in the same transaction, so write records never accumulate on chain. The records themselves (about 100 B each; Donga writes about 15k per 30 days, about 1.5 MB a month) are stored on AinDrive.
- **Per-app budgets** (decision D2) remain the isolation mechanism.
- **Writes:** one transaction per write or batch, acknowledged at finality (a few seconds) behind the SDK's pending state.
- **Reads** never touch the chain.
- **Monitoring:** every 5 minutes, check per-app budget use, apply lag (the Store's position against the MMR's `n`), archive completeness (every leaf up to `n` is on AinDrive), state-root lag, and trigger failures. Alert AIN Teams #comcom at 70% and 85%.

## Migrating existing projects

| Project | Gate before the old project's billing is unlinked |
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

1. Chain: the `_storeAppend` native function (MMR append and slot erase), per-app budgets, deletions always accepted, the REST whitelist entry for ainize.
2. SSO: publish the directory (`/apps/ain_sso` orgs, members, sessions); session keys at sign-in.
3. Store: SDK, write follower and deterministic apply, SQLite indexes, sparse Merkle state root and proofs, AinDrive bodies and leaf archive, SSE, rule helpers.
4. Runs: verified events, delegations, `as` and `writes`, on-chain install.
5. Migrate Baby Shark, then nft-server, then Donga Science with one week of dual-run, then the orchestrator.

## Decisions (approved 2026-10-31)

- **D1. On-chain index is O(log n).** A consensus-maintained Merkle Mountain Range over every write, through a new native function `_storeAppend`, plus a state root. SQLite is the only query index; AinDrive holds bodies and the write records. This is a mainnet consensus change.
- **D2. Per-app state budgets** set by governance replace the shared free pool, and deletions are always accepted. This is a mainnet consensus change. Donga's increase is approved.
- **D3. SSO publishes orgs, members and sessions on chain, and users sign with SSO-issued session keys.**
- **D4. Runs execute `as: "app"` (default) or `as: "caller"`, scoped by SSO resource delegations to declared paths.**
- **D5. Data-dependent rules run on deterministic replay by default. A later option: verify them in consensus by having the transaction carry the document's O(log n) state proof.**

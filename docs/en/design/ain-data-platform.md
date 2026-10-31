---
title: "Design (draft): AIN Store — a web3 Firestore"
summary: Status — awaiting approval. A Firestore replacement for apps on ainize. Documents, queries, realtime, rules, files and triggers, with originals on AinDrive and integrity anchored on AIN Blockchain. Architecture informed by Supabase and PocketBase.
---

# Design (draft): AIN Store — a web3 Firestore

**Status: awaiting approval (2026-10-31).**

AIN Store is the database apps on ainize use in place of Firestore. It gives developers what made Firestore easy: documents and collections, queries, realtime listeners, security rules, file fields and triggers. It also adds what Firestore cannot:

- **Originals belong to the owner.** They live on the owner's AinDrive, not inside a cloud vendor.
- **Every change is verifiable.** Batches of changes are anchored on AIN Blockchain.
- **Identity is AIN.** Users sign in with AIN SSO or an AIN wallet.

## Requirements

1. **Firestore-level convenience.** No hand-written backend for CRUD. A client SDK with `collection / doc / where / orderBy / limit / onSnapshot`, plus declarative per-collection rules.
2. **Originals on AinDrive.** The durable copy of every database and file is on AinDrive. Anything on a node can be rebuilt from it.
3. **The chain holds proofs and public facts only.** Hash roots, pointers, and data that is meant to be public. Never bulk or encrypted data, because nobody can read it and every byte comes out of a budget shared by all apps.
4. **Isolation.** One app's size or traffic can never stop another app. That holds both on the chain and on the hosting nodes.
5. **Cheap at small scale, enough at our largest.** Most apps are small; Baby Shark sees about 3k reads per 30 days. The largest current workload is Donga Science, about 6.2M reads and 15k writes per 30 days, roughly 2.4 reads per second on average.

## What we take from Supabase and PocketBase

| Idea | From | How AIN Store uses it |
| --- | --- | --- |
| The database is the source of truth; API, realtime and storage are thin services around it | Supabase | One storage engine per project; everything else derives from its commit log |
| Access rules live next to the data and are evaluated on every request | Supabase (RLS), PocketBase (API rules) | Per-collection rule expressions for `list`, `get`, `create`, `update` and `delete`, over `auth` and `doc` |
| Realtime comes from the commit log, not from app code | Supabase (WAL to Realtime) | Subscriptions are fed from the engine's commit stream |
| Storage is metadata in the database plus bytes elsewhere | Supabase Storage | File fields record path and hash; the bytes live on AinDrive |
| One self-contained server per app: embedded SQLite, schema, rules, realtime over SSE, hooks, admin UI | PocketBase | Each ainize project gets one small Store process with an embedded SQLite file. No shared database server |
| Collections with a schema you can grow, plus schemaless JSON | PocketBase | Collections are schemaless by default; adding fields or indexes is optional |
| Hooks on record events | PocketBase, Supabase functions | `onCreate`, `onUpdate` and `onDelete` triggers run as ainize Runs |

Why per-project SQLite (PocketBase) rather than one shared Postgres (Supabase): ainize already runs one container per project. A Store per project keeps the isolation from requirement 4 without a shared server, a noisy neighbour or a cross-tenant schema. SQLite in WAL mode serves Donga's load with a wide margin. The commit log it produces is what we replicate to AinDrive and anchor on chain.

## Architecture

```text
 app (browser / server) ── @ainize/store SDK ── HTTPS + SSE
                                   │
              ┌────────────────────▼─────────────────────┐
              │  Store (one per ainize project)          │
              │  ├ Document API   collections, queries   │
              │  ├ Rules engine   per-collection rules   │
              │  ├ Realtime       SSE fed by commits     │
              │  ├ Files          file fields → AinDrive │
              │  ├ Auth           AIN SSO / wallet sig   │
              │  └ SQLite (WAL)   local working copy     │
              └──────┬──────────────────┬───────────────┘
        commit log   │                  │  batch roots
   (segments + snapshots)               ▼
              ┌──────▼────────┐   ┌────────────────────┐
              │ AinDrive      │   │ AIN Blockchain     │
              │ originals:    │   │ /apps/<app>/       │
              │ db log, files │   │   anchors/<seq>    │
              └───────────────┘   │   public/… (opt-in)│
                                  └────────────────────┘
 triggers ── ainize Runs            admin UI ── ainize web "Store" tab
```

### Data model

- **Shape:** collections hold documents, and documents can hold subcollections, the same as Firestore. A document is JSON with an `id`, `createTime`, `updateTime` and `version`.
- **Storage:** each collection is a table of `(id, parent, data JSON, version, hash, timestamps)`. Indexed fields become generated columns with indexes. Queries cover equality, range, `in`, `array-contains`, `orderBy`, `limit` and cursors, and compile to SQL.
- **Large values:** a value over 256 KB, or a declared `file` field, is stored on AinDrive. The document keeps `{ path, sha256, size, type }`.

### Writes, commits and the original

1. The Store checks the rules, applies the write in a SQLite transaction, and appends a commit record: `(seq, collection, id, op, sha256(doc), prevHash)`. These records form a hash chain.
2. Commit records and WAL frames stream to AinDrive as numbered segments, about every second or every 4 MB, with a snapshot every day. **AinDrive is the original:** a new node restores the latest snapshot and replays the segments. This is the Litestream model, with AinDrive as the target.
3. A write is acknowledged once it is committed locally. A project can require `durability: "aindrive"` to wait until its segment is on AinDrive.

### Anchoring and verification

- **Anchors:** every 10 minutes, if anything changed, the Store builds a Merkle root over that period's commit hashes and writes one value: `/apps/<app>/anchors/<seq> = { root, fromSeq, toSeq, segment }`. That is about 200 bytes per period whatever the write volume, at most about 29 KB per app per day. Anchors older than 90 days are folded into monthly roots, so chain state per app stays bounded.
- **Verification:** anyone with read access can get a document, its commit and a Merkle path, and check them against the anchored root. A restore from AinDrive is verified the same way, segment by segment.

### Public data on chain

Some data exists to be read by others: game scores, NFT metadata, leaderboards. A collection marked `public: chain` mirrors its documents to `/apps/<app>/public/…` in plaintext, within the app's chain quota. Everything else stays off chain.

### Rules and auth

- **Rules:** each collection has expressions for `list`, `get`, `create`, `update` and `delete` over `auth` (`addr`, `sub`, `org`, `role`), `doc` and `request.data`. Example: `create: auth.org == "donga" && request.data.status in ["draft"]`. With no rule, the operation is denied.
- **Auth:** an AIN SSO session token, or an AIN wallet signature over a server nonce, issues a short-lived Store token. Server-to-server calls use a per-project key.

### Realtime

`onSnapshot(query)` opens an SSE stream. The Store matches each commit against the open queries and their rules, then pushes added, modified and removed changes, the same semantics as Firestore listeners.

### Triggers

`onCreate`, `onUpdate` and `onDelete` per collection run as ainize Runs, which receive the commit record. Scheduled jobs are Runs as well.

### Admin

The ainize web "Store" tab provides a collection browser, a document editor, rules, indexes, usage, the anchor history, and restore to any point in time.

## Safeguards against one app blocking others

| Layer | Safeguard |
| --- | --- |
| Chain (consensus) | New param `resource/free_state_budget_per_app` (proposed 5 MB). An unstaked app over it fails only its own writes. Activated by a timer flag at a set block on all mainnet nodes |
| Chain (consensus) | Budget checks apply only to operations that grow state; deletions are always accepted |
| Store | Writes to chain go only through anchors and `public: chain` collections, each metered against the app quota. No other code path writes app data to chain |
| Hosting | One Store process per project, with its own CPU and memory limits and its own volume |
| Monitoring | Every 5 minutes, check free-tier usage, per-app chain usage and anchor lag; alert AIN Teams #comcom at 70% and 85% |

## Moving off Firebase

| Firebase feature | AIN Store |
| --- | --- |
| Firestore collections, queries, `onSnapshot` | Collections, the same query operators, `onSnapshot` over SSE |
| Security rules | Collection rules (a translation guide plus a converter for common patterns) |
| Realtime Database paths | A collection per top-level path |
| Firebase Storage / GCS | File fields on AinDrive |
| Cloud Functions | ainize Runs triggers |
| Firebase Auth | AIN SSO or wallet. Existing Firebase Auth users are exported and kept |

| Project | What moves | Gate before billing is unlinked |
| --- | --- | --- |
| Baby Shark (`babyshark-187c9`) | Firestore users, payments, rentals; images as file fields. Game scores stay on chain as a `public: chain` collection | A game on https://nft.babyshark.com/game grants its reward; the utility page loads images |
| nft-server (`nft-server-prod`) | RTDB `nftSymbols` and `nftMetadataHosting` become collections; a small service keeps serving `/metadata/:appId/:symbol/:tokenId` | Every hosted token URI returns byte-identical JSON |
| Donga Science (`donga-science-prod`) | 20 Firestore collections; the backend's `infrastructure/firestore/*.repository.ts` move to the Store SDK behind the same interfaces | New articles flow from collection through translation and review to publication on https://dongascience.com/en; the admin dashboard works |
| a2a orchestrator | Threads, messages and reports become collections; report bodies become file fields; the encrypted state is removed from chain | ainspace report and chat flows give identical results |

Each move follows the same steps: export → import → dual-run and compare → switch → verify the live service → remove the old copy → unlink billing.

## Build order

1. Chain safeguards and monitoring.
2. The Store core: document API, rules, SQLite, commit log, AinDrive replication and restore.
3. Realtime, anchors, verification, file fields.
4. SDK, admin tab, triggers.
5. Migrate Baby Shark, then nft-server, then Donga Science with one week of dual-run, then the orchestrator.

## Decisions for approval

- **D1. Per-project embedded SQLite (PocketBase model) rather than a shared Postgres (Supabase model).** Recommended, for isolation and the one-container-per-project fit.
- **D2. The original is the commit log plus snapshots on AinDrive; the node's SQLite file is a rebuildable working copy.**
- **D3. A per-app chain cap of 5 MB, and deletions always allowed.** This is a consensus change on mainnet.
- **D4. Anchor every 10 minutes; fold anchors older than 90 days.**
- **D5. Acknowledge writes on local commit by default, with `durability: "aindrive"` as an opt-in.**

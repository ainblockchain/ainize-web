---
title: "Design (draft): AIN Store — a web3 Firestore"
summary: Status — awaiting approval. A Firestore replacement where AIN Blockchain is the index, the rules and the triggers, AinDrive holds the documents, AIN SSO is the identity behind every permission, and ainize Runs execute the triggers under that same identity.
---

# Design (draft): AIN Store — a web3 Firestore

**Status: awaiting approval (2026-10-31).**

AIN Store is the database apps on ainize use in place of Firestore. It keeps what made Firestore easy: documents and collections, queries, realtime listeners, security rules and triggers. The difference is where the authority lives. Firestore's rules and triggers run inside Google, and you trust Google to apply them. In AIN Store they run in **AIN Blockchain consensus**: every node checks every write against the rules, and every trigger fires from a finalized transaction. Nobody, the operator included, can skip a rule or bypass a trigger unnoticed.

| Part | Role | Firestore equivalent |
| --- | --- | --- |
| AIN Blockchain | **Index** (one entry per document: its hash and version), **rules** (`.rule`), **triggers** (`.function`), change events | Document metadata, security rules, function triggers, listeners |
| AinDrive | **Document bodies and files**, stored under their hash | Document contents, Cloud Storage |
| AIN SSO | **Identity and roles** for users, orgs and services; delegations to sessions, agents and Runs | Firebase Auth, custom claims |
| ainize Runs | **Executes triggers** under a scoped identity issued by SSO | Cloud Functions |
| Store gateway (per project) | SDK endpoint, query cache, realtime fan-out; holds no authority | Firestore frontend |

## Principles

1. **The chain is the index.** Each document has one small entry on chain. Each entry is how you find the document, how you verify it, and the point where rules and triggers attach.
2. **Bodies live on AinDrive, addressed by hash.** The hash on chain is also the AinDrive address, so finding and verifying are the same step.
3. **Rules and triggers are enforced by consensus.** That is what only a chain can offer, and why the index belongs there.
4. **One identity end to end.** The SSO account that signs a write is the `auth` its rules see, and the trigger that write fires runs with permissions derived from that account or from the app's own account, never wider.
5. **Everything else is rebuildable.** The gateway's query cache can be rebuilt at any time from the chain and AinDrive.

## Data model

```text
chain    /apps/<app>/<collection>/<docId>        = "<version>:<sha256 base64url>"
         /apps/<app>/<collection>/.rule          write rule (consensus)
         /apps/<app>/<collection>/$id/.function  trigger → ainize Runs
AinDrive <org drive>/store/<app>/objects/<sha256> document body (JSON) or file bytes
```

- **Index entries:** one string per document, `"<version>:<hash>"`. A single leaf keeps the cost at about 300 bytes per document; the chain bills a node as its value's size plus 160 bytes.
- **Subcollections:** nested paths, `/apps/<app>/users/<uid>/payments/<pid>`, the same shape as Firestore.
- **Bodies:** JSON stored on AinDrive under their sha256. An update writes a new object and a new entry. Old objects are kept for history or garbage-collected per collection policy.
- **Private collections:** the chain is public, so for private collections `<docId>` is an HMAC of the real id under an org key. The index then reveals counts and timing, not names or contents. Bodies stay behind AinDrive permissions.
- **Public collections:** game scores and NFT metadata may store the value itself on chain instead of a hash, so other apps can read it without us.

## Write path

```text
SDK ─► gateway ─► AinDrive: put body → sha256
                 └► chain tx: SET_VALUE /apps/<app>/<col>/<id> = "v:hash"   (signed by the user's session key)
                       ├ .rule checks auth (SSO account, org role), shape and version
                       ├ finalized → change event → gateway cache + realtime listeners
                       └ .function → ainize Runs (trigger)
```

1. The SDK applies the write locally at once and marks it pending, as Firestore's latency compensation does.
2. The gateway puts the body on AinDrive and gets its hash.
3. The chain transaction is signed with the user's **session key**. A batch of writes goes in one transaction, so it is atomic like a Firestore batch.
4. The rule decides at consensus. A rejected write rolls back on the client with the rule's error.
5. Once finalized, the change event updates the gateway's query cache and every matching `onSnapshot` listener.

## Read path

- **Get by id:** read the index entry from chain, fetch the body from AinDrive by hash, and verify the hash. Verification is on by default in the SDK.
- **Queries:** `where`, `orderBy`, `limit` and cursors run on the gateway's SQLite cache. The cache is built from chain events and AinDrive bodies, and its indexes are declared per collection. It is not a source of truth: drop it, and it is rebuilt.
- **Realtime:** chain change events fan out to SSE listeners, filtered by each listener's read permission.
- **Read permission:** the chain index is public, so read control applies to bodies. AinDrive enforces it with SSO roles and shares, and the gateway applies the collection's `read` rule to queries.

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
/apps/donga/articles/.rule.write:
  getValue('/apps/ain_sso/sessions/' + auth.addr + '/org') === 'org_donga'
  && ['editor','admin'].includes(getValue('/apps/ain_sso/orgs/org_donga/members/'
       + getValue('/apps/ain_sso/sessions/' + auth.addr + '/addr')))
  && util.isString(newData)
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

- **Declaring a trigger:** `ainize.json` declares, per trigger, the paths it may write and the AinDrive objects it may read. For example: `"on-article": { "type": "ain", "path": "/apps/donga/articles/$id", "as": "app", "writes": ["/apps/donga/translations/$id"] }`.
- **Running as the app (`as: "app"`):** the Run acts as the project's own SSO service account, owned by the org. Its permission is the declared scope, limited to the roles the org grants that account.
- **Running as the caller (`as: "caller"`):** the Run acts for the account that signed the triggering transaction. It can never do more than that user could.
- **Verified events:** the node checks the event against the chain before running anything. The per-trigger URL token stays only as rate-limit protection.
- **Ephemeral keys:** the Run's session key expires with the run's timeout. Revoking the org's delegations stops its Runs.
- **Schedule and webhook triggers:** these always run as `as: "app"`.

## Capacity and cost

| Project | Documents (measured 2026-10-31) | Index on chain at about 300 B each |
| --- | --- | --- |
| Donga Science | 214,566 (translations 70,067, evaluations 70,059, articles 68,287) | about 64 MB |
| Baby Shark | 8,669 top-level, plus small subcollections | about 2.6 MB |
| a2a orchestrator | about 6,000 records | about 1.8 MB |

- The current free pool is 100 MB shared by all unstaked apps, so Donga alone does not fit. At today's total stake, staking for 64 MB would take about 270,000 AIN, since 50 AIN buys 11.9 KB.
- **Proposal:** replace the shared pool with **explicit per-app budgets**, `resource/app_state_budget/<app>`, set by the params owner (a governance transaction) when an app is onboarded. An app over its budget fails only its own writes. Deletions are always accepted.
- **Writes:** one transaction per write or batch. Donga writes about 15k documents per 30 days, well within chain throughput. Writes are acknowledged at finality, a few seconds; the SDK's pending state hides that, as in Firestore.
- **Reads** never touch consensus; they hit the gateway cache and AinDrive. Donga's 5.7M reads per 30 days were the admin dashboard polling stats every 5 seconds. That is fixed separately in donga-science-backend #56 and donga-science-admin #14.
- **Monitoring:** every 5 minutes, check per-app budget use, trigger failures and cache lag; alert AIN Teams #comcom at 70% and 85%.

## Moving off Firebase

| Firebase | AIN Store |
| --- | --- |
| Firestore documents and collections | Index entries on chain plus bodies on AinDrive |
| Queries, `onSnapshot` | Gateway cache queries, SSE listeners on chain events |
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
3. Store: SDK, gateway (AinDrive bodies, query cache, SSE), rule helpers.
4. Runs: verified events, delegations, `as` and `writes`, on-chain install.
5. Migrate Baby Shark, then nft-server, then Donga Science with one week of dual-run, then the orchestrator.

## Decisions for approval

- **D1. The chain is the index:** one entry per document (`"version:hash"`), bodies on AinDrive by hash.
- **D2. Per-app state budgets** set by governance replace the shared free pool, and deletions are always accepted. This is a mainnet consensus change.
- **D3. SSO publishes orgs, members and sessions on chain, and users sign with SSO-issued session keys.**
- **D4. Runs execute `as: "app"` (default) or `as: "caller"`, scoped by SSO resource delegations to declared paths.**
- **D5. HMAC document ids for private collections.**

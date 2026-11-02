---
title: "AIN Store: what it is and how to run it"
summary: AIN Store is the document database for apps on ainize. This tutorial explains where your data lives, sets up a Store for an app, connects your code, moves data in from Firestore, and covers day-to-day management, backup and recovery.
---

# AIN Store: what it is and how to run it

AIN Store is the document database for apps on ainize. Your code reads and writes documents in collections, with queries and realtime listeners. If your app already uses Firestore, it keeps the same API through `@ainize/firestore-compat`. The full design is in [AIN Store design](../design/ain-data-platform.md).

By the end of this tutorial you will know where each piece of your data lives, have a Store running for your app, and know how to read, export, change, monitor, back up and rebuild it.

## 1. Where your data lives

A Store keeps each kind of data where it fits best.

| Part | What it holds | Can it be rebuilt? |
| --- | --- | --- |
| **AinDrive** (your organization's drive, under `store/<app>/`) | The **originals**: every document body, encrypted, and every write record (`writes/*.jsonl`, with the signed transaction) | It *is* the source |
| **AIN Blockchain** (`/apps/<app>/store/`) | A Merkle Mountain Range over every write (`mmr`, a few KB whatever the data size) and the latest state root (`state`). Write rules and triggers live on the chain too. | It *is* the source of order and proof |
| **Store server** (one per app) | Follows the chain, applies writes, answers queries and listeners | Stateless; restart or redeploy it |
| **Postgres** (an ainize managed store) | The query index the Store server keeps | Yes, from AinDrive + chain (section 7) |

A few properties follow from this.

- **Private collections** (the default for app data) put only an HMAC of each document id and a salted hash of its body on chain. Bodies on AinDrive are AES-256-GCM encrypted. Nobody can read your data from the chain or the drive without your keys.
- **Every write is provable**: the Store can show that a document's current version and the write that produced it are anchored on chain.
- **Your keys are your data.** The HMAC and encryption keys decide whether originals can be read. Keep them in a secret store, never only on one machine.

## 2. Plan the app

Decide three things first.

1. **The app name** on chain, e.g. `<app>` (lowercase, digits, `_`).
2. **The collections.** Firestore subcollections become flat collections: `users/{u}/missions` becomes `users__missions`, with document ids like `<u>/<mission>`. Your code still uses the Firestore paths when it goes through `firestore-compat`.
3. **Who may read and write each collection.**
   - **Service-only** (your backend writes everything): the simplest and most common case.
   - **Signed-in users** write their own documents with AIN SSO session keys.
   - **Public** collections, for data others should read (scores, NFT metadata), may put values on chain.

Write it down in `store.config.json`:

```json
{
  "app": "<app>",
  "database": { "urlEnv": "DATABASE_URL" },
  "chain": { "rpcUrl": "https://mainnet-api.ainetwork.ai/json-rpc", "protoVer": "1.6.1", "chainId": 1,
             "startBlock": <a block just before you install the app>, "activationBlock": 1586503 },
  "storage": { "kind": "aindrive", "baseUrl": "https://aindrive.ainetwork.ai", "driveId": "<drive id>",
               "prefix": "store/<app>", "oauth": { "clientId": "<client id>", "refreshTokenEnv": "AINDRIVE_REFRESH_TOKEN" } },
  "collections": {
    "users": { "private": { "hmacKeyEnv": "AIN_STORE_HMAC_KEY", "encryptKeyEnv": "AIN_STORE_ENCRYPT_KEY" }, "read": "none" }
  },
  "state": { "enabled": true, "serviceKeyEnv": "AIN_STORE_SERVICE_KEY" },
  "auth": { "serviceTokenEnv": "AIN_STORE_SERVICE_TOKEN" }
}
```

`read: "none"` means only your backend (with the service token) can read. Other options are `"public"`, `"auth"` (any signed-in AIN SSO identity), `{ "org": "<org>" }` and `{ "ownerField": "<field>" }`.

**Check:** every collection your code touches is listed.

## 3. Install the app on chain

The chain enforces who may write. For each collection, an owner transaction installs:

- the **write rule** on `/apps/<app>/writes/<collection>`, e.g. only your service address for a service-only collection (`compileServiceOnlyRule` in `@ainize/store-core` produces it), or a session rule for user writes (`compileSessionRule`);
- the **`_storeAppend` function** on `/apps/<app>/writes/<collection>/$key`, which folds each write into the app's MMR in the same transaction;
- the Store service account as the writer of `/apps/<app>/store/state`.

**Check:** `ain_get` on `/apps/<app>/store/mmr` returns `null` before the first write and `{ n, peaks }` after it.

## 4. Run the Store on ainize

A Store is an ainize project (kind `service`) with a managed Postgres attached.

1. In the **Storage** tab, create a Postgres store for your organization and **connect** it to the Store project. The container gets `DATABASE_URL`.
2. Put `ainize.json`, the Store `Dockerfile` and your `store.config.json` in the project's repository. `ainize.json` declares `"storage": [{ "name": "db", "kind": "postgres" }]` and a `release` command that creates the schema before each deploy.
3. Set the project **secrets**:

   | Secret | Purpose |
   | --- | --- |
   | `AIN_STORE_SERVICE_KEY` | Signs state posts and service writes |
   | `AIN_STORE_SERVICE_TOKEN` | Your backends' bearer token |
   | `AIN_STORE_HMAC_KEY`, `AIN_STORE_ENCRYPT_KEY` | Private ids and body encryption |
   | `AIN_STORE_TOKEN_KEY` | Encrypts the stored AinDrive tokens |
   | `AINDRIVE_REFRESH_TOKEN` | The AinDrive OAuth grant for the drive (seeded once; the Store rotates it in the database) |

4. Push to AinDrive. ainize builds and deploys it; readiness is `/healthz`.

**Check:** `GET /healthz` answers `{"ok":true,"ready":true,"alert":null}`.

## 5. Connect your app

Give your backend a connection (as a secret, `AIN_STORE_CONFIG_B64`, or a file in `AIN_STORE_CONFIG`):

```json
{ "url": "https://<store host>", "app": "<app>", "chainId": 1,
  "writerKey": "<service writer key>", "serviceToken": "<service token>",
  "privateCollections": ["users", "users__missions"], "hmacKey": "<hmac key>" }
```

If the code was written for Firestore, swap only the initialisation:

```js
const compat = require('@ainize/firestore-compat');
const db = compat.createFirestore(compat.readConnection());
const { FieldValue } = compat;

await db.collection('users').doc(uid).set({ points: 0 }, { merge: true });
const top = await db.collection('users').orderBy('points', 'desc').limit(10).get();
```

New code can use `@ainize/store` directly (`createStore`, `collection`, `doc`, `where`, `orderBy`, `onSnapshot`, `batch`).

Keep no Firebase fallback in the code: the server should refuse to start without the Store connection, so a misconfigured deploy fails loudly instead of writing somewhere else.

**Check:** one read and one write from your backend succeed, and the write appears in `/v1/status` as applied.

## 6. Move data in from Firestore

The `firestore-import` tool from `@ainize/firestore-compat` reads a Firestore managed export (or a JSONL dump) and writes it through the Store.

```bash
firestore-import plan    --export <export dir>                       # proposes the collections
firestore-import migrate --export <export dir> --transform <rewrite.mjs>
firestore-import verify  --export <export dir> --report verify.json  # counts and a hash per document
```

- `--transform` rewrites each document on the way in, e.g. old storage URLs to their new location.
- Import **before** your app goes live on the Store. After cutover, never re-run `migrate` over live data: it would put export values back over newer ones. Import anything left over only with a mode that skips documents that already exist.

**Check:** `verify` reports zero missing and zero different documents.

## 7. Day-to-day management

**Health and status**

```bash
curl https://<store host>/healthz                                  # ok, ready, alert, applied, ingested
curl -H "Authorization: Bearer $TOKEN" https://<store host>/v1/status   # cursors, MMR, blocked docs, monitor
```

A Store stops serving reads (503) while it is catching up after a start, and under any alert (e.g. its MMR disagrees with the chain). Set `monitor.webhookUrlEnv` to get alerts.

**Read and export**

```bash
curl -X POST https://<store host>/v1/query -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"collection":"users","limit":100}'
```

Page through with `nextCursor` to export a whole collection. Private documents come back decrypted, with their original ids. Exports contain user data; treat them accordingly.

**Write**

- Each write waits for the chain to finalize, a few seconds. Batch related writes and avoid long sequential loops in request handlers.
- One writer key can have only a limited number of transactions pending on chain. Don't run several bulk scripts with the same key at once.
- Today each document in a batch is decided on its own. Do not rely on a batch or transaction being all-or-nothing across documents for value transfers until this page says otherwise.

**Operate**

- Only one Store instance writes at a time (a leader lock); others serve reads and take over if it stops.
- A restart re-checks the chain before serving reads, which takes minutes for a large app. Redeploy deliberately, not as a reflex.
- Never run `docker restart` on an ainize project container; redeploy by pushing.

## 8. Back up and recover

- **Originals** are on AinDrive (bodies and write records) and anchored on chain. They are the backup.
- **Postgres** is an index. Back it up for speed of recovery (managed stores back up nightly), but it can always be rebuilt:

```bash
ain-store rebuild --config store.config.json --out rebuilt.db
```

Rebuild replays every write record from AinDrive, verifies each against its signed transaction, and checks the result against the chain's MMR and state root.

- **Keys** (`AIN_STORE_HMAC_KEY`, `AIN_STORE_ENCRYPT_KEY`, the service key) cannot be rebuilt. Lose them and private bodies stay encrypted forever. Keep them in your organization's secret store with at least two holders. To rotate the encryption key, set a new `encryptKeyEnv` and list the old one in `previousEncryptKeyEnvs`.

## 9. Checklist for whoever owns a Store

- [ ] The keys are in the organization's secret store, and two people can reach them.
- [ ] Alerts go to a channel someone watches.
- [ ] The app's backend has no fallback to another database.
- [ ] Bulk scripts run one at a time, and never re-import over live data.
- [ ] You know where the originals are: `store/<app>/` on your drive.

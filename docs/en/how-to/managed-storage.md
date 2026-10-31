---
title: Give a project a database and file storage
summary: Create a Postgres or S3-compatible Blob store for your organization, connect it to a project, and the app gets DATABASE_URL and S3_* at the next deploy — with migrations, a data browser, and nightly backups to AinDrive.
aincode: false
---

# Give a project a database and file storage

An app deployed with [ainize.json](./deploy-with-ainize-json.md) often needs somewhere to keep data. Instead of
renting a database on the internet and pasting its URL into a secret, ask the node for one: a **store** is a Postgres 16
database (optionally with pgvector) or an S3-compatible **Blob** bucket that the node runs next to your app, on a
private network only the projects you connect can reach. It belongs to your [organization](./organizations.md), so the
backend and the web front of one product can share it. If you have used Vercel Storage, this is the same flow: create
a store, connect a project, the connection details arrive as environment variables.

A store is available on a node whose operator turned managed storage on. Where it is off, the Storage tabs say
"This node offers no managed storage" and a deploy that asks for storage fails with one sentence.

## Create a store

Open your organization's **Settings → Storage** (also linked as **Storage →** from the organization's repository list)
and choose **Create store**:

- **Name** — lower-case letters, digits and hyphens, up to 32 (`app-db`, `ainteams-files`). Name it after the entry
  in your `ainize.json` and the project's Storage tab connects it in one click. The name is also the store's address
  for your app: `<name>.store.internal`.
- **Kind** — *Postgres* (relational: Prisma, Drizzle, TypeORM, …) or *Blob* (files and images over the S3 API).
- **Engine** — Postgres 16, Postgres 16 + pgvector, or Blob.
- **Memory / CPUs** — leave empty for the node's default; the dialog shows the node's maximum.
- **Backup hour** — the store is backed up daily at this hour (Asia/Seoul).

Creating takes about a minute. The store's page shows **Provisioning** and then **Ready**. A member with the write role
creates stores; any member sees the list.

## Declare it in ainize.json and connect it

Say in `ainize.json` what your code expects — the store's name is enough:

```json
{ "kind": "nextjs", "storage": ["app-db"] }
```

or, with the kind checked and a prefix of your choosing:

```json
{
  "kind": "service",
  "port": 4000,
  "storage": [
    { "name": "app-db", "kind": "postgres" },
    { "name": "app-files", "kind": "blob", "env": "FILES", "required": false }
  ]
}
```

Then open the project's **Storage** tab. Every entry is listed; one that is not connected yet says so, with
**Connect**. Pick an existing store of the right kind or **Create new** (the name is filled in from the entry), keep
**Redeploy after connecting** on, and the app has the variables as soon as that deploy is ready. You can also connect
from the store's own page (**Overview → Connect to project**).

A `required` entry (the default) that is not connected **fails the deploy before the build**, with the sentence
`storage "app-db" is declared in ainize.json but not connected — connect a store on the project's Storage tab`.
`"required": false` only writes a line in the deployment log. A project connects at most 4 stores.

## What your code sees

At deploy the app's container joins the store's private network and receives these variables, after the project's own
environment variables. The **first** Postgres and the **first** Blob store also get the bare names; every store gets
its prefixed set (`P` is the prefix — the entry's name upper-cased, `-` → `_`, or the `env` you gave):

| Store | First of its kind | Every store | Value |
|---|---|---|---|
| Postgres | `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_URL_NO_SSL` | `P_DATABASE_URL`, `P_POSTGRES_URL`, … | `postgresql://app:<password>@<name>.store.internal:5432/app?sslmode=disable` |
| | `POSTGRES_PRISMA_URL` | `P_POSTGRES_PRISMA_URL` | the same with `&connection_limit=10&pool_timeout=20&connect_timeout=15` |
| | `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`, `POSTGRES_DB` | `P_POSTGRES_HOST`, … | the parts of the URL |
| | `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | — | so `psql` and `pg_dump` in the image just work |
| Blob | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_FORCE_PATH_STYLE` | `P_S3_*` | `http://<name>.store.internal:9000`, `app`, key, secret, `us-east-1`, `true` |
| | `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | — | the AWS SDK v3 picks these up by itself |
| | `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_USE_SSL` | `P_MINIO_*` | `<name>.store.internal:9000` (no scheme), key, secret, `app`, `false` |

The Storage tab lists exactly these names for each connected store. There is no TLS and no pooler: the store is on a
private bridge only connected projects join. The app logs in as the role `app`, which owns its database; it is never
the superuser. A Blob store has one private bucket, `app`.

If the project already had an environment variable of one of these names (an external `DATABASE_URL`, say), the store
wins while it is connected: the deployment log says `overrides secret DATABASE_URL`, the row is greyed in
**Settings → Environment variables**, and setting it there is refused until the store is disconnected.

Next.js or NestJS with Drizzle:

```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }));
```

Prisma reads `POSTGRES_PRISMA_URL` (or `DATABASE_URL`) from `schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("POSTGRES_PRISMA_URL")
}
```

The AWS SDK v3 needs nothing but the bucket name and path-style addressing:

```ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ forcePathStyle: true });
await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: 'hello.txt', Body: 'hi' }));
```

minio-js takes the endpoint without a scheme, as the docker-compose files it replaces did:

```ts
import { Client } from 'minio';

const [host, port] = process.env.MINIO_ENDPOINT!.split(':');
const minio = new Client({ endPoint: host, port: Number(port), useSSL: false, accessKey: process.env.MINIO_ACCESS_KEY!, secretKey: process.env.MINIO_SECRET_KEY! });
```

To work against the store from your laptop, **Show values** on the store card reveals the values for a minute (to
members with the write role; each reveal is logged) and **Copy .env.local** copies them whole. The store is reachable
only from the node's private network, so local work needs a tunnel through the node's operator.

## Run migrations with `release`

`release` runs a command from the built image before the new container takes traffic — the place for database
migrations:

```json
{
  "kind": "service",
  "port": 4000,
  "storage": ["app-db"],
  "release": { "command": ["pnpm", "--filter", "@app/backend", "db:migrate"], "timeoutSeconds": 900 }
}
```

- It has the app's environment and store networks, a read-only root file system, and egress through the proxy only.
- A non-zero exit or a timeout (default 600 s, at most 1800 s) **fails the deployment and the previous container keeps
  serving**. The `[release]` lines are in the deployment log.
- `target` builds a second stage of your Dockerfile for it — a `builder` stage that still has `drizzle-kit`:
  `{ "target": "builder", "command": ["node_modules/.bin/drizzle-kit", "migrate"] }`. `entrypoint` replaces the image's.
- `"when": "storage"` skips it while no store is connected.
- It runs on **every** deploy, while the old version still serves. Write migrations that can run twice
  (`drizzle-kit migrate`, `prisma migrate deploy` are) and change the schema in two steps — add the new column, deploy
  the code that writes both, remove the old column later.

## Share a store between projects

One store can be connected to many projects of the organization. AIN Teams, for example, keeps its backend and its web
front on the same two stores — only the backend migrates:

```json
{ "kind": "service", "port": 4000, "storage": ["ainteams-db", "ainteams-files"], "release": { "command": ["pnpm", "--filter", "@app/backend", "db:migrate"] } }
```

```json
{ "kind": "service", "port": 3000, "storage": ["ainteams-db", "ainteams-files"] }
```

A connection may ask for a **database of its own** in the same Postgres store (the **Database** field when
connecting); the default is the shared `app` database. Projects connected to one store can reach each other on its
network — keep a store to the projects of one product.

## Browse data and run read-only SQL

The store page's **Data** tab (write role) lists the tables of a database with their approximate row counts and shows
the rows of one, 50 a page, ordered by any column. **Run SQL** takes one read-only statement — a `SELECT`, 10 seconds,
at most 200 rows shown — as a separate read-only role, so nothing typed there can change the data. A Blob store lists
its objects by prefix, with a download for each.

## Backups, restore and undo

Every store is dumped daily at its hour (or hourly, or never — the **Backups** tab's schedule), verified, and kept on the
node's NAS. Set the organization's **AinDrive backup target** once (**Settings → Storage**, admin: the drive id and an
AinDrive account token `aind_aat_…` with `drives:write`; the node tests it with an upload and never shows it again), and
each backup is also copied to that drive under `ainize-storage/<store>-<id>/backups/<date>/`, with a small JSON file
describing it — enough to restore on another node from the drive alone. A dump over 2 GiB stays on the NAS only.
Retention keeps 30 days and at most 60 scheduled backups by default; the newest one is always kept, and the safety
backups taken before a restore, a rotation or a delete are kept 30 days.

**Back up now** takes one at any time. **Restore…** on a backup (admin, with the store's name typed to confirm) offers:

- **Restore into a new store (recommended)** — this store is left alone and a copy `<name>-r<date>` is created,
  connected to nothing. Compare, then connect the projects to whichever you keep.
- **Replace this store's data** — a safety backup first, then the current database is **renamed** to
  `<db>_prerestore_<time>` (not dropped) and a fresh one is filled from the backup. Connected apps see connection errors
  while it runs. For 7 days **Undo restore** swaps the names back.

Every restore checks the backup file's checksum before anything is changed.

## Move from docker-compose

To bring an existing database over without an upload limit, ask the node's operator to copy a custom-format dump into
the store's `backups/import/` directory on the NAS:

```bash
pg_dump -Fc -d "$OLD_DATABASE_URL" -f app.dump
```

then restore it from the store's Backups tab with the source `import/app.dump` (or `POST /api/stores/<id>/restore` with
`{ "source": { "path": "import/app.dump" }, "mode": "in-place", "confirm": "<store name>" }`). Objects come across with
any S3 tool, using the values **Show values** reveals.

## Settings and limits

The store page's **Settings** tab renames the store (its address changes, so connected projects redeploy), changes
memory and CPUs (the container is recreated — a short interruption), **rotates credentials** (admin: new passwords and
keys after a safety backup; every connected project is redeployed) and shows the store's own log. **Delete** is refused
while any project is connected; it takes a last backup first, and the data stays in the node's trash for 30 days.

| Limit | Default |
|---|---|
| Stores per project | 4 |
| Stores per organization | 8 (the node's operator sets it) |
| Projects per store | 16 |
| One SQL statement | 16 KiB, 10 s, 200 rows, 1 MiB of result |
| A backup copied to AinDrive | 2 GiB |
| Undo an in-place restore | 7 days |
| Deleted store's data in the trash | 30 days |

The HTTP routes behind all of this are in the [HTTP API reference](/docs/reference/http-api) under **Storage**.

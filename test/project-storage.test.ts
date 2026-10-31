/**
 * Managed storage (ainize-node `src/project-storage-routes.ts`, docs/PROJECTS.md "Managed storage") held still where it
 * crosses into this app: the node's rules mirrored, every answer read defensively, the error codes and the access
 * decision the pages take from them, the env names a binding produces (exactly `storeEnv()`'s), the `.env.local`
 * text, the next scheduled backup, the URLs — and that every string the storage views render exists in both
 * languages, and that the pages are mounted where the design says.
 *
 *   node --test --import tsx test/project-storage.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  BACKUP_TRIGGERS, bytesLabel, connectionStringOf, databaseNameProblem, defaultEngineOf, dotenvOf, engineKindOf, ENV_PREFIX, envNamesOf, envPrefixProblem, maskEnvValue, nextBackupAt,
  orgStoresUrl, backupTargetUrl, parseAttachResult, parseBackups, parseDetachResult, parseObjects, parseProjectStorage, parseQueryResult, parseRestoreResult, parseRevealed,
  parseRotateResult, parseRows, parseStore, parseStoreDetail, parseStoreLogs, parseStores, parseTables, projectStorageUrl, QUERY_MAX_BYTES, restoreCopyNameOf, ROWS_MAX,
  storageAccessOf, storageApiErrorOf, STORAGE_ERROR_CODES, STORAGE_MAX, STORE_ENGINES, STORE_KINDS, STORE_NAME, STORE_STATUSES, storeEnvPrefixOf, storeIsBusy, storeNameProblem,
  storeObjectDownloadUrl, storeObjectsUrl, storeRowsUrl, storeStatusTone, storeUrl, driveBackupUrl, type Store,
} from '../src/api/projectStorage.ts';
import { envRowsOf, parseProjectSecretsResponse, secretApiErrorOf } from '../src/api/projectSecrets.ts';
import { storage } from '../src/i18n/pages/storage.ts';
import { projects } from '../src/i18n/pages/projects.ts';
import { organizations } from '../src/i18n/pages/organizations.ts';
import { storePath } from '../src/lib/reservedRoutes.ts';

const src = (rel: string) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');
const repo = (rel: string) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

const STORE = {
  id: 'st_0123456789abcdef', orgId: 'org_1', name: 'app-db', kind: 'postgres', engine: 'postgres16', image: 'postgres@sha256:abc', generation: 2,
  status: 'ready', error: null, warning: null, volume: 'ainize-store-st_0123456789abcdef', host: 'app-db.store.internal', port: 5432,
  resources: { memory: '1g', cpus: 1, diskGiB: 0 }, postgres: { databases: ['app', 'teams'], extensions: ['vector'] },
  backups: { schedule: 'daily', hour: 4, retainDays: 30, retainCount: 60, lastAt: 1, lastId: 'bk_1', lastStatus: 'ok', lastError: null },
  restores: [{ at: 5, backupId: 'bk_1', database: 'app', undoDatabase: 'app_prerestore_5', undoUntil: 99 }],
  credentialsVersion: 3, usage: { bytes: 2048, at: 7 }, operation: null, connectionNames: ['DATABASE_URL'],
  attachedProjects: [{ projectId: 'p1', binding: 'db', envPrefix: 'DB', database: 'app' }],
  lastBackup: { id: 'bk_1', status: 'ok', startedAt: 10, finishedAt: 11, bytes: 100, trigger: 'schedule' },
  health: { state: 'running', ready: true, checkedAt: 12 }, createdAt: 1, createdBy: 'ain:0xabc', updatedAt: 2,
};

// ------------------------------------------------------------------------------------------------ the node's rules

test('the node\'s rules are mirrored: names, prefixes, kinds, engines, limits', () => {
  for (const ok of ['db', 'app-db', 'a', 'ainteams-files', `a${'b'.repeat(31)}`]) assert.ok(STORE_NAME.test(ok), ok);
  for (const bad of ['', 'Db', '1db', '-db', 'db_x', `a${'b'.repeat(32)}`, 'db.x']) assert.ok(!STORE_NAME.test(bad), bad);
  for (const ok of ['DB', 'TEAMS_DB', 'A1']) assert.ok(ENV_PREFIX.test(ok), ok);
  for (const bad of ['db', '_DB', '1DB', 'DB-X']) assert.ok(!ENV_PREFIX.test(bad), bad);
  assert.deepEqual([...STORE_KINDS], ['postgres', 'blob']);
  assert.deepEqual([...STORE_ENGINES], ['postgres16', 'postgres16-pgvector', 'minio']);
  assert.equal(STORAGE_MAX, 4); assert.equal(QUERY_MAX_BYTES, 16 * 1024); assert.equal(ROWS_MAX, 200);
  assert.equal(storeEnvPrefixOf('teams-db'), 'TEAMS_DB');
  assert.equal(engineKindOf('minio'), 'blob'); assert.equal(engineKindOf('postgres16-pgvector'), 'postgres');
  assert.equal(defaultEngineOf('blob'), 'minio'); assert.equal(defaultEngineOf('postgres'), 'postgres16');
  assert.equal(storeNameProblem(''), 'empty'); assert.equal(storeNameProblem('Bad'), 'invalid'); assert.equal(storeNameProblem('good'), null);
  assert.equal(envPrefixProblem(''), null, 'empty = the default prefix'); assert.equal(envPrefixProblem('x'), 'invalid');
  assert.equal(databaseNameProblem('teams_v2'), null); assert.equal(databaseNameProblem('Teams'), 'invalid');
});

// ------------------------------------------------------------------------------------------------ readers

test('a store is read defensively: a full view, a partial one, garbage', () => {
  const s = parseStore(STORE)!;
  assert.equal(s.name, 'app-db'); assert.equal(s.kind, 'postgres'); assert.equal(s.status, 'ready'); assert.equal(s.port, 5432);
  assert.deepEqual(s.postgres, { databases: ['app', 'teams'], extensions: ['vector'] }); assert.equal(s.blob, null);
  assert.equal(s.restores[0]!.undoDatabase, 'app_prerestore_5');
  assert.deepEqual(s.attachedProjects, [{ projectId: 'p1', binding: 'db', envPrefix: 'DB', database: 'app' }]);
  assert.equal(s.lastBackup?.trigger, 'schedule'); assert.equal(s.health?.ready, true);
  assert.ok(!('volume' in s), 'only the fields the views use');

  const partial = parseStore({ id: 'st_1', name: 'files', engine: 'minio', status: 'warming-up' })!;
  assert.equal(partial.kind, 'blob', 'the kind follows the engine when it is missing');
  assert.equal(partial.status, 'error', 'an unknown status is not shown as ready');
  assert.equal(partial.host, 'files.store.internal'); assert.equal(partial.port, 9000);
  assert.deepEqual(partial.blob, { bucket: 'app', accessKeyId: '' }); assert.equal(partial.postgres, null);
  assert.equal(partial.backups.schedule, 'daily'); assert.equal(partial.backups.hour, 4);
  assert.deepEqual(partial.connectionNames, []); assert.equal(partial.lastBackup, null); assert.equal(partial.usage, null);

  for (const bad of [null, undefined, 'x', [], { id: 1, name: 'x' }, { name: 'x' }]) assert.equal(parseStore(bad), null);

  const detail = parseStoreDetail({ ...STORE, attachments: [{ projectId: 'p1', org: 'comcom', repoName: 'ainproj', binding: 'db', envPrefix: 'DB', database: 'app', createdAt: 3 }, { nope: 1 }] })!;
  assert.deepEqual(detail.attachments, [{ projectId: 'p1', org: 'comcom', repoName: 'ainproj', binding: 'db', envPrefix: 'DB', database: 'app', createdAt: 3 }]);
  assert.deepEqual(parseStoreDetail({ ...STORE })!.attachments, []);
});

test('the organization\'s list: sorted by name, limits and the backup target read, deleted stores grouped', () => {
  const r = parseStores({
    stores: [{ ...STORE, id: 'st_b', name: 'zed' }, { ...STORE, id: 'st_a', name: 'alpha' }, { bad: true }],
    backupDrive: { configured: true, driveId: 'drv', origin: 'https://aindrive.ainetwork.ai', lastOkAt: 5, defaultDriveId: '-nLGGiI3VXYR' },
    limits: { perOrg: 8, memoryMax: '4g', cpusMax: 2, attachmentsPerStore: 16, extensions: ['vector', 'pg_trgm', 3] },
    deletedStores: [{ storeId: 'st_gone', name: 'old', kind: 'postgres', engine: 'postgres16', backups: [{ id: 'bk_a', startedAt: 1 }, { id: 'bk_b', startedAt: 9 }] }, { name: 'no id' }],
  });
  assert.deepEqual(r.stores.map((s) => s.name), ['alpha', 'zed']);
  assert.deepEqual(r.backupDrive, { configured: true, driveId: 'drv', origin: 'https://aindrive.ainetwork.ai', setAt: null, lastOkAt: 5, lastError: null, defaultDriveId: '-nLGGiI3VXYR' });
  assert.deepEqual(r.limits, { perOrg: 8, memoryMax: '4g', cpusMax: 2, attachmentsPerStore: 16, extensions: ['vector', 'pg_trgm'] });
  assert.equal(r.deletedStores.length, 1); assert.deepEqual(r.deletedStores[0]!.backups.map((b) => b.id), ['bk_b', 'bk_a'], 'newest first');
  const empty = parseStores(null);
  assert.deepEqual(empty.stores, []); assert.equal(empty.backupDrive.configured, false); assert.equal(empty.limits.perOrg, null); assert.deepEqual(empty.deletedStores, []);
});

test('the project\'s view: declared bindings, connected stores, missing ones derived when an answer leaves them out', () => {
  const full = parseProjectStorage({
    attached: [{ store: STORE, binding: 'db', envPrefix: 'DB', database: 'app', envNames: ['DATABASE_URL', 'DB_DATABASE_URL'] }, { store: { bad: 1 } }],
    declared: ['db', { name: 'files', kind: 'blob', env: 'FILES', required: false }, { name: 'cache', kind: 'redis' }, 'Bad Name'],
    missing: [], optionalMissing: ['files'], orgStores: [{ id: 'st_x', name: 'x', kind: 'blob', engine: 'minio', status: 'ready' }], orgId: 'org_1', canManage: true,
  });
  assert.equal(full.attached.length, 1); assert.deepEqual(full.attached[0]!.envNames, ['DATABASE_URL', 'DB_DATABASE_URL']);
  assert.deepEqual(full.declared, [
    { name: 'db', kind: null, env: null, required: true },
    { name: 'files', kind: 'blob', env: 'FILES', required: false },
    { name: 'cache', kind: null, env: null, required: true },
  ], 'an unknown kind is "any", a malformed string is dropped');
  assert.deepEqual(full.optionalMissing, ['files']); assert.equal(full.canManage, true); assert.equal(full.orgId, 'org_1');
  assert.deepEqual(full.orgStores, [{ id: 'st_x', name: 'x', kind: 'blob', engine: 'minio', status: 'ready' }]);

  const old = parseProjectStorage({ attached: [{ store: STORE, binding: 'db' }], declared: ['db', 'files', { name: 'opt', required: false }] });
  assert.deepEqual(old.missing, ['files']); assert.deepEqual(old.optionalMissing, ['opt']);
  assert.equal(old.attached[0]!.envPrefix, 'DB', 'the default prefix is the binding\'s');
  assert.deepEqual(old.attached[0]!.envNames, envNamesOf('postgres', 'DB', true), 'names computed when the node sent none');
  assert.equal(old.canManage, false, 'not told = not a writer');
  assert.deepEqual(parseProjectStorage(undefined), { attached: [], declared: [], missing: [], optionalMissing: [], orgStores: [], orgId: null, canManage: false });
});

test('backups, tables, rows, query results, objects, reveals and the mutation answers', () => {
  const b = parseBackups({
    backups: [
      { id: 'bk_old', storeId: 'st', kind: 'postgres', engine: 'postgres16', trigger: 'manual', status: 'ok', startedAt: 1, finishedAt: 2, bytes: 10, sha256: 'ab', local: 'backups/x.dump', drive: { driveId: 'd', path: 'ainize-storage/a/backups/x.dump', uploadedAt: 3 } },
      { id: 'bk_new', storeId: 'st', trigger: 'nightly?', status: 'running', startedAt: 5, drive: { error: 'too_large_for_drive', retryAt: 0 } },
      { id: 'bk_mid', startedAt: 3, drive: null, files: [{ database: 'app', local: 'l', bytes: 1, sha256: 's', drive: null }, { bad: 1 }] },
    ],
    schedule: { schedule: 'hourly', hour: 0 }, drive: { configured: false },
  });
  assert.deepEqual(b.backups.map((x) => x.id), ['bk_new', 'bk_mid', 'bk_old']);
  assert.deepEqual(b.backups[2]!.drive, { driveId: 'd', path: 'ainize-storage/a/backups/x.dump', uploadedAt: 3 });
  assert.deepEqual(b.backups[0]!.drive, { error: 'too_large_for_drive', retryAt: 0 });
  assert.equal(b.backups[0]!.trigger, 'manual', 'an unknown trigger reads as manual');
  assert.equal(b.backups[1]!.drive, null); assert.equal(b.backups[1]!.files.length, 1);
  assert.equal(b.schedule?.schedule, 'hourly'); assert.equal(b.drive.configured, false);
  assert.equal(parseBackups({}).schedule, null);

  const tables = parseTables({ database: 'app', tables: [{ schema: 'public', name: 'users', rows: '12', bytes: 8192 }, { name: 'x' }, { schema: 'a' }] });
  assert.deepEqual(tables.tables, [{ schema: 'public', name: 'users', rows: 12, bytes: 8192 }, { schema: 'public', name: 'x', rows: null, bytes: null }], 'psql text numbers become numbers');

  const rows = parseRows({ database: 'app', schema: 'public', table: 'users', columns: [{ name: 'id', type: 'int4' }, { type: 'x' }], rows: [[1], 'bad', [2]], total: 2, limit: 50, offset: 0 });
  assert.deepEqual(rows.columns, [{ name: 'id', type: 'int4' }]); assert.deepEqual(rows.rows, [[1], [2]]); assert.equal(rows.total, 2);
  assert.equal(parseRows({}).total, null);

  const q = parseQueryResult({ database: 'app', columns: ['n'], rows: [[1], [2]], truncated: true, ms: 4 });
  assert.deepEqual(q, { database: 'app', columns: ['n'], rows: [[1], [2]], rowCount: 2, truncated: true, ms: 4 });

  const o = parseObjects({ prefix: 'img/', objects: [{ key: 'img/a.png', size: 3, lastModified: '2026-10-30T00:00:00Z' }, { size: 1 }], prefixes: ['img/x/'], next: null });
  assert.deepEqual(o.objects, [{ key: 'img/a.png', size: 3, lastModified: '2026-10-30T00:00:00Z' }]); assert.deepEqual(o.prefixes, ['img/x/']);

  const rv = parseRevealed({ env: { DATABASE_URL: 'postgresql://app:pw@h:5432/app?sslmode=disable', N: 5 } });
  assert.deepEqual(rv.env, { DATABASE_URL: 'postgresql://app:pw@h:5432/app?sslmode=disable' }, 'non-string values are dropped');
  assert.equal(rv.dotenv, 'DATABASE_URL=postgresql://app:pw@h:5432/app?sslmode=disable\n', 'an answer without dotenv gets one');
  assert.equal(parseRevealed({ env: {}, dotenv: 'X=1\n' }).dotenv, 'X=1\n');

  assert.deepEqual(parseAttachResult({ attachment: { storeId: 's', projectId: 'p', binding: 'db', envPrefix: 'DB', database: 'app' }, envNames: ['DATABASE_URL'], redeploy: { deploymentId: 'dep_1', status: 'queued' } }),
    { attachment: { storeId: 's', projectId: 'p', binding: 'db', envPrefix: 'DB', database: 'app' }, envNames: ['DATABASE_URL'], redeploy: { deploymentId: 'dep_1', status: 'queued' } });
  assert.equal(parseAttachResult({}).redeploy, null);
  assert.deepEqual(parseDetachResult({ ok: true, redeploy: null }), { ok: true, redeploy: null });
  assert.deepEqual(parseRotateResult({ credentialsVersion: 4, redeploys: [{ projectId: 'p', deploymentId: 'd' }, { projectId: 'x' }] }), { credentialsVersion: 4, redeploys: [{ projectId: 'p', deploymentId: 'd' }] });
  assert.equal(parseRestoreResult({}), null);
  assert.equal(parseRestoreResult({ store: STORE, newStore: { ...STORE, id: 'st_n', name: 'app-db-r20261031' } })!.newStore!.name, 'app-db-r20261031');
  const logs = parseStoreLogs({ storeId: 's', tail: 2, fetchedAt: 1, lines: [{ ts: null, stream: 'stdout', text: 'LOG: ready' }, { text: 7 }], truncated: false });
  assert.deepEqual(logs.lines, [{ ts: null, stream: 'stdout', text: 'LOG: ready' }]);
});

// ------------------------------------------------------------------------------------------------ errors and access

test('the node\'s refusals: codes with their extras, bare statuses, the network, an unknown code', () => {
  assert.deepEqual(storageApiErrorOf({ status: 409, data: { error: { code: 'store_attached', message: 'still connected', projects: ['comcom/ainproj'] } } }),
    { status: 409, code: 'store_attached', message: 'still connected', extra: { projects: ['comcom/ainproj'] } });
  assert.equal(storageApiErrorOf({ status: 400, data: { error: { code: 'sql_error', message: 'syntax error at or near "SELEC"' } } }).message, 'syntax error at or near "SELEC"');
  assert.equal(storageApiErrorOf({ status: 418, data: { error: { code: 'teapot', message: 'x' } } }).code, 'unknown');
  assert.equal(storageApiErrorOf({ status: 'FETCH_ERROR' }).code, 'network');
  assert.equal(storageApiErrorOf({ status: 401 }).code, 'not_signed_in');
  assert.equal(storageApiErrorOf({ status: 403 }).code, 'insufficient_role');
  assert.equal(storageApiErrorOf({ status: 404, data: '<html>Cannot GET</html>' }).code, 'not_found', 'a node from before storage: 404 with no body');
  assert.equal(storageApiErrorOf({ status: 'PARSING_ERROR', originalStatus: 404, data: 'Cannot GET' }).code, 'not_found');
  assert.equal(storageApiErrorOf({ status: 503 }).code, 'storage_off');
  assert.equal(storageApiErrorOf({ status: 500 }).code, 'unknown');
  for (const c of ['storage_off', 'storage_not_allowed', 'name_taken', 'store_busy', 'cross_org', 'binding_taken', 'kind_mismatch', 'prefix_taken', 'multi_statement', 'sql_timeout', 'result_too_large', 'checksum_mismatch', 'nothing_to_undo', 'drive_unauthorized', 'aindrive_error', 'managed_by_store']) {
    assert.ok(STORAGE_ERROR_CODES.includes(c as never), c);
  }
  assert.equal(new Set(STORAGE_ERROR_CODES).size, STORAGE_ERROR_CODES.length);
});

test('what a storage section shows (mirrors envAccessOf)', () => {
  const err = (status: number, code?: string) => ({ error: { status, data: code ? { error: { code, message: '' } } : undefined } });
  assert.equal(storageAccessOf({ skip: true }), 'hidden');
  assert.equal(storageAccessOf({ isLoading: true }), 'loading');
  assert.equal(storageAccessOf({ data: { canManage: true } }), 'writer');
  assert.equal(storageAccessOf({ data: { canManage: false } }), 'reader');
  assert.equal(storageAccessOf({ data: { stores: [] } }), 'writer', 'a list without canManage is the writer\'s');
  assert.equal(storageAccessOf(err(503, 'storage_off')), 'off');
  assert.equal(storageAccessOf(err(503)), 'off');
  assert.equal(storageAccessOf(err(403, 'storage_not_allowed')), 'off');
  assert.equal(storageAccessOf(err(404)), 'hidden', 'a node too old to have the route');
  assert.equal(storageAccessOf(err(404, 'not_found')), 'hidden');
  assert.equal(storageAccessOf(err(403, 'not_member')), 'hidden');
  assert.equal(storageAccessOf(err(401)), 'hidden');
  assert.equal(storageAccessOf(err(403, 'insufficient_role')), 'reader');
  assert.equal(storageAccessOf(err(500)), 'error');
  assert.equal(storageAccessOf({ error: { status: 'FETCH_ERROR' } }), 'error');
});

// ------------------------------------------------------------------------------------------------ builders

test('envNamesOf: exactly ainize-node storeEnv() — the first of a kind also gets the bare names', () => {
  assert.deepEqual(envNamesOf('postgres', 'DB', true), [
    'DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_URL_NON_POOLING', 'POSTGRES_URL_NO_SSL', 'POSTGRES_PRISMA_URL',
    'POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DATABASE', 'POSTGRES_DB',
    'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE',
    'DB_DATABASE_URL', 'DB_POSTGRES_URL', 'DB_POSTGRES_URL_NON_POOLING', 'DB_POSTGRES_URL_NO_SSL', 'DB_POSTGRES_PRISMA_URL',
    'DB_POSTGRES_HOST', 'DB_POSTGRES_PORT', 'DB_POSTGRES_USER', 'DB_POSTGRES_PASSWORD', 'DB_POSTGRES_DATABASE',
  ]);
  assert.deepEqual(envNamesOf('postgres', 'TEAMS', false), [
    'TEAMS_DATABASE_URL', 'TEAMS_POSTGRES_URL', 'TEAMS_POSTGRES_URL_NON_POOLING', 'TEAMS_POSTGRES_URL_NO_SSL', 'TEAMS_POSTGRES_PRISMA_URL',
    'TEAMS_POSTGRES_HOST', 'TEAMS_POSTGRES_PORT', 'TEAMS_POSTGRES_USER', 'TEAMS_POSTGRES_PASSWORD', 'TEAMS_POSTGRES_DATABASE',
  ], 'a second postgres store: prefixed only, no PG* (libpq defaults are the first store\'s)');
  assert.deepEqual(envNamesOf('blob', 'FILES', true), [
    'S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_REGION', 'S3_FORCE_PATH_STYLE',
    'AWS_ENDPOINT_URL_S3', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION',
    'MINIO_ENDPOINT', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'MINIO_BUCKET', 'MINIO_USE_SSL',
    'FILES_S3_ENDPOINT', 'FILES_S3_BUCKET', 'FILES_S3_ACCESS_KEY_ID', 'FILES_S3_SECRET_ACCESS_KEY', 'FILES_S3_REGION', 'FILES_S3_FORCE_PATH_STYLE',
    'FILES_MINIO_ENDPOINT', 'FILES_MINIO_ACCESS_KEY', 'FILES_MINIO_SECRET_KEY', 'FILES_MINIO_BUCKET', 'FILES_MINIO_USE_SSL',
  ]);
  assert.ok(!envNamesOf('blob', 'B', false).some((n) => n.startsWith('AWS_') || n.startsWith('MINIO_')), 'AWS_* / MINIO_* are the first blob store\'s only');
});

test('dotenvOf quotes what needs it, as the node\'s renderDotenv does; connectionStringOf and masking', () => {
  assert.equal(dotenvOf({}), '');
  assert.equal(dotenvOf({ DATABASE_URL: 'postgresql://app:Ab_c-9@db.store.internal:5432/app?sslmode=disable', PORT: '5432' }),
    'DATABASE_URL=postgresql://app:Ab_c-9@db.store.internal:5432/app?sslmode=disable\nPORT=5432\n');
  assert.equal(dotenvOf({ A: 'two words', B: 'say "hi"', C: 'a\\b', D: 'line\nbreak', E: '' }), 'A="two words"\nB="say \\"hi\\""\nC="a\\\\b"\nD="line\\nbreak"\nE=\n');
  assert.equal(connectionStringOf('postgres', { DATABASE_URL: 'u1', X_DATABASE_URL: 'u2' }), 'u1');
  assert.equal(connectionStringOf('postgres', { X_DATABASE_URL: 'u2' }), 'u2', 'a second store has only the prefixed URL');
  assert.equal(connectionStringOf('blob', { FILES_S3_ENDPOINT: 'http://f:9000' }), 'http://f:9000');
  assert.equal(connectionStringOf('blob', {}), null);
  assert.equal(maskEnvValue('DATABASE_URL', 'postgresql://app:secret@h:5432/app'), 'postgresql://app:••••••@h:5432/app');
  assert.equal(maskEnvValue('PGPASSWORD', 'secret'), '••••••');
  assert.equal(maskEnvValue('MINIO_SECRET_KEY', 'secret'), '••••••');
  assert.equal(maskEnvValue('PGHOST', 'db.store.internal'), 'db.store.internal');
  assert.equal(maskEnvValue('S3_BUCKET', 'app'), 'app');
});

test('status tones and busy, sizes, the restore copy\'s name', () => {
  assert.equal(storeStatusTone('ready'), 'ok');
  for (const s of ['error', 'stopped'] as const) assert.equal(storeStatusTone(s), 'warn');
  for (const s of ['provisioning', 'restoring', 'deleting'] as const) assert.equal(storeStatusTone(s), 'busy');
  assert.equal(storeIsBusy({ status: 'ready', operation: null }), false);
  assert.equal(storeIsBusy({ status: 'ready', operation: { kind: 'backup', startedAt: 1, log: [] } }), true);
  assert.equal(storeIsBusy({ status: 'provisioning', operation: null }), true);
  assert.equal(bytesLabel(null), '—'); assert.equal(bytesLabel(512), '512 B'); assert.equal(bytesLabel(2048), '2.0 KiB'); assert.equal(bytesLabel(5 * 1024 ** 3), '5.0 GiB'); assert.equal(bytesLabel(300 * 1024 ** 2), '300 MiB');
  const at = Date.UTC(2026, 9, 31, 12);
  assert.equal(restoreCopyNameOf('app-db', at), 'app-db-r20261031');
  const long = restoreCopyNameOf('a'.repeat(32), at);
  assert.equal(long.length, 32); assert.ok(STORE_NAME.test(long), 'still a store name');
});

test('nextBackupAt: daily at the hour in Asia/Seoul, hourly after the last one, off never', () => {
  const s = (b: Partial<Store['backups']>) => ({ backups: { schedule: 'daily', hour: 4, retainDays: 30, retainCount: 60, lastAt: null, lastId: null, lastStatus: null, lastError: null, ...b } as Store['backups'] });
  // 2026-10-31 00:00 UTC = 09:00 KST → the next 04:00 KST is 2026-11-01 04:00 KST = 2026-10-31 19:00 UTC
  assert.equal(nextBackupAt(s({}), Date.UTC(2026, 9, 31, 0)), Date.UTC(2026, 9, 31, 19));
  // 2026-10-30 18:00 UTC = 03:00 KST on the 31st → the same KST day's 04:00 = 19:00 UTC
  assert.equal(nextBackupAt(s({}), Date.UTC(2026, 9, 30, 18)), Date.UTC(2026, 9, 30, 19));
  // exactly at the slot: the next day's
  assert.equal(nextBackupAt(s({}), Date.UTC(2026, 9, 30, 19)), Date.UTC(2026, 9, 31, 19));
  assert.equal(nextBackupAt(s({ hour: 0 }), Date.UTC(2026, 9, 31, 0)), Date.UTC(2026, 9, 31, 15), '00:00 KST = 15:00 UTC the day before');
  assert.equal(nextBackupAt(s({ schedule: 'daily', hour: 4 }), Date.UTC(2026, 9, 31, 0), 'UTC'), Date.UTC(2026, 9, 31, 4), 'another zone');
  const now = Date.UTC(2026, 9, 31, 10);
  assert.equal(nextBackupAt(s({ schedule: 'hourly', lastAt: now - 20 * 60_000 }), now), now + 40 * 60_000);
  assert.equal(nextBackupAt(s({ schedule: 'hourly', lastAt: now - 3 * 3_600_000 }), now), now, 'overdue: now');
  assert.equal(nextBackupAt(s({ schedule: 'hourly', lastAt: null }), now), now);
  assert.equal(nextBackupAt(s({ schedule: 'off' }), now), null);
});

test('URLs: every id encoded, limits clamped, the store page path', () => {
  assert.equal(orgStoresUrl('org/1'), 'api/orgs/org%2F1/stores');
  assert.equal(backupTargetUrl('o'), 'api/orgs/o/storage/backup-target');
  assert.equal(storeUrl('st_1'), 'api/stores/st_1');
  assert.equal(storeUrl('st 1', 'backups'), 'api/stores/st%201/backups');
  assert.equal(projectStorageUrl('p/1'), 'api/projects/p%2F1/storage');
  assert.equal(storeRowsUrl('s', 'public', 'my table', { limit: 999, offset: -4 }), 'api/stores/s/tables/public/my%20table/rows?limit=200&offset=0');
  assert.equal(storeRowsUrl('s', 'a', 'b', { database: 'teams', order: 'id', dir: 'desc' }), 'api/stores/s/tables/a/b/rows?database=teams&limit=50&offset=0&order=id&dir=desc');
  assert.equal(storeObjectsUrl('s', {}), 'api/stores/s/objects');
  assert.equal(storeObjectsUrl('s', { prefix: 'img/', after: 'img/a', limit: 200 }), 'api/stores/s/objects?prefix=img%2F&after=img%2Fa&limit=200');
  assert.equal(storeObjectDownloadUrl('s', 'img/a b.png'), '/api/stores/s/objects/download?key=img%2Fa%20b.png');
  assert.equal(driveBackupUrl('drv', 'ainize-storage/db-st/backups/2026-10-31/bk.dump'), 'https://aindrive.ainetwork.ai/d/drv?path=ainize-storage%2Fdb-st%2Fbackups%2F2026-10-31');
  assert.equal(storePath('org_1', 'st_0123456789abcdef'), '/org/org_1/storage/st_0123456789abcdef');
  assert.equal(storePath('a b', 'c/d'), '/org/a%20b/storage/c%2Fd');
});

test('environment variables a connected store sets are greyed, not missing, and their PUT refusal has words', () => {
  const r = parseProjectSecretsResponse({ secrets: [{ name: 'DATABASE_URL', updatedAt: 1 }, { name: 'API_KEY', updatedAt: 2 }], declared: ['DATABASE_URL', 'S3_BUCKET', 'OPENAI_KEY'], missing: ['S3_BUCKET', 'OPENAI_KEY'], managed: ['DATABASE_URL', 'S3_BUCKET'] });
  assert.deepEqual(r.managed, ['DATABASE_URL', 'S3_BUCKET']);
  assert.deepEqual(r.missing, ['OPENAI_KEY'], 'a name a store provides is not missing');
  assert.deepEqual(envRowsOf(r).map((x) => [x.name, x.set, x.managed]), [['OPENAI_KEY', false, false], ['API_KEY', true, false], ['DATABASE_URL', true, true], ['S3_BUCKET', false, true]]);
  assert.deepEqual(parseProjectSecretsResponse({ secrets: [] }).managed, [], 'an older node says nothing about stores');
  assert.equal(secretApiErrorOf({ status: 400, data: { error: { code: 'managed_by_store', message: 'x' } } }).code, 'managed_by_store');
  assert.ok(projects['projects.env.err.managed_by_store']);
  const view = src('components/ProjectEnvVars.tsx');
  assert.match(view, /r\.managed \? <ManagedItem/);
  assert.match(view, /t\('storage\.env\.shadowed', \{ name: row\.name \}\)/);
});

// ------------------------------------------------------------------------------------------------ i18n

const VIEWS = [
  ...readdirSync(fileURLToPath(new URL('../src/components/storage/', import.meta.url))).filter((f) => f.endsWith('.tsx')).map((f) => `components/storage/${f}`),
  'screens/org/StorePage.tsx', 'screens/org/storage/StorageTab.tsx',
];

test('every string the storage views render exists in English and in Korean, the dynamic ones too', () => {
  const all = { ...projects, ...organizations, ...storage };
  const sources = VIEWS.map(src).join('\n');
  const keys = [...sources.matchAll(/\bt\('([a-zA-Z0-9_.-]+)'/g)].map((m) => m[1]!);
  assert.ok(keys.length > 150, `the views are translated through t() (${keys.length})`);
  const outside = ['components/ProjectEnvVars.tsx', 'screens/OrgRepositoriesPage.tsx', 'screens/ProjectPage.tsx'].map(src).join('\n');
  const outsideKeys = [...outside.matchAll(/\bt\('(storage\.[a-zA-Z0-9_.-]+)'/g)].map((m) => m[1]!);
  assert.ok(outsideKeys.includes('storage.env.shadowed') && outsideKeys.includes('storage.org_link'));
  const dynamic = [
    ...STORE_STATUSES.map((s) => `storage.status.${s}`),
    ...STORE_KINDS.map((k) => `storage.kind.${k}`), 'storage.kind.any',
    ...STORE_KINDS.map((k) => `storage.create.kind_help.${k}`),
    ...STORE_ENGINES.map((e) => `storage.engine.${e}`),
    ...STORAGE_ERROR_CODES.map((c) => `storage.err.${c}`),
    ...BACKUP_TRIGGERS.map((k) => `storage.backups.kind.${k}`),
    ...['running', 'ok', 'error'].map((s) => `storage.backups.status.${s}`),
    ...['daily', 'hourly', 'off'].map((s) => `storage.backups.schedule_opt.${s}`),
    ...['provision', 'backup', 'restore', 'rotate', 'recreate', 'delete'].map((k) => `storage.operation.${k}`),
    ...['overview', 'data', 'backups', 'settings'].map((k) => `storage.tab.${k}`),
    ...['over_quota', 'drive_unauthorized'].map((w) => `storage.warning.${w}`),
    'storage.banner.missing_one', 'orgSettings.tab.storage', 'projects.tabs.storage',
  ];
  for (const key of [...keys, ...outsideKeys, ...dynamic]) {
    const e = all[key];
    assert.ok(e, `missing i18n key ${key}`);
    assert.ok(e.en.trim() && e.ko.trim(), `${key} needs both languages`);
    assert.ok(/[가-힣]/.test(e.ko), `${key}.ko is not Korean`);
  }
  for (const [key, e] of Object.entries(storage)) {
    assert.ok(key.startsWith('storage.'), `${key} is namespaced`);
    assert.ok(/[가-힣]/.test(e.ko), `${key}.ko is not Korean`);
    // a placeholder in one language is a placeholder in the other
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    assert.equal(vars(e.ko), vars(e.en), `${key}: the two languages interpolate the same {vars}`);
  }
  assert.match(src('i18n/pages/generated.ts'), /from '\.\/storage'/, 'npm run gen picked the dictionary up');
});

// ------------------------------------------------------------------------------------------------ structure

test('the project console has a Storage tab for service / nextjs, the banner above the tabs', () => {
  const page = src('screens/ProjectPage.tsx');
  assert.match(page, /const TABS: Tab\[\] = \[[^\]]*'storage'[^\]]*\]/);
  assert.match(page, /\{tab === 'storage'[^\n]*\n\s*<TabBody>\n\s*<ProjectStorage project=\{p\} onOpenDeployment=\{openDeployment\} \/>/);
  assert.match(page, /const hasStorage = kind === 'nextjs' \|\| kind === 'service';/);
  assert.match(page, /<MissingStorageBanner project=\{p\} onGo=\{\(\) => setTab\('storage'\)\} \/>/);
  assert.match(page, /t\('projects\.tabs\.storage'\)\}\$\{p\.storage\?\.attached/);
});

test('organization settings has a Storage tab any member sees; the store page is routed before /org/:id', () => {
  const settings = src('screens/org/OrgSettingsPage.tsx');
  assert.match(settings, /const TABS: Tab\[\] = \[[^\]]*'storage'[^\]]*\]/);
  assert.match(settings, /write \? \(\['groups', 'storage'\] as Tab\[\]\) : \(\['storage'\] as Tab\[\]\)/);
  assert.match(settings, /\{current === 'storage' && <StorageTab org=\{org\} \/>\}/);
  const app = src('App.tsx');
  const store = app.indexOf('path="/org/:id/storage/:storeId" element={<SignedInLayout><StorePage />');
  assert.ok(store > 0, 'the store page is routed behind sign-in');
  assert.ok(store < app.indexOf('path="/org/:id/settings"') && store < app.indexOf('path="/org/:id"'), 'before /org/:id/settings and /org/:id');
  assert.match(src('screens/OrgRepositoriesPage.tsx'), /\/settings\?tab=storage`\}>\{t\('storage\.org_link'\)\}/);
  const page = src('screens/org/StorePage.tsx');
  assert.match(page, /const TABS: Tab\[\] = \['overview', 'data', 'backups', 'settings'\];/);
  assert.match(page, /pollingInterval: busy \? 3000/);
});

test('the API slice: every storage endpoint, its tag, and reveals / SQL never cached', () => {
  const api = src('api/api.ts');
  assert.match(api, /tagTypes: \[[^\]]*'Store'\]/);
  for (const name of ['projectStorage', 'orgStores', 'store', 'storeTables', 'storeRows', 'storeObjects', 'storeBackups', 'storeLogs']) assert.match(api, new RegExp(`\\n    ${name}: b\\.query<`), name);
  for (const name of ['createStore', 'updateStore', 'storeAction', 'deleteStore', 'connectStore', 'disconnectStore', 'revealStoreEnv', 'rotateStore', 'storeQuery', 'runStoreBackup', 'deleteStoreBackup', 'restoreStore', 'undoRestore', 'setOrgBackupTarget', 'clearOrgBackupTarget']) {
    assert.match(api, new RegExp(`\\n    ${name}: b\\.mutation<`), name);
  }
  for (const hook of ['useProjectStorageQuery', 'useOrgStoresQuery', 'useStoreQuery', 'useConnectStoreMutation', 'useRevealStoreEnvMutation', 'useStoreQueryMutation', 'useRestoreStoreMutation', 'useSetOrgBackupTargetMutation']) assert.match(api, new RegExp(`\\b${hook}\\b`), hook);
  assert.match(api, /providesTags: \(_r, _e, id\) => \[\{ type: 'Project', id: `\$\{id\}\/storage` \}\]/);
  assert.match(api, /connectStore:[\s\S]*?\{ type: 'Project', id: `\$\{a\.projectId\}\/secrets` \}/, 'connecting changes the managed names of the env list');
  assert.match(src('lib/reservedRoutes.ts'), /export const storePath = /);
});

test('the how-to is in both languages and both tables of contents', () => {
  for (const lang of ['en', 'ko']) {
    const toc = repo(`docs/${lang}/_toctree.json`);
    const at = toc.indexOf('how-to/deploy-with-ainize-json');
    assert.ok(at > 0 && toc.indexOf('how-to/managed-storage') > at, `${lang}: managed-storage follows deploy-with-ainize-json`);
    const md = repo(`docs/${lang}/how-to/managed-storage.md`);
    assert.ok(md.includes('DATABASE_URL') && md.includes('release'), lang);
  }
  for (const lang of ['en', 'ko']) {
    const table = repo(`docs/${lang}/how-to/deploy-with-ainize-json.md`);
    assert.match(table, /\| `storage` \|/, `${lang}: the key table has storage`);
    assert.match(table, /\| `release` \|/, `${lang}: the key table has release`);
  }
});

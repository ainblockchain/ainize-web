/**
 * Managed storage's secrets stay out of the Redux store. RTK Query keeps a mutation's answer (`data`) and its argument
 * (`originalArgs`) in `state.api.mutations` until its hook is reset or unmounts — and the project's Storage tab stays
 * mounted, polling, for as long as it is open. So a store reveal (DATABASE_URL with the password in it) and the backup
 * target's AinDrive token go through `unwrapUncached`, which removes the entry the moment the answer arrives, and the
 * Redux DevTools (which record every payload) are off in production.
 *
 * This drives the real API slice in a real store, with `fetch` faked — nothing leaves the process.
 *
 *   node --test --import tsx test/project-storage-secrets.test.ts
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { configureStore } from '@reduxjs/toolkit';
import { api } from '../src/api/api.ts';
import { unwrapUncached } from '../src/api/projectStorage.ts';

const src = (rel: string) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');
const PASSWORD = 'hunter2-0123456789abcdef';
const TOKEN = 'aind_aat_0123456789abcdef0123456789abcdef';

// fetchBaseQuery builds `new Request('/api/…')`: a relative URL Node cannot resolve, so it is given a base here.
const RealRequest = globalThis.Request;
const realFetch = globalThis.fetch;
const asked: { method: string; url: string }[] = [];
let answer: { status: number; body: unknown } = { status: 200, body: {} };
globalThis.Request = class extends RealRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) { super(typeof input === 'string' && input.startsWith('/') ? `http://node.test${input}` : input, init); }
} as typeof Request;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const req = input instanceof Request ? input : new Request(input);
  asked.push({ method: req.method, url: new URL(req.url).pathname });
  return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;
after(() => { globalThis.Request = RealRequest; globalThis.fetch = realFetch; });

const freshStore = () => configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: (gdm) => gdm().concat(api.middleware) });
const mutationsOf = (store: ReturnType<typeof freshStore>) => JSON.stringify(store.getState()[api.reducerPath].mutations);

test('a plain unwrap leaves the revealed values in state.api.mutations — the leak this guards against', async () => {
  const store = freshStore();
  answer = { status: 200, body: { env: { DATABASE_URL: `postgresql://app:${PASSWORD}@db.store.internal:5432/app` }, dotenv: `PGPASSWORD=${PASSWORD}\n` } };
  await store.dispatch(api.endpoints.revealStoreEnv.initiate({ sid: 'st_1' })).unwrap();
  assert.ok(mutationsOf(store).includes(PASSWORD), 'RTK keeps a mutation\'s answer until it is reset');
});

test('unwrapUncached: the reveal answers, and nothing of it stays in the store', async () => {
  const store = freshStore();
  answer = { status: 200, body: { env: { DATABASE_URL: `postgresql://app:${PASSWORD}@db.store.internal:5432/app`, PGPASSWORD: PASSWORD }, dotenv: `PGPASSWORD=${PASSWORD}\n` } };
  const r = await unwrapUncached(store.dispatch(api.endpoints.revealStoreEnv.initiate({ sid: 'st_1', projectId: 'p1' })));
  assert.equal(r.env.PGPASSWORD, PASSWORD, 'the caller gets the values');
  assert.equal(asked.at(-1)?.method, 'POST'); assert.equal(asked.at(-1)?.url, '/api/stores/st_1/reveal');
  assert.equal(mutationsOf(store), '{}', 'the mutation entry is gone');
  assert.ok(!JSON.stringify(store.getState()).includes(PASSWORD));
});

test('unwrapUncached: a refusal still rejects, and still leaves nothing behind', async () => {
  const store = freshStore();
  answer = { status: 403, body: { error: { code: 'insufficient_role', message: 'write role' } } };
  await assert.rejects(unwrapUncached(store.dispatch(api.endpoints.revealStoreEnv.initiate({ sid: 'st_1' }))), (e: { status?: number }) => e.status === 403);
  assert.equal(mutationsOf(store), '{}');
});

test('the backup target\'s AinDrive token: not in the store after the call, saved or refused', async () => {
  // (RTK's mutation slice keeps no originalArgs; the hook does, in React state — useForgetMutationArgs drops that)
  answer = { status: 200, body: { driveId: 'DRV1', verifiedAt: 1 } };
  const store = freshStore();
  const r = await unwrapUncached(store.dispatch(api.endpoints.setOrgBackupTarget.initiate({ orgId: 'org_1', driveId: 'DRV1', token: TOKEN })));
  assert.equal(r.driveId, 'DRV1');
  assert.equal(asked.at(-1)?.method, 'PUT'); assert.equal(asked.at(-1)?.url, '/api/orgs/org_1/storage/backup-target');
  assert.ok(!JSON.stringify(store.getState()).includes(TOKEN));
  answer = { status: 400, body: { error: { code: 'drive_unreachable' } } };
  await assert.rejects(unwrapUncached(store.dispatch(api.endpoints.setOrgBackupTarget.initiate({ orgId: 'org_1', driveId: 'DRV1', token: TOKEN }))));
  assert.ok(!JSON.stringify(store.getState()).includes(TOKEN), 'nor when the node refuses it');
});

test('the views go through it: reveal on the card and the store page, the backup target, hide / unmount / rotation reset', () => {
  const card = src('components/storage/StoreCard.tsx');
  assert.match(card, /export function useRevealedEnv\(/);
  assert.match(card, /setRevealed\(await unwrapUncached\(reveal\(/, 'the reveal is unwrapped uncached');
  assert.match(card, /const hide = useCallback\(\(\) => \{ setRevealed\(null\); reset\.current\(\); \}, \[\]\);/, 'Hide (and the minute running out) resets the hook too');
  assert.match(card, /useEffect\(\(\) => \(\) => reset\.current\(\), \[\]\);/, 'unmount resets');
  assert.match(card, /useEffect\(\(\) => \{ hide\(\); \}, \[store\.id, store\.credentialsVersion, hide\]\);/, 'rotated credentials hide the old values');
  assert.match(card, /onHide=\{hide\}/);
  assert.doesNotMatch(card, /setRevealed\(null\)\} \/>/);
  const page = src('screens/org/StorePage.tsx');
  assert.match(page, /useRevealedEnv\(store\)/);
  assert.match(page, /onHide=\{hide\}/);
  assert.doesNotMatch(page, /useRevealStoreEnvMutation/, 'the store page reveals only through the hook');
  const tab = src('screens/org/storage/StorageTab.tsx');
  assert.match(tab, /await unwrapUncached\(setTarget\(\{ orgId, driveId: driveId\.trim\(\), token: token\.trim\(\) \}\)\)/);
  assert.match(tab, /const \[setTarget, setting\] = useSetOrgBackupTargetMutation\(\);\n  useForgetMutationArgs\(setting\);/, 'the hook\'s own copy of the token is dropped once the call settles');
  assert.match(src('components/storage/common.tsx'), /if \(!isLoading && originalArgs !== undefined\) reset\(\);/);
  assert.match(src('store.ts'), /devTools: process\.env\.NODE_ENV !== 'production'/, 'no DevTools action history in production');
});

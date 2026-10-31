import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPublicationReview, publishReviewed, samePublicationReview, PublicationReviewError } from '../src/lib/publicationReview';
import { manageFixture } from './fixtures/manageKnowledge';
const revision = 'a'.repeat(64), hash = 'b'.repeat(64), p = manageFixture();
const review = () => ({ anchor: p.anchor, revision, retires: [], coexisting: 0 });
const retirement = () => ({ patch_id: 'old/id', author: p.anchor.author, name: 'Older knowledge', status: 'VERIFIED', overlap_rows: 2, price: '1', currency: 'AIN', paid_sales: 2, revenue: '2' });
const code = (expected: string) => (e: unknown) => e instanceof PublicationReviewError && e.code === expected;
const ack = () => ({ record: { kind: 'anchor', hash, author: p.anchor.author, body: { ...p.anchor, created_at: 200, gateway_url: 'https://node/x402/patch/chosen' } } });
const published = () => ({ ...p, status: 'ANNOUNCED', record_hash: hash, anchor: ack().record.body });
test('publication previews reject unrelated or malformed targets and preserve full server content', () => {
  assert.equal(readPublicationReview(review(), p)?.revision, revision);
  for (const raw of [null, { ...review(), revision: 'bad' }, { ...review(), anchor: { ...p.anchor, id: 'other' } }, { ...review(), retires: [retirement(), retirement()] }, { ...review(), retires: [{ ...retirement(), author: '0x' + 'c'.repeat(40) }] }, { ...review(), retires: [{ ...retirement(), paid_sales: -1 }] }]) assert.equal(readPublicationReview(raw, p), null);
  assert.equal(samePublicationReview(review(), { ...review(), anchor: { ...p.anchor, price: '2' } }), false);
});
test('publication sends the reviewed revision and matches the acknowledged anchor plus public record', async () => {
  let sent = '';
  const result = await publishReviewed(review(), p, '', { current: () => true, preview: async () => review(), write: async value => { sent = value; return ack(); }, detail: async () => published() });
  assert.equal(sent, revision); assert.equal(result?.record_hash, hash);
});
test('changed reviews or missing typed confirmation cannot reach publication', async () => {
  await assert.rejects(publishReviewed({ ...review(), retires: [retirement()] }, p, '', { current: () => true, preview: async () => review(), write: async () => { assert.fail('no publication'); }, detail: async () => published() }), code('confirm'));
  for (const fresh of [{ ...review(), revision: 'c'.repeat(64) }, { ...review(), anchor: { ...p.anchor, price: '2' } }]) {
    await assert.rejects(publishReviewed(review(), p, '', { current: () => true, preview: async () => fresh, write: async () => { assert.fail('changed review'); }, detail: async () => published() }), code('changed'));
  }
  await assert.rejects(publishReviewed(review(), p, '', { current: () => true, preview: async () => review(), write: async () => { throw { status: 409, data: { code: 'publication_preview_changed' } }; }, detail: async () => published() }), code('changed'));
});
test('wrong or incomplete records and failed public confirmation remain unconfirmed', async () => {
  for (const raw of [{}, { record: { ...ack().record, kind: 'price' } }, { record: { ...ack().record, body: { ...ack().record.body, price: '2' } } }, { record: { ...ack().record, author: '0x' + 'c'.repeat(40) } }]) {
    await assert.rejects(publishReviewed(review(), p, '', { current: () => true, preview: async () => review(), write: async () => raw, detail: async () => published() }), code('unconfirmed'));
  }
  for (const after of [p, { ...published(), record_hash: 'other' }, { ...published(), anchor: { ...p.anchor, price: '3' } }]) {
    await assert.rejects(publishReviewed(review(), p, '', { current: () => true, preview: async () => review(), write: async () => ack(), detail: async () => after }), code('unconfirmed'));
  }
});
test('departed confirmation never sends or reports publication in the replacement view', async () => {
  let active = true;
  assert.equal(await publishReviewed(review(), p, '', { current: () => active, preview: async () => { active = false; return review(); }, write: async () => { assert.fail('departed'); }, detail: async () => published() }), null);
  active = true;
  assert.equal(await publishReviewed(review(), p, '', { current: () => active, preview: async () => review(), write: async () => { active = false; return ack(); }, detail: async () => { assert.fail('departed follow-up'); } }), null);
});
test('preview and reviewed-publication transport retain exact paths and send only the review revision', async () => {
  const { configureStore } = await import('@reduxjs/toolkit'); const { api } = await import('../src/api/api');
  const originalFetch = globalThis.fetch, OriginalRequest = globalThis.Request, calls: { path: string; method: string; body: string }[] = [];
  globalThis.Request = class extends OriginalRequest { constructor(input: any, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, 'https://fixture.invalid') : input, init); } } as typeof Request;
  globalThis.fetch = async input => { const request = input as Request; calls.push({ path: new URL(request.url).pathname, method: request.method, body: await request.text() }); return new Response('{}', { headers: { 'Content-Type': 'application/json' } }); };
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: g => g().concat(api.middleware) });
  try {
    const id = 'folder/id?x'; await store.dispatch(api.endpoints.announcePreview.initiate({ id, identity: 'first' }, { subscribe: false })).unwrap();
    assert.equal(api.endpoints.announcePreview.select({ id, identity: 'other' })(store.getState()).data, undefined);
    await store.dispatch(api.endpoints.reviewedAnnounce.initiate({ id, revision })).unwrap();
    assert.deepEqual(calls, [{ path: '/api/patches/folder%2Fid%3Fx/announce-preview', method: 'GET', body: '' }, { path: '/api/patches/folder%2Fid%3Fx/announce', method: 'POST', body: JSON.stringify({ expected_preview: revision }) }]);
  } finally { store.dispatch(api.util.resetApiState()); globalThis.fetch = originalFetch; globalThis.Request = OriginalRequest; }
});

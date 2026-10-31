import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountWallet, accountSales, accountPayouts, accountOwed, accountPayments } from '../src/lib/accountWallet';

const me = '0x' + 'aa'.repeat(20), payee = '0x' + 'bb'.repeat(20);
const sale = (currency: string, amount = '10'): any => ({ patch_id: 'chosen', tx_hash: currency, seller: me, buyer: payee, amount, currency, scheme: 'local-credit', created_at: 1, royalty: { [payee]: '2' } });
const payout = (currency: string, id = 1): any => ({ id, patch_id: 'chosen', address: payee, amount: '3', currency, status: 'pending', created_at: 2, updated_at: 3 });
const wallet = (sales: any[] = []) => ({ address: me, balance: 20, purchases: 0, sales, royalties: [] });

test('sales retain currency boundaries and exclude unresolved allocations from the seller share', () => {
  const sales = [sale('AIN'), { ...sale('CREDIT', '100'), royalty_unresolved: { unknown_parent: '4' } }];
  const before = JSON.stringify(sales);
  const raw = wallet(sales); assert.equal(accountWallet(raw, me), raw);
  const view = accountSales(sales, me)!;
  assert.deepEqual(view.totals.map(g => [g.currency, g.grossTotal, g.netTotal, g.sharedTotal, g.unresolvedTotal]), [['AIN', 10, 8, 2, 0], ['CREDIT', 100, 94, 6, 4]]);
  assert.equal(view.split.get('CREDIT')?.unresolved, 4); assert.equal(JSON.stringify(sales), before);
});

test('bad wallet identities, duplicate sales, invalid amounts and impossible splits cannot become totals', () => {
  const raw = wallet([sale('AIN')]);
  assert.equal(accountWallet(raw, payee), null);
  for (const patch of [{ balance: '20' }, { purchases: -1 }, { sales: [sale('AIN'), sale('AIN')] }, { royalties: [null] }, { sales: [{ ...sale('AIN'), royalty_unresolved: { parent: '9' } }] }, { sales: [{ ...sale('AIN'), amount: 'NaN' }] }, { sales: [{ ...sale('AIN'), created_at: 9e20 }] }]) assert.equal(accountWallet({ ...raw, ...patch }, me), null);
  assert.equal(accountSales([sale('AIN', '1e308'), { ...sale('AIN', '1e308'), tx_hash: 'other' }], me), null);
});

test('outgoing records group by currency as well as payee, knowledge and status', () => {
  const rows = [payout('AIN'), payout('CREDIT', 2)];
  assert.equal(accountPayouts({ items: rows }), rows);
  const view = accountOwed([sale('AIN'), sale('CREDIT')], rows, me)!;
  assert.equal(view.rows.length, 4); assert.equal(new Set(view.rows.map(r => r.key)).size, 4);
  assert.deepEqual(view.totals, [{ currency: 'AIN', open: 3, credited: 2, paid: 0 }, { currency: 'CREDIT', open: 3, credited: 2, paid: 0 }]);
  assert.equal(accountPayouts({ items: [rows[0], rows[0]] }), null);
  assert.equal(accountPayouts({ items: [{ ...rows[0], status: 'unknown' }] }), null);
  assert.equal(accountPayouts(undefined), null);
});

test('incoming payments retain state and evidence and missing data never becomes zero or the node currency', () => {
  const rows: any[] = [
    { amount: '2', currency: 'AIN', state: 'paid', evidence: 'record' },
    { amount: '3', currency: 'AIN', state: 'paid', evidence: 'seller_reported' },
    { amount: '4', currency: 'AIN', state: 'pending' },
    { amount: '100', currency: 'CREDIT', state: 'credited' },
  ];
  const groups = accountPayments(rows)!;
  assert.equal(groups.length, 4); assert.equal(groups.find(g => g.evidence === 'record')?.amount, 2);
  assert.equal(groups.find(g => g.state === 'pending')?.amount, 4);
  assert.equal(accountPayments(undefined), null); assert.deepEqual(accountPayments([]), []);
  assert.equal(accountPayments([{ amount: '2' } as any]), null);
  assert.equal(accountPayments([{ ...rows[0], kind: 'lineage' }], 'verification'), null);
  assert.deepEqual(accountPayments([{ amount: '2', currency: 'AIN' } as any]), [{ amount: 2, currency: 'AIN', state: 'unconfirmed', evidence: '' }]);
});

test('operator query identity keys never travel in the request URL or reuse another account cache', async () => {
  const { configureStore } = await import('@reduxjs/toolkit');
  const { api } = await import('../src/api/api');
  const originalFetch = globalThis.fetch, OriginalRequest = globalThis.Request;
  const urls: string[] = [];
  globalThis.Request = class extends OriginalRequest { constructor(input: any, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, 'https://fixture.invalid') : input, init); } } as typeof Request;
  globalThis.fetch = async input => { const url = new URL((input as Request).url); urls.push(url.pathname + url.search); return new Response('{"fixture":"first account"}', { headers: { 'Content-Type': 'application/json' } }); };
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: g => g().concat(api.middleware) });
  try {
    for (const name of ['info', 'nodes', 'runtime', 'settings', 'owners', 'bindings', 'wallet', 'myPatches', 'payouts'] as const) {
      const endpoint = api.endpoints[name] as any;
      const first = { identity: 'first', ...(name === 'payouts' ? { limit: 500 } : {}) };
      await store.dispatch(endpoint.initiate(first, { subscribe: false })).unwrap();
      assert.equal(endpoint.select({ ...first, identity: 'second' })(store.getState()).data, undefined);
    }
    assert.equal(urls.length, 9); assert.ok(urls.every(u => !u.includes('identity') && !u.includes('first')));
    assert.equal(urls.at(-1), '/api/me/payouts?limit=500');
  } finally { store.dispatch(api.util.resetApiState()); globalThis.fetch = originalFetch; globalThis.Request = OriginalRequest; }
});

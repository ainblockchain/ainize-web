import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dashboardInventory, inventoryRows, paidSales, verificationPayments, verificationWindow } from '../src/lib/dashboardView';
import { dashboardEntry, dashboardAttest, verificationPayment } from './fixtures/dashboard';
import { ledgerFixture } from './fixtures/ledger';
import { trackAuthor } from './fixtures/track';

test('inventory sales order and counts use paid sales, never free or self settlement totals', () => {
  const free = { ...dashboardEntry('free'), downloads: 1000, sales: { sales_all: 0, sales_30d: 0 } };
  const paid = { ...dashboardEntry('paid'), downloads: 2, sales: { sales_all: 2, sales_30d: 2 } };
  const unknown = { ...dashboardEntry('unknown'), downloads: 9999, sales: undefined };
  const input = [free, unknown, paid];
  assert.deepEqual(inventoryRows(input, '', 'all', 'sales').map(e => e.anchor.id), ['paid', 'free', 'unknown']);
  assert.deepEqual(input.map(e => e.anchor.id), ['free', 'unknown', 'paid']);
  assert.equal(paidSales(unknown), null);
  assert.deepEqual(inventoryRows(input, 'PAID', 'VERIFIED', 'new').map(e => e.anchor.id), ['paid']);
  assert.deepEqual(inventoryRows(input, '', 'DRAFT', 'status'), []);
});

test('inventory rejects malformed and duplicate rows instead of crashing or claiming an empty inventory', () => {
  const entry = dashboardEntry('selected');
  assert.deepEqual(dashboardInventory({ items: [entry] }), [entry]);
  assert.deepEqual(dashboardInventory({ items: [] }), []);
  for (const raw of [{}, { items: [entry, entry] }, { items: [{ ...entry, sales: { sales_all: -1 } }] }, { items: [{ ...entry, anchor: { ...entry.anchor, benchmark: null } }] }, { items: [{ ...entry, anchor: { ...entry.anchor, author: 'org-slug' } }] }]) assert.equal(dashboardInventory(raw), null);
});

test('verification summaries stay within the returned window and require explicit results', () => {
  const rows = [dashboardAttest('a'), dashboardAttest('b', false, trackAuthor.toUpperCase(), 'hash-only'), dashboardAttest('other', false, `0x${'b'.repeat(40)}`)];
  const fixture = ledgerFixture(rows); fixture.info.records = 20000;
  assert.deepEqual(verificationWindow(fixture, trackAuthor), { shown: 3, ledgerTotal: 20000, networkFailed: 2, total: 2, passed: 1, failed: 1, hashOnly: 1, knowledges: 2 });
  const malformed = dashboardAttest(); delete (malformed.body as any).passed;
  assert.equal(verificationWindow(ledgerFixture([malformed]), trackAuthor), null);
  assert.equal(verificationWindow(ledgerFixture(rows), 'org-slug'), null);
});

test('verification money keeps currency, payout status and evidence separate and does not use a combined total', () => {
  const value = verificationPayments({ verification_total: '999999', verification: [
    verificationPayment('2', 'AIN', 'paid', 'record'), verificationPayment('3', 'AIN', 'paid', 'seller_reported'),
    verificationPayment('4', 'AIN', 'pending'), verificationPayment('5', 'USDC', 'pending'),
    verificationPayment('6', 'CREDIT', 'credited'), verificationPayment('1', 'AIN', 'paid', 'record'),
  ] });
  assert.ok(value); assert.equal(value.length, 5);
  assert.equal(value.find(r => r.state === 'paid' && r.evidence === 'record')?.amount, 3);
  assert.equal(value.find(r => r.state === 'paid' && r.evidence === 'seller_reported')?.amount, 3);
  assert.equal(value.find(r => r.currency === 'USDC')?.amount, 5);
  assert.deepEqual(verificationPayments({ verification: [] }), []);
  for (const row of [{ ...verificationPayment(), currency: undefined }, { ...verificationPayment(), amount: 'NaN' }, { ...verificationPayment(), state: 'success' }]) assert.equal(verificationPayments({ verification: [row] }), null);
  assert.equal(verificationPayments({ verification_total: '0' }), null);
  const duplicate = { ...verificationPayment(), settle_hash: 'same-record' };
  assert.equal(verificationPayments({ verification: [duplicate, duplicate] }), null);
});


test('inventory supports public legacy question arrays without changing signed input anchors', () => {
  const entry = dashboardEntry('legacy');
  const input = { ...entry, anchor: { ...entry.anchor, benchmark: { schema: 'qa', queries: [{ prompt: 'Question one', expect: 'Answer one' }, { prompt: 'Question two', expect: 'Answer two' }] } } };
  const view = dashboardInventory({ items: [input] });
  assert.equal(view?.[0].anchor.benchmark.queries, 2);
  assert.ok(Array.isArray(input.anchor.benchmark.queries));
  assert.equal(dashboardInventory({ items: [{ ...input, anchor: { ...input.anchor, benchmark: { schema: 'qa', queries: [null] } } }] }), null);
});

import type { LedgerRecord, LedgerResponse, GraphResponse } from '../../src/api/types';
export const ledgerRecord = (kind: LedgerRecord['kind'], body: unknown, hash: string = kind, ts = 1): LedgerRecord => ({ kind, body, hash, ts, author: 'prototype-fixture', parents: [], sig: '' });
export const ledgerFixture = (records: LedgerRecord[] = []): LedgerResponse => ({ info: { kind: 'local', network: 'fixture', records: records.length, height: records.length }, records });
export const ledgerNode = () => ledgerRecord('node', { address: 'peer', name: 'Selected node record', roles: [], endpoint: null });
export const ledgerGraphFixture = (): GraphResponse => ({ nodes: [{ id: 'chosen/id', name: 'Selected graph knowledge', author: `0x${'a'.repeat(40)}`, status: 'VERIFIED', model: 'model', schema: 'schema' }], edges: [], chain: null });

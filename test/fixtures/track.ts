import type { CatalogEntry } from '../../src/api/types';
export const trackName = 'finance/selected';
export const trackAuthor = `0x${'a'.repeat(40)}`;
/** Only fields consumed by the track view; independent of full knowledge-detail fixtures. */
export const trackEntry = (id: string, overrides: Partial<CatalogEntry> = {}): CatalogEntry => ({
  anchor: { id, name: `Knowledge ${id}`, author: trackAuthor, created_at: 10, model: { id_M: 'model' }, price: '1', currency: 'AIN' },
  status: 'VERIFIED', downloads: 100, sales: { sales_all: 1, sales_30d: 0 }, revenue: '2', ...overrides,
} as CatalogEntry);
export const trackBranches = (ids = ['selected']) => ({
  branches: [{ name: trackName, description: 'Selected track', owner: trackAuthor, created_at: 1, context: {}, patch_ids: ids, current: ids.slice(-1), subscribers: [] }], mine: [],
});
export const trackHistory = { info: { records: 20000 }, records: [{ hash: 'subscription-1', kind: 'subscribe', ts: 1, body: { branch: trackName, node: trackAuthor, action: 'subscribe' } }] };

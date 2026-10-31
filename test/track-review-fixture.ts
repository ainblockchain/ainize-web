import type { TrackActionReview } from '../src/api/types';
export const trackReviewFixture = (): TrackActionReview => ({ version: 1, revision: 'a'.repeat(64), node: 'test-node', action: 'subscribe',
  quote: { branch: 'selected', owner: 'curator', description: '', subscribed: false, current: ['new'], buy: ['new'], retired: [], currency: 'CREDIT', balance: 10,
    total: [{ amount: '2', currency: 'CREDIT' }], runtime_available: true, runtime_error: null,
    items: [{ patch_id: 'new', patch_sha256: 'file', author: 'seller', author_name: null, name: 'New knowledge', status: 'VERIFIED', price: '2', currency: 'CREDIT', plan: 'buy', reason: '', superseded_by: [] }],
    subscription: { branch: 'selected', owner: 'curator', terms: { price: '1', currency: 'CREDIT', period_days: 30 }, due: true, paid_at: null, paid_until: null, periods_paid: 0, currency: 'CREDIT', run_rate: { days: 30, knowledge_added: 0, knowledge_spend: '0', per_period: '1', per_30_days: '1' } } },
  before: [], after: [{ patch_id: 'new', sha256: 'file', reason: 'subscription:selected' }],
  anchors: [{ id: 'new', patch_sha256: 'file', name: 'New knowledge', author: 'seller', price: '2', currency: 'CREDIT' } as any], overlaps: [],
  fee: { amount: '1', currency: 'CREDIT' }, total: [{ amount: '3', currency: 'CREDIT' }] });

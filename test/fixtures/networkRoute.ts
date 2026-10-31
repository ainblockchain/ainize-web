import type { RouteResponse } from '../../src/api/types';
export const routeCondition = { key: 'jurisdiction', value: 'KR' };
export const matchedRoute = (): RouteResponse => ({
  branch: { name: 'finance/chosen', description: 'Chosen track', owner: `0x${'b'.repeat(40)}`, context: { jurisdiction: 'KR' }, patch_ids: ['chosen/id'], created_at: 1 },
  matched: ['jurisdiction'], unmatched: [], current: ['chosen/id'], ambiguous: false,
  candidates: [{ name: 'finance/chosen', context: { jurisdiction: 'KR' }, matched: ['jurisdiction'], unmatched: [] }],
  nodes: [{ address: `0x${'c'.repeat(40)}`, endpoint: 'https://serving.example/base/', model: 'model', current: true, missing: [], applied: ['chosen/id'] } as RouteResponse['nodes'][number]],
});
export const unmatchedRoute = (): RouteResponse => ({ branch: null, nodes: [], current: [], matched: [], unmatched: ['jurisdiction'], candidates: [], ambiguous: false });

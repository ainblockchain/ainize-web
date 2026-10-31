import type { TrackAdditionReview } from '../src/lib/trackAddition';
export const additionNode = `0x${'1'.repeat(40)}`;
export const additionSubject = `0x${'2'.repeat(40)}`;
export function additionFixture(): TrackAdditionReview {
  return { version: 1, revision: 'a'.repeat(64), node: additionNode,
    branch: { name: 'law/KR', owner: additionNode, description: 'Current track', context: { region: 'KR' }, patch_ids: ['old'], created_at: 1 },
    item: { id: 'new/id?#', name: 'Selected knowledge', author: additionSubject, sha256: 'file', price: '0.00000001', currency: 'AIN', status: 'VERIFIED' },
    already: false, replaces: ['old'] };
}

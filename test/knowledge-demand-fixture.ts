import type { KnowledgeDemandStatus } from '../src/lib/knowledgeDemand';
export const demandNode = `0x${'11'.repeat(20)}`, demandAuthor = `0x${'22'.repeat(20)}`;
export function demandFixture(requested = false): KnowledgeDemandStatus {
  return { version: 1, node: demandNode, actor: 'google:person', scope: 'account', patch_id: 'selected', author: demandAuthor,
    patch_sha256: 'selected-file', requester: 'opaque-requester', requested, available: false, can_request: !requested,
    requests: requested ? 2 : 1, event_id: requested ? 7 : null, count_scope: 'retained_requests' };
}

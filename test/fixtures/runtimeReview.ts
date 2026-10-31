import type { RuntimeApplyReview } from '../../src/lib/runtimeApplyReview';
import { manageFixture } from './manageKnowledge';
export function runtimeReviewFixture(): RuntimeApplyReview {
  const { id, name, author, patch_sha256, benchmark_hash, created_at, model, base } = manageFixture().anchor;
  return { version: 1, node: '0x' + 'ab'.repeat(20), instance: 'a'.repeat(32), requested: [id], with_base: false, revision: 'c'.repeat(64), before: [],
    after: [{ patch_id: id, sha256: patch_sha256 }],
    order: [{ anchor: { id, name, author, patch_sha256, benchmark_hash, created_at, model, base }, requested: true, physical_id: id, action: 'load' }] };
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isKnowledgeAuthor, knowledgePath, knowledgeLookupPath, resolvedKnowledgePath } from '../src/lib/detailRoutes.ts';

test('organization project failures cannot turn into unrelated knowledge pages', () => {
  for (const org of ['comcom', 'ainize', 'unknown-org', '0xabc', 'train']) assert.equal(isKnowledgeAuthor(org), false);
  assert.equal(isKnowledgeAuthor('0xAb6fC64Ed70dEA2294E8f2371e29535ED71278E5'), true);
});

test('id-only knowledge links resolve the actual author instead of guessing a slug or selecting a search result', () => {
  const author = `0x${'a'.repeat(40)}`;
  assert.equal(knowledgeLookupPath('id/with ?'), '/patch/id%2Fwith%20%3F');
  assert.equal(resolvedKnowledgePath({ anchor: { author, id: 'chosen' } }, 'chosen'), `/${author}/chosen`);
  assert.equal(resolvedKnowledgePath({ anchor: { author, id: 'different' } }, 'chosen'), null);
  assert.equal(resolvedKnowledgePath({ anchor: { author: 'organization', id: 'chosen' } }, 'chosen'), null);
  assert.equal(resolvedKnowledgePath({}, 'chosen'), null);
});

test('legacy knowledge links retain the complete identity instead of returning home', () => {
  assert.equal(knowledgePath('0xabc', 'tax facts/2026'), '/0xabc/tax%20facts%2F2026');
});

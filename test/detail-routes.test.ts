import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isKnowledgeAuthor, knowledgePath } from '../src/lib/detailRoutes.ts';

test('organization project failures cannot turn into unrelated knowledge pages', () => {
  for (const org of ['comcom', 'ainize', 'unknown-org', '0xabc', 'train']) assert.equal(isKnowledgeAuthor(org), false);
  assert.equal(isKnowledgeAuthor('0xAb6fC64Ed70dEA2294E8f2371e29535ED71278E5'), true);
});

test('legacy knowledge links retain the complete identity instead of returning home', () => {
  assert.equal(knowledgePath('0xabc', 'tax facts/2026'), '/0xabc/tax%20facts%2F2026');
});

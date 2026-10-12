/**
 * Readable agent ids: what the create and link forms suggest, and what they try when it is taken.
 *
 *   node --test --import tsx test/agent-ids.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentIdCandidate, agentIdFromName, createWithFreeAgentId, romanizeHangul } from '../src/api/agentIds';
import { isHostedAgentIdValid } from '../src/api/hostedAgents';
import { linkedAgentIdFromName } from '../src/api/linkedAgents';

test('Hangul romanizes syllable by syllable (Revised Romanization, no cross-syllable sound changes but ㄹㄹ)', () => {
  assert.equal(romanizeHangul('박향기'), 'bakhyanggi');
  assert.equal(romanizeHangul('안새벽'), 'ansaebyeok');
  assert.equal(romanizeHangul('김철용'), 'gimcheolyong');
  assert.equal(romanizeHangul('앤디'), 'aendi');
  assert.equal(romanizeHangul('출석'), 'chulseok');
  assert.equal(romanizeHangul('빨리'), 'ppalli', 'ㄹㄹ is ll');
  assert.equal(romanizeHangul('의사'), 'uisa');
  assert.equal(romanizeHangul('AI 가이드'), 'AI gaideu', 'everything else passes through');
  assert.equal(romanizeHangul('박'.normalize('NFD')), '박'.normalize('NFD'), 'loose jamo are not syllables (agentIdFromName composes first)');
});

test('an id from a name is readable — the name, never a timestamp or a hash', () => {
  assert.equal(agentIdFromName('Coffee Bot!'), 'coffee-bot');
  assert.equal(agentIdFromName('  Café  Critic '), 'cafe-critic');
  assert.equal(agentIdFromName('박향기'), 'bakhyanggi');
  assert.equal(agentIdFromName('박향기'.normalize('NFD')), 'bakhyanggi', 'decomposed Hangul is composed first');
  assert.equal(agentIdFromName('출석 체크'), 'chulseok-chekeu');
  assert.equal(agentIdFromName('KXIZY 청룡'), 'kxizy-cheongryong');
  assert.equal(agentIdFromName('체육부 장관 Rio'), 'cheyukbu-janggwan-rio');
  assert.equal(agentIdFromName('파파이스 기억 보관소 (Popeyes Korea Memorial Agent)').length <= 40, true);
  assert.equal(agentIdFromName('新闻'), '');
  assert.equal(linkedAgentIdFromName('Agent M'), 'agent-m', 'linked and hosted forms share the rule');
  for (const name of ['박향기', '파파이스 기억 보관소 (Popeyes Korea Memorial Agent)', 'a'.repeat(39) + ' b', 'STEELLIFE Customer Service AI']) {
    const id = agentIdFromName(name);
    assert.ok(isHostedAgentIdValid(id), `${name} → ${id}`);
  }
});

test('a taken id gets -2, -3… and stays a valid id at the length limit', () => {
  assert.equal(agentIdCandidate('coffee-bot', 1), 'coffee-bot');
  assert.equal(agentIdCandidate('coffee-bot', 2), 'coffee-bot-2');
  assert.equal(agentIdCandidate('coffee-bot', 10), 'coffee-bot-10');
  const long = 'a'.repeat(37) + '-bc';
  const second = agentIdCandidate(long, 2);
  assert.equal(second.length, 40 - 1, 'the hyphen left at the cut is dropped');
  assert.equal(second, 'a'.repeat(37) + '-2');
  assert.ok(isHostedAgentIdValid(agentIdCandidate('a'.repeat(40), 12)));
  assert.equal(agentIdCandidate('', 2), 'agent-2');
});

test('create retries a suggested id that is taken, and gives up on anything else', async () => {
  const taken = new Set(['coffee-bot', 'coffee-bot-2']);
  const tried: string[] = [];
  const create = async (b: { id: string }) => { tried.push(b.id); if (taken.has(b.id)) throw { code: 'id_taken' }; };
  const isTaken = (e: unknown) => (e as { code?: string }).code === 'id_taken';
  const accepted = await createWithFreeAgentId({ id: 'coffee-bot', name: 'Coffee Bot' }, create, isTaken);
  assert.deepEqual(accepted, { id: 'coffee-bot-3', name: 'Coffee Bot' });
  assert.deepEqual(tried, ['coffee-bot', 'coffee-bot-2', 'coffee-bot-3']);

  await assert.rejects(createWithFreeAgentId({ id: 'x' }, async () => { throw { code: 'invalid_request' }; }, isTaken), { code: 'invalid_request' });
  let calls = 0;
  await assert.rejects(createWithFreeAgentId({ id: 'x' }, async () => { calls++; throw { code: 'id_taken' }; }, isTaken, 2), { code: 'id_taken' });
  assert.equal(calls, 3, 'the id itself plus two retries');
});

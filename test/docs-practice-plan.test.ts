import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES } from '../src/screens/docs/generated.ts';
import { practicePlan } from '../src/components/docs/practice-plan.ts';
import { parseDoc, type Block } from '../src/components/docs/markdown-parser.ts';

function codes(blocks: Block[]): string[] {
  return blocks.flatMap(b => b.t === 'code' ? [b.code] : b.t === 'quote' ? codes(b.c) : b.t === 'tabs' ? b.panels.flatMap(p => codes(p.c)) : []);
}
test('every published English and Korean code example has an exact ordered practice step', () => {
  for (const [key, source] of Object.entries(SOURCES)) {
    const [lang, ...parts] = key.replace(/\.md$/, '').split('/');
    const plan = practicePlan(source, lang, parts.join('/'));
    assert.deepEqual(plan.steps.map(s => s.code), codes(parseDoc(source).blocks), key);
    assert.equal(new Set(plan.steps.map(s => s.id)).size, plan.steps.length, key);
    assert.equal(plan.execution.verified, false, 'a generated plan cannot claim runtime verification');
  }
});
test('operator commands, credentials and JSON fragments are identified without executing them', () => {
  const source = '# Guide\n\n```bash\nainize start -d\n```\n\n```json\n"inputs": {}\n```\n\n```python\nclient = ainize.connect(url, api_key=os.environ["AINIZE_API_KEY"])\n```';
  const plan = practicePlan(source, 'en', 'guide');
  assert.ok(plan.steps[0].requirements.includes('node-operator'));
  assert.equal(plan.steps[1].kind, 'file');
  assert.ok(plan.steps[2].requirements.includes('credential-handling'));
});

test('HTTP response examples stay reference data while requests remain executable requests', () => {
  const source = '# Payment\n\n```http\nHTTP/1.1 402 Payment Required\nx-payment-required: sample\n```\n\n```http\nPOST /v1/systemone\nContent-Type: application/json\n\n{}\n```';
  const plan = practicePlan(source, 'en', 'payment');
  assert.equal(plan.steps[0].kind, 'reference');
  assert.equal(plan.steps[1].kind, 'request');
  assert.equal(plan.steps[0].code, 'HTTP/1.1 402 Payment Required\nx-payment-required: sample');
});

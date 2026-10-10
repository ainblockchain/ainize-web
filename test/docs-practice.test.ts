import { test } from 'node:test';
import assert from 'node:assert/strict';
import { practiceHref } from '../src/components/docs/practice.ts';
import { GET } from '../app/api/docs/source/[...path]/route.ts';

test('practice passes a document and exact step without code, credentials or giant URLs', () => {
  const url = new URL(practiceHref({ lang: 'ko', slug: 'how-to/build-for-ainteams' }, 'step-2'), 'https://ainize.ai');
  assert.equal(url.pathname, '/code/practice');
  assert.equal(url.searchParams.get('doc'), 'how-to/build-for-ainteams');
  assert.equal(url.searchParams.get('lang'), 'ko');
  assert.equal(url.searchParams.get('step'), 'step-2');
  assert.equal(url.searchParams.has('prompt'), false);
  assert.ok(url.href.length < 200);
});

test('source endpoint returns published Markdown and rejects unknown/traversal paths', async () => {
  const valid = await GET(new Request('https://ainize.ai'), { params: Promise.resolve({ path: ['en', 'how-to', 'build-for-ainteams'] }) });
  assert.equal(valid.status, 200);
  assert.ok((await valid.text()).includes('```'));
  const invalid = await GET(new Request('https://ainize.ai'), { params: Promise.resolve({ path: ['..', '..', 'package'] }) });
  assert.equal(invalid.status, 404);
});

/**
 * The header's unified search ranks and groups without a renderer — this holds the ranking, the group order and
 * the "see all" destinations, and that every string the dropdown reads exists in English and in real Korean.
 *
 *   node --test --import tsx test/global-search.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SEARCH_KINDS, docsFromAgents, docsFromCatalog, docsFromModels, docsFromProjects, flattenHits, matchingSearchIds, scoreDoc, searchDocs, searchHref, seeAllHref, type SearchDoc } from '../src/lib/globalSearch.ts';
import { common } from '../src/i18n/pages/common.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const HANGUL = /[ㄱ-ㆎ가-힣]/;

const docs: SearchDoc[] = [
  ...docsFromModels([{ id: 'dsv41', modality: 'chat', providers: [{ node: { name: 'ainspace', address: '0x' + '1'.repeat(40) } }] }, { id: 'whisper-large', modality: 'transcription' }]),
  ...docsFromAgents([{ id: 'ag1', name: 'Docent', description: 'museum guide', alias: 'docent', skills: [{ name: 'tour', tags: ['art', 'museum'] }] }, { id: 'ag2', name: 'Chat helper', description: null }]),
  ...docsFromCatalog([{ anchor: { id: 'k1', name: 'Korean tax facts', author: '0xabc', author_name: 'Kim', description: 'income tax rules', topic_path: 'finance/tax' } }]),
  ...docsFromProjects([{ id: 'p1', org: 'comcom', repoName: 'nextjs-hello-world', name: 'Hello World', kind: 'nextjs' }]),
];

test('an empty query matches nothing', () => {
  assert.deepEqual(searchDocs(docs, ''), []);
  assert.deepEqual(searchDocs(docs, '   '), []);
});

test('full lists keep every preview match, including words in separate fields', () => {
  for (const query of ['museum docent', 'hello nextjs', 'dsv41 ainspace', 'not-a-match']) {
    const preview = flattenHits(searchDocs(docs, query));
    const ids = matchingSearchIds(docs, query);
    assert.deepEqual([...ids].sort(), preview.map((hit) => hit.id).sort());
  }
  assert.equal(matchingSearchIds(docs, '').size, docs.length, 'unfiltered lists still show all rows');
});

test('groups come back in nav order and only when they have hits', () => {
  const groups = searchDocs(docs, 'a');
  const kinds = groups.map((g) => g.kind);
  assert.deepEqual(kinds, SEARCH_KINDS.filter((k) => kinds.includes(k)));
  assert.ok(!searchDocs(docs, 'whisper').some((g) => g.kind === 'agent'), 'a query with no agent hit must not draw an Agents heading');
});

test('exact beats prefix beats substring beats keyword', () => {
  const a: SearchDoc = { kind: 'model', id: 'x', title: 'chat', href: '/' };
  const b: SearchDoc = { kind: 'model', id: 'y', title: 'chatty', href: '/' };
  const c: SearchDoc = { kind: 'model', id: 'z', title: 'my chat', href: '/' };
  const d: SearchDoc = { kind: 'model', id: 'w', title: 'other', href: '/', keywords: ['chat'] };
  const scores = [a, b, c, d].map((doc) => scoreDoc(doc, 'chat'));
  assert.ok(scores[0]! > scores[1]! && scores[1]! > scores[2]! && scores[2]! > scores[3]! && scores[3]! > 0, String(scores));
  assert.equal(scoreDoc(d, 'nothing'), 0);
});

test('every word of a multi-word query has to land', () => {
  assert.ok(scoreDoc(docs.find((d) => d.id === 'self#ag1')!, 'docent museum') > 0);
  assert.equal(scoreDoc(docs.find((d) => d.id === 'self#ag2')!, 'chat museum'), 0);
});

test('search is case-insensitive and reaches skills, tags, aliases, authors and topics', () => {
  const by = (q: string) => flattenHits(searchDocs(docs, q)).map((h) => h.id);
  assert.deepEqual(by('MUSEUM'), ['self#ag1']);
  assert.deepEqual(by('kim'), ['k1']);
  assert.deepEqual(by('finance'), ['k1']);
  assert.deepEqual(by('ainspace'), ['dsv41']);
  assert.deepEqual(by('comcom'), ['p1']);
});

test('perKind caps the rows but total still counts them', () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ kind: 'agent' as const, id: `a${i}`, title: `agent ${i}`, href: '/' }));
  const [g] = searchDocs(many, 'agent', 4);
  assert.equal(g!.hits.length, 4);
  assert.equal(g!.total, 9);
});

test('adapters link where the site already links', () => {
  const href = (id: string) => docs.find((d) => d.id === id)!.href;
  assert.equal(href('dsv41'), '/models/dsv41');
  assert.equal(href('self#ag1'), '/agent/docent', 'an aliased agent links by its alias');
  assert.equal(href('self#ag2'), '/agent/ag2');
  assert.equal(href('k1'), '/0xabc/k1');
  assert.equal(href('p1'), '/comcom/nextjs-hello-world');
});

test('"see all" carries the query to the page that lists that kind', () => {
  assert.equal(searchHref('  hello world  '), '/search?q=hello%20world');
  assert.equal(seeAllHref('app', 'a b'), '/apps?q=a%20b');
  assert.equal(seeAllHref('model', 'x'), '/models?q=x');
  assert.equal(seeAllHref('agent', 'x'), '/explore?kind=agent&q=x');
  assert.equal(seeAllHref('knowledge', 'x'), '/train/knowledge?q=x');
});

test('app search has the same kinds and exact monorepo destinations as the Apps list', () => {
  const rows = docsFromProjects([
    { id: 'web', org: 'team', repoName: 'mono', name: 'Website', kind: 'nextjs', sourcePath: 'apps/web' },
    { id: 'api', org: 'team', repoName: 'mono', name: 'Backend', kind: 'service', sourcePath: 'services/api' },
    { id: 'script', org: 'team', repoName: 'mono', name: 'Migration', kind: 'script' },
    { id: 'agent', org: 'team', repoName: 'mono', name: 'Assistant', kind: 'agent' },
  ]);
  assert.deepEqual(rows.map((r) => r.id), ['web', 'api']);
  assert.equal(rows[0]!.href, '/team/mono?project=apps%2Fweb');
  assert.equal(searchDocs(rows, 'services/api')[0]!.hits[0]!.href, '/team/mono?project=services%2Fapi');
});

test('every string the search box reads exists in English and in Korean', () => {
  const src = readFileSync(join(root, 'src/components/ui/GlobalSearch.tsx'), 'utf8');
  const keys = [...new Set([...src.matchAll(/\bt\('([a-z0-9_.]+)'/g)].map((m) => m[1]!))];
  assert.ok(keys.length >= 5, `expected the search box to read several strings, found ${keys.length}`);
  for (const key of keys) {
    const e = common[key];
    assert.ok(e, `${key} is not in i18n/pages/common.ts`);
    assert.ok(e.en.trim(), `${key} has no English`);
    assert.ok(HANGUL.test(e.ko), `${key} has no Korean`);
  }
  for (const kind of SEARCH_KINDS) assert.ok(common[`search.kind.${kind}`], `search.kind.${kind} is missing`);
});


test('agent search distinguishes same-id nodes in matching, labels and destinations', () => {
  const base = { id: 'guide', name: 'Guide', description: 'museum guide', alias: 'docent' };
  const rows = docsFromAgents([base, { ...base, node: { address: 'peer-one', name: 'Seoul node' } }, { ...base, node: { address: 'peer-two', name: 'Busan node' } }]);
  assert.equal(new Set(rows.map((row) => row.id)).size, 3);
  assert.deepEqual(rows.map((row) => row.href), ['/agent/docent', '/agent/docent?node=peer-one', '/agent/docent?node=peer-two']);
  assert.deepEqual([...matchingSearchIds(rows, 'Seoul')], ['peer-one#guide']);
  assert.deepEqual([...matchingSearchIds(rows, 'peer-two')], ['peer-two#guide']);
  assert.equal(rows[1].subtitle, 'Seoul node · museum guide');
});

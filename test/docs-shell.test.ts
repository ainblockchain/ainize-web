/**
 * The docs shell, checked where it can be checked without a browser: the markdown subset, the navigation tree,
 * previous/next, search, link and anchor resolution, and the highlighter.
 *
 * Two of these tests read `docs/` itself rather than a fixture, and they are the ones that matter most, because the
 * pages under it are not all hand-written: `scripts/docs-gen.mjs` writes five of them out of the CLI, the OpenAPI
 * document, the config schema and the error literals. This file is the joint between that generator and this
 * renderer — a generated page that used a construct the renderer does not support, or linked to an anchor that does
 * not exist, would ship as a broken page and nobody would notice until a reader hit it.
 *
 *   node --test --import tsx test/docs-shell.test.ts     (packages/web)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDoc, slugify, inlineText, type Block } from '../src/components/docs/markdown.ts';
import { buildSite, docHref, neighbours, parseDocsPath, resolveDocHref, searchDocs, type Toctree } from '../src/components/docs/docsTree.ts';
import { highlight } from '../src/components/docs/highlight.ts';

const DOCS = fileURLToPath(new URL('../../../docs', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** every published page keyed the way `pages.ts` keys it: `en/index.md`, `ko/reference/cli.md` */
const SOURCES: Record<string, string> = Object.fromEntries(
  ['en', 'ko'].flatMap((lang) => walk(join(DOCS, lang))
    .filter((p) => p.endsWith('.md'))
    .map((p) => [p.slice(DOCS.length + 1), readFileSync(p, 'utf-8')])),
);
const TREES: Record<'en' | 'ko', Toctree> = {
  en: JSON.parse(readFileSync(join(DOCS, 'en/_toctree.json'), 'utf-8')),
  ko: JSON.parse(readFileSync(join(DOCS, 'ko/_toctree.json'), 'utf-8')),
};
const SITES = { en: buildSite('en', SOURCES, TREES.en), ko: buildSite('ko', SOURCES, TREES.ko) };

/* ------------------------------------------------------------------ the tree as it is on disk */

test('every published page parses inside the supported subset', () => {
  for (const [path, text] of Object.entries(SOURCES)) {
    const doc = parseDoc(text);
    assert.deepEqual(doc.errors, [], `${path} uses something the renderer does not support: ${JSON.stringify(doc.errors)}`);
    assert.ok(doc.blocks.length > 0, `${path} rendered nothing`);
  }
});

test('the navigation lists every file, and every entry it lists exists', () => {
  for (const site of [SITES.en, SITES.ko]) {
    assert.deepEqual(site.missing, [], `${site.lang}/_toctree.json points at a page that is not there`);
    assert.deepEqual(site.mislabelled, [], `an "untranslated" flag in ${site.lang}/_toctree.json disagrees with what is on disk`);
  }
  // a page nobody can navigate to is a page nobody reads: add it to the toctree or delete it
  assert.deepEqual(SITES.en.orphans, [], 'a file under docs/en/ is listed by no toctree');
  assert.deepEqual(SITES.ko.orphans, [], 'a file under docs/ko/ is listed by no toctree');
});

test('heading anchors are unique within a page', () => {
  for (const [path, text] of Object.entries(SOURCES)) {
    const ids = parseDoc(text).headings.map((h) => h.id);
    assert.equal(new Set(ids).size, ids.length, `${path} has two headings with the same anchor`);
  }
});

/** every link a page writes, flattened out of the block tree */
function links(blocks: Block[]): string[] {
  const out: string[] = [];
  const inline = (nodes: { t: string; c?: unknown; href?: string }[]) => {
    for (const n of nodes as { t: string; href?: string; c?: [] }[]) {
      if (n.t === 'link' && n.href) out.push(n.href);
      if (n.c) inline(n.c);
    }
  };
  for (const b of blocks) {
    if (b.t === 'heading' || b.t === 'para') inline(b.c);
    else if (b.t === 'list') for (const it of b.items) { inline(it.c); if (it.sub) for (const s of it.sub.items) inline(s.c); }
    else if (b.t === 'table') { for (const c of b.head) inline(c); for (const r of b.rows) for (const c of r) inline(c); }
    else if (b.t === 'quote') out.push(...links(b.c));
    else if (b.t === 'tabs') for (const p of b.panels) out.push(...links(p.c));
  }
  return out;
}

test('every internal link and every #anchor in the tree resolves', () => {
  for (const site of [SITES.en, SITES.ko]) {
    for (const entry of site.flat) {
      for (const href of links(entry.doc.blocks)) {
        const r = resolveDocHref(href, { lang: entry.lang, slug: entry.slug });
        if (r.kind === 'external' || r.kind === 'file') continue;
        if (r.kind === 'anchor') {
          const id = r.to.slice(1);
          assert.ok(entry.doc.headings.some((h) => h.id === id), `${entry.lang}/${entry.slug}.md links to #${id}, which is not a heading on that page`);
          continue;
        }
        if (!r.to.startsWith('/docs/')) continue;   // an app route such as /explore
        const [path, hash] = r.to.split('#');
        const slug = path.replace(/^\/docs\/(ko\/)?/, '');
        const target = site.bySlug.get(slug);
        assert.ok(target, `${entry.lang}/${entry.slug}.md links to ${path}, which the navigation does not have`);
        if (hash) assert.ok(target.doc.headings.some((h) => h.id === hash), `${entry.lang}/${entry.slug}.md links to ${path}#${hash}, which is not a heading on that page`);
      }
    }
  }
});

test('a translated page records the English page it was translated from, and is not stale', () => {
  for (const [path, text] of Object.entries(SOURCES)) {
    if (!path.startsWith('ko/')) continue;
    const { front } = parseDoc(text);
    assert.ok(front.source, `${path} does not say which English page it was translated from`);
    const english = SOURCES[front.source];
    assert.ok(english, `${path} names ${front.source}, which does not exist`);
    const sha = createHash('sha256').update(english).digest('hex');
    assert.equal(front.source_sha256, sha,
      `${front.source} has changed since ${path} was translated — retranslate it, then update source_sha256`);
  }
});

/* ------------------------------------------------------------------ navigation, previous/next, search */

const FIXTURE: Toctree = [
  { group: 'Get started', pages: [{ page: 'index', title: 'Ainize' }, { page: 'get-started/install', title: 'Installation' }] },
  { group: 'Reference', pages: [{ page: 'reference/cli', title: 'CLI reference' }, { page: 'nope', title: 'Missing' }] },
];
const FIXTURE_SOURCES = {
  'en/index.md': '# Ainize\n\nA marketplace for knowledge.\n\n## Surfaces\n\nThe site, the CLI and an MCP server.\n',
  'en/get-started/install.md': '# Installation\n\nNode 24 and a clone of the repository.\n',
  'en/reference/cli.md': '# CLI reference\n\n## ainize status\n\nPrints what the node thinks about itself.\n',
};

test('previous and next walk the flattened tree, across group boundaries', () => {
  const site = buildSite('en', FIXTURE_SOURCES, FIXTURE);
  assert.deepEqual(site.flat.map((e) => e.slug), ['index', 'get-started/install', 'reference/cli']);
  const end = neighbours(site, 'get-started/install');
  // the next page after the last of "Get started" is the first of "Reference"
  assert.equal(end.next?.title, 'CLI reference');
  assert.equal(end.prev?.title, 'Ainize');
  assert.equal(neighbours(site, 'index').prev, undefined);
  assert.equal(neighbours(site, 'reference/cli').next, undefined);
});

test('a toctree entry with no file is dropped from the navigation and reported', () => {
  const site = buildSite('en', FIXTURE_SOURCES, FIXTURE);
  assert.deepEqual(site.missing, ['en/nope.md']);
  assert.equal(site.groups[1].pages.length, 1, 'the missing page must not appear in the sidebar');
});

test('search finds a term inside a page body, not only in titles', () => {
  const site = buildSite('en', FIXTURE_SOURCES, FIXTURE);
  const body = searchDocs(site, 'MCP');
  assert.equal(body.length, 1);
  assert.equal(body[0].where, 'body');
  assert.equal(body[0].entry.slug, 'index');
  assert.ok(body[0].snippet?.match === 'MCP' && body[0].snippet.before.includes('CLI'),
    'a body hit carries the sentence it was found in');

  const heading = searchDocs(site, 'ainize status');
  assert.equal(heading[0].where, 'heading');
  assert.equal(heading[0].heading?.id, 'ainize-status');

  const title = searchDocs(site, 'Installation');
  assert.equal(title[0].where, 'title');
});

test('search reaches into the real tree, including the generated reference pages', () => {
  const hits = searchDocs(SITES.en, 'ai·nize');
  assert.equal(hits[0]?.entry.slug, 'index', 'a phrase that appears once in one body is findable');
  assert.equal(hits[0]?.where, 'body');
});

/* ------------------------------------------------------------------ URLs */

test('a /docs path splits into a language and a page', () => {
  assert.deepEqual(parseDocsPath('/docs', 'en'), { lang: 'en', slug: '', explicit: false });
  assert.deepEqual(parseDocsPath('/docs/', 'en'), { lang: 'en', slug: '', explicit: false });
  assert.deepEqual(parseDocsPath('/docs/reference/cli', 'en'), { lang: 'en', slug: 'reference/cli', explicit: false });
  // a bare URL follows the reader's own language; the /ko/ form pins it
  assert.deepEqual(parseDocsPath('/docs/reference/cli', 'ko'), { lang: 'ko', slug: 'reference/cli', explicit: false });
  assert.deepEqual(parseDocsPath('/docs/ko/reference/cli', 'en'), { lang: 'ko', slug: 'reference/cli', explicit: true });
  assert.equal(docHref('en', 'reference/cli'), '/docs/reference/cli');
  assert.equal(docHref('ko', 'reference/cli'), '/docs/ko/reference/cli');
});

test('links written in a page resolve the way a reader expects', () => {
  const ctx = { lang: 'en' as const, slug: 'reference/config' };
  assert.deepEqual(resolveDocHref('./cli.md#ainize-config', ctx), { kind: 'route', to: '/docs/reference/cli#ainize-config' });
  assert.deepEqual(resolveDocHref('../index.md', ctx), { kind: 'route', to: '/docs/index' });
  assert.deepEqual(resolveDocHref('#how-to-read-this-page', ctx), { kind: 'anchor', to: '#how-to-read-this-page' });
  assert.deepEqual(resolveDocHref('https://example.com', ctx), { kind: 'external', to: 'https://example.com' });
  assert.deepEqual(resolveDocHref('/explore', ctx), { kind: 'route', to: '/explore' });
  // served by the node, not routed by the app — a Link here would land on the SPA's 404 page
  assert.deepEqual(resolveDocHref('/api/openapi.json', ctx), { kind: 'file', to: '/api/openapi.json' });
  const ko = resolveDocHref('./cli.md', { lang: 'ko', slug: 'reference/config' });
  assert.equal(ko.to, '/docs/ko/reference/cli');
});

/* ------------------------------------------------------------------ the subset, enforced */

test('anchors are GitHub-compatible, and Korean headings keep Korean anchors', () => {
  const used = new Map<string, number>();
  assert.equal(slugify('Check that a node is answering', used), 'check-that-a-node-is-answering');
  assert.equal(slugify('`ainize config set <key> <value>`', used), 'ainize-config-set-key-value');
  assert.equal(slugify('이 문서가 쓰는 말', used), '이-문서가-쓰는-말');
  assert.equal(slugify('Options', used), 'options');
  assert.equal(slugify('Options', used), 'options-1', 'a repeated heading gets GitHub\'s numeric suffix');
});

test('constructs outside the subset are reported rather than silently mangled', () => {
  const raw = parseDoc('# Title\n\n<div class="x">hi</div>\n');
  assert.match(raw.errors[0].message, /raw HTML/);
  const alert = parseDoc('> [!DANGER]\n> careful\n');
  assert.match(alert.errors[0].message, /unknown alert/);
  const fence = parseDoc('```bash\nainize status\n');
  assert.match(fence.errors[0].message, /never closed/);
  const stray = parseDoc('# Title\n\n::tab CLI\n');
  assert.match(stray.errors[0].message, /stray directive/);
  assert.deepEqual(parseDoc('# Title\n\nJust prose with `code` and a [link](./x.md).\n').errors, []);
});

test('a task with two routes is one page: :::tabs parses into panels of blocks', () => {
  const doc = parseDoc([
    '# Title', '', ':::tabs', '::tab CLI', 'Run it:', '', '```bash', 'npx ainize status', '```', '',
    '::tab Browser', 'Open the node.', ':::', '', 'After.',
  ].join('\n'));
  assert.deepEqual(doc.errors, []);
  const tabs = doc.blocks.find((b) => b.t === 'tabs');
  assert.ok(tabs && tabs.t === 'tabs');
  assert.deepEqual(tabs.panels.map((p) => p.label), ['CLI', 'Browser']);
  assert.equal(tabs.panels[0].c.filter((b) => b.t === 'code').length, 1);
  assert.equal(doc.blocks.at(-1)?.t, 'para', 'the container closes and prose continues after it');
  // the body text search indexes includes what is inside the panels
  assert.ok(doc.text.includes('npx ainize status'));
});

test('tables, alerts and one level of list nesting survive the round trip', () => {
  const doc = parseDoc([
    '| Key | Type |', '|---|---:|', '| `port` | a number |', '',
    '> [!WARNING]', '> Money is a decimal string.', '',
    '- one', '  - nested', '- two',
  ].join('\n'));
  assert.deepEqual(doc.errors, []);
  const table = doc.blocks[0];
  assert.ok(table.t === 'table');
  assert.deepEqual(table.align, ['left', 'right']);
  assert.equal(inlineText(table.rows[0][0]), 'port');
  const quote = doc.blocks[1];
  assert.ok(quote.t === 'quote' && quote.alert === 'WARNING');
  const list = doc.blocks[2];
  assert.ok(list.t === 'list');
  assert.equal(list.items.length, 2);
  assert.equal(inlineText(list.items[0].sub!.items[0].c), 'nested');
});

/* ------------------------------------------------------------------ highlighting */

test('the highlighter colours what it knows and leaves the rest alone', () => {
  const sh = highlight('npx ainize status --json  # ask the node', 'bash');
  assert.equal(sh.find((t) => t.k === 'command')?.v, 'npx', 'the command word is marked');
  assert.ok(sh.some((t) => t.k === 'flag' && t.v === '--json'));
  assert.ok(sh.some((t) => t.k === 'comment' && t.v.startsWith('#')));

  const js = highlight('{"port": 3402, "roles": ["seller"]}', 'json');
  assert.ok(js.some((t) => t.k === 'key' && t.v === '"port"'), 'an object key reads differently from a value');
  assert.ok(js.some((t) => t.k === 'string' && t.v === '"seller"'));
  assert.ok(js.some((t) => t.k === 'number' && t.v === '3402'));

  // no rules for this language: one plain token, and every character still there
  const plain = highlight('SELECT 1;', 'sql');
  assert.deepEqual(plain, [{ k: 'plain', v: 'SELECT 1;' }]);
  for (const lang of ['bash', 'json', 'ts', 'sql']) {
    const src = 'const a = {"b": 1}; # x\n--flag';
    assert.equal(highlight(src, lang).map((t) => t.v).join(''), src, `${lang} highlighting lost characters`);
  }
});

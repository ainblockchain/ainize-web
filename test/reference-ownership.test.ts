/**
 * One generator per file.
 *
 * Two tools were writing `docs/en/reference/http-api.md` and `schemas.md`: `docs-gen.mjs` in ainize-node, which
 * derives them from the code and has a test that fails when they drift from it, and `sync-api-docs.mjs` here,
 * which reads a running node's OpenAPI document. Each overwrote the other, so the file's contents depended on
 * which had run last — and main sat with a failing docs-gen check because of it.
 *
 * Both are worth having, because they answer different questions: one is *what does the code promise*, the other
 * is *what is that deployment serving right now*. So they get different files, and this makes that checkable
 * rather than remembered.
 *
 *   node --test --import tsx test/reference-ownership.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const syncScript = readFileSync(join(root, 'scripts/sync-api-docs.mjs'), 'utf8');

/** Pages `ainize-node/scripts/docs-gen.mjs` owns. Nothing here may write them. */
const GENERATED_BY_THE_NODE = ['cli.md', 'http-api.md', 'schemas.md', 'config.md', 'errors.md'];
/** Pages `sync-api-docs.mjs` owns. */
const GENERATED_BY_THIS_REPO = ['api-index.md', 'schema-index.md'];

for (const page of GENERATED_BY_THE_NODE) {
  test(`sync-api-docs does not write ${page}, which the node's generator owns`, () => {
    assert.ok(!syncScript.includes(`reference/${page}`),
      `${page} is derived from the node's code and checked against it there; a second writer makes its contents depend on which tool ran last`);
  });
}

for (const page of GENERATED_BY_THIS_REPO) {
  test(`${page} exists and is written by sync-api-docs`, () => {
    assert.ok(existsSync(join(root, 'docs/en/reference', page)), `${page} is missing`);
    assert.ok(syncScript.includes(`reference/${page}`), `nothing writes ${page} any more`);
  });
}

test('each index points at the full reference it summarises', () => {
  const apiIndex = readFileSync(join(root, 'docs/en/reference/api-index.md'), 'utf8');
  const schemaIndex = readFileSync(join(root, 'docs/en/reference/schema-index.md'), 'utf8');
  assert.match(apiIndex, /\(\.\/http-api\.md\)/, 'a summary that does not say where the detail is strands the reader');
  assert.match(schemaIndex, /\(\.\/schemas\.md\)/);
});

test('each index says it describes a running node, not the source', () => {
  // The distinction is the entire reason both pages exist; a reader who misses it will trust the wrong one.
  for (const page of GENERATED_BY_THIS_REPO) {
    const text = readFileSync(join(root, 'docs/en/reference', page), 'utf8');
    assert.match(text, /running/, `${page} must say whose API it is describing`);
  }
});

test('both index pages are in the table of contents', () => {
  const toc = JSON.parse(readFileSync(join(root, 'docs/en/_toctree.json'), 'utf8')) as { pages: { page: string }[] }[];
  const pages = new Set(toc.flatMap((g) => g.pages.map((p) => p.page)));
  assert.ok(pages.has('reference/api-index'), 'a page nobody links to is a page nobody reads');
  assert.ok(pages.has('reference/schema-index'));
});

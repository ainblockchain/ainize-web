/**
 * `/<org>` and `/<org>/<repo>` share the URL space with every other page. The list that keeps them apart
 * (src/lib/reservedRoutes.ts) must name every first segment App.tsx routes and every Next route in app/ — a route
 * added without a reservation would still render (static beats dynamic), but its unmatched neighbours
 * (`/explore/x`) would turn into "no such project" instead of "not found".
 *
 *   node --test --import tsx test/reserved-routes.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { RESERVED_FIRST_SEGMENTS, isReservedFirstSegment, looksLikeSlug, projectPath } from '../src/lib/reservedRoutes.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');

test('every static first segment routed in App.tsx is reserved', () => {
  const paths = [...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]!);
  assert.ok(paths.length > 30, 'the routes are read');
  const firsts = new Set(paths.map((p) => p.split('/').filter(Boolean)[0]).filter((s): s is string => !!s && !s.startsWith(':') && s !== '*'));
  for (const s of firsts) assert.ok(isReservedFirstSegment(s), `"${s}" is routed in App.tsx but not reserved`);
});

test('every Next.js route folder under app/ is reserved', () => {
  const dirs = readdirSync(join(root, 'app')).filter((n) => statSync(join(root, 'app', n)).isDirectory() && !n.startsWith('[') && !n.startsWith('('));
  for (const d of dirs) assert.ok(isReservedFirstSegment(d), `app/${d} is a Next route but not reserved`);
});

test('the org/repo routes are the two dynamic ones, declared after every static route', () => {
  assert.match(app, /<Route path="\/:org" /);
  assert.match(app, /<Route path="\/:org\/:repo" /);
  const idx = (re: RegExp) => { const m = re.exec(app); assert.ok(m, String(re)); return m.index; };
  const lastStatic = Math.max(...[...app.matchAll(/<Route path="\/[a-z][^":]*"/g)].map((m) => m.index));
  assert.ok(idx(/<Route path="\/:org\/:repo"/) > lastStatic, 'dynamic routes come after the static ones');
});

test('a slug is a slug, a reserved word or an odd string is not; links are built in one place', () => {
  assert.equal(looksLikeSlug('comcom'), true);
  assert.equal(looksLikeSlug('clef-artwork-search'), true);
  for (const r of RESERVED_FIRST_SEGMENTS) assert.equal(looksLikeSlug(r), false, r);
  assert.equal(looksLikeSlug('Models'), false, 'case-insensitive');
  assert.equal(looksLikeSlug('.git'), false);
  assert.equal(looksLikeSlug('a b'), false);
  assert.equal(projectPath({ org: 'comcom', repoName: 'clef-artwork-search' }), '/comcom/clef-artwork-search');
});

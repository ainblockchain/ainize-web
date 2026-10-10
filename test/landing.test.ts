/**
 * The landing page's four capabilities, their order, and where each one leads.
 *
 * Owner review 2026-10: the page said nothing about models, agents, run or deploy. This holds the redesign to its
 * brief the same way `lifecycle.test.ts` holds the lifecycle diagram and `nav-parity.test.ts` holds the menu — by
 * reading the source, because this suite has no renderer and what is asserted is about the code as written: which
 * sections exist, in what order, which `to="…"` / `href="…"` each one offers, and that every dictionary key the
 * page reads exists in English and in real Korean.
 *
 *   node --test --import tsx test/landing.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { landing } from '../src/i18n/pages/public.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(root, 'src/screens/LandingPage.tsx'), 'utf8');
const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
const HANGUL = /[ㄱ-ㆎ가-힣]/;

/** The source between a section's test id and the next section's, so a link is attributed to the card it is on. */
function block(testId: string): string {
  const start = page.indexOf(`data-testid="${testId}"`);
  assert.ok(start >= 0, `no element carries data-testid="${testId}"`);
  const next = page.slice(start + 1).search(/data-testid="(cap-(models|agents|run|deploy)|landing-(example|only))"/);
  return next < 0 ? page.slice(start) : page.slice(start, start + 1 + next);
}

test('the four capabilities are on the page in the order the owner named them: models, agents, run, deploy', () => {
  const order = ['cap-models', 'cap-agents', 'cap-run', 'cap-deploy', 'landing-example', 'landing-only'].map((id) => page.indexOf(`data-testid="${id}"`));
  for (const at of order) assert.ok(at >= 0, 'a section is missing');
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'the sections are out of order');
  assert.ok(page.indexOf('data-testid="hero-trace"') < order[0]!, 'the hero comes first');
});

test('each capability leads where its brief says', () => {
  const models = block('cap-models');
  assert.match(models, /to="\/models"/, 'Models → /models');
  assert.match(models, /to="\/docs\/how-to\/call-the-model"/);
  assert.match(models, /to="\/docs\/how-to\/decision-models-clef"/);
  assert.match(models, /ainize\.connect\(/, 'the SDK snippet');
  assert.match(models, /client\.decide\(/, 'and the Clef call');

  const agents = block('cap-agents');
  assert.match(agents, /to="\/explore\?kind=agent"/, 'Agents → the marketplace');
  assert.match(agents, /to="\/docs\/how-to\/host-an-agent"/);
  assert.match(agents, /to="\/docs\/how-to\/create-an-agent-from-a-model"/);
  assert.match(agents, /ainize agent add/, 'the one-line registration');

  const run = block('cap-run');
  assert.match(run, /to="\/docs\/how-to\/deploy-with-ainize-json"/, 'Run → the deploy how-to (the `script` kind and Inputs)');
  assert.match(run, /AINIZE_API_KEY/, 'says the key is injected');

  const deploy = block('cap-deploy');
  assert.match(deploy, /to="\/docs\/how-to\/deploy-with-ainize-json"/, 'Deploy → the how-to');
  assert.match(deploy, /"kind"/, 'shows ainize.json');
  assert.match(deploy, /EXAMPLE_PROJECT/, 'and links the example project');
  assert.match(page, /EXAMPLE_PROJECT = 'https:\/\/ainize\.ai\/comcom\/clef-artwork-search'/);
});

test('the differentiators follow: teach, and one identity', () => {
  const only = block('landing-only');
  assert.match(only, /to="\/teach"/, 'Teach → /teach');
  assert.match(only, /to="\/docs\/concepts\/lineage-and-royalties"/);
  assert.match(only, /to="\/docs\/how-to\/run-a-verifier"/);
  assert.match(only, /to="\/signing"/, 'the identity card leads to sign-in');
  for (const name of ['aindrive', 'ainteams', 'ainmem']) assert.ok(only.includes(name), `the identity card names ${name}`);
});

test('the hero keeps the live test reachable and leads to the models', () => {
  const hero = page.slice(page.indexOf('data-testid="hero-title"'), page.indexOf('data-testid="hero-trace"'));
  assert.match(hero, /to="\/models"/);
  assert.match(hero, /to="\/chat"/);
});

test('every internal destination on the page is a route in App.tsx', () => {
  const routes = [...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1]!);
  const matches = (to: string) => {
    const path = to.replace(/[?#].*$/, '');
    return routes.some((r) => {
      if (r === path) return true;
      if (r.endsWith('/*')) return path === r.slice(0, -2) || path.startsWith(r.slice(0, -1));
      const rs = r.split('/'); const ps = path.split('/');
      return rs.length === ps.length && rs.every((seg, i) => seg.startsWith(':') || seg === ps[i]);
    });
  };
  const tos = [...page.matchAll(/\bto="([^"]+)"/g)].map((m) => m[1]!);
  assert.ok(tos.length > 10);
  for (const to of tos) assert.ok(matches(to), `${to} has no route`);
});

test('every dictionary key the page reads exists in English and in real Korean, and no landing key is dead', () => {
  const keys = [...page.matchAll(/t\('(landing\.[^']+)'/g)].map((m) => m[1]!);
  assert.ok(keys.length > 30);
  for (const key of new Set(keys)) {
    const e = landing[key];
    assert.ok(e, `missing dictionary entry: ${key}`);
    assert.ok(e.en.trim().length > 0 && e.ko.trim().length > 0, `${key} is empty in one locale`);
    assert.notEqual(e.ko, e.en, `${key} is not translated — the Korean is the English`);
    assert.match(e.ko, HANGUL, `${key} has no Hangul: a transliteration is not a translation`);
  }
  // `landing.flow.*` is read by components/public/Lifecycle.tsx and pinned by lifecycle.test.ts; everything else in
  // the dictionary must be read by this page, or it is copy that nobody can see.
  const used = new Set(keys);
  for (const k of Object.keys(landing)) {
    if (k.startsWith('landing.flow.')) continue;
    assert.ok(used.has(k), `dead landing copy: ${k}`);
  }
});

test('no marketing claim that the docs do not make', () => {
  // The page used to promise `npm install -g ainize` while the package was private (lifecycle.test.ts). The same
  // discipline for this page: install lines are the docs' `pip install ainize`, and nothing names a model the
  // call-the-model how-to does not.
  assert.ok(!page.includes('npm install -g ainize'));
  const callDoc = readFileSync(join(root, 'docs/en/how-to/call-the-model.md'), 'utf8');
  for (const model of [...page.matchAll(/"(Qwen[^"]+)"/g)].map((m) => m[1]!)) assert.ok(callDoc.includes(model), `${model} is not in the docs`);
});

/**
 * Reading an A2UI surface out of an A2A reply.
 *
 * The fixture is not hand-written: `fixtures-a2ui-parts.json` is the exact `result.parts` array the
 * news-fitness agent returned for a real article, captured from a live call. A renderer tested against a
 * fixture somebody typed proves the renderer agrees with itself; this one proves it agrees with the agent.
 *
 * Only `readSurface` is exercised here — the parsing half. The drawing half is React and belongs in a
 * browser; what can go wrong without one is the part that silently produces an empty frame.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { A2UI_MIME, actionPayload, isInteractive, readPath, readSurface, writePath } from '../src/components/a2ui/surface';

const here = dirname(fileURLToPath(import.meta.url));
const parts = JSON.parse(readFileSync(join(here, 'fixtures-a2ui-parts.json'), 'utf8'));

test('the fixture is what the agent actually sends: one text part and three A2UI data parts', () => {
  assert.equal(parts.length, 4);
  const text = parts.filter((p: { kind?: string }) => p.kind === 'text');
  const a2ui = parts.filter((p: { metadata?: { mimeType?: string } }) => p.metadata?.mimeType === A2UI_MIME);
  assert.equal(text.length, 1, 'the text answer is always sent, so a client without a renderer still works');
  assert.equal(a2ui.length, 3, 'createSurface, updateComponents, updateDataModel');
  assert.match(text[0].text, /News fitness/);
});

test('readSurface assembles the three messages into one surface', () => {
  const s = readSurface(parts)!;
  assert.ok(s, 'a reply carrying A2UI parts produces a surface');
  assert.equal(s.surfaceId, 'news-fitness');
  assert.match(s.catalogId!, /catalogs\/basic\/catalog\.json$/);
  assert.ok(s.components.has('root'), 'v0.9 addresses the root by the id "root"');
  assert.ok(s.components.size >= 20, `the score card is more than a couple of nodes (got ${s.components.size})`);
});

test('the component tree is flat and joined by id — children are references, never inline', () => {
  const s = readSurface(parts)!;
  const root = s.components.get('root')!;
  assert.equal(root.component, 'Column');
  const children = root.children as string[];
  assert.ok(Array.isArray(children));
  for (const id of children) {
    assert.ok(s.components.has(id), `root names child "${id}" and the surface must carry it`);
  }
});

test('every axis reads its value from the data model rather than from a baked-in string', () => {
  const s = readSurface(parts)!;
  const data = s.data as Record<string, string>;
  for (const key of ['title', 'lead', 'read', 'len', 'overall_label']) {
    assert.ok(key in data, `data model carries ${key}`);
  }
  // the components point at those keys by JSON Pointer, which is what lets the same tree re-render
  const titleValue = s.components.get('title_value')!;
  assert.deepEqual(titleValue.text, { path: '/title' });
  assert.match(data.overall_label, /^\d+\/100$|^not scored$/);
  assert.match(data.read, /^FK /);
  assert.match(data.len, /words/);
});

test('the reference list is a template over the bound array, so the tree size does not depend on the data', () => {
  const s = readSurface(parts)!;
  const list = s.components.get('refs_list')!;
  const tpl = (list.children as { template?: { dataPath?: string; componentId?: string } }).template!;
  assert.equal(tpl.dataPath, '/references');
  assert.ok(s.components.has(tpl.componentId!), 'the row component the template repeats must exist');
  const refs = (s.data as { references: unknown[] }).references;
  assert.ok(Array.isArray(refs) && refs.length > 0, 'the fixture compared against real articles');
  // the row binds RELATIVE paths, resolved against each item rather than the model root
  assert.deepEqual(s.components.get('ref_outlet')!.text, { path: 'outlet' });
});

test('a reply with no A2UI parts yields null, so the caller falls back to text instead of an empty frame', () => {
  assert.equal(readSurface([{ kind: 'text', text: 'hello' }]), null);
  assert.equal(readSurface([]), null);
  assert.equal(readSurface(undefined), null);
  // a data part that is not A2UI is not mistaken for one
  assert.equal(readSurface([{ kind: 'data', data: { foo: 1 }, metadata: { mimeType: 'application/json' } }]), null);
});

test('the v1.0 part spelling is read as well as the v0.3 one', () => {
  const v1 = [
    { content: { $case: 'data', value: { version: 'v0.9', createSurface: { surfaceId: 's' } } }, mediaType: A2UI_MIME },
    {
      content: {
        $case: 'data',
        value: { version: 'v0.9', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Text', text: 'hi' }] } },
      },
      mediaType: A2UI_MIME,
    },
  ];
  const s = readSurface(v1)!;
  assert.equal(s.surfaceId, 's');
  assert.equal(s.components.get('root')!.text, 'hi');
});

/**
 * The input half: a surface that asks for something back.
 *
 * `TextField` and `Button` are in the basic catalog, and an agent that uses them is describing its own form —
 * which is the half this renderer was missing. The marketplace used to supply the form out of its own head,
 * so every agent got the same one. What has to be right is small and unforgiving: the value the reader types
 * has to reach the model, and the button has to carry THAT value rather than the one drawn with the tree.
 */
test('a pressed button carries what is in the model now, not what was there when it was drawn', () => {
  const action = { event: { name: 'score', context: { article: { path: '/article' }, kind: 'news' } } };
  const drawn = { article: '' };
  assert.deepEqual(actionPayload(action, drawn), { name: 'score', context: { article: '', kind: 'news' } });

  // …the reader types, which writes into the model…
  const typed = writePath(drawn, '/article', 'Teradyne opens Bengaluru hub');
  assert.equal(drawn.article, '', 'the write does not mutate: React decides to re-render by identity');
  assert.deepEqual(actionPayload(action, typed), {
    name: 'score',
    context: { article: 'Teradyne opens Bengaluru hub', kind: 'news' },
  });
});

test('a literal in the action context is carried as it is; only a {path} is read from the model', () => {
  const out = actionPayload({ event: { name: 'go', context: { id: 'abc', v: { path: '/n' } } } }, { n: 7 });
  assert.deepEqual(out, { name: 'go', context: { id: 'abc', v: 7 } });
  assert.equal(actionPayload({ nothing: true }, {}), null, 'an action with no event is not an action');
  assert.equal(actionPayload(null, {}), null);
});

test('writePath builds the missing levels rather than throwing on a path that is not there yet', () => {
  assert.deepEqual(writePath({}, '/a/b', 1), { a: { b: 1 } });
  assert.deepEqual(readPath({ a: { b: 1 } }, '/a/b'), 1);
  assert.equal(readPath({ a: 1 }, '/a/b/c'), undefined, 'a path through a non-object is absent, not an error');
});

test('a form is told apart from a result by what it contains', () => {
  const form = readSurface([
    { kind: 'data', data: { version: 'v0.9', createSurface: { surfaceId: 's' } }, metadata: { mimeType: A2UI_MIME } },
    { kind: 'data', metadata: { mimeType: A2UI_MIME },
      data: { version: 'v0.9', updateComponents: { surfaceId: 's', components: [
        { id: 'root', component: 'Column', children: ['f'] },
        { id: 'f', component: 'TextField', label: 'x', value: { path: '/v' } },
      ] } } },
  ])!;
  assert.equal(isInteractive(form), true);
  const result = readSurface(parts)!;
  assert.equal(isInteractive(result), false, 'the score card asks for nothing');
});

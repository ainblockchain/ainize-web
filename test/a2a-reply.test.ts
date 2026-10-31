import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A2aReply, a2aReplyText, readA2aReply } from '../src/lib/a2aReply';
import { a2uiActionParts } from '../src/lib/a2uiAction';
import { readFrame, takeFrames } from '../src/lib/a2a-stream';
import { a2aImagesOf } from '../src/lib/a2aFileParts';
import { A2UI_MIME, readSurface, readSurfaces, writePath, readPath, resolve, actionPayload, hasSurfaceAction } from '../src/components/a2ui/surface';

const text = (text: string) => ({ kind: 'text', text });
const artifact = (artifactId: string, parts: unknown[], append = false) => ({ kind: 'artifact-update', artifact: { artifactId, parts }, append });

test('a completed status without a message retains the streamed answer and media artifacts', () => {
  const reply = new A2aReply();
  reply.accept(artifact('answer', [text('Hello')]));
  reply.accept(artifact('answer', [text(' world')], true));
  reply.accept(artifact('picture', [{ kind: 'file', file: { mimeType: 'image/png', uri: 'https://example.invalid/image.png' } }]));
  const final = reply.accept({ kind: 'status-update', final: true, status: { state: 'completed' } });
  assert.equal(a2aReplyText(final), 'Hello world');
  assert.equal(a2aImagesOf(final).length, 1);
});

test('replacing one artifact preserves other artifacts, and a repeated final answer renders once', () => {
  const reply = new A2aReply();
  reply.accept(artifact('a', [text('first')])); reply.accept(artifact('b', [text('second')]));
  reply.accept(artifact('a', [text('corrected')]));
  const final = reply.accept({ kind: 'message', parts: [text('corrected')] });
  assert.equal(a2aReplyText(final), 'corrected\nsecond');
});

test('blocking Task responses expose artifacts, failures and continuation instead of false silence', () => {
  const result = { kind: 'task', id: 'task-one', contextId: 'conversation-one', status: { state: 'completed' }, artifacts: [{ artifactId: 'a', parts: [text('Task answer')] }] };
  assert.equal(a2aReplyText(readA2aReply(result)!.parts), 'Task answer');
  const failed = readA2aReply({ ...result, status: { state: 'failed', message: { parts: [text('Model unavailable')] } } })!;
  assert.equal(failed.error, 'Model unavailable');
  const waiting = readA2aReply({ ...result, artifacts: [], status: { state: 'input-required', message: { parts: [text('Which city?')] } } })!;
  assert.equal(waiting.taskId, 'task-one'); assert.equal(waiting.contextId, 'conversation-one'); assert.equal(waiting.pending, true);
  assert.equal(a2aReplyText(waiting.parts), 'Which city?');
  assert.equal(readA2aReply({ nonsense: true }), null);
  assert.deepEqual(readA2aReply({ kind: 'message', parts: [] })!.parts, []);
});

test('a final Task snapshot is recognized as completion and a failed snapshot is an error', () => {
  assert.equal(readFrame({ result: { kind: 'task', status: { state: 'working' } } })?.kind, 'task');
  const completed = readFrame({ result: { kind: 'task', status: { state: 'completed' }, artifacts: [{ artifactId: 'a', parts: [text('Done')] }] } });
  assert.equal(completed?.kind, 'final'); assert.equal(a2aReplyText(completed!.parts!), 'Done');
  assert.equal(readFrame({ result: { kind: 'task', status: { state: 'failed' } } })?.kind, 'error');
});

test('SSE accepts CRLF, no optional space, multi-line data and split delimiters', () => {
  const event = 'event: message\r\ndata:{\r\ndata: "result": {"kind":"message","parts":[]}\r\ndata:}\r\n\r\n';
  const first = takeFrames(event.slice(0, -1));
  assert.equal(first.frames.length, 0);
  const final = takeFrames(first.rest + event.slice(-1));
  assert.deepEqual(final.frames, [{ result: { kind: 'message', parts: [] } }]);
  assert.equal(final.rest, '');
});

test('form actions keep all values, action identity and source; a text-only legacy field remains unchanged', () => {
  const source = { surfaceId: 'booking', sourceComponentId: 'submit', version: 'v0.9', mimeType: A2UI_MIME };
  const context = { city: 'Seoul', guests: 2, includeDinner: false, tags: ['quiet', 'view'] };
  const parts = a2uiActionParts('reserve', context, source, '2026-10-31T00:00:00.000Z');
  assert.deepEqual(parts[1].data?.action, { name: 'reserve', surfaceId: 'booking', sourceComponentId: 'submit', timestamp: '2026-10-31T00:00:00.000Z', context });
  assert.deepEqual(JSON.parse(parts[0].text!), { action: 'reserve', context });
  assert.equal(a2uiActionParts('score', { article: 'Full article' }, source)[0].text, 'Full article');
  assert.ok(a2uiActionParts('refresh', {}, source)[1].data?.action);
  assert.ok(a2uiActionParts('refresh', {}, { ...source, version: 'v0.8' })[1].data?.userAction);
});

test('bound list input preserves arrays and escaped keys; scoped actions read the edited row', () => {
  const initial = { rows: [{ 'a/b': 'before', 'x~y': 1 }, { 'a/b': 'other' }] };
  const next = writePath(initial, '/rows/0/a~1b', 'after');
  assert.equal(initial.rows[0]['a/b'], 'before'); assert.ok(Array.isArray(next.rows));
  assert.equal(readPath(next, '/rows/0/a~1b'), 'after'); assert.equal(readPath(next, '/rows/0/x~0y'), 1);
  assert.deepEqual(actionPayload({ event: { name: 'save', context: { value: { path: 'a~1b' } } } }, next, next.rows[0])?.context, { value: 'after' });
  assert.equal(resolve({ path: 'a~1b' }, next, next.rows[0]), 'after');
  assert.equal(readPath({}, '/toString'), undefined);
  const own = writePath({}, '/__proto__/field', 'own');
  assert.equal(readPath(own, '/__proto__/field'), 'own'); assert.equal(({} as any).field, undefined);
});

test('nested server data updates reach the displayed model and an actual action is required for a form', () => {
  const part = (data: Record<string, unknown>) => ({ kind: 'data', metadata: { mimeType: 'application/a2ui+json' }, data });
  const surface = readSurface([
    part({ version: 'v0.9', createSurface: { surfaceId: 's' } }),
    part({ updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'TextField', value: { path: '/person/name' } }] } }),
    part({ updateDataModel: { surfaceId: 's', path: '/', value: { person: { name: 'before' } } } }),
    part({ updateDataModel: { surfaceId: 's', path: '/person/name', value: 'after' } }),
  ])!;
  assert.equal(resolve(surface.components.get('root')!.value, surface.data, undefined), 'after');
  assert.equal(hasSurfaceAction(surface), false);
  surface.components.set('submit', { id: 'submit', component: 'Button', action: { event: { name: 'refresh', context: {} } } });
  assert.equal(hasSurfaceAction(surface), true);
});


test('multiple surfaces keep their own root ids and models, including batched data and deletion', () => {
  const entries = (id: string, value: string) => [
    { version: 'v0.9', createSurface: { surfaceId: id } },
    { updateComponents: { surfaceId: id, components: [{ id: 'root', component: 'Text', text: { path: '/value' } }] } },
    { updateDataModel: { surfaceId: id, value: { value } } },
  ];
  const payload = { kind: 'data', mediaType: 'application/a2ui+json', data: [...entries('left', 'Left only'), ...entries('right', 'Right only')] };
  const surfaces = readSurfaces([payload]);
  assert.equal(surfaces.length, 2);
  assert.equal(resolve(surfaces[0].components.get('root')!.text, surfaces[0].data, undefined), 'Left only');
  assert.equal(resolve(surfaces[1].components.get('root')!.text, surfaces[1].data, undefined), 'Right only');
  assert.deepEqual(readSurfaces([payload, { ...payload, data: [{ deleteSurface: { surfaceId: 'left' } }] }]).map((surface) => surface.surfaceId), ['right']);
});

test('repeated data model updates remain ordered, even when the last value repeats an earlier one', () => {
  const data = (value: string) => ({ kind: 'data', metadata: { mimeType: A2UI_MIME }, data: { updateDataModel: { surfaceId: 's', path: '/value', value } } });
  const reply = new A2aReply();
  reply.accept(artifact('ui', [data('first')]));
  reply.accept(artifact('ui', [data('second')], true));
  reply.accept(artifact('ui', [data('first')], true));
  assert.equal(reply.parts().length, 3);
});

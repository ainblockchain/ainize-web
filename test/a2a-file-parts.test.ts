/**
 * The agent page's file parts (src/lib/a2aFileParts.ts): a picture from either protocol shape, and the audio check.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { a2aAudioPart, a2aCardTakesAudio, a2aImagesOf } from '../src/lib/a2aFileParts';

test('a picture is found in the v0.3 and the v1.0 part shapes, and nothing else is', () => {
  const parts = [
    { kind: 'text', text: 'here it is' },
    { kind: 'file', file: { bytes: 'iVBOR', mimeType: 'image/png', name: 'image-1.png' } },
    { content: { $case: 'raw', value: '/9j/4' }, mediaType: 'image/jpeg', filename: 'b.jpg' },
    { kind: 'file', file: { bytes: 'AAAA', mimeType: 'application/pdf', name: 'doc.pdf' } },
    { kind: 'file', file: { uri: 'javascript:alert(1)', mimeType: 'image/png', name: 'x.png' } },
    { kind: 'data', data: { a: 1 } },
  ];
  assert.deepEqual(a2aImagesOf(parts), [
    { src: 'data:image/png;base64,iVBOR', name: 'image-1.png' },
    { src: 'data:image/jpeg;base64,/9j/4', name: 'b.jpg' },
  ]);
  assert.deepEqual(a2aImagesOf(null), []);
});

test('a card takes audio only when its input modes say so', () => {
  assert.equal(a2aCardTakesAudio({ defaultInputModes: ['text/plain', 'audio/webm'] }), true);
  assert.equal(a2aCardTakesAudio({ defaultInputModes: ['text/plain'] }), false);
  assert.equal(a2aCardTakesAudio({}), false);
  assert.deepEqual(a2aAudioPart('AA==', 'memo.webm', ''), { kind: 'file', file: { bytes: 'AA==', name: 'memo.webm', mimeType: 'audio/webm' } });
});

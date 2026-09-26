/**
 * File parts in an A2A exchange — the pictures an agent sends back, and the voice note a person sends it.
 *
 * Pure, so `test/a2a-file-parts.test.ts` can pin both part shapes: v0.3 (`kind: "file"`, `file: { bytes | uri,
 * mimeType, name }`) is what the node's compat layer answers a v0.3 call with, and v1.0 (`content.$case` "raw" /
 * "url", `mediaType`, `filename`) is what a v1.0 agent may send. Either way the page shows the same picture.
 */

export interface A2aImage { src: string; name: string }

/** Images among the parts, as `<img src>`-ready URLs. Anything that is not an image, or has no bytes/URL, is skipped. */
export function a2aImagesOf(parts: unknown): A2aImage[] {
  if (!Array.isArray(parts)) return [];
  const out: A2aImage[] = [];
  for (const raw of parts as Record<string, unknown>[]) {
    if (!raw || typeof raw !== 'object') continue;
    const file = raw.file as { bytes?: unknown; uri?: unknown; mimeType?: unknown; name?: unknown } | undefined;
    if ((raw.kind === 'file' || raw.type === 'file') && file && typeof file === 'object') {
      const mime = typeof file.mimeType === 'string' ? file.mimeType : '';
      if (!/^image\//i.test(mime)) continue;
      const name = typeof file.name === 'string' ? file.name : 'image';
      if (typeof file.bytes === 'string' && file.bytes) out.push({ src: `data:${mime};base64,${file.bytes}`, name });
      else if (typeof file.uri === 'string' && /^https?:\/\//.test(file.uri)) out.push({ src: file.uri, name });
      continue;
    }
    const content = raw.content as { $case?: unknown; value?: unknown } | undefined;
    const mime = typeof raw.mediaType === 'string' ? raw.mediaType : '';
    if (!content || !/^image\//i.test(mime)) continue;
    const name = typeof raw.filename === 'string' ? raw.filename : 'image';
    if (content.$case === 'raw' && typeof content.value === 'string' && content.value) out.push({ src: `data:${mime};base64,${content.value}`, name });
    else if (content.$case === 'url' && typeof content.value === 'string' && /^https?:\/\//.test(content.value)) out.push({ src: content.value, name });
  }
  return out;
}

/**
 * The most audio one message may carry inline. The node refuses an A2A request body over 200 KB, and base64 is
 * 4/3 the size of the bytes — so a little under 150 KB of audio, with room left for the rest of the request.
 * About ten seconds of a phone's AAC, or half a minute of a browser's Opus.
 */
export const A2A_INLINE_AUDIO_MAX_BYTES = 140 * 1024;

/** A voice note as a v0.3 file part — the shape the page already sends its text in. */
export const a2aAudioPart = (bytesBase64: string, name: string, mimeType: string) =>
  ({ kind: 'file', file: { bytes: bytesBase64, name, mimeType: mimeType || 'audio/webm' } });

/** Does a card say it takes audio? Read from `defaultInputModes`; an absent or malformed list means no. */
export const a2aCardTakesAudio = (card: unknown): boolean => {
  const modes = (card as { defaultInputModes?: unknown } | null | undefined)?.defaultInputModes;
  return Array.isArray(modes) && modes.some((m) => typeof m === 'string' && /^audio\//i.test(m));
};

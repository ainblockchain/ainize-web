/**
 * A picture file as the base64 a classification model is sent.
 *
 * A phone photo is several megabytes; the model looks at a few hundred pixels and the node's route takes about
 * 3.5 MB at most. So the picture is drawn at no more than `MAX_SIDE` on its long side and re-encoded as JPEG in the
 * browser first — the call is smaller and faster, and a 12-megapixel photo does not fail on size.
 */
export const PICTURE_MAX_SIDE = 1280;

/** The size to draw a `width`×`height` picture at: unchanged when it already fits, never enlarged. */
export function fittedSize(width: number, height: number, maxSide = PICTURE_MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Thrown when the browser cannot decode the file as a picture; the panel says so in the reader's language. */
export const PICTURE_UNREADABLE = 'picture:unreadable';

export async function pictureBase64(file: Blob): Promise<string> {
  let bitmap: ImageBitmap;
  // `from-image`: a phone photo taken upright is stored sideways with a note saying so; the model must see it upright.
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error(PICTURE_UNREADABLE); }
  try {
    const size = fittedSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width; canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error(PICTURE_UNREADABLE);
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (!blob) throw new Error(PICTURE_UNREADABLE);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  } finally { bitmap.close(); }
}

export interface ClassifiedLabel { label: string; score: number; detail: string | null }

/** Read a classification answer: `labels` with a text `label` and a 0–1 `score`; anything else is skipped. */
export function parseLabels(raw: unknown): ClassifiedLabel[] {
  const labels = (raw as { labels?: unknown } | null | undefined)?.labels;
  if (!Array.isArray(labels)) return [];
  const out: ClassifiedLabel[] = [];
  for (const entry of labels as Record<string, unknown>[]) {
    if (!entry || typeof entry.label !== 'string' || !entry.label || typeof entry.score !== 'number' || !Number.isFinite(entry.score)) continue;
    const detail = typeof entry.common_name === 'string' && entry.common_name.trim() ? entry.common_name.trim() : null;
    out.push({ label: entry.label, score: Math.max(0, Math.min(1, entry.score)), detail });
  }
  return out;
}

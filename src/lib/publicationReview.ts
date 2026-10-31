import type { PatchAnchor, PatchDetail } from '../api/types';
import { managedKnowledge, managementMatchesAuthor } from './manageKnowledge';
export interface PublicationRetirement { patch_id: string; author: string; name: string; status: string; overlap_rows: number; price: string; currency: string; paid_sales: number | null; revenue: string | null }
export interface PublicationReview { anchor: PatchAnchor; revision: string; retires: PublicationRetirement[]; coexisting: number }
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const canonical = (v: unknown) => JSON.stringify(v, (_key, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const anchorContent = (a: PatchAnchor) => { const { created_at: _time, gateway_url: _gateway, ...content } = a as PatchAnchor & { gateway_url?: string }; return canonical(content); };
export function readPublicationReview(raw: unknown, expected: PatchDetail): PublicationReview | null {
  if (!object(raw) || typeof raw.revision !== 'string' || !/^[a-f0-9]{64}$/.test(raw.revision) || !count(raw.coexisting) || !Array.isArray(raw.retires)) return null;
  const detail = managedKnowledge({ ...expected, anchor: raw.anchor }, expected.anchor.id);
  if (!detail || !managementMatchesAuthor(detail, expected.anchor.author)) return null;
  const seen = new Set<string>();
  for (const row of raw.retires) {
    if (!object(row) || typeof row.patch_id !== 'string' || !row.patch_id || seen.has(row.patch_id) || row.patch_id === expected.anchor.id
      || typeof row.author !== 'string' || row.author.toLowerCase() !== expected.anchor.author.toLowerCase() || typeof row.name !== 'string'
      || !['VERIFIED', 'VERIFYING', 'ANNOUNCED'].includes(row.status) || !count(row.overlap_rows) || typeof row.price !== 'string' || !/^\d+(\.\d+)?$/.test(row.price)
      || typeof row.currency !== 'string' || !row.currency || row.paid_sales !== null && !count(row.paid_sales) || row.revenue !== null && (typeof row.revenue !== 'string' || !row.revenue.trim() || !Number.isFinite(Number(row.revenue)) || Number(row.revenue) < 0)) return null;
    seen.add(row.patch_id);
  }
  return raw as PublicationReview;
}
export const samePublicationReview = (a: PublicationReview, b: PublicationReview) => a.revision === b.revision && canonical(a) === canonical(b);
export class PublicationReviewError extends Error { constructor(readonly code: 'read' | 'changed' | 'confirm' | 'unconfirmed') { super(code); } }
export async function publishReviewed(review: PublicationReview, expected: PatchDetail, typed: string, deps: {
  current: () => boolean; preview: () => Promise<unknown>; write: (revision: string) => Promise<unknown>; detail: () => Promise<unknown>;
}) {
  if (!deps.current()) return null;
  if (review.retires.length && typed.trim() !== review.anchor.id) throw new PublicationReviewError('confirm');
  const fresh = readPublicationReview(await deps.preview(), expected);
  if (!deps.current()) return null;
  if (!fresh) throw new PublicationReviewError('read');
  if (!samePublicationReview(review, fresh)) throw new PublicationReviewError('changed');
  let raw: unknown;
  try { raw = await deps.write(review.revision); }
  catch (error) { if ((error as any)?.data?.code === 'publication_preview_changed' || (error as any)?.data?.details?.code === 'publication_preview_changed') throw new PublicationReviewError('changed'); throw error; }
  if (!deps.current()) return null;
  const record = object(raw) ? raw.record : null;
  if (!object(record) || record.kind !== 'anchor' || typeof record.hash !== 'string' || !/^[a-f0-9]{64}$/.test(record.hash)
    || typeof record.author !== 'string' || record.author.toLowerCase() !== review.anchor.author.toLowerCase() || !object(record.body)
    || !count(record.body.created_at) || anchorContent(record.body as PatchAnchor) !== anchorContent(review.anchor)) throw new PublicationReviewError('unconfirmed');
  let confirmed: PatchDetail | null;
  try { confirmed = managedKnowledge(await deps.detail(), review.anchor.id); } catch { throw new PublicationReviewError('unconfirmed'); }
  if (!deps.current()) return null;
  if (!confirmed || confirmed.status === 'DRAFT' || !confirmed.owned || confirmed.record_hash !== record.hash || !managementMatchesAuthor(confirmed, review.anchor.author)
    || anchorContent(confirmed.anchor) !== anchorContent(review.anchor)) throw new PublicationReviewError('unconfirmed');
  return confirmed;
}

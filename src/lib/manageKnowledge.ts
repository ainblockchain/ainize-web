import type { PatchDetail } from '../api/types';
import { dashboardInventory } from './dashboardView';
import { isKnowledgeAuthor } from './detailRoutes';

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string';
const count = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const strings = (v: unknown) => Array.isArray(v) && v.every(text);
const optionalText = (v: unknown) => v == null || text(v);
const address = (v: unknown): v is string => text(v) && isKnowledgeAuthor(v);
const reference = (v: unknown) => object(v) && text(v.id) && !!v.id && address(v.author) && text(v.status) && optionalText(v.name);

/** Check the selected management response without changing the signed benchmark or anchor. */
export function managedKnowledge(raw: unknown, id: string): PatchDetail | null {
  if (!object(raw) || !dashboardInventory({ items: [raw] })) return null;
  const a = raw.anchor;
  if (a.id !== id || !text(a.price) || !text(a.billing) || !text(a.patch_sha256) || !text(a.benchmark_hash)
    || !count(a.size_bytes) || !count(a.rows) || !['description', 'license', 'branch'].every(k => optionalText(a[k]))
    || a.benchmark.samples != null && !Array.isArray(a.benchmark.samples)
    || !['owned', 'purchased', 'has_body', 'applied'].every(k => typeof raw[k] === 'boolean')
    || !count(raw.self_checks) || !count(raw.downloads) || !optionalText(raw.gateway_url)
    || !Array.isArray(raw.attestations) || !raw.attestations.every((v: unknown) => object(v) && address(v.verifier) && typeof v.passed === 'boolean' && text(v.verified_on))
    || !Array.isArray(raw.settlements) || !raw.settlements.every((v: unknown) => object(v) && address(v.buyer))
    || !strings(raw.supersedes) || !strings(raw.superseded_by)
    || !object(raw.lineage) || !Array.isArray(raw.lineage.parents) || !raw.lineage.parents.every(reference)
    || !Array.isArray(raw.lineage.children) || !raw.lineage.children.every(reference)
    || !Array.isArray(raw.conflicts) || !raw.conflicts.every((v: unknown) => object(v) && text(v.patch_id) && !!v.patch_id && text(v.status) && count(v.overlap_rows)
      && typeof v.same_schema === 'boolean' && (v.author == null || address(v.author)))) return null;
  if (raw.price_history != null && (!Array.isArray(raw.price_history) || !raw.price_history.every((v: unknown) => object(v) && text(v.price) && text(v.currency)))) return null;
  if (raw.open_challenge != null && (!object(raw.open_challenge) || !address(raw.open_challenge.challenger) || !text(raw.open_challenge.reason))) return null;
  if (raw.stalled != null && (!object(raw.stalled) || !text(raw.stalled.reason) || !Array.isArray(raw.stalled.verifiers)
    || !raw.stalled.verifiers.every((v: unknown) => object(v) && text(v.endpoint) && optionalText(v.name) && optionalText(v.model) && text(v.attested)))) return null;
  return raw as PatchDetail;
}
export const managementMatchesAuthor = (detail: PatchDetail, author: string) =>
  isKnowledgeAuthor(author) && detail.anchor.author.toLowerCase() === author.toLowerCase();

export class ManagementSelectionError extends Error {}
/** The read and the write share the resource/account task; leaving never starts a later write. */
export async function runManagedAction(id: string, author: string, deps: {
  current: () => boolean; read: () => Promise<unknown>; action: (current: () => boolean) => Promise<unknown>;
}) {
  if (!deps.current()) return null;
  const fresh = managedKnowledge(await deps.read(), id);
  if (!deps.current()) return null;
  if (!fresh || !fresh.owned || !managementMatchesAuthor(fresh, author)) throw new ManagementSelectionError();
  await deps.action(deps.current);
  return deps.current() ? true : null;
}

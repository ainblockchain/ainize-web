import type { DeviceRequest } from '../api/types';
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const address = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
const time = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= 8.64e15;
const owner = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 300 && !/[\s\x00-\x1f]/.test(v);
export const deviceCode = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v);
export function selectedDeviceCode(params: URLSearchParams): string | null {
  const codes = params.getAll('code'); return codes.length === 1 && deviceCode(codes[0]) ? codes[0] : null;
}
export interface DeviceApprovalReview { owner: string; kind: 'cli' | 'node'; delegate: string; label: string | null; message: string; expires: number; expires_at: number }
export function readDeviceApprovalReview(raw: unknown): DeviceApprovalReview | null {
  if (!object(raw) || Object.keys(raw).sort().join(',') !== 'delegate,expires,expires_at,kind,label,message,owner'
    || !owner(raw.owner) || !['cli', 'node'].includes(raw.kind) || !address(raw.delegate)
    || raw.label !== null && (typeof raw.label !== 'string' || raw.label.length > 80)
    || typeof raw.message !== 'string' || !raw.message || raw.message.length > 8192 || !time(raw.expires) || !time(raw.expires_at)) return null;
  return { owner: raw.owner, kind: raw.kind, delegate: raw.delegate, label: raw.label, message: raw.message, expires: raw.expires, expires_at: raw.expires_at };
}
export function readDeviceRequest(raw: unknown): DeviceRequest | null {
  if (!object(raw) || raw.capabilities?.reviewed_approval !== true || !address(raw.node) || typeof raw.name !== 'string'
    || !['pending', 'approved', 'claimed', 'expired'].includes(raw.status)) return null;
  const review = readDeviceApprovalReview({ owner: 'shape-check', kind: raw.kind, delegate: raw.delegate, label: raw.label, message: raw.message, expires: raw.expires, expires_at: raw.expires_at });
  if (!review || (['approved', 'claimed'].includes(raw.status) ? !owner(raw.owner) : raw.owner !== null)) return null;
  return { capabilities: { reviewed_approval: true }, kind: review.kind, status: raw.status, delegate: review.delegate, label: review.label, message: review.message,
    expires: review.expires, expires_at: review.expires_at, node: raw.node, name: raw.name, owner: raw.owner };
}
export function deviceReview(request: DeviceRequest, actor: string): DeviceApprovalReview {
  return { owner: actor, kind: request.kind!, delegate: request.delegate, label: request.label, message: request.message, expires: request.expires, expires_at: request.expires_at };
}
export const sameDeviceRequest = (a: DeviceRequest, b: DeviceRequest) => a.node.toLowerCase() === b.node.toLowerCase() && a.name === b.name
  && JSON.stringify(deviceReview(a, 'compare')) === JSON.stringify(deviceReview(b, 'compare'));
export const deviceApprovedFor = (r: DeviceRequest, actor: string) => ['approved', 'claimed'].includes(r.status)
  && (address(actor) ? r.owner?.toLowerCase() === actor.toLowerCase() : r.owner === actor);
export class DeviceApprovalError extends Error {
  constructor(readonly code: 'changed' | 'read' | 'unconfirmed') { super(code); }
}
/** One explicit approval. Lost replies only read the exact code; acknowledgement is not completion. */
export async function approveReviewedDevice(reviewed: DeviceRequest, actor: string, deps: {
  current: () => boolean; read: () => Promise<unknown>; prove?: (message: string) => Promise<string>;
  attempting: () => void; write: (expected: DeviceApprovalReview, signature?: string) => Promise<unknown>;
}): Promise<DeviceRequest | null> {
  if (!deps.current()) return null;
  if (!owner(actor)) throw new DeviceApprovalError('changed');
  const inspect = async () => {
    const current = readDeviceRequest(await deps.read());
    if (!current) throw new DeviceApprovalError('read');
    if (!sameDeviceRequest(reviewed, current)) throw new DeviceApprovalError('changed');
    return current;
  };
  const before = await inspect();
  if (!deps.current()) return null;
  if (deviceApprovedFor(before, actor)) return before;
  if (before.status !== 'pending') throw new DeviceApprovalError('changed');
  let signature: string | undefined;
  if (deps.prove) {
    signature = await deps.prove(before.message);
    if (!deps.current()) return null;
    if (typeof signature !== 'string' || !signature) throw new DeviceApprovalError('read');
    const afterProof = await inspect();
    if (!deps.current()) return null;
    if (deviceApprovedFor(afterProof, actor)) return afterProof;
    if (afterProof.status !== 'pending') throw new DeviceApprovalError('changed');
  }
  if (!deps.current()) return null;
  deps.attempting();
  try { await deps.write(deviceReview(before, actor), signature); } catch { /* Recover only with GET; no automatic retry. */ }
  if (!deps.current()) return null;
  const after = await inspect().catch(() => null);
  if (!deps.current()) return null;
  if (!after || !deviceApprovedFor(after, actor)) throw new DeviceApprovalError('unconfirmed');
  return after;
}

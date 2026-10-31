import type { AppDomain, AppDomainsResponse } from '../api/projects';

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const labelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Match the node's public hostname input, including IDN and a trailing DNS dot; never interpret a URL as a host. */
export function appDomainHostname(input: string): string | null {
  const raw = input.trim().toLowerCase().replace(/\.$/, '');
  if (!raw || /[\s/:@?#%\\\[\]*]/.test(raw)) return null;
  try {
    const host = new URL(`https://${raw}`).hostname;
    if (host.length > 253 || !host.includes('.') || /^\d+(?:\.\d+){3}$/.test(host)
      || host.split('.').some(label => !labelPattern.test(label)) || /\.(?:localhost|local|internal|test|invalid|example)$/.test(host)) return null;
    return host;
  } catch { return null; }
}
export const appDomainLabel = (input: string): string | null => labelPattern.test(input.trim().toLowerCase()) ? input.trim().toLowerCase() : null;
const canonicalHost = (v: unknown): v is string => typeof v === 'string' && appDomainHostname(v) === v;
const ipAddress = (v: unknown): v is string => {
  if (typeof v !== 'string') return false;
  if (/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(v)) return v.split('.').every(n => Number(n) <= 255);
  if (!v.includes(':') || !/^[0-9a-fA-F:.]+$/.test(v)) return false;
  try { return new URL(`http://[${v}]/`).hostname.startsWith('['); } catch { return false; }
};

export function readAppDomain(raw: unknown, projectId: string, hostname?: string): AppDomain | null {
  if (!object(raw) || raw.projectId !== projectId || !canonicalHost(raw.hostname) || hostname && raw.hostname !== hostname
    || typeof raw.token !== 'string' || !/^ainize-verification=[a-f0-9]{48}$/.test(raw.token)
    || typeof raw.status !== 'string' || !['pending', 'invalid', 'verified', 'ready', 'error'].includes(raw.status)
    || typeof raw.message !== 'string' || raw.message.length > 4096 || !number(raw.createdAt)
    || raw.checkedAt !== null && !number(raw.checkedAt) || raw.managed !== undefined && typeof raw.managed !== 'boolean') return null;
  return { hostname: raw.hostname, projectId, token: raw.token, status: raw.status as AppDomain['status'], message: raw.message,
    createdAt: raw.createdAt, checkedAt: raw.checkedAt as number | null, ...(raw.managed === undefined ? {} : { managed: raw.managed }) };
}
export function readAppDomains(raw: unknown, projectId: string): AppDomainsResponse | null {
  if (!object(raw) || !Array.isArray(raw.domains) || raw.domains.length > 20 || !Array.isArray(raw.addresses)
    || raw.addresses.length > 64 || !raw.addresses.every(ipAddress) || new Set(raw.addresses).size !== raw.addresses.length
    || raw.cname !== '' && !canonicalHost(raw.cname) || raw.managedBase !== undefined && !canonicalHost(raw.managedBase)) return null;
  const domains: AppDomain[] = [], hosts = new Set<string>();
  for (const value of raw.domains) {
    const row = readAppDomain(value, projectId);
    if (!row || hosts.has(row.hostname)) return null;
    if (row.managed && (!raw.managedBase || !row.hostname.endsWith(`.${raw.managedBase}`)
      || !appDomainLabel(row.hostname.slice(0, -(String(raw.managedBase).length + 1))) || domains.some(d => d.managed))) return null;
    hosts.add(row.hostname); domains.push(row);
  }
  return { domains, addresses: [...raw.addresses], cname: raw.cname as string, ...(raw.managedBase ? { managedBase: raw.managedBase as string } : {}) };
}

export type DomainAction = { kind: 'add'; hostname: string }
  | { kind: 'rename'; hostname: string; previous: AppDomain; base: string }
  | { kind: 'check' | 'remove'; hostname: string; previous: AppDomain };
export class DomainOperationError extends Error {
  constructor(readonly reason: 'changed' | 'unconfirmed') { super(reason); }
}
const sameClaim = (a: AppDomain | undefined, b: AppDomain) => a?.hostname === b.hostname && a.projectId === b.projectId && a.token === b.token && !!a.managed === !!b.managed;
const explicitRefusal = (error: unknown) => {
  const e = error as { status?: unknown; data?: { error?: { code?: unknown } } } | null;
  const code = e?.data?.error?.code, status = e?.status;
  return status === 503 && code === 'domains_off' || typeof status === 'number' && status >= 400 && status < 500 && typeof code === 'string'
    && ['not_signed_in', 'forbidden', 'not_found', 'invalid_kind', 'invalid_domain', 'org_private', 'domain_unavailable', 'domain_not_found', 'domain_changed', 'default_domain'].includes(code);
};

/** One view's mutations are serialized; only exact receipts plus a fresh matching list can clear the draft. */
export function createDomainOperation() {
  let pending = false, unknown = false;
  return {
    blocked: () => pending || unknown,
    uncertain: () => unknown,
    async run(projectId: string, action: DomainAction, io: { read: () => Promise<unknown>; send: () => Promise<unknown>; active: () => boolean }): Promise<AppDomain | 'removed' | undefined> {
      if (pending || unknown || !io.active()) return undefined;
      pending = true;
      let dispatched = false, acknowledged = false;
      try {
        const before = readAppDomains(await io.read(), projectId);
        if (!io.active()) return undefined;
        if (!before || !canonicalHost(action.hostname)) throw new DomainOperationError('changed');
        if (action.kind === 'add') {
          if (before.domains.some(d => d.hostname === action.hostname)) throw new DomainOperationError('changed');
        } else {
          if (!sameClaim(before.domains.find(d => d.hostname === action.previous.hostname), action.previous)) throw new DomainOperationError('changed');
          if (action.kind === 'remove' && action.previous.managed) throw new DomainOperationError('changed');
          if (action.kind === 'rename' && (!action.previous.managed || before.managedBase !== action.base
            || !action.hostname.endsWith(`.${action.base}`) || !appDomainLabel(action.hostname.slice(0, -(action.base.length + 1)))
            || before.domains.some(d => d.hostname === action.hostname))) throw new DomainOperationError('changed');
          if (action.kind !== 'rename' && action.hostname !== action.previous.hostname) throw new DomainOperationError('changed');
        }
        dispatched = true;
        const raw = await io.send();
        acknowledged = true;
        if (!io.active()) return undefined;
        const receipt = action.kind === 'remove' ? null : readAppDomain(raw, projectId, action.hostname);
        if (action.kind !== 'remove' && (!receipt || action.kind === 'rename' && (!receipt.managed || receipt.token === action.previous.token)
          || action.kind === 'add' && receipt.managed
          || action.kind === 'check' && (!sameClaim(receipt, action.previous) || receipt.checkedAt === null || receipt.checkedAt < (action.previous.checkedAt ?? 0)))) throw new DomainOperationError('unconfirmed');
        const after = readAppDomains(await io.read(), projectId);
        if (!io.active()) return undefined;
        if (!after) throw new DomainOperationError('unconfirmed');
        const current = after.domains.find(d => d.hostname === action.hostname);
        if (action.kind === 'remove') {
          if (current) throw new DomainOperationError('unconfirmed');
          return 'removed';
        }
        if (!receipt || !sameClaim(current, receipt) || action.kind === 'rename' && after.domains.some(d => d.hostname === action.previous.hostname)
          || action.kind === 'check' && (current!.checkedAt === null || current!.checkedAt < receipt.checkedAt!)) throw new DomainOperationError('unconfirmed');
        return current;
      } catch (error) {
        if (dispatched && (acknowledged || !explicitRefusal(error))) unknown = true;
        throw error;
      } finally { pending = false; }
    },
  };
}

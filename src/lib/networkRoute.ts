import type { RouteResponse } from '../api/types';

export interface RouteInput { key: string; value: string }
export function routeInput(key: string, value: string): RouteInput | null {
  key = key.trim(); value = value.trim();
  // /api/route consumes `partial` as an option, not a context attribute.
  return key && value && key !== 'partial' ? { key, value } : null;
}
const object = (v: unknown): Record<string, any> | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : null;
const text = (v: unknown): v is string => typeof v === 'string';
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(text) && new Set(v).size === v.length;
const context = (v: unknown) => !!object(v) && Object.values(v as object).every(text);

export function nodeApiUrl(endpoint: unknown, path: 'info' | 'route'): string | null {
  if (!text(endpoint) || !endpoint) return null;
  try {
    const url = new URL(endpoint);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
    url.pathname = `${url.pathname.replace(/\/$/, '')}/api/${path}`;
    return url.href;
  } catch { return null; }
}

/** Require an exact match for the submitted condition; malformed replies must not become “no match”. */
export function networkRouteView(raw: unknown, input: RouteInput): RouteResponse | null {
  const p = object(raw);
  if (!p || !Array.isArray(p.nodes) || !strings(p.matched) || !strings(p.unmatched) || !strings(p.current)
    || typeof p.ambiguous !== 'boolean' || !Array.isArray(p.candidates)) return null;
  if (!p.candidates.every((c: any) => object(c) && text(c.name) && context(c.context) && strings(c.matched) && strings(c.unmatched))) return null;
  if (p.branch === null) return p.nodes.length === 0 && p.matched.length === 0 && p.current.length === 0
    && p.unmatched.length === 1 && p.unmatched[0] === input.key ? p as RouteResponse : null;
  const b = object(p.branch);
  if (!b || !text(b.name) || !b.name || !text(b.description) || !context(b.context) || b.context[input.key] !== input.value
    || !strings(b.patch_ids) || !p.current.every((id: string) => b.patch_ids.includes(id))
    || p.matched.length !== 1 || p.matched[0] !== input.key || p.unmatched.length !== 0) return null;
  if (!p.nodes.every((n: any) => object(n) && text(n.address) && !!n.address && (n.endpoint === null || nodeApiUrl(n.endpoint, 'info'))
    && (n.model == null || text(n.model)) && (n.current === null || typeof n.current === 'boolean') && strings(n.missing)
    && n.missing.every((id: string) => p.current.includes(id))
    && (n.current !== true || n.missing.length === 0) && (n.current !== false || n.missing.length > 0))) return null;
  if (new Set(p.nodes.map((n: any) => n.address.toLowerCase())).size !== p.nodes.length) return null;
  return p as RouteResponse;
}

export type RouteState = { phase: 'idle' | 'loading' } | { phase: 'error'; error: unknown } | { phase: 'ready'; data: RouteResponse };
export interface RouteRequest { unwrap(): Promise<unknown>; abort(): void }
/** A task belongs to one input/view. Edits cancel it, including A → B → A and delayed failures. */
export function createNetworkRouteTask() {
  let generation = 0, flight: RouteRequest | null = null;
  return {
    cancel() { generation++; flight?.abort(); flight = null; },
    async run(input: RouteInput, request: (context: Record<string, string>) => RouteRequest, active: () => boolean, emit: (state: RouteState) => void) {
      if (flight || !active()) return;
      const attempt = ++generation;
      const current = () => active() && generation === attempt;
      emit({ phase: 'loading' });
      try {
        flight = request({ [input.key]: input.value });
        const raw = await flight.unwrap();
        if (!current()) return;
        const data = networkRouteView(raw, input);
        if (!data) throw new Error('The routing response did not match the requested condition.');
        emit({ phase: 'ready', data });
      } catch (error) { if (current()) emit({ phase: 'error', error }); }
      finally { if (generation === attempt) flight = null; }
    },
  };
}

const shellQuote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;
export function routeCurlCommand(endpoint: string, input: RouteInput | null): string | null {
  const address = nodeApiUrl(endpoint, 'route');
  if (!address || !input) return null;
  const url = new URL(address); url.searchParams.set(input.key, input.value);
  return `curl ${shellQuote(url.href)}`;
}

import { NODE_URL } from './node-url';

/** Public probes expose the node revision without relaying private upstream diagnostics. */
export async function nodeHealth(path: '/healthz' | '/readyz') {
  const headers = { 'cache-control': 'no-store' };
  try {
    const response = await fetch(new URL(path, NODE_URL), {
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
    });
    const body = await response.json();
    if (typeof body?.ok !== 'boolean' || typeof body.commit !== 'string' || !/^[0-9a-f]{40}$/i.test(body.commit)) {
      return Response.json({ ok: false, error: 'node_probe_invalid' }, { status: 502, headers });
    }
    const ok = response.ok && body.ok;
    const status = response.ok && !ok ? 503 : response.status;
    return Response.json({ ok, commit: body.commit }, { status, headers });
  } catch {
    return Response.json({ ok: false, error: 'node_probe_unavailable' }, { status: 502, headers });
  }
}

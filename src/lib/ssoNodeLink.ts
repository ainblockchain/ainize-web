import { callNode, NodeCallError } from './nodeCall';

/** The session owner comes from the node, never from the request body. */
export async function linkSsoNode(req: Request, origin: string, env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const from = req.headers.get('origin');
  if (from ? from !== origin : req.headers.get('sec-fetch-site') !== 'same-origin') {
    return Response.json({ error: 'cross_origin' }, { status: 403 });
  }
  const body = await req.json().catch(() => null) as unknown;
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 ||
      !('code' in body) || typeof body.code !== 'string' || !body.code.length || body.code.length > 100) {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  try {
    const node = (env.AINIZE_NODE_URL ?? 'http://127.0.0.1:3400').replace(/\/+$/, '');
    const me = await fetchImpl(`${node}/api/auth/me`, {
      headers: { cookie: req.headers.get('cookie') ?? '' },
      redirect: 'error', signal: AbortSignal.timeout(10_000),
    });
    if (!me.ok) return Response.json({ error: 'session_unavailable' }, { status: me.status === 401 ? 401 : 502 });
    const account = await me.json() as { sso?: { principal?: unknown } | null };
    if (typeof account.sso?.principal !== 'string' || !account.sso.principal.length) {
      return Response.json({ error: 'ain_sign_in_required' }, { status: 401 });
    }
    const linked = await callNode('/api/auth/sso/node-link', { principal: account.sso.principal, code: body.code }, env, fetchImpl);
    return Response.json(linked);
  } catch (e) {
    if (e instanceof NodeCallError) return Response.json({ error: e.code }, { status: e.status >= 400 && e.status < 500 ? e.status : 502 });
    return Response.json({ error: 'node_unavailable' }, { status: 502 });
  }
}

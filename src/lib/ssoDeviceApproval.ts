import { callNode, NodeCallError } from './nodeCall';

/** Only an explicit same-origin action can delegate the HttpOnly browser session to a terminal. */
export async function approveSsoDevice(req: Request, origin: string, env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const from = req.headers.get('origin');
  if (from ? from !== origin : req.headers.get('sec-fetch-site') !== 'same-origin') return Response.json({ error: 'cross_origin' }, { status: 403 });
  const body = await req.json().catch(() => null) as unknown;
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 ||
      !('code' in body) || typeof body.code !== 'string' || !body.code.length || body.code.length > 100) {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  const cookies = (req.headers.get('cookie') ?? '').split(';').map((c) => c.trim()).filter((c) => c.startsWith('ainize_session='));
  if (cookies.length !== 1) return Response.json({ error: 'ain_sign_in_required' }, { status: 401 });
  const sessionToken = cookies[0].slice('ainize_session='.length);
  if (!sessionToken || sessionToken.length > 200) return Response.json({ error: 'ain_sign_in_required' }, { status: 401 });
  try {
    return Response.json(await callNode('/api/auth/sso/device-approve', { sessionToken, code: body.code }, env, fetchImpl));
  } catch (e) {
    if (e instanceof NodeCallError) return Response.json({ error: e.code }, { status: e.status >= 400 && e.status < 500 ? e.status : 502 });
    return Response.json({ error: 'node_unavailable' }, { status: 502 });
  }
}

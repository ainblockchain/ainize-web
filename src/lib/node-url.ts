/**
 * Where this app's backend finds the main node.
 *
 * Server-side only. The browser never learns it: the whole reason the route handlers exist is that the node is
 * reached by the app, not by the visitor — on a real deployment it listens on loopback and is not routable from
 * anywhere else.
 *
 * `AINIZE_NODE_URL` is the deployment knob. The default is the loopback port a node uses out of the box, which
 * is right for `next dev` beside a local node and wrong to rely on in production — a misconfigured deployment
 * should fail loudly against localhost rather than quietly reach some other machine.
 */
export const NODE_URL = (process.env.AINIZE_NODE_URL ?? 'http://127.0.0.1:3400').replace(/\/+$/, '');

/** Headers that belong to the browser's hop and must not be forwarded to the node. */
const HOP_BY_HOP = new Set([
  'host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-authenticate',
  'proxy-authorization', 'te', 'trailer', 'content-length', 'accept-encoding',
]);

/**
 * The headers to send onward.
 *
 * `x-forwarded-for` is appended rather than set: the node rate-limits per IP, and a proxy that replaces the
 * chain makes every visitor look like one caller. Cookies and `authorization` pass through — the node is what
 * authenticates an operator, and this app is not in that business.
 */
export function forwardHeaders(req: Request): Headers {
  const out = new Headers();
  for (const [k, v] of req.headers) if (!HOP_BY_HOP.has(k.toLowerCase())) out.set(k, v);
  out.set('x-forwarded-host', new URL(req.url).host);
  out.set('x-forwarded-proto', new URL(req.url).protocol.replace(':', ''));
  return out;
}

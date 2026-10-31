/**
 * The backend half of this app: one hop from a browser request to the main node.
 *
 * Deliberately a relay and not a rewrite. The node is the authority on everything this app shows — the
 * catalogue, the agents, who owns what — and re-deriving any of it here would create a second answer that can
 * disagree with the first. What this layer adds is the thing a static frontend cannot have: the node's address
 * stays on the server, so the machine that holds it is never named to a visitor.
 *
 * Streaming is preserved. A live test holds the node's runtime lock and answers over tens of seconds; buffering
 * it here would turn that into one late burst, which is how a working chat reads as a hang.
 */
import { NODE_URL, forwardHeaders } from './node-url';
import { SITE_CALL_HEADER } from './nodeCall';
import { SITE_SUBJECT_HEADER, siteSubjectFor, vouchesFor } from './siteAssertion';

/** Body-carrying methods. A GET with a body is not a thing fetch will send. */
const WITH_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** The node's session cookie (ainize-node src/site-session.ts) — the one cookie a `/svc` request carries onward. */
export const NODE_SESSION_COOKIE = 'ainize_session';

/**
 * What a `/svc/<projectId>/…` request may carry to the node. `/svc` is a user's app served on THIS origin, so the
 * visitor's ambient credentials for ainize.ai must not travel with it as they do to every other route: no
 * `Authorization`, no `X-Ainize-*` / `X-AIN-Actor`, and of the cookies only the node's own session. The node needs that
 * one to decide whether the visitor is an active member of an org-private project's organization — it is the
 * authority on sessions, and resolving it here would cost a round trip per asset — and it strips it, with every other
 * credential, before the request reaches the container (ainize-node project-routes.ts `/svc`). Everything else
 * ainize.ai's cookie jar holds (the Google session, SSO state) stays here.
 */
export function serviceHeaders(headers: Headers): Headers {
  headers.delete('authorization');
  for (const name of [...headers.keys()]) if (name.startsWith('x-ainize-') || name === 'x-ain-actor') headers.delete(name);
  const session = (headers.get('cookie') ?? '').split(';').map((c) => c.trim()).find((c) => c.slice(0, c.indexOf('=')) === NODE_SESSION_COOKIE);
  if (session) headers.set('cookie', session); else headers.delete('cookie');
  return headers;
}

/**
 * `service`: the request is a user's app on this origin (`/svc`, above) — its credentials are trimmed on the way in,
 * and the app's `Set-Cookie` is dropped on the way out: an app served on ainize.ai must not plant or overwrite a
 * cookie of ainize.ai's (a session fixation, or a way to shadow `ainize_session`).
 */
export async function relayToNode(req: Request, path: string, opts: { service?: boolean } = {}): Promise<Response> {
  const url = new URL(req.url);
  const target = `${NODE_URL}${path}${url.search}`;
  const headers = forwardHeaders(req);
  if (opts.service) serviceHeaders(headers);
  // Only this app may vouch for a Google account, and only on the paths it vouches for. A visitor's own copy of
  // the header is dropped everywhere: the node would reject a forged one, but it should never even see one.
  headers.delete(SITE_SUBJECT_HEADER);
  // Likewise this app's own signed calls (nodeCall.ts): they are this app speaking, never a visitor.
  headers.delete(SITE_CALL_HEADER);
  if (!opts.service && vouchesFor(path)) {
    const subject = await siteSubjectFor(req);
    if (subject) headers.set(SITE_SUBJECT_HEADER, subject);
  }
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: WITH_BODY.has(req.method) ? await req.arrayBuffer() : undefined,
      redirect: 'manual',
      // a scoring turn or a live test runs for minutes; the platform default would cut it off
      signal: AbortSignal.timeout(10 * 60_000),
    });
  } catch (e) {
    // The node being down is this app's most likely failure, and it must not look like the app crashing.
    return Response.json(
      { error: 'the node is not answering', detail: (e as Error).message },
      { status: 502 },
    );
  }
  const out = new Headers(upstream.headers);
  // set-cookie is the node's to set: an operator signs in there, and the cookie is scoped to this origin
  out.delete('content-encoding');
  out.delete('content-length');
  if (opts.service) out.delete('set-cookie');
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
}

/**
 * The verbs the node answers, wired to one path prefix.
 *
 * OPTIONS is relayed rather than left to the framework. Next answers a preflight itself when no handler
 * exports one — with `allow:` and no `access-control-allow-origin`, which a browser reads as "no" — and an
 * A2A agent address is exactly the kind of URL a page on another origin calls. The node already answers
 * preflights; this hands the question to it.
 */
export function nodeRoutes(prefix: string, opts: { service?: boolean } = {}) {
  const handler = async (req: Request, ctx: { params: Promise<{ path?: string[] }> }) => {
    const { path } = await ctx.params;
    // Next already decoded each captured segment. Re-encode it independently: `qa%2Fprefix` is one
    // benchmark id, not two routes, and a literal `?`/`#` in an id must not rewrite the upstream query.
    return relayToNode(req, `${prefix}/${(path ?? []).map(part => encodeURIComponent(part)).join('/')}`, opts);
  };
  return { GET: handler, POST: handler, PUT: handler, PATCH: handler, DELETE: handler, OPTIONS: handler };
}

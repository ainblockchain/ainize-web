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
import { SITE_SUBJECT_HEADER, siteSubjectFor, vouchesFor } from './siteAssertion';

/** Body-carrying methods. A GET with a body is not a thing fetch will send. */
const WITH_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function relayToNode(req: Request, path: string): Promise<Response> {
  const url = new URL(req.url);
  const target = `${NODE_URL}${path}${url.search}`;
  const headers = forwardHeaders(req);
  // Only this app may vouch for a Google account, and only on the paths it vouches for. A visitor's own copy of
  // the header is dropped everywhere: the node would reject a forged one, but it should never even see one.
  headers.delete(SITE_SUBJECT_HEADER);
  if (vouchesFor(path)) {
    const subject = siteSubjectFor(req);
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
export function nodeRoutes(prefix: string) {
  const handler = async (req: Request, ctx: { params: Promise<{ path?: string[] }> }) => {
    const { path } = await ctx.params;
    return relayToNode(req, `${prefix}/${(path ?? []).join('/')}`);
  };
  return { GET: handler, POST: handler, PUT: handler, PATCH: handler, DELETE: handler, OPTIONS: handler };
}

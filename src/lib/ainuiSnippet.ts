/**
 * AIN-UI link snippets (ainize-node docs/PROJECTS.md "Link snippets"; the contract is aindrive's
 * docs/AINUI-LINK-SNIPPETS.md): a chat that had `https://ainize.ai/<org>/<repo>` or `/projects/<id>` pasted asks
 * THAT URL with `Accept: application/vnd.ain.ui+json` and gets the project's snippet instead of the page.
 *
 * The pages here are a browser-only app (app/[[...slug]]), so the decision cannot live in them: the middleware
 * reads the header and hands the request to the node's `GET /api/ainui/snippet?url=<the pasted URL>` — the node
 * knows the projects, verifies the consumer's machine token and the viewer it names. This module only decides,
 * pure, for every request; `middleware.ts` relays.
 *
 * Left alone: everything a browser sends (no browser puts this media type in Accept, and `text/html` beside it
 * means a page), `/api`, `/agents` and the other machine paths (they negotiate for themselves), and any method
 * but GET/HEAD.
 */
export const AINUI_MEDIA_TYPE = 'application/vnd.ain.ui+json';
export const AINUI_SNIPPET_PATH = '/api/ainui/snippet';

/** Paths the node already answers on its own terms; a snippet request there is not a page URL. */
const NOT_PAGES = /^\/(?:api|agents|x402|p2p|v1|svc|_next|static|\.well-known)(?:\/|$)/;

/** `Accept` asks for the snippet and not for a page. */
export function wantsAinui(accept: string | null | undefined): boolean {
  const a = (accept ?? '').toLowerCase();
  return a.includes(AINUI_MEDIA_TYPE) && !a.includes('text/html');
}

/**
 * The node path to relay a request to, or null when the request is not a snippet request. `url` is the request's
 * absolute URL as the browser (consumer) spelled it; the node compares its host with its own.
 */
export function ainuiSnippetTarget(req: { method: string; url: string; headers: { get(name: string): string | null } }): string | null {
  if (req.method !== 'GET' && req.method !== 'HEAD') return null;
  if (!wantsAinui(req.headers.get('accept'))) return null;
  const u = new URL(req.url);
  if (NOT_PAGES.test(u.pathname)) return null;
  // The pasted URL, as the consumer saw it: behind nginx `req.url` names the loopback listener, so the public
  // host comes from the forwarded headers, like canonicalHostRedirect.
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? u.host;
  const proto = req.headers.get('x-forwarded-proto') ?? u.protocol.replace(':', '');
  const pasted = `${proto}://${host}${u.pathname}${u.search}`;
  return `${AINUI_SNIPPET_PATH}?url=${encodeURIComponent(pasted)}`;
}

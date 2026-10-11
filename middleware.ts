/**
 * Two things happen before any route runs:
 *
 * 1. Canonical host: `www.ainize.ai/…` → `ainize.ai/…` (308, method and body kept). Why: src/lib/canonicalHostRedirect.ts.
 *    The host is read from the request as nginx forwarded it (`x-forwarded-host`, then `host`), not from `nextUrl`,
 *    which behind the proxy names the loopback address this server listens on.
 * 2. Automatic sign-in (src/lib/silentSso.ts decides, src/lib/silentSignIn.ts answers): a person's browser opening a
 *    page with no session here gets, as the answer to that very request, the one redirect to AIN SSO with
 *    `prompt=none`. Everything else — APIs, assets, crawlers, prefetches, signed-in browsers — passes through
 *    untouched, after a few string comparisons.
 *
 * 3. AIN-UI link snippets (src/lib/ainuiSnippet.ts): a page URL asked for with `Accept: application/vnd.ain.ui+json`
 *    — a chat that had the URL pasted — is answered by the node's `GET /api/ainui/snippet?url=…` through the same
 *    relay the `/api` route handlers use, never by the page. Browsers never send that media type.
 *
 * The Node.js runtime, because the answer needs what the route handlers use (Node's crypto for the sealed flow cookie,
 * the OIDC client) and the client secret. (A rewrite to the start route cannot stand in for it: behind this app's
 * loopback HOSTNAME, Next treats a middleware rewrite as an external URL and proxies it.)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { canonicalHostRedirect } from './src/lib/canonicalHostRedirect';
import { silentSsoStart } from './src/lib/silentSso';
import { silentSignIn } from './src/lib/silentSignIn';
import { ainuiSnippetTarget } from './src/lib/ainuiSnippet';
import { relayToNode } from './src/lib/proxy';

export async function middleware(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const target = canonicalHostRedirect(host, req.nextUrl.pathname + req.nextUrl.search);
  if (target) return NextResponse.redirect(target, 308);
  // Next's automatic normalization is disabled to preserve service mount roots.
  // Keep the existing slash-free URLs for the rest of this site.
  const pathname = req.nextUrl.pathname;
  if (!pathname.startsWith('/svc/') && pathname !== '/' && pathname.endsWith('/')) {
    const canonical = new URL(req.url);
    if (host) canonical.host = host;
    canonical.protocol = (req.headers.get('x-forwarded-proto') ?? canonical.protocol.replace(':', '')) + ':';
    canonical.pathname = pathname.replace(/\/+$/, '');
    return NextResponse.redirect(canonical, 308);
  }
  const snippet = ainuiSnippetTarget(req);
  if (snippet) {
    // relayToNode appends the request's own query; the snippet path carries the pasted URL in its own, so hand it a
    // request without one. The identity headers (Authorization, X-AIN-Actor) travel with the rest.
    const bare = new Request(`${req.nextUrl.origin}${req.nextUrl.pathname}`, { method: req.method, headers: req.headers });
    return relayToNode(bare, snippet);
  }
  if (silentSsoStart(req)) return silentSignIn(req, req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next();
}

export const config = {
  // Everything, including /api and /agents: an A2A client or a sign-in callback on www must land on the apex too.
  matcher: '/:path*',
  runtime: 'nodejs',
};

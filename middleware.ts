/**
 * Canonical host: `www.ainize.ai/…` → `ainize.ai/…` (308, method and body kept). Why: src/lib/canonicalHostRedirect.ts.
 *
 * The host is read from the request as nginx forwarded it (`x-forwarded-host`, then `host`), not from `nextUrl`,
 * which behind the proxy names the loopback address this server listens on.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { canonicalHostRedirect } from './src/lib/canonicalHostRedirect';

export function middleware(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const target = canonicalHostRedirect(host, req.nextUrl.pathname + req.nextUrl.search);
  return target ? NextResponse.redirect(target, 308) : NextResponse.next();
}

export const config = {
  // Everything, including /api and /agents: an A2A client or a sign-in callback on www must land on the apex too.
  matcher: '/:path*',
};

/** `/api/auth/google/start?next=/path` — send the browser to Google (src/lib/googleOAuth.ts). */
import { NextResponse, type NextRequest } from 'next/server';
import { GOOGLE_FLOW_COOKIE, GOOGLE_FLOW_TTL_S, googleCookieOptions, readGoogleOAuthConfig, startGoogleFlow } from '@/lib/googleOAuth';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const config = readGoogleOAuthConfig();
  if (!config) return NextResponse.json({ error: 'Google sign-in is not configured on this server' }, { status: 503 });
  const { authorizeUrl, flowCookie } = startGoogleFlow(req, config, req.nextUrl.searchParams.get('next'));
  const res = NextResponse.redirect(authorizeUrl, 302);
  res.cookies.set(GOOGLE_FLOW_COOKIE, flowCookie, googleCookieOptions(req, GOOGLE_FLOW_TTL_S));
  return res;
}

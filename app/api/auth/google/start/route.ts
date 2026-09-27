/** `/api/auth/google/start?next=/path` — send the browser to Google (src/lib/googleOAuth.ts). */
import { NextResponse, type NextRequest } from 'next/server';
import { GOOGLE_FLOW_COOKIE, GOOGLE_FLOW_TTL_S, googleCookieOptions, googleRedirectUri, readGoogleOAuthConfig, startGoogleFlow } from '@/lib/googleOAuth';
import { legacyLoginMode } from '@/lib/legacyLogin';
import { legacyRefusalMessage } from '@/lib/ssoMessages';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const config = readGoogleOAuthConfig();
  if (!config) return NextResponse.json({ error: 'Google sign-in is not configured on this server' }, { status: 503 });
  // LEGACY_LOGIN=false (src/lib/legacyLogin.ts): the button is gone; a bookmarked link says why instead of working.
  if (legacyLoginMode() === 'false') {
    const back = new URL('/signing', new URL(googleRedirectUri(req, config)).origin);
    back.searchParams.set('google_error', legacyRefusalMessage('legacy_login_off'));
    return NextResponse.redirect(back, 302);
  }
  const { authorizeUrl, flowCookie } = startGoogleFlow(req, config, req.nextUrl.searchParams.get('next'));
  const res = NextResponse.redirect(authorizeUrl, 302);
  res.cookies.set(GOOGLE_FLOW_COOKIE, flowCookie, googleCookieOptions(req, GOOGLE_FLOW_TTL_S));
  return res;
}

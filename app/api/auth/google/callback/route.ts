/**
 * `/api/auth/google/callback` — where Google sends the browser back (src/lib/googleOAuth.ts).
 *
 * A failure lands on the sign-in page with the reason in `google_error`, not on a JSON body: the person arrived here
 * by a redirect and has no page of ours to read an error from otherwise.
 */
import { NextResponse, type NextRequest } from 'next/server';
import {
  GOOGLE_FLOW_COOKIE, GOOGLE_SESSION_COOKIE, GOOGLE_SESSION_TTL_S, GoogleOAuthError, finishGoogleFlow, googleCookieOptions,
  googleRedirectUri, readGoogleOAuthConfig,
} from '@/lib/googleOAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const config = readGoogleOAuthConfig();
  if (!config) return NextResponse.json({ error: 'Google sign-in is not configured on this server' }, { status: 503 });
  // Absolute redirects are built from the same public origin Google was given, not from req.url, which behind a proxy
  // can name the loopback address the server listens on.
  const origin = new URL(googleRedirectUri(req, config)).origin;
  try {
    const { sessionCookie, next } = await finishGoogleFlow(req, config, req.cookies.get(GOOGLE_FLOW_COOKIE)?.value);
    const res = NextResponse.redirect(new URL(next, origin), 302);
    res.cookies.set(GOOGLE_SESSION_COOKIE, sessionCookie, googleCookieOptions(req, GOOGLE_SESSION_TTL_S));
    res.cookies.set(GOOGLE_FLOW_COOKIE, '', googleCookieOptions(req, 0));
    return res;
  } catch (e) {
    const reason = e instanceof GoogleOAuthError ? e.message : 'Google sign-in failed';
    if (!(e instanceof GoogleOAuthError)) console.error('[google-oauth] callback failed', e);
    const back = new URL('/signing', origin);
    back.searchParams.set('google_error', reason);
    const res = NextResponse.redirect(back, 302);
    res.cookies.set(GOOGLE_FLOW_COOKIE, '', googleCookieOptions(req, 0));
    return res;
  }
}

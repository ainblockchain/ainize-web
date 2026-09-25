/**
 * `/api/auth/google/session` — GET: who is signed in with Google, if anyone. DELETE: sign that person out.
 *
 * `configured` rides along so the sign-in page offers Google only on a server that can actually complete it.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { GOOGLE_SESSION_COOKIE, googleCookieOptions, readGoogleOAuthConfig, readGoogleSession } from '@/lib/googleOAuth';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const config = readGoogleOAuthConfig();
  const identity = config ? readGoogleSession(req.cookies.get(GOOGLE_SESSION_COOKIE)?.value, config) : null;
  return NextResponse.json({ configured: !!config, identity }, { headers: { 'cache-control': 'no-store' } });
}

export function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GOOGLE_SESSION_COOKIE, '', googleCookieOptions(req, 0));
  return res;
}

/**
 * `/api/auth/sso/logout` — the second half of "Log out" for an AIN session (RP-initiated logout, ADR-0005 path 1).
 *
 * The page has already ended this app's session (`POST /api/auth/logout`); this sends the browser to AIN SSO's
 * end-session page, which asks whether to sign out of AIN in this browser — ending, if they say yes, the AIN session
 * and their sessions in the other apps — and returns to this site. Without it, automatic sign-in would bring the
 * person straight back: their AIN session would still be there.
 *
 * The browser stays marked as checked (`ain_sso_checked`, 30 minutes), so whatever the person answers at AIN SSO,
 * this site does not sign them in again on the way back.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { readAinSsoConfig, ssoEndSessionUrl } from '@/lib/ainSso';
import { googleCookieOptions } from '@/lib/googleOAuth';
import { SSO_CHECKED_COOKIE, SSO_CHECKED_TTL_S } from '@/lib/silentSso';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const config = readAinSsoConfig();
  let target: string | null = null;
  if (config) {
    try { target = await ssoEndSessionUrl(req, config); } catch (e) { console.error('[ain-sso] no end-session URL:', (e as Error).message); }
  }
  const res = new NextResponse(null, { status: 302, headers: { location: target ?? '/', 'cache-control': 'no-store' } });
  // Nothing here ends a session: that was the page's POST. A GET anyone can link to must not sign anybody out.
  res.cookies.set(SSO_CHECKED_COOKIE, '1', googleCookieOptions(req, SSO_CHECKED_TTL_S));
  return res;
}

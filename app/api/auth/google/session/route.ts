/**
 * `/api/auth/google/session` — GET: who is signed in with Google, if anyone. DELETE: sign that person out.
 *
 * `configured` rides along so the sign-in page offers Google only on a server that can actually complete it.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { GOOGLE_SESSION_COOKIE, googleCookieOptions, readGoogleOAuthConfig, readGoogleSessionWithIat } from '@/lib/googleOAuth';
import { legacyGoogleVerdict, legacyLoginMode } from '@/lib/legacyLogin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // LEGACY_LOGIN=false takes the button away (`configured: false`) and stops every existing Google cookie counting.
  const config = legacyLoginMode() === 'false' ? null : readGoogleOAuthConfig();
  const session = config ? readGoogleSessionWithIat(req.cookies.get(GOOGLE_SESSION_COOKIE)?.value, config) : null;
  // A cookie that verifies is not enough once AIN SSO exists: the node may have suspended the account, or signed it
  // out everywhere after this cookie was minted. Such a session is ended here, the way the node ends its own rows.
  const verdict = session ? await legacyGoogleVerdict(session) : null;
  const identity = session && verdict?.ok ? session.identity : null;
  const res = NextResponse.json({ configured: !!config, identity }, { headers: { 'cache-control': 'no-store' } });
  if (session && !verdict?.ok && verdict?.reason !== 'node_unavailable') res.cookies.set(GOOGLE_SESSION_COOKIE, '', googleCookieOptions(req, 0));
  return res;
}

export function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GOOGLE_SESSION_COOKIE, '', googleCookieOptions(req, 0));
  return res;
}

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
  const legacyOff = legacyLoginMode() === 'false';
  const google = readGoogleOAuthConfig();
  const config = legacyOff ? null : google;
  const cookie = req.cookies.get(GOOGLE_SESSION_COOKIE)?.value;
  const session = config ? readGoogleSessionWithIat(cookie, config) : null;
  // A cookie that verifies is not enough once AIN SSO exists: the node may have suspended the account, or signed it
  // out everywhere after this cookie was minted. Such a session is ended here, the way the node ends its own rows.
  const verdict = session ? await legacyGoogleVerdict(session) : null;
  const identity = session && verdict?.ok ? session.identity : null;
  const res = NextResponse.json({ configured: !!config, identity }, { headers: { 'cache-control': 'no-store' } });
  // So is a cookie that can never count again: Google sign-in switched off, or a cookie that does not verify (signed
  // with a rotated AINIZE_WEB_SESSION_SECRET, expired, tampered with). Left in place it would keep the automatic
  // sign-in away from this browser until it expired (silentSso.ts skips any browser that holds one). A server that
  // merely lacks its Google configuration right now cannot tell, and leaves it alone.
  const refused = !!session && !verdict?.ok && verdict?.reason !== 'node_unavailable';
  const dead = cookie !== undefined && (legacyOff || (!!google && !session));
  if (refused || dead) res.cookies.set(GOOGLE_SESSION_COOKIE, '', googleCookieOptions(req, 0));
  return res;
}

export function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GOOGLE_SESSION_COOKIE, '', googleCookieOptions(req, 0));
  return res;
}

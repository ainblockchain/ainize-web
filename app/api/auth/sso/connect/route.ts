/**
 * `POST /api/auth/sso/connect {choice: "legacy" | "new"}` — finish an AIN sign-in that had no link yet.
 *
 * `legacy`: the existing ainize.ai Google session in THIS browser is the proof (ADR-0004 `app_proof`, method
 * `legacy_session`); the node links that `google:<sub>` principal to the AIN account — refusing if it belongs to
 * another AIN account or is suspended — and the link is reported to AIN SSO, best effort. `new`: a fresh account.
 *
 * Same-origin only; the pending identity is the sealed cookie the callback left, never anything in the body.
 */
import { NextResponse, type NextRequest } from 'next/server';
import {
  NODE_SESSION_COOKIE, SSO_PENDING_COOKIE, SSO_SESSION_TTL_S, readAinSsoConfig, reportAppProof, ssoRedirectUri, unseal, type PendingPayload,
} from '@/lib/ainSso';
import { GOOGLE_SESSION_COOKIE, googleCookieOptions, readGoogleOAuthConfig, readGoogleSession } from '@/lib/googleOAuth';
import { legacyLoginMode } from '@/lib/legacyLogin';
import { NodeCallError, nodeSsoSignIn } from '@/lib/nodeCall';
import { ssoRefusalMessage } from '@/lib/ssoMessages';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const config = readAinSsoConfig();
  if (!config) return NextResponse.json({ error: 'AIN sign-in is not configured on this server' }, { status: 503 });
  const origin = new URL(ssoRedirectUri(req, config)).origin;
  // A cross-site form cannot get here with the Lax cookies anyway; this says so explicitly.
  const from = req.headers.get('origin');
  if (from ? from !== origin : req.headers.get('sec-fetch-site') !== 'same-origin') {
    return NextResponse.json({ error: 'cross_origin' }, { status: 403 });
  }
  const pending = unseal<PendingPayload>(req.cookies.get(SSO_PENDING_COOKIE)?.value, config, 'pending');
  if (!pending) return NextResponse.json({ error: 'no_pending_sign_in', message: 'the AIN sign-in expired — start again' }, { status: 400 });
  const { choice } = await req.json().catch(() => ({})) as { choice?: string };
  if (choice !== 'legacy' && choice !== 'new') return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  let link: { principal: string; method: 'legacy_session' } | null = null;
  if (choice === 'legacy') {
    const google = readGoogleOAuthConfig();
    const legacy = google ? readGoogleSession(req.cookies.get(GOOGLE_SESSION_COOKIE)?.value, google) : null;
    if (legacyLoginMode() === 'false' || !legacy) {
      return NextResponse.json({ error: 'no_legacy_session', message: 'sign in with your ainize.ai Google account in this browser first' }, { status: 400 });
    }
    link = { principal: `google:${legacy.sub}`, method: 'legacy_session' };
  }
  try {
    const result = await nodeSsoSignIn({ ...pending.identity, link, allowConnect: false, replaces: req.cookies.get(NODE_SESSION_COOKIE)?.value ?? null });
    if (result.status !== 'ok') return NextResponse.json({ error: 'needs_link' }, { status: 409 });
    if (result.linked) await reportAppProof(config, pending.identity.sub, result.linked);
    const res = NextResponse.json({ ok: true, next: pending.next, linked: result.linked });
    res.cookies.set(NODE_SESSION_COOKIE, result.token, googleCookieOptions(req, SSO_SESSION_TTL_S));
    res.cookies.set(SSO_PENDING_COOKIE, '', googleCookieOptions(req, 0));
    res.cookies.set(GOOGLE_SESSION_COOKIE, '', googleCookieOptions(req, 0));
    return res;
  } catch (e) {
    if (e instanceof NodeCallError) return NextResponse.json({ error: e.code, message: ssoRefusalMessage(e) }, { status: e.status >= 400 && e.status < 500 ? e.status : 502 });
    console.error('[ain-sso] connect failed', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

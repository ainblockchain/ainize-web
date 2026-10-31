/**
 * `POST /api/auth/sso/connect {choice, expected}` — finish the exact reviewed pending sign-in.
 *
 * `legacy`: the existing ainize.ai Google session in THIS browser is the proof (ADR-0004 `app_proof`, method
 * `legacy_session`); the node links that `google:<sub>` principal to the AIN account — refusing if it belongs to
 * another AIN account or is suspended — and the link is reported to AIN SSO, best effort. `new`: continue without
 * creating a legacy link (an existing mapping for this AIN account may still be used).
 *
 * Same-origin only; the pending identity is the sealed cookie the callback left, never anything in the body.
 */
import { NextResponse, type NextRequest } from 'next/server';
import {
  NODE_SESSION_COOKIE, SSO_PENDING_COOKIE, SSO_SESSION_TTL_S, readAinSsoConfig, reportAppProof, ssoRedirectUri,
} from '@/lib/ainSso';
import { GOOGLE_SESSION_COOKIE, googleCookieOptions } from '@/lib/googleOAuth';
import { NodeCallError, nodeSsoSignIn } from '@/lib/nodeCall';
import { ssoRefusalMessage } from '@/lib/ssoMessages';
import { ssoConnectionContext } from '@/lib/ssoConnectionServer';
import { readConnectionReview, sameConnectionReview } from '@/lib/ssoConnection';

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
  const context = ssoConnectionContext(req, config);
  if (!context) return NextResponse.json({ error: 'no_pending_sign_in', message: 'the pending AIN sign-in is unavailable — start again' }, { status: 400 });
  const body = await req.json().catch(() => null) as unknown;
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 2 || !('choice' in body) || !('expected' in body)) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const { choice } = body;
  const expected = readConnectionReview(body.expected);
  if ((choice !== 'legacy' && choice !== 'new') || !expected) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  if (!sameConnectionReview(expected, context.review)) return NextResponse.json({ error: 'connection_changed', message: 'The sign-in or account changed. Review the current accounts before connecting.' }, { status: 409 });
  const { pending, legacy } = context;

  let link: { principal: string; method: 'legacy_session' } | null = null;
  if (choice === 'legacy') {
    if (!legacy) {
      return NextResponse.json({ error: 'no_legacy_session', message: 'sign in with your ainize.ai Google account in this browser first' }, { status: 400 });
    }
    link = { principal: context.review.legacy!.principal, method: 'legacy_session' };
  }
  try {
    const result = await nodeSsoSignIn({ ...pending.identity, link, allowConnect: false, replaces: context.replaces });
    if (result?.status === 'needs_link') return NextResponse.json({ error: 'needs_link' }, { status: 409 });
    if (!result || result.status !== 'ok') return NextResponse.json({ error: 'unconfirmed_connection' }, { status: 502 });
    if (typeof result.token !== 'string' || !result.token || result.token.length > 200 || /[\s;]/.test(result.token)
      || !Number.isFinite(result.expiresAt) || result.expiresAt <= Date.now()
      || typeof result.principal !== 'string' || !(result.linked === null || typeof result.linked === 'string')
      || (link ? result.principal !== link.principal || result.linked !== null && result.linked !== link.principal
        : result.linked !== null || result.principal !== `sso:${pending.identity.sub}`.toLowerCase() && !/^google:[0-9a-z_-]{1,255}$/.test(result.principal))) {
      return NextResponse.json({ error: 'unconfirmed_connection' }, { status: 502 });
    }
    if (result.linked) await reportAppProof(config, pending.identity.sub, result.linked);
    const res = NextResponse.json({ ok: true, next: context.review.next, linked: result.linked,
      request: context.review.request, subject: pending.identity.sub, principal: result.principal }, { headers: { 'cache-control': 'no-store' } });
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

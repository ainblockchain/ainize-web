/**
 * `/api/auth/sso/callback` — where AIN SSO sends the browser back (src/lib/ainSso.ts).
 *
 * The verified identity goes to the node, which links it by (issuer, sub) and starts a session keyed by the OIDC
 * `sid`; the browser gets the node's session cookie. With no link yet and the legacy sign-in still allowed, the
 * person is first asked whether to connect their existing ainize.ai Google account (the pending identity waits,
 * sealed, in a 10-minute cookie). A failure lands on the sign-in page with the reason in `sso_error`.
 *
 * An automatic sign-in (`prompt=none`, src/lib/silentSso.ts) takes the same path when AIN SSO says who it is, with
 * two differences: nobody is stopped to be asked about connecting an old account (that is the explicit button's
 * question — linking otherwise happens once, at AIN SSO, through its legacy mappings and the attestations of the
 * Google sign-in here), and nothing that goes wrong is shown: `login_required` and the other "would need a page"
 * answers mean "not signed in", and any failure returns the visitor to their page, anonymous.
 */
import { NextResponse, type NextRequest } from 'next/server';
import {
  NODE_SESSION_COOKIE, SILENT_SIGN_IN_ERRORS, SSO_FLOW_COOKIE, SSO_PENDING_COOKIE, SSO_PENDING_TTL_S, SSO_SESSION_TTL_S, SsoFlowError, finishSsoFlow,
  readAinSsoConfig, sealPending, silentReturnOf, ssoRedirectUri, type SilentReturn,
} from '@/lib/ainSso';
import { GOOGLE_SESSION_COOKIE, googleCookieOptions, readGoogleOAuthConfig } from '@/lib/googleOAuth';
import { legacyLoginMode } from '@/lib/legacyLogin';
import { NodeCallError, nodeSsoSignIn } from '@/lib/nodeCall';
import { backToPage, noteSilentReturn } from '@/lib/silentSignIn';
import { ssoRefusalMessage } from '@/lib/ssoMessages';

export const dynamic = 'force-dynamic';

/** The page the visitor asked for, anonymous; a browser that keeps no cookies is marked in the URL instead. */
function quietly(req: NextRequest, silent: SilentReturn) {
  const res = backToPage(req, silent.next, silent.cookieless);
  if (silent.ownFlow) res.cookies.set(SSO_FLOW_COOKIE, '', googleCookieOptions(req, 0));
  return res;
}

export async function GET(req: NextRequest) {
  const config = readAinSsoConfig();
  const flowCookie = req.cookies.get(SSO_FLOW_COOKIE)?.value;
  const silent = config ? silentReturnOf(req, config, flowCookie) : null;
  if (!config) return NextResponse.json({ error: 'AIN sign-in is not configured on this server' }, { status: 503 });
  const origin = new URL(ssoRedirectUri(req, config)).origin;
  if (silent) {
    noteSilentReturn(req.nextUrl.searchParams.get('state'));
    const error = req.nextUrl.searchParams.get('error');
    if (error) {
      // login_required & co. are the everyday answer for a visitor with no AIN session; anything else is worth a line.
      if (!SILENT_SIGN_IN_ERRORS.has(error)) console.error(`[ain-sso] automatic sign-in answered ${/^[a-z_]{1,64}$/.test(error) ? error : 'an error'}`);
      return quietly(req, silent);
    }
  }
  const fail = (reason: string) => {
    const back = new URL('/signing', origin);
    back.searchParams.set('sso_error', reason);
    const res = NextResponse.redirect(back, 302);
    res.cookies.set(SSO_FLOW_COOKIE, '', googleCookieOptions(req, 0));
    return res;
  };
  try {
    const { identity, next } = await finishSsoFlow(req, config, flowCookie);
    // "Connect your existing account" is offered only while there can be one to connect: the legacy Google
    // sign-in exists here and LEGACY_LOGIN has not switched it off — and only to a person who pressed the button.
    const allowConnect = !silent && legacyLoginMode() !== 'false' && !!readGoogleOAuthConfig();
    const result = await nodeSsoSignIn({ ...identity, link: null, allowConnect, replaces: req.cookies.get(NODE_SESSION_COOKIE)?.value ?? null });
    if (result.status === 'needs_link') {
      const res = NextResponse.redirect(new URL(`/signing?sso=connect&next=${encodeURIComponent(next)}`, origin), 302);
      res.cookies.set(SSO_PENDING_COOKIE, sealPending(identity, next, config), googleCookieOptions(req, SSO_PENDING_TTL_S));
      res.cookies.set(SSO_FLOW_COOKIE, '', googleCookieOptions(req, 0));
      return res;
    }
    const res = NextResponse.redirect(new URL(next, origin), 302);
    res.cookies.set(NODE_SESSION_COOKIE, result.token, googleCookieOptions(req, SSO_SESSION_TTL_S));
    res.cookies.set(SSO_FLOW_COOKIE, '', googleCookieOptions(req, 0));
    // One way to be signed in at a time: the AIN session now speaks for the Google account if they are linked.
    res.cookies.set(GOOGLE_SESSION_COOKIE, '', googleCookieOptions(req, 0));
    if (silent) res.headers.set('cache-control', 'no-store');
    return res;
  } catch (e) {
    if (silent) {
      console.error('[ain-sso] automatic sign-in failed:', e instanceof SsoFlowError || e instanceof NodeCallError ? e.message : (e as Error).name);
      return quietly(req, silent);
    }
    if (e instanceof SsoFlowError) return fail(e.message);
    if (e instanceof NodeCallError) return fail(ssoRefusalMessage(e));
    console.error('[ain-sso] callback failed', e);
    return fail('AIN sign-in failed');
  }
}

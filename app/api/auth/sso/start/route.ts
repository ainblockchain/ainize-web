/** `/api/auth/sso/start?next=/path` — send the browser to AIN SSO (src/lib/ainSso.ts). */
import { NextResponse, type NextRequest } from 'next/server';
import { SSO_FLOW_COOKIE, SSO_FLOW_TTL_S, readAinSsoConfig, ssoRedirectUri, startSsoFlow } from '@/lib/ainSso';
import { googleCookieOptions } from '@/lib/googleOAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const config = readAinSsoConfig();
  if (!config) return NextResponse.json({ error: 'AIN sign-in is not configured on this server' }, { status: 503 });
  try {
    const { authorizeUrl, flowCookie } = await startSsoFlow(req, config, req.nextUrl.searchParams.get('next'));
    const res = NextResponse.redirect(authorizeUrl, 302);
    res.cookies.set(SSO_FLOW_COOKIE, flowCookie, googleCookieOptions(req, SSO_FLOW_TTL_S));
    return res;
  } catch (e) {
    // AIN SSO unreachable (discovery failed): back to the sign-in page with a reason, not a stack trace.
    console.error('[ain-sso] could not start a sign-in', e);
    const back = new URL('/signing', new URL(ssoRedirectUri(req, config)).origin);
    back.searchParams.set('sso_error', 'AIN SSO is not answering — try again, or sign in another way');
    return NextResponse.redirect(back, 302);
  }
}

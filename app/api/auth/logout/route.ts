/**
 * `POST /api/auth/logout` — relayed to the node as before (it ends the session and clears its cookie), and one thing
 * more: the browser is marked as checked (`ain_sso_checked`, 30 minutes), so the automatic sign-in
 * (src/lib/silentSso.ts) does not sign the person straight back in on the next page. An explicit "Log out" is an
 * answer; it holds at least for the rest of the visit. (For an AIN session the page then continues to AIN SSO's
 * sign-out, api/auth/sso/logout, which can end the AIN session itself.)
 */
import type { NextRequest } from 'next/server';
import { googleCookieOptions } from '@/lib/googleOAuth';
import { relayToNode } from '@/lib/proxy';
import { SSO_CHECKED_COOKIE, SSO_CHECKED_TTL_S } from '@/lib/silentSso';

export const dynamic = 'force-dynamic';

const cookieLine = (req: NextRequest) => {
  const o = googleCookieOptions(req, SSO_CHECKED_TTL_S);
  return `${SSO_CHECKED_COOKIE}=1; Path=${o.path}; Max-Age=${o.maxAge}; HttpOnly; SameSite=Lax${o.secure ? '; Secure' : ''}`;
};

export async function POST(req: NextRequest) {
  const res = await relayToNode(req, '/api/auth/logout');
  const headers = new Headers(res.headers);
  headers.append('set-cookie', cookieLine(req));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/**
 * `GET /api/auth/me` — relayed to the node as before, and one thing more: a session cookie the node no longer knows
 * (ended by a back-channel logout from AIN SSO, a suspension, a sign-out elsewhere) is cleared.
 *
 * It matters because of the automatic sign-in (src/lib/silentSso.ts), which leaves any browser holding a session
 * cookie alone: a dead one would keep the person signed out here for the rest of its 14 days, however often they
 * sign in to AIN elsewhere. Cleared only on the node's own word — a 200 that knows about AIN sessions (`sso` present)
 * and names neither an address nor an AIN account — never because the node could not be asked.
 */
import type { NextRequest } from 'next/server';
import { NODE_SESSION_COOKIE } from '@/lib/ainSso';
import { googleCookieOptions } from '@/lib/googleOAuth';
import { relayToNode } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const res = await relayToNode(req, '/api/auth/me');
  if (res.status !== 200 || !req.cookies.get(NODE_SESSION_COOKIE)?.value) return res;
  const text = await res.text();
  const headers = new Headers(res.headers);
  const me = ((): { signedIn?: unknown; sso?: unknown } | null => { try { return JSON.parse(text) as { signedIn?: unknown; sso?: unknown }; } catch { return null; } })();
  if (me && typeof me === 'object' && me.signedIn === false && 'sso' in me && me.sso === null) {
    const o = googleCookieOptions(req, 0);
    headers.append('set-cookie', `${NODE_SESSION_COOKIE}=; Path=${o.path}; Max-Age=0; HttpOnly; SameSite=Lax${o.secure ? '; Secure' : ''}`);
  }
  return new Response(text, { status: res.status, statusText: res.statusText, headers });
}

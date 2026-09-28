/**
 * Starting an automatic sign-in (silentSso.ts decides when): the answer to the page request itself — a redirect to
 * AIN SSO with `prompt=none`, or, whenever that cannot be done safely, a redirect back to the page. Used by the
 * middleware (Node.js runtime) for page requests and by `/api/auth/sso/start?prompt=none`.
 *
 * Server-side only.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { SSO_FLOW_COOKIE, SSO_FLOW_TTL_S, readAinSsoConfig, startSsoFlow, type AinSsoConfig } from './ainSso';
import { googleCookieOptions, safeGoogleNext } from './googleOAuth';
import { SSO_CHECKED_COOKIE, SSO_CHECKED_PARAM, SSO_CHECKED_TTL_S } from './silentSso';

// ------------------------------------------------------------------------------------------------ keeping it safe

/**
 * Automatic sign-in sends visitors to AIN SSO before they see the page they asked for, so AIN SSO being down — or
 * refusing this client — would put its error page in front of this site. Two guards keep that from happening:
 *
 * - AIN SSO must have answered its discovery document within the last minute (a quick, cached probe), or the visitor
 *   goes straight to the page;
 * - silent sign-ins that leave and never come back (an error page at AIN SSO has no way back) pause the feature
 *   for ten minutes: at least 20 sign-ins due back in the last ten minutes, fewer than one in five returned.
 *
 * The state lives on `globalThis`: the middleware and the route handlers are separate bundles in one process, and the
 * starts the middleware counts must meet the returns the callback counts.
 */
interface Guards {
  probe: { at: number; ok: boolean; pending: Promise<boolean> | null };
  starts: { at: number; state: string; back: boolean }[];
  pausedUntil: number;
}
const G: Guards = ((globalThis as { __ainizeSilentSignIn?: Guards }).__ainizeSilentSignIn ??= { probe: { at: 0, ok: false, pending: null }, starts: [], pausedUntil: 0 });
const BREAKER = { windowMs: 10 * 60_000, graceMs: 30_000, minSamples: 20, openMs: 10 * 60_000, max: 2_000 };

export async function ssoReachable(cfg: AinSsoConfig, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<boolean> {
  if (now - G.probe.at < 60_000) return G.probe.ok;
  if (G.probe.pending) return G.probe.pending;
  const url = new URL('.well-known/openid-configuration', cfg.issuer.endsWith('/') ? cfg.issuer : `${cfg.issuer}/`);
  const pending = fetchImpl(url, { signal: AbortSignal.timeout(1_500), redirect: 'error' })
    .then((res) => res.ok)
    .catch(() => false)
    .then((ok) => { G.probe.at = Date.now(); G.probe.ok = ok; G.probe.pending = null; return ok; });
  G.probe.pending = pending;
  return pending;
}

export function noteSilentStart(state: string, now = Date.now()): void {
  const s = G.starts;
  s.push({ at: now, state, back: false });
  while (s.length > BREAKER.max || (s[0] && now - s[0].at > BREAKER.windowMs)) s.shift();
}

export function noteSilentReturn(state: string | null): void {
  if (!state) return;
  for (let i = G.starts.length - 1; i >= 0; i--) if (G.starts[i]!.state === state) { G.starts[i]!.back = true; return; }
}

export function silentSignInPaused(now = Date.now()): boolean {
  if (now < G.pausedUntil) return true;
  const due = G.starts.filter((s) => now - s.at > BREAKER.graceMs && now - s.at <= BREAKER.windowMs);
  if (due.length >= BREAKER.minSamples && due.filter((s) => s.back).length * 5 < due.length) {
    G.pausedUntil = now + BREAKER.openMs;
    G.starts.length = 0;
    console.error(`[ain-sso] automatic sign-in paused for ${BREAKER.openMs / 60_000} minutes: ${due.length} browsers sent to AIN SSO, almost none came back`);
    return true;
  }
  return false;
}

/** Test seam. */
export function resetSilentSignInGuards(): void {
  G.starts.length = 0; G.pausedUntil = 0; G.probe.at = 0; G.probe.ok = false; G.probe.pending = null;
}

// ------------------------------------------------------------------------------------------------ the answer

/**
 * Back to the page, marked as checked: what every automatic sign-in that does not happen ends in. A relative
 * `Location` (RFC 9110 §10.2.2), so it cannot name the loopback address this server listens on behind the proxy.
 * `marker`: for a browser that kept no cookie, the URL says it instead (silentSso.ts honours it).
 */
export function backToPage(req: Request, next: string, marker = false): NextResponse {
  let location = safeGoogleNext(next);
  if (marker) location += `${location.includes('?') ? '&' : '?'}${SSO_CHECKED_PARAM}=1`;
  const res = new NextResponse(null, { status: 302, headers: { location, 'cache-control': 'no-store' } });
  res.cookies.set(SSO_CHECKED_COOKIE, '1', googleCookieOptions(req, SSO_CHECKED_TTL_S));
  return res;
}

/**
 * The redirect to AIN SSO with `prompt=none` for the page `next`, the flow sealed in its cookie and the browser marked
 * as checked on this very response (so it is never sent through AIN SSO twice in 30 minutes, whatever happens
 * there) — or back to the page when AIN sign-in is not configured, AIN SSO is not answering, or the feature is paused.
 */
export async function silentSignIn(req: NextRequest, next: string | null): Promise<NextResponse> {
  const config = readAinSsoConfig();
  if (!config || silentSignInPaused() || !(await ssoReachable(config))) return backToPage(req, next ?? '/');
  try {
    const { authorizeUrl, flowCookie, state } = await startSsoFlow(req, config, next, { prompt: 'none' });
    const res = NextResponse.redirect(authorizeUrl, 302);
    res.cookies.set(SSO_FLOW_COOKIE, flowCookie, googleCookieOptions(req, SSO_FLOW_TTL_S));
    res.cookies.set(SSO_CHECKED_COOKIE, '1', googleCookieOptions(req, SSO_CHECKED_TTL_S));
    res.headers.set('cache-control', 'no-store');
    noteSilentStart(state);
    return res;
  } catch (e) {
    console.error('[ain-sso] could not start an automatic sign-in:', (e as Error).message);
    return backToPage(req, next ?? '/');
  }
}

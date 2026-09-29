/**
 * Vouching to the node for a Google account this app signed in.
 *
 * API keys are the node's: it issues them, stores their hashes and checks them on every /v1 call. It proves who
 * is asking with its own session, which is a wallet signature. A Google account has no wallet, and the node
 * cannot check Google itself, so this app says it for the account, on the one hop the visitor never sees:
 *
 *   x-ainize-site-subject: google:<sub>.<issued-at seconds>.<hex HMAC-SHA256>
 *
 * signed with AINIZE_SITE_ASSERTION_SECRET, the same secret the node reads from `<AINIZE_HOME>/site-assertion.secret`.
 * The format and the rules live in ainize-node's src/site-assertion.ts; this is the signing half only.
 *
 * It carries on the routes where a Google account acts as itself: its API keys, its agents (hosted, linked and the
 * shared registry — it owns what it makes as `google:<sub>`, the way an AIN SSO account does), and `/api/auth/me`, so
 * a service calling through this app with the visitor's cookies (the ainize.ai/code gateway) learns who it is. Nothing
 * that a wallet signature guards — deposits, publishing, the node's operator routes — ever sees it; the node gives the
 * account no organization either. A wallet or AIN SSO session on the same request outranks it at the node.
 */
import { createHmac } from 'node:crypto';
import { GOOGLE_SESSION_COOKIE, readGoogleOAuthConfig, readGoogleSessionWithIat } from './googleOAuth';
import { legacyGoogleVerdict } from './legacyLogin';
import { siteAssertionSecret } from './siteSecret';

export const SITE_SUBJECT_HEADER = 'x-ainize-site-subject';
const LABEL = 'ainize-site-subject';

export function signSiteSubject(secret: string, subject: string, issuedAtS: number): string {
  const mac = createHmac('sha256', secret).update(`${LABEL}\n${subject}\n${issuedAtS}`).digest('hex');
  return `${subject}.${issuedAtS}.${mac}`;
}

export { siteAssertionSecret };

/** The path prefixes a Google account may act on through this app (each matches itself and `<prefix>/…`). */
const VOUCHED_PREFIXES = ['/api/keys', '/api/hosted-agents', '/api/linked-agents', '/api/shared-agents'] as const;

/** The paths a Google account may act on through this app. */
export function vouchesFor(path: string): boolean {
  if (path === '/api/auth/me') return true;
  return VOUCHED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

function cookieValue(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

/**
 * The header value to send for this request, or null.
 *
 * Null whenever any part is missing — no secret, no Google config, no valid Google cookie — so a deployment
 * that has not been set up behaves exactly as it did before, and the node answers 401 as it always has.
 *
 * Also null when the legacy Google sign-in may no longer act (legacyLogin.ts): switched off by `LEGACY_LOGIN`, an
 * account AIN SSO suspended or signed out everywhere, or — under `LEGACY_LOGIN=unlinked_only` — one that is linked
 * to an AIN account and must now sign in with it.
 */
export async function siteSubjectFor(req: Request, now = Date.now(), env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const secret = siteAssertionSecret(env);
  const config = readGoogleOAuthConfig(env);
  if (!secret || !config) return null;
  const session = readGoogleSessionWithIat(cookieValue(req, GOOGLE_SESSION_COOKIE), config, now);
  if (!session) return null;
  const verdict = await legacyGoogleVerdict(session, env, fetchImpl);
  return verdict.ok ? signSiteSubject(secret, `google:${session.identity.sub}`, Math.floor(now / 1000)) : null;
}

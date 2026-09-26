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
 * Only /api/keys carries it. Anything wider would make a Google sign-in stand for more than it was ever checked for.
 */
import { createHmac } from 'node:crypto';
import { GOOGLE_SESSION_COOKIE, readGoogleOAuthConfig, readGoogleSession } from './googleOAuth';

export const SITE_SUBJECT_HEADER = 'x-ainize-site-subject';
const LABEL = 'ainize-site-subject';

export function signSiteSubject(secret: string, subject: string, issuedAtS: number): string {
  const mac = createHmac('sha256', secret).update(`${LABEL}\n${subject}\n${issuedAtS}`).digest('hex');
  return `${subject}.${issuedAtS}.${mac}`;
}

export function siteAssertionSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const s = env.AINIZE_SITE_ASSERTION_SECRET?.trim();
  return s && s.length >= 32 ? s : null;
}

/** The paths a Google account may act on through this app. */
export function vouchesFor(path: string): boolean {
  return path === '/api/keys' || path.startsWith('/api/keys/');
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
 */
export function siteSubjectFor(req: Request, now = Date.now(), env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = siteAssertionSecret(env);
  const config = readGoogleOAuthConfig(env);
  if (!secret || !config) return null;
  const identity = readGoogleSession(cookieValue(req, GOOGLE_SESSION_COOKIE), config, now);
  return identity ? signSiteSubject(secret, `google:${identity.sub}`, Math.floor(now / 1000)) : null;
}

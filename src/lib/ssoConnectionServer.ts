import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NODE_SESSION_COOKIE, SSO_PENDING_COOKIE, unseal, type AinSsoConfig, type PendingPayload } from './ainSso';
import { GOOGLE_SESSION_COOKIE, readGoogleOAuthConfig, readGoogleSession } from './googleOAuth';
import { legacyLoginMode } from './legacyLogin';
import { readConnectionReview } from './ssoConnection';
import { safeReturnPath } from './uiNavigation';

/** Derive the review and authority from the same HttpOnly cookies; review fields never supply an identity. */
export function ssoConnectionContext(req: NextRequest, config: AinSsoConfig) {
  const names = [SSO_PENDING_COOKIE, GOOGLE_SESSION_COOKIE, NODE_SESSION_COOKIE];
  const parts = (req.headers.get('cookie') ?? '').split(';').map(value => value.trim());
  if (names.some(name => parts.filter(value => value.startsWith(name + '=')).length > 1)) return null;
  const cookie = req.cookies.get(SSO_PENDING_COOKIE)?.value;
  const pending = unseal<PendingPayload>(cookie, config, 'pending');
  if (!pending || pending.identity?.iss !== config.issuer) return null;
  const google = legacyLoginMode() !== 'false' ? readGoogleOAuthConfig() : null;
  const legacyCookie = req.cookies.get(GOOGLE_SESSION_COOKIE)?.value;
  const legacy = google ? readGoogleSession(legacyCookie, google) : null;
  const replaces = req.cookies.get(NODE_SESSION_COOKIE)?.value ?? null;
  const review = readConnectionReview({
    // A comparison ID only: it cannot authenticate a request without all the actual cookies.
    request: createHash('sha256').update(JSON.stringify(['sso-connect-v1', cookie, legacyCookie ?? null, replaces])).digest('hex'),
    issuer: pending.identity.iss, subject: pending.identity.sub, name: pending.identity.name, email: pending.identity.email,
    next: safeReturnPath(pending.next), expiresAt: pending.exp * 1000,
    legacy: legacy ? { principal: `google:${legacy.sub}`.toLowerCase(), email: legacy.email } : null,
  });
  return review ? { pending, legacy, replaces, review } : null;
}

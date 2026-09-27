/**
 * `/api/auth/sso/status` — whether this server offers AIN sign-in, how the legacy Google sign-in is switched
 * (`LEGACY_LOGIN`), and, during "connect your existing account", who is waiting and which Google account this
 * browser could connect. Who is signed in with AIN is the node's answer (`/api/auth/me` → `sso`), not this one.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { SSO_PENDING_COOKIE, readAinSsoConfig, unseal, type PendingPayload } from '@/lib/ainSso';
import { GOOGLE_SESSION_COOKIE, readGoogleOAuthConfig, readGoogleSession } from '@/lib/googleOAuth';
import { legacyLoginMode } from '@/lib/legacyLogin';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const config = readAinSsoConfig();
  const mode = legacyLoginMode();
  const pending = config ? unseal<PendingPayload>(req.cookies.get(SSO_PENDING_COOKIE)?.value, config, 'pending') : null;
  const google = mode !== 'false' ? readGoogleOAuthConfig() : null;
  const legacy = pending && google ? readGoogleSession(req.cookies.get(GOOGLE_SESSION_COOKIE)?.value, google) : null;
  return NextResponse.json({
    configured: !!config,
    legacyLogin: mode,
    pending: pending ? { name: pending.identity.name, email: pending.identity.email, next: pending.next, expiresAt: pending.exp * 1000 } : null,
    // Offered to connect only while an AIN sign-in is waiting for it.
    legacyGoogle: legacy ? { email: legacy.email } : null,
    legacyGoogleAvailable: !!google,
  }, { headers: { 'cache-control': 'no-store' } });
}

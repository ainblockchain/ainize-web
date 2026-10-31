/**
 * `/api/auth/sso/status` — whether this server offers AIN sign-in, how the legacy Google sign-in is switched
 * (`LEGACY_LOGIN`), and, during "connect your existing account", who is waiting and which Google account this
 * browser could connect. Who is signed in with AIN is the node's answer (`/api/auth/me` → `sso`), not this one.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { readAinSsoConfig } from '@/lib/ainSso';
import { readGoogleOAuthConfig } from '@/lib/googleOAuth';
import { legacyLoginMode } from '@/lib/legacyLogin';
import { ssoConnectionContext } from '@/lib/ssoConnectionServer';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const config = readAinSsoConfig();
  const mode = legacyLoginMode();
  const context = config ? ssoConnectionContext(req, config) : null;
  const pending = context?.pending;
  const google = mode !== 'false' ? readGoogleOAuthConfig() : null;
  const legacy = context?.legacy;
  return NextResponse.json({
    configured: !!config,
    connectionReview: context?.review ?? null,
    legacyLogin: mode,
    pending: pending ? { name: pending.identity.name, email: pending.identity.email, next: pending.next, expiresAt: pending.exp * 1000 } : null,
    // Offered to connect only while an AIN sign-in is waiting for it.
    legacyGoogle: legacy ? { email: legacy.email } : null,
    legacyGoogleAvailable: !!google,
  }, { headers: { 'cache-control': 'no-store' } });
}

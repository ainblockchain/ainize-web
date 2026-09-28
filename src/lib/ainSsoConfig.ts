/**
 * Whether AIN SSO is configured on this app — apart from ainSso.ts so that the middleware's per-request decision
 * (silentSso.ts) asks exactly the question the route handlers ask, without loading the OIDC client. Two answers would
 * be worse than none: a middleware that thought SSO was on while the routes thought it off would send visitors to a
 * route that answers 503.
 *
 * Server-side only: it reads the client secret.
 */
import { siteAssertionSecret } from './siteSecret';

export interface AinSsoConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** fixed callback URL, when the one derived from the request would be wrong (a proxy that rewrites Host) */
  redirectUri: string | null;
}

const isLoopback = (host: string) => host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
let warned = false;
const warnOnce = (message: string) => { if (!warned) { warned = true; console.error(`[ain-sso] ${message}`); } };

/**
 * Null — no "Continue with AIN" button, no route that does anything — unless `AIN_SSO_ISSUER`, `AIN_SSO_CLIENT_ID`
 * and `AIN_SSO_CLIENT_SECRET` are all set, and this app can speak to the node (`AINIZE_SITE_ASSERTION_SECRET`),
 * which is where the session lives.
 */
export function readAinSsoConfig(env: NodeJS.ProcessEnv = process.env): AinSsoConfig | null {
  const issuer = env.AIN_SSO_ISSUER?.trim();
  const clientId = env.AIN_SSO_CLIENT_ID?.trim();
  const clientSecret = env.AIN_SSO_CLIENT_SECRET?.trim();
  if (!issuer || !clientId || !clientSecret) return null;
  let url: URL;
  try { url = new URL(issuer); } catch { warnOnce('AIN_SSO_ISSUER is not a URL — AIN sign-in stays off'); return null; }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback(url.hostname))) { warnOnce('AIN_SSO_ISSUER must be https — AIN sign-in stays off'); return null; }
  if (!siteAssertionSecret(env)) { warnOnce('AINIZE_SITE_ASSERTION_SECRET is not set, and the node keeps the sessions — AIN sign-in stays off'); return null; }
  return { issuer, clientId, clientSecret, redirectUri: env.AIN_SSO_REDIRECT_URI?.trim() || null };
}

/**
 * Automatic sign-in (silent SSO, silentSso.ts) is on wherever AIN sign-in is, unless `AIN_SSO_SILENT_LOGIN` says
 * `false` — the switch that takes it away without taking the button away, e.g. while AIN SSO is having a bad day.
 */
export function silentSsoEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const off = env.AIN_SSO_SILENT_LOGIN?.trim().toLowerCase();
  if (off === 'false' || off === '0' || off === 'off' || off === 'no') return false;
  return readAinSsoConfig(env) !== null;
}

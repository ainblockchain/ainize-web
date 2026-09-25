/**
 * Google sign-in, done by this app rather than by the node.
 *
 * Every other identity here is a wallet and the node is its authority. A Google account is not something the node
 * knows how to check yet, so this app checks it and remembers the answer in its own cookie. That makes it a name,
 * not a permission: nothing here tells the node who you are, so a Google session opens no screen the node guards.
 * When the node learns to accept one, this is the half that hands it over.
 *
 * Server-side only — it holds the client secret and the key that signs the cookie. The flow is the plain
 * authorization-code one with PKCE and a nonce. The ID token comes straight from Google's token endpoint over TLS
 * in exchange for our secret, which is what lets its claims be read without fetching Google's keys
 * (OpenID Connect Core §3.1.3.7, step 6); the claims that matter are still checked one by one.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const GOOGLE_SESSION_COOKIE = 'ainize_google_session';
/** state, PKCE verifier, nonce and where to land — alive only for the round trip to Google */
export const GOOGLE_FLOW_COOKIE = 'ainize_google_flow';
export const GOOGLE_SESSION_TTL_S = 30 * 24 * 3600;
export const GOOGLE_FLOW_TTL_S = 10 * 60;

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  /** signs both cookies; rotating it signs everybody out, which is the point of rotating it */
  sessionSecret: string;
  /** fixed callback URL, when the one derived from the request would be wrong (a proxy that rewrites Host) */
  redirectUri: string | null;
}

/** Null when any of the three secrets is missing — the sign-in page then does not offer Google at all. */
export function readGoogleOAuthConfig(env: NodeJS.ProcessEnv = process.env): GoogleOAuthConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const sessionSecret = env.AINIZE_WEB_SESSION_SECRET?.trim();
  if (!clientId || !clientSecret || !sessionSecret) return null;
  return { clientId, clientSecret, sessionSecret, redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI?.trim() || null };
}

export interface GoogleIdentity {
  /** Google's stable account id — the email can change, this cannot */
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

interface GoogleSessionPayload extends GoogleIdentity { exp: number }
interface GoogleFlowPayload { state: string; verifier: string; nonce: string; next: string; exp: number }

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');

/** `<payload>.<hmac>`, both base64url. Not encrypted: it carries nothing a person does not already know about themselves. */
function signGoogleCookie(payload: object, secret: string): string {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${b64url(createHmac('sha256', secret).update(body).digest())}`;
}

function verifyGoogleCookie<T extends { exp: number }>(value: string | undefined, secret: string, now = Date.now()): T | null {
  if (!value) return null;
  const dot = value.indexOf('.');
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1), 'base64url');
  const want = createHmac('sha256', secret).update(body).digest();
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
    return typeof payload.exp === 'number' && payload.exp * 1000 > now ? payload : null;
  } catch { return null; }
}

/**
 * Where to land after Google, reduced to a path on this site.
 *
 * `next` arrives in a URL anyone can write, so an absolute URL, a protocol-relative `//evil.com` or a `/\evil.com`
 * that some browsers read the same way would make this sign-in page an open redirect.
 */
export function safeGoogleNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
}

/** The callback URL Google must send the browser back to — registered in the Google console exactly as this returns it. */
export function googleRedirectUri(req: Request, config: GoogleOAuthConfig): string {
  if (config.redirectUri) return config.redirectUri;
  const url = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || url.protocol.replace(':', '');
  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host') || url.host;
  return `${proto}://${host}/api/auth/google/callback`;
}

/** Step one: the Google URL to send the browser to, and the flow cookie that the callback will hold it to. */
export function startGoogleFlow(req: Request, config: GoogleOAuthConfig, next: string | null, now = Date.now()) {
  const flow: GoogleFlowPayload = {
    state: b64url(randomBytes(24)),
    verifier: b64url(randomBytes(32)),
    nonce: b64url(randomBytes(24)),
    next: safeGoogleNext(next),
    exp: Math.floor(now / 1000) + GOOGLE_FLOW_TTL_S,
  };
  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: googleRedirectUri(req, config),
    response_type: 'code',
    scope: 'openid email profile',
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: b64url(createHash('sha256').update(flow.verifier).digest()),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return { authorizeUrl: url.toString(), flowCookie: signGoogleCookie(flow, config.sessionSecret) };
}

export class GoogleOAuthError extends Error {}

/**
 * The claims of an ID token received directly from Google's token endpoint, checked.
 *
 * Exported apart from the exchange so the checks can be tested without a network.
 */
export function checkGoogleIdToken(idToken: string, config: GoogleOAuthConfig, nonce: string, now = Date.now()): GoogleIdentity {
  const part = idToken.split('.')[1];
  if (!part) throw new GoogleOAuthError('malformed id_token');
  let c: Record<string, unknown>;
  try { c = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>; } catch { throw new GoogleOAuthError('malformed id_token'); }
  if (!GOOGLE_ISSUERS.has(String(c.iss))) throw new GoogleOAuthError('id_token issuer is not Google');
  if (c.aud !== config.clientId) throw new GoogleOAuthError('id_token was issued to another client');
  if (typeof c.exp !== 'number' || c.exp * 1000 <= now) throw new GoogleOAuthError('id_token has expired');
  if (c.nonce !== nonce) throw new GoogleOAuthError('id_token nonce does not match this sign-in');
  // An unverified address is only a string somebody typed; showing it as who they are would be a lie.
  if (c.email_verified !== true || typeof c.email !== 'string') throw new GoogleOAuthError('Google account has no verified email');
  if (typeof c.sub !== 'string' || !c.sub) throw new GoogleOAuthError('id_token has no subject');
  return {
    sub: c.sub,
    email: c.email,
    name: typeof c.name === 'string' ? c.name : null,
    picture: typeof c.picture === 'string' ? c.picture : null,
  };
}

/** Step two: hold the callback to the flow it started, trade the code for an ID token, and mint the session cookie. */
export async function finishGoogleFlow(
  req: Request, config: GoogleOAuthConfig, flowCookie: string | undefined, fetchImpl: typeof fetch = fetch, now = Date.now(),
): Promise<{ identity: GoogleIdentity; sessionCookie: string; next: string }> {
  const url = new URL(req.url);
  const flow = verifyGoogleCookie<GoogleFlowPayload>(flowCookie, config.sessionSecret, now);
  if (!flow) throw new GoogleOAuthError('sign-in expired or was started in another browser — try again');
  const googleError = url.searchParams.get('error');
  if (googleError) throw new GoogleOAuthError(`Google refused: ${googleError}`);
  const state = url.searchParams.get('state');
  if (!state || state !== flow.state) throw new GoogleOAuthError('state does not match this sign-in');
  const code = url.searchParams.get('code');
  if (!code) throw new GoogleOAuthError('Google sent no code');

  const res = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: googleRedirectUri(req, config),
      grant_type: 'authorization_code',
      code_verifier: flow.verifier,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({})) as { id_token?: string; error?: string; error_description?: string };
  if (!res.ok || !body.id_token) throw new GoogleOAuthError(`token exchange failed: ${body.error_description ?? body.error ?? res.status}`);

  const identity = checkGoogleIdToken(body.id_token, config, flow.nonce, now);
  const session: GoogleSessionPayload = { ...identity, exp: Math.floor(now / 1000) + GOOGLE_SESSION_TTL_S };
  return { identity, sessionCookie: signGoogleCookie(session, config.sessionSecret), next: flow.next };
}

export function readGoogleSession(cookieValue: string | undefined, config: GoogleOAuthConfig, now = Date.now()): GoogleIdentity | null {
  const s = verifyGoogleCookie<GoogleSessionPayload>(cookieValue, config.sessionSecret, now);
  return s ? { sub: s.sub, email: s.email, name: s.name, picture: s.picture } : null;
}

/** Test seam: mint a session without a round trip to Google. */
export function mintGoogleSessionCookie(identity: GoogleIdentity, config: GoogleOAuthConfig, now = Date.now()): string {
  return signGoogleCookie({ ...identity, exp: Math.floor(now / 1000) + GOOGLE_SESSION_TTL_S }, config.sessionSecret);
}

/** `Secure` everywhere but plain-http localhost, where a browser would drop a Secure cookie and sign-in would silently fail. */
export function googleCookieOptions(req: Request, maxAge: number) {
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || new URL(req.url).protocol.replace(':', '');
  return { httpOnly: true, secure: proto === 'https', sameSite: 'lax' as const, path: '/', maxAge };
}

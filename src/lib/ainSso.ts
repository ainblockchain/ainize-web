/**
 * Sign-in with AIN SSO — an alternative to this app's Google sign-in, offered only when configured.
 *
 * This app is the OpenID Connect relying party: authorization code with PKCE (S256), `state` and `nonce`, the
 * pending values sealed in an encrypted HttpOnly cookie for the round trip, and the ID token validated in full —
 * signature against AIN SSO's JWKS, `iss`, `aud`, `exp`, `nonce` — by openid-client. What it does NOT do is keep a
 * session of its own: the node already has revocable, server-side sessions, so the verified identity is handed to
 * the node (nodeCall.ts) and the node's session cookie is what the browser gets. That is what lets a back-channel
 * logout or a suspension from AIN SSO end it: the node deletes the row (ainize-node docs/ain-sso.md).
 *
 * The node links the account by the verified (issuer, sub) — never by email. With no link yet, and when the legacy
 * Google sign-in is still allowed, the person may prove their existing ainize.ai Google account in this browser and
 * connect it (ADR-0004 `app_proof`); that link is reported to AIN SSO, best effort.
 *
 * Server-side only: it holds the client secret.
 */
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';
import * as oidc from 'openid-client';
import type { AinSsoConfig } from './ainSsoConfig';
import { safeGoogleNext } from './googleOAuth';

export const SSO_FLOW_COOKIE = 'ainize_sso_flow';
/** the verified identity waiting for "connect your existing account" or "continue" */
export const SSO_PENDING_COOKIE = 'ainize_sso_pending';
export const SSO_FLOW_TTL_S = 10 * 60;
export const SSO_PENDING_TTL_S = 10 * 60;
/** The node's session cookie — the one every relayed request already carries. */
export const NODE_SESSION_COOKIE = 'ainize_session';
/** Equal to the node's SSO_SESSION_TTL_MS (14 days, ADR-0005's absolute SSO session lifetime). */
export const SSO_SESSION_TTL_S = 14 * 24 * 3600;
export const SSO_SCOPE = 'openid profile email org';

export { readAinSsoConfig, silentSsoEnabled, type AinSsoConfig } from './ainSsoConfig';

export class SsoFlowError extends Error {}

// ------------------------------------------------------------------------------------------------ sealed cookies

/** AES-256-GCM under a key derived from the client secret, one key per purpose, the purpose also bound as AAD. */
function sealKey(cfg: AinSsoConfig, purpose: string): Buffer {
  return Buffer.from(hkdfSync('sha256', cfg.clientSecret, 'ainize-web/ain-sso', `cookie:${purpose}`, 32));
}

export function seal(payload: object, cfg: AinSsoConfig, purpose: 'flow' | 'pending'): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', sealKey(cfg, purpose), iv);
  cipher.setAAD(Buffer.from(purpose));
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64url');
}

export function unseal<T extends { exp: number }>(value: string | undefined, cfg: AinSsoConfig, purpose: 'flow' | 'pending', now = Date.now()): T | null {
  if (!value) return null;
  try {
    const raw = Buffer.from(value, 'base64url');
    if (raw.length < 12 + 16 + 2) return null;
    const decipher = createDecipheriv('aes-256-gcm', sealKey(cfg, purpose), raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(raw.subarray(raw.length - 16));
    const json = Buffer.concat([decipher.update(raw.subarray(12, raw.length - 16)), decipher.final()]).toString('utf8');
    const payload = JSON.parse(json) as T;
    return typeof payload.exp === 'number' && payload.exp * 1000 > now ? payload : null;
  } catch { return null; }
}

// ------------------------------------------------------------------------------------------------ the OIDC client

let discovered: { key: string; at: number; config: Promise<oidc.Configuration> } | null = null;

/** Discovery (`/.well-known/openid-configuration`), cached for an hour; a failure is not cached. */
export function ssoClient(cfg: AinSsoConfig): Promise<oidc.Configuration> {
  const key = `${cfg.issuer}\n${cfg.clientId}\n${createHash('sha256').update(cfg.clientSecret).digest('hex')}`;
  if (discovered && discovered.key === key && Date.now() - discovered.at < 3600_000) return discovered.config;
  const insecure = new URL(cfg.issuer).protocol === 'http:';
  // enableNonRepudiationChecks: the ID token from the token endpoint is verified against the JWKS as well, rather
  // than trusted for arriving over TLS.
  const execute: ((c: oidc.Configuration) => void)[] = [oidc.enableNonRepudiationChecks];
  if (insecure) execute.unshift(oidc.allowInsecureRequests);
  const config = oidc.discovery(new URL(cfg.issuer), cfg.clientId, undefined, oidc.ClientSecretBasic(cfg.clientSecret), { execute, timeout: 10 });
  discovered = { key, at: Date.now(), config };
  config.catch(() => { if (discovered?.config === config) discovered = null; });
  return config;
}

/** The callback URL registered at AIN SSO for this client — exactly as this returns it. */
export function ssoRedirectUri(req: Request, cfg: AinSsoConfig): string {
  if (cfg.redirectUri) return cfg.redirectUri;
  const url = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || url.protocol.replace(':', '');
  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host') || url.host;
  return `${proto}://${host}/api/auth/sso/callback`;
}

interface FlowPayload { state: string; nonce: string; verifier: string; redirectUri: string; next: string; exp: number; silent?: true }

/**
 * What the person asked for besides signing in. `prompt=none`: automatic sign-in (silentSso.ts) — AIN SSO answers
 * without showing anything. `prompt=create`: the sign-up page (OIDC Prompt Create 1.0). `idp=google`: straight to
 * Google (`ain_idp=google`) — AIN SSO skips its own sign-in page, or answers at once for a browser signed in there.
 */
export interface SsoStartOptions { prompt?: 'none' | 'create' | null; idp?: 'google' | null }

/** Only the values this app means; anything else in a hand-written URL is dropped rather than passed on. */
export function readSsoStartOptions(params: URLSearchParams): SsoStartOptions {
  const prompt = params.get('prompt');
  return { prompt: prompt === 'none' || prompt === 'create' ? prompt : null, idp: params.get('idp') === 'google' ? 'google' : null };
}

/**
 * A silent sign-in's `state` also says that it is silent, and where the visitor was going: `sn.<random>.<next>`.
 * It is the one thing that comes back from AIN SSO even to a browser that kept no cookie — so such a browser is
 * still returned quietly to its page instead of to a sign-in error it never asked for. It is never trusted for
 * more than that: the sign-in itself is held to the sealed cookie, as always.
 */
const SILENT_STATE = /^sn\.[A-Za-z0-9_-]{16,}(?:\.([A-Za-z0-9_-]{1,700}))?$/;
function silentState(next: string): string {
  const packed = Buffer.from(next, 'utf8').toString('base64url');
  return `sn.${oidc.randomState()}${packed.length <= 700 ? `.${packed}` : ''}`;
}

/** Step one: the AIN SSO authorization URL, and the sealed cookie the callback will be held to. */
export async function startSsoFlow(req: Request, cfg: AinSsoConfig, next: string | null, options: SsoStartOptions = {}, now = Date.now()) {
  const client = await ssoClient(cfg);
  const silent = options.prompt === 'none';
  // `prompt=create` only where AIN SSO says it supports it (OIDC Prompt Create: listed in prompt_values_supported);
  // anywhere else it would be refused, and the ordinary sign-in page, which also offers sign-up, is the better answer.
  const listed = client.serverMetadata().prompt_values_supported;
  const prompt = options.prompt === 'create' && !(Array.isArray(listed) && listed.includes('create')) ? null : options.prompt;
  const safeNext = safeGoogleNext(next);
  const flow: FlowPayload = {
    state: silent ? silentState(safeNext) : oidc.randomState(), nonce: oidc.randomNonce(), verifier: oidc.randomPKCECodeVerifier(),
    redirectUri: ssoRedirectUri(req, cfg), next: safeNext, exp: Math.floor(now / 1000) + SSO_FLOW_TTL_S, ...(silent ? { silent: true as const } : {}),
  };
  const url = oidc.buildAuthorizationUrl(client, {
    redirect_uri: flow.redirectUri,
    response_type: 'code',
    scope: SSO_SCOPE,
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: await oidc.calculatePKCECodeChallenge(flow.verifier),
    code_challenge_method: 'S256',
    ...(prompt ? { prompt } : {}),
    ...(options.idp ? { ain_idp: options.idp } : {}),
  });
  return { authorizeUrl: url.href, flowCookie: seal(flow, cfg, 'flow'), state: flow.state };
}

/**
 * Is the browser coming back from a silent sign-in, and to which page? From the sealed flow cookie when it is there
 * and belongs to this callback, else from the silent `state` (a browser that kept no cookie). Null: an ordinary
 * sign-in, which shows its errors as it always has.
 */
export interface SilentReturn {
  next: string;
  /** no flow cookie came back at all: this browser keeps none, so it is sent back with a marker instead */
  cookieless: boolean;
  /** the flow cookie is this sign-in's own (and may be spent), not another sign-in's in another tab */
  ownFlow: boolean;
}
export function silentReturnOf(req: Request, cfg: AinSsoConfig, flowCookie: string | undefined, now = Date.now()): SilentReturn | null {
  const state = new URL(req.url).searchParams.get('state') ?? '';
  const flow = unseal<FlowPayload>(flowCookie, cfg, 'flow', now);
  if (flow?.silent && (!state || state === flow.state)) return { next: flow.next, cookieless: false, ownFlow: true };
  const m = SILENT_STATE.exec(state);
  if (!m) return null;
  if (flow && flow.state === state) return { next: flow.next, cookieless: false, ownFlow: true };
  let next = '/';
  try { next = m[1] ? safeGoogleNext(Buffer.from(m[1], 'base64url').toString('utf8')) : '/'; } catch { next = '/'; }
  return { next, cookieless: !flowCookie, ownFlow: false };
}

/**
 * The answers AIN SSO gives a `prompt=none` request when it cannot sign the browser in without showing a page — no AIN
 * session, a consent or an account choice to make — or when the account may not use this app (`access_denied`). For a
 * silent sign-in they all mean "not signed in", not "something failed": the visitor stays anonymous, nothing is logged.
 */
export const SILENT_SIGN_IN_ERRORS = new Set(['login_required', 'interaction_required', 'consent_required', 'account_selection_required', 'access_denied']);

/** Who AIN SSO says signed in, after every check. */
export interface SsoIdentity {
  iss: string;
  sub: string;
  sid: string | null;
  name: string | null;
  email: string | null;
  orgs: { id: string; slug: string; name: string }[];
  activeOrg: string | null;
}

const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);

/** Scope `org`: `orgs[]` of `{id, slug, name, role, groups}`. Anything malformed is dropped, never guessed. */
function parseOrgs(v: unknown): SsoIdentity['orgs'] {
  if (!Array.isArray(v)) return [];
  const out: SsoIdentity['orgs'] = [];
  for (const o of v.slice(0, 50)) {
    const id = str((o as Record<string, unknown>)?.id, 200);
    if (!id) continue;
    out.push({ id, slug: str((o as Record<string, unknown>).slug, 200) ?? id, name: str((o as Record<string, unknown>).name, 200) ?? id });
  }
  return out;
}

/**
 * Step two: hold the callback to the flow this browser started (the sealed cookie, `state`), trade the code with
 * the PKCE verifier, and validate the ID token — signature via JWKS, `iss`, `aud`, `exp`, `nonce` (openid-client).
 */
export async function finishSsoFlow(req: Request, cfg: AinSsoConfig, flowCookie: string | undefined, now = Date.now()): Promise<{ identity: SsoIdentity; next: string }> {
  const flow = unseal<FlowPayload>(flowCookie, cfg, 'flow', now);
  if (!flow) throw new SsoFlowError('sign-in expired or was started in another browser — try again');
  const received = new URL(req.url);
  const refused = received.searchParams.get('error');
  if (refused) throw new SsoFlowError(refused === 'access_denied' ? 'AIN SSO did not grant this account access to ainize' : `AIN SSO refused: ${refused}`);
  // Checked before anything is sent anywhere: a swapped state is somebody else's code.
  if (received.searchParams.get('state') !== flow.state) throw new SsoFlowError('state does not match this sign-in');
  // Rebuilt on the registered redirect URI, so a Host header or a proxy cannot change what the token request says.
  const url = new URL(flow.redirectUri);
  for (const [k, v] of received.searchParams) url.searchParams.append(k, v);
  const client = await ssoClient(cfg);
  let tokens: Awaited<ReturnType<typeof oidc.authorizationCodeGrant>>;
  try {
    tokens = await oidc.authorizationCodeGrant(client, url, {
      pkceCodeVerifier: flow.verifier, expectedState: flow.state, expectedNonce: flow.nonce, idTokenExpected: true,
    });
  } catch (e) {
    if (e instanceof oidc.AuthorizationResponseError) throw new SsoFlowError(`AIN SSO refused: ${e.error}`);
    console.error('[ain-sso] code exchange or ID token validation failed', e);
    throw new SsoFlowError('the sign-in could not be verified — try again');
  }
  const claims = tokens.claims();
  const sub = str(claims?.sub, 255);
  if (!claims || !sub || !tokens.id_token) throw new SsoFlowError('the sign-in could not be verified — try again');
  const orgs = parseOrgs(claims.orgs);
  const active = str(claims.active_org, 200);
  return {
    identity: {
      iss: claims.iss, sub, sid: str(claims.sid, 500), name: str(claims.name, 200),
      // Contact data only, and only when AIN SSO says it is verified. Nothing is ever linked by it.
      email: claims.email_verified === true ? str(claims.email, 320) : null,
      orgs, activeOrg: active && orgs.some((o) => o.id === active) ? active : null,
    },
    next: flow.next,
  };
}

// ------------------------------------------------------------------------------------------------ connect

export interface PendingPayload { identity: SsoIdentity; next: string; exp: number }

export function sealPending(identity: SsoIdentity, next: string, cfg: AinSsoConfig, now = Date.now()): string {
  return seal({ identity, next, exp: Math.floor(now / 1000) + SSO_PENDING_TTL_S } satisfies PendingPayload, cfg, 'pending');
}

/**
 * Tell AIN SSO that this AIN account proved a legacy account here (`POST {issuer}/api/upstream/app-proof`,
 * client_secret_basic). Best effort: the link on the node is what this app goes by; a failure is only logged, and
 * AIN SSO learns it from the next proof or an administrator's import.
 */
export async function reportAppProof(cfg: AinSsoConfig, sub: string, legacyUserId: string, fetchImpl: typeof fetch = fetch): Promise<'reported' | 'rejected' | 'failed' | 'skipped'> {
  if (!/^acc_[0-9a-z]{26}$/.test(sub)) return 'skipped';
  const url = new URL('api/upstream/app-proof', cfg.issuer.endsWith('/') ? cfg.issuer : `${cfg.issuer}/`);
  const basic = Buffer.from(`${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.clientSecret)}`).toString('base64');
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { authorization: `Basic ${basic}`, 'content-type': 'application/json' },
      body: JSON.stringify({ sub, legacyUserId, method: 'legacy_session' }),
      signal: AbortSignal.timeout(5_000),
    });
    const body = await res.json().catch(() => ({})) as { rejected?: { code: string } };
    if (!res.ok) { console.error(`[ain-sso] app-proof report answered ${res.status}`); return 'failed'; }
    if (body.rejected) { console.error(`[ain-sso] AIN SSO did not record the link: ${body.rejected.code}`); return 'rejected'; }
    return 'reported';
  } catch (e) {
    console.error('[ain-sso] app-proof report failed', (e as Error).message);
    return 'failed';
  }
}

// ------------------------------------------------------------------------------------------------ attestation

/**
 * Tell AIN SSO that a legacy user just signed in here with this app's own Google login
 * (`POST {issuer}/api/upstream/app-attest`, shape B of ainetwork-ai/sso docs/specs/management-api.md §13.2):
 * `{legacyUserId, googleSub, legacyLoginAt}`. AIN SSO links that legacy user to the AIN account that has this Google
 * identity — at once when one exists, else on that identity's first sign-in through AIN SSO — and pushes
 * `legacyUserId` to the node's adapter, which links it (an account that holds nothing yet included).
 *
 * `legacyUserId` is `google:<sub>`: the principal the node keys a Google sign-in's API keys by, and the only legacy
 * shape the node's adapter links (ainize-node docs/ain-sso.md §3). `googleSub` is the `sub` of the Google ID token
 * this app verified at this login. Any email domain; no email is sent.
 *
 * Best effort and off the sign-in's path: the caller does not wait for it, a short timeout, one call per login, and
 * nothing but the status and error code is logged. 4xx other than 401/429 are normal answers ("nothing to do").
 */
export type AttestOutcome = 'linked' | 'pending' | 'refused' | 'failed' | 'skipped';
/** 4xx other than 401 (our credentials) and 429 (rate limit) mean "nothing to do" (management-api.md §13.2). */
const nothingToDo = (status: number) => status >= 400 && status < 500 && status !== 401 && status !== 429;

export async function attestLegacyGoogleLogin(
  cfg: AinSsoConfig, googleSub: string, loginAt = new Date(), fetchImpl: typeof fetch = fetch,
): Promise<AttestOutcome> {
  // A Google subject is at most 255 ASCII characters (OIDC Core §2); the node links `google:` + [0-9a-z_-] only.
  if (!/^[0-9A-Za-z_-]{1,193}$/.test(googleSub)) return 'skipped';
  const url = new URL('api/upstream/app-attest', cfg.issuer.endsWith('/') ? cfg.issuer : `${cfg.issuer}/`);
  const basic = Buffer.from(`${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.clientSecret)}`).toString('base64');
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { authorization: `Basic ${basic}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ legacyUserId: `google:${googleSub}`, googleSub, legacyLoginAt: loginAt.toISOString() }),
      redirect: 'error',
      signal: AbortSignal.timeout(5_000),
    });
    const body = await res.json().catch(() => ({})) as { status?: string; error?: string };
    const code = typeof body.error === 'string' && /^[a-z_]{1,64}$/.test(body.error) ? body.error : '';
    if (res.ok) return body.status === 'linked' ? 'linked' : 'pending';
    if (nothingToDo(res.status)) { console.debug(`[ain-sso] app-attest: ${res.status} ${code}`); return 'refused'; }
    console.error(`[ain-sso] app-attest answered ${res.status} ${code}`);
    return 'failed';
  } catch (e) {
    console.error('[ain-sso] app-attest failed:', (e as Error).name);
    return 'failed';
  }
}

// ------------------------------------------------------------------------------------------------ sign-out

/**
 * RP-initiated logout (OpenID Connect RP-Initiated Logout 1.0, ADR-0005 path 1): AIN SSO's end-session URL, which
 * asks the person whether to sign out of AIN in this browser and — if they do — ends the AIN session and, through
 * back-channel logout, their sessions in the other apps; then returns to this site. Null when AIN SSO has none.
 */
export async function ssoEndSessionUrl(req: Request, cfg: AinSsoConfig): Promise<string | null> {
  const client = await ssoClient(cfg);
  if (!client.serverMetadata().end_session_endpoint) return null;
  const origin = new URL(ssoRedirectUri(req, cfg)).origin;
  return oidc.buildEndSessionUrl(client, { post_logout_redirect_uri: `${origin}/` }).href;
}

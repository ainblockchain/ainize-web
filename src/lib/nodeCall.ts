/**
 * This app's own calls to the node — not relays of a visitor's request, but things this app asks as itself:
 * "this AIN SSO ID token checked out, start a session for it", "may this legacy Google session still act?".
 *
 * The node answers them only when they carry
 *
 *   x-ainize-site-call: <issued-at seconds>.<32 hex nonce>.<hex HMAC-SHA256>
 *
 * signed with the secret the two share (siteSecret.ts) over a label of its own, the method, the path, the time, a
 * nonce and the SHA-256 of the exact body. The format and the checks live in ainize-node's src/site-call.ts; this
 * is the signing half. The relay (proxy.ts) drops the header from everything a visitor sends.
 *
 * Server-side only.
 */
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { siteAssertionSecret } from './siteSecret';

export const SITE_CALL_HEADER = 'x-ainize-site-call';
const LABEL = 'ainize-site-call-v1';

export function signSiteCall(secret: string, method: string, path: string, issuedAtS: number, body: string, nonce = randomBytes(16).toString('hex')): string {
  const bodyHash = createHash('sha256').update(body).digest('hex');
  const mac = createHmac('sha256', secret).update(`${LABEL}\n${method.toUpperCase()}\n${path}\n${issuedAtS}\n${nonce}\n${bodyHash}`).digest('hex');
  return `${issuedAtS}.${nonce}.${mac}`;
}

/** A refusal from the node, with its code (`account_suspended`, `legacy_conflict`, …), or 0/`unreachable`. */
export class NodeCallError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'NodeCallError';
  }
}

const nodeUrl = (env: NodeJS.ProcessEnv) => (env.AINIZE_NODE_URL ?? 'http://127.0.0.1:3400').replace(/\/+$/, '');

export async function callNode<T>(path: string, body: unknown, env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): Promise<T> {
  const secret = siteAssertionSecret(env);
  if (!secret) throw new NodeCallError(0, 'no_site_secret', 'AINIZE_SITE_ASSERTION_SECRET is not set, so this app cannot speak for itself to the node');
  const raw = JSON.stringify(body);
  let res: Response;
  try {
    res = await fetchImpl(`${nodeUrl(env)}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [SITE_CALL_HEADER]: signSiteCall(secret, 'POST', path, Math.floor(Date.now() / 1000), raw) },
      body: raw,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    throw new NodeCallError(0, 'unreachable', `the node is not answering: ${(e as Error).message}`);
  }
  const json = await res.json().catch(() => ({})) as { error?: string; message?: string };
  if (!res.ok) throw new NodeCallError(res.status, json.error ?? `http_${res.status}`, json.message ?? json.error ?? `the node answered ${res.status}`);
  return json as T;
}

/** What the node knows about a legacy principal (`google:<sub>`): linked to an AIN account, suspended, signed out since. */
export interface PrincipalState { linked: boolean; blocked: boolean; notBefore: number | null }

export function nodePrincipalState(principal: string, env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): Promise<PrincipalState> {
  return callNode<PrincipalState>('/api/auth/sso/principal', { principal }, env, fetchImpl);
}

export interface NodeSsoSignIn {
  iss: string; sub: string; sid: string | null; name: string | null; email: string | null;
  orgs: { id: string; slug: string; name: string }[]; activeOrg: string | null;
  link: { principal: string; method: 'legacy_session' } | null;
  allowConnect: boolean;
  replaces: string | null;
}
export type NodeSsoSignInResult =
  | { status: 'needs_link' }
  | { status: 'ok'; token: string; principal: string; expiresAt: number; created: boolean; linked: string | null };

export function nodeSsoSignIn(body: NodeSsoSignIn, env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): Promise<NodeSsoSignInResult> {
  return callNode<NodeSsoSignInResult>('/api/auth/sso/session', body, env, fetchImpl);
}

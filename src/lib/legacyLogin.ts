/**
 * The legacy sign-in — this app's own Google login — once AIN SSO exists beside it.
 *
 * `LEGACY_LOGIN` is the migration switch of the AIN SSO rollout runbook (docs/runbooks/migration-rollback.md in
 * ainetwork-ai/sso):
 *
 *   true            (default) the Google button works for everyone, as it always has
 *   unlinked_only   only for Google accounts NOT linked to an AIN account; a linked one signs in with AIN
 *   false           off: no button, no callback, and existing Google cookies stop counting
 *
 * Wallet sign-in is not "legacy" and is not governed here: it is the node's own authority (a signature over a
 * nonce, personal to whoever holds the key), and AIN SSO never stands in for it.
 *
 * Independently of the switch, a Google session is refused when the node says AIN SSO suspended its account or
 * signed that account out everywhere after the cookie was minted. That check does not depend on AIN SSO being
 * configured HERE: turning SSO off on this app (a rollback) must never let a suspended person back in, so the
 * node — which keeps the suspension — is asked whenever this app can speak to it (siteSecret.ts).
 */
import { nodePrincipalState, NodeCallError } from './nodeCall';
import { siteAssertionSecret } from './siteSecret';

export type LegacyLoginMode = 'true' | 'unlinked_only' | 'false';

let warnedBadMode = false;
/** Unset or empty = `true`. Anything unrecognised fails closed (`false`) and says so once. */
export function legacyLoginMode(env: NodeJS.ProcessEnv = process.env): LegacyLoginMode {
  const v = env.LEGACY_LOGIN?.trim().toLowerCase();
  if (!v) return 'true';
  if (v === 'true' || v === 'unlinked_only' || v === 'false') return v;
  if (!warnedBadMode) { warnedBadMode = true; console.error(`[legacy-login] LEGACY_LOGIN=${env.LEGACY_LOGIN} is not true, unlinked_only or false — treating it as false`); }
  return 'false';
}

export type LegacyVerdict =
  | { ok: true }
  | { ok: false; reason: 'legacy_login_off' | 'linked_use_ain' | 'suspended' | 'signed_out' | 'node_unavailable' };

/** Is AIN SSO configured on this app? (Read here without importing ainSso.ts, which pulls in the OIDC client.) */
const ssoConfigured = (env: NodeJS.ProcessEnv) => !!(env.AIN_SSO_ISSUER?.trim() && env.AIN_SSO_CLIENT_ID?.trim() && env.AIN_SSO_CLIENT_SECRET?.trim());

/**
 * May this legacy Google session act right now? `iat` is when its cookie was minted (seconds).
 *
 * With everything at its defaults — `LEGACY_LOGIN` unset, AIN SSO not configured — an unreachable or older node
 * leaves the answer as it always was (yes); in every other configuration not knowing is a no.
 */
export async function legacyGoogleVerdict(
  session: { identity: { sub: string }; iat: number }, env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch,
): Promise<LegacyVerdict> {
  const mode = legacyLoginMode(env);
  if (mode === 'false') return { ok: false, reason: 'legacy_login_off' };
  const asBefore = mode === 'true' && !ssoConfigured(env);
  if (!siteAssertionSecret(env)) return asBefore ? { ok: true } : { ok: false, reason: 'node_unavailable' };
  let state;
  try {
    state = await nodePrincipalState(`google:${session.identity.sub}`, env, fetchImpl);
  } catch (e) {
    // 404: a node from before AIN SSO, which has no state to keep. Anything else: the node could not answer.
    if (!(e instanceof NodeCallError) || e.status === 0 || e.status === 404 || e.status >= 500) {
      if (!asBefore) console.error(`[legacy-login] could not ask the node about a Google session: ${(e as Error).message}`);
      return asBefore ? { ok: true } : { ok: false, reason: 'node_unavailable' };
    }
    return { ok: false, reason: 'node_unavailable' };
  }
  if (state.blocked) return { ok: false, reason: 'suspended' };
  if (state.notBefore && session.iat * 1000 < state.notBefore) return { ok: false, reason: 'signed_out' };
  if (mode === 'unlinked_only' && state.linked) return { ok: false, reason: 'linked_use_ain' };
  return { ok: true };
}

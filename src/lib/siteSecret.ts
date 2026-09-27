/**
 * The secret this app shares with the node in front of which it stands: `AINIZE_SITE_ASSERTION_SECRET` here, the
 * node's `<AINIZE_HOME>/site-assertion.secret` there. It signs two things, each under its own label so neither can
 * pass as the other: the per-request Google vouching on `/api/keys` (siteAssertion.ts), and this app's own calls to
 * the node for AIN SSO (nodeCall.ts). Shorter than 32 characters counts as no secret at all.
 */
export function siteAssertionSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const s = env.AINIZE_SITE_ASSERTION_SECRET?.trim();
  return s && s.length >= 32 ? s : null;
}

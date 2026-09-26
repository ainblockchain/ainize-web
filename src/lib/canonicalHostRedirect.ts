/**
 * One origin for the site: `www.<host>` answers with a permanent redirect to `<host>`.
 *
 * Both names were served side by side, and cookies belong to one host. A Google sign-in started on www stored its
 * flow cookie on www while Google returned to the apex (the one registered redirect URI) — which never saw the
 * cookie and failed; a session made on one name looked signed out on the other. Redirecting before anything else
 * runs means every cookie is set on, and read from, the same host.
 *
 * Pure, so the rule is tested without a server (test/canonical-host-redirect.test.ts); middleware.ts applies it.
 */
/**
 * Always https: a `www.` name is a public site, and the scheme the request reports cannot be trusted behind the
 * proxy — Next fills `x-forwarded-proto` with the loopback hop's `http` when nginx sends none, and a 308 to http
 * would be answered by another redirect that drops a POST's body.
 */
export function canonicalHostRedirect(host: string | null | undefined, pathAndQuery: string): string | null {
  const h = (host ?? '').trim().toLowerCase();
  if (!h.startsWith('www.')) return null;
  const apex = h.slice(4);
  // `www.localhost` or a bare `www.` is not a real site with an apex to go to.
  if (!apex.includes('.') || apex.startsWith('localhost')) return null;
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  return `https://${apex}${path}`;
}

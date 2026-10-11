/** A service mount is a directory: keep relative app assets inside it. */
export function serviceRootRedirect(url: string, method: string): string | null {
  if (method !== 'GET' && method !== 'HEAD') return null;
  const parsed = new URL(url);
  if (!/^\/svc\/[^/]+$/.test(parsed.pathname)) return null;
  parsed.pathname += '/';
  return parsed.pathname + parsed.search;
}

/** Relativize only this site's API routes, including its www alias. Preserve another node's destination. */
export function agentRequestUrl(value: string, origin: string): string {
  try {
    const url = new URL(value, origin);
    const here = new URL(origin);
    const sameSite = url.protocol === here.protocol && url.port === here.port
      && url.hostname.replace(/^www\./, '') === here.hostname.replace(/^www\./, '');
    return sameSite && /^\/(api|agents)\//.test(url.pathname) ? url.pathname + url.search : value;
  } catch { return value; }
}

/** Drop legacy cached 308s once, without touching sessions or local storage. */
export const SERVICE_CACHE_REVISION = 'mount-v2';
export function needsServiceCacheMigration(request: { method: string; pathname: string; accept: string; prefetch: boolean; revision?: string }): boolean {
  return request.method === 'GET' && request.accept.includes('text/html') && !request.prefetch
    && !/^\/(?:api|svc|_next)(?:\/|$)/.test(request.pathname)
    && request.revision !== SERVICE_CACHE_REVISION;
}

import type { LinkCtx } from './docsTree';

/** Only a published document and exact step identity cross the service boundary. */
export function practiceHref(ctx: LinkCtx, stepId?: string) {
  const params = new URLSearchParams({ doc: ctx.slug || 'index', lang: ctx.lang });
  if (stepId) params.set('step', stepId);
  return `/code/practice?${params}`;
}

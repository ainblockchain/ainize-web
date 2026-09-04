/**
 * The one place the markdown in `docs/` becomes something the web can render.
 *
 * `import.meta.glob(..., { query: '?raw', eager: true })` reaches outside the package root and inlines every page at
 * build time; in dev Vite rewrites the same glob to `/@fs/…` and serves the files off disk, because `server.fs.allow`
 * defaults to the npm-workspace root and `docs/` is inside it. Neither path needs a `vite.config.ts` change.
 *
 * This module is imported only from the `/docs` route, and `App.tsx` already `lazy()`-loads that route, so the
 * markdown lands in the docs chunk — a visitor who never opens `/docs` never downloads it.
 *
 * Budget: at ~18 pages of prose this is tens of KB gzipped. Past ~40 pages, switch to `eager: false` (one chunk per
 * page) and generate a headings index for search rather than letting the docs chunk grow unbounded.
 */
import { buildSite, type DocSite, type Lang, type Toctree } from '@/components/docs/docsTree';

const RAW = import.meta.glob(['../../../../../docs/en/**/*.md', '../../../../../docs/ko/**/*.md'], {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;

const TREES = import.meta.glob(['../../../../../docs/en/_toctree.json', '../../../../../docs/ko/_toctree.json'], {
  import: 'default', eager: true,
}) as Record<string, Toctree>;

/** `../../../../../docs/en/index.md` → `en/index.md` */
function under(key: string): string {
  const at = key.indexOf('/docs/');
  return at === -1 ? key : key.slice(at + '/docs/'.length);
}

/** every page keyed by its path under `docs/` — the shape `buildSite` and the tests both take */
export const SOURCES: Record<string, string> = Object.fromEntries(
  Object.entries(RAW).map(([key, text]) => [under(key), text]),
);

const toctrees: Record<Lang, Toctree> = { en: [], ko: [] };
for (const [key, tree] of Object.entries(TREES)) {
  toctrees[under(key).startsWith('ko/') ? 'ko' : 'en'] = tree;
}

export const SITES: Record<Lang, DocSite> = {
  en: buildSite('en', SOURCES, toctrees.en),
  ko: buildSite('ko', SOURCES, toctrees.ko),
};

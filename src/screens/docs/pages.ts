/**
 * The one place the markdown in `docs/` becomes something the web can render.
 *
 * `scripts/gen-inline.mjs` inlines every page from `docs/` into `generated.ts` at build time. It was a bundler
 * glob once; that glob reached five directories up into the monorepo, and when the packages were split it matched
 * nothing — the build stayed green and shipped an empty `/docs`. A discovery that finds no files is not an error,
 * so `docs-shell.test.ts` asserts the page count instead, and `npm run gen:check` fails on a stale file.
 *
 * This module is imported only from the `/docs` route, and `App.tsx` already `lazy()`-loads that route, so the
 * markdown lands in the docs chunk — a visitor who never opens `/docs` never downloads it.
 *
 * Budget: at ~18 pages of prose this is tens of KB gzipped. Past ~40 pages, switch to `eager: false` (one chunk per
 * page) and generate a headings index for search rather than letting the docs chunk grow unbounded.
 */
import { buildSite, type DocSite, type Lang, type Toctree } from '@/components/docs/docsTree';
import { SOURCES as RAW, TREES } from './generated';

/** every page keyed by its path under `docs/` — the shape `buildSite` and the tests both take */
export const SOURCES: Record<string, string> = RAW;

const toctrees: Record<Lang, Toctree> = { en: [], ko: [] };
for (const [key, tree] of Object.entries(TREES)) {
  toctrees[key.startsWith('ko/') ? 'ko' : 'en'] = tree as Toctree;
}

export const SITES: Record<Lang, DocSite> = {
  en: buildSite('en', SOURCES, toctrees.en),
  ko: buildSite('ko', SOURCES, toctrees.ko),
};

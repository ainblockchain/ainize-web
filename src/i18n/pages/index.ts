/**
 * Page dictionaries are auto-discovered: every `src/i18n/pages/*.ts` module (except this index) that exports one or
 * more `Dict` objects is merged here. Workstreams add their own file and never touch shared files.
 * Keys are namespaced by page: 'explore.title', 'patch.tab.overview', … Keep sentences plain-language (see glossary).
 */
import type { Dict } from '../index';
import { MODULES } from './generated';

// The discovery moved to `scripts/gen-inline.mjs` (see it for why) — adding a file here still needs no edit to
// any shared module, and `npm run gen:check` fails the build if the generated list is stale.
export const PAGES: Dict = MODULES.reduce<Dict>((acc, mod) => {
  for (const value of Object.values(mod)) {
    if (value && typeof value === 'object') Object.assign(acc, value);
  }
  return acc;
}, {});

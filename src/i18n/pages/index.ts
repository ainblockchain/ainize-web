/**
 * Page dictionaries are auto-discovered: every `src/i18n/pages/*.ts` module (except this index) that exports one or
 * more `Dict` objects is merged here. Workstreams add their own file and never touch shared files.
 * Keys are namespaced by page: 'explore.title', 'patch.tab.overview', … Keep sentences plain-language (see glossary).
 */
import type { Dict } from '../index';

const modules = import.meta.glob<Record<string, Dict>>(['./*.ts', '!./index.ts'], { eager: true });

export const PAGES: Dict = Object.values(modules).reduce<Dict>((acc, mod) => {
  for (const value of Object.values(mod)) {
    if (value && typeof value === 'object') Object.assign(acc, value);
  }
  return acc;
}, {});

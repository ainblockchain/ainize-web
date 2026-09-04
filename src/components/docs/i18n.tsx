/**
 * Inside `/docs`, the chrome speaks the language of the page, not the language of the app.
 *
 * `useT()` is bound to the reader's app locale, which is right everywhere else and wrong here: a Korean colleague
 * pastes `/docs/ko/get-started/install` to an English-locale reader, and that reader must get the Korean page with a
 * Korean sidebar, Korean previous/next and a Korean on-this-page rail — not a Korean body wrapped in English chrome,
 * and certainly not a silent redirect to the English page. So the docs language comes from the URL when the URL
 * names one, and everything the frame says is translated against that.
 *
 * It reads the same merged page dictionaries as `useT()` (`src/i18n/pages`), so `i18n/pages/docs.ts` stays the one
 * place the chrome's words are written.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { PAGES } from '@/i18n/pages';
import type { Lang } from './docsTree';

export type DocsT = (key: string, vars?: Record<string, string | number>) => string;

export function createDocsT(lang: Lang): DocsT {
  return (key, vars) => {
    const entry = PAGES[key];
    if (!entry) return key;
    const text = entry[lang] ?? entry.en;
    return vars ? text.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`)) : text;
  };
}

const Ctx = createContext<{ lang: Lang; t: DocsT }>({ lang: 'en', t: createDocsT('en') });

export function DocsLangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo(() => ({ lang, t: createDocsT(lang) }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDocsT() { return useContext(Ctx); }

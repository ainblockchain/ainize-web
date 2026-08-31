/**
 * Minimal i18n (no dependency): `useT()` returns a translator bound to the current locale (English default),
 * with `term(key)` / `help(key)` helpers backed by the plain-language glossary.
 * Page dictionaries live in ./pages/*.ts and are merged here so parallel workstreams never edit one file.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode, createElement } from 'react';
import { GLOSSARY, AUDIENCE, type TermKey } from './glossary';
import { PAGES } from './pages';

export type Locale = 'ko' | 'en';
export type Dict = Record<string, { ko: string; en: string }>;

const LocaleContext = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({ locale: 'ko', setLocale: () => undefined });
const KEY = 'ainize.locale';

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try { const v = localStorage.getItem(KEY); if (v === 'ko' || v === 'en') return v; } catch { /* ignore */ }
    return 'en';   // Ainize is English-first; Korean stays available via the toggle
  });
  const setLocale = useCallback((l: Locale) => { setLocaleState(l); try { localStorage.setItem(KEY, l); } catch { /* ignore */ } }, []);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return createElement(LocaleContext.Provider, { value }, children);
}

export function useLocale() { return useContext(LocaleContext); }

/** Interpolate {name} placeholders. */
function fmt(s: string, vars?: Record<string, string | number>): string {
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`)) : s;
}

export function useT() {
  const { locale } = useLocale();
  return useMemo(() => ({
    locale,
    /** page string: t('explore.title') */
    t: (key: string, vars?: Record<string, string | number>): string => {
      const e = PAGES[key];
      if (!e) return key;
      return fmt(e[locale] ?? e.en, vars);
    },
    /** glossary primary label */
    term: (k: TermKey): string => GLOSSARY[k][locale],
    /** glossary help sentence (for tooltips / hints) */
    help: (k: TermKey): string => (locale === 'ko' ? GLOSSARY[k].help_ko : GLOSSARY[k].help_en),
    /** technical name for developers (tooltip secondary line) */
    tech: (k: TermKey): string => GLOSSARY[k].tech,
    audience: (k: keyof typeof AUDIENCE) => ({ title: AUDIENCE[k][locale], help: locale === 'ko' ? AUDIENCE[k].help_ko : AUDIENCE[k].help_en }),
  }), [locale]);
}

export { GLOSSARY, AUDIENCE };

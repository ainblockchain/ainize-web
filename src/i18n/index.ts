/**
 * Minimal i18n (no dependency): `useT()` returns a translator bound to the current locale (English default),
 * with `term(key)` / `help(key)` helpers backed by the plain-language glossary.
 * Page dictionaries live in ./pages/*.ts and are merged here so parallel workstreams never edit one file.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode, createElement } from 'react';
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
  // index.html ships lang="en"; without this a page rendered entirely in Korean still declared itself English, so
  // screen readers read Hangul with an English voice and browsers offered to translate it into the language it is in.
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return createElement(LocaleContext.Provider, { value }, children);
}

export function useLocale() { return useContext(LocaleContext); }

/** Interpolate {name} placeholders. */
function fmt(s: string, vars?: Record<string, string | number>): string {
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`)) : s;
}

/**
 * Finding 88 — Korean particle alternates, resolved against the word they actually follow.
 *
 * Korean source strings are written in the usual dictionary convention: `{name}을(를)`, `{name}이(가)`,
 * `{filename}(으)로`. That convention is for a reader who picks the right half; a screen has to pick it. Before this,
 * every one of those pairs reached the visitor verbatim — the dataset preview said `messy.csv(으)로 저장했습니다`
 * on the screen where they decide whether to trust a permanent record.
 *
 * The choice is made by the last sound of the preceding word: a syllable with a final consonant (받침) takes 을 / 은 /
 * 이 / 과 / 으로, one without takes 를 / 는 / 가 / 와 / 로 — and a final ㄹ takes 로 like a vowel does. Filenames and
 * ids are not Hangul, so a digit is judged by how it is read aloud (1 일 has a 받침, 2 이 does not) and a Latin letter
 * by whether it ends in a vowel sound. Anything else is left exactly as written rather than guessed at.
 */
const PARTICLES: [RegExp, string, string][] = [
  [/을\(를\)/g, '을', '를'],
  [/를\(을\)/g, '을', '를'],
  [/은\(는\)/g, '은', '는'],
  [/는\(은\)/g, '은', '는'],
  [/이\(가\)/g, '이', '가'],
  [/가\(이\)/g, '이', '가'],
  [/와\(과\)/g, '과', '와'],
  [/과\(와\)/g, '과', '와'],
  [/\(으\)로/g, '으로', '로'],
];
/** Digits read aloud: 영 일 삼 육 칠 팔 end in a consonant; 이 사 오 구 do not. */
const DIGIT_FINAL: Record<string, boolean> = { '0': true, '1': true, '2': false, '3': true, '4': false, '5': false, '6': true, '7': true, '8': true, '9': false };
/** Latin letters are read by their Korean names: 엘 엠 엔 알 에스 엑스 제트 end in a consonant, 에이 비 씨 … do not. */
const LETTER_FINAL = 'lmnrsxz';
/** Does the word ending at `at` (exclusive) end in a final consonant? `null` when this text cannot be judged. */
function hasFinal(text: string, at: number): { final: boolean; rieul: boolean } | null {
  let i = at - 1;
  // a name is often quoted or bracketed — the particle follows the WORD, not the punctuation around it
  while (i >= 0 && '"\'’”)]}』」〉>.…·'.includes(text[i])) i--;
  if (i < 0) return null;
  const ch = text[i];
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) { const jong = (code - 0xac00) % 28; return { final: jong !== 0, rieul: jong === 8 }; }
  if (ch >= '0' && ch <= '9') return { final: DIGIT_FINAL[ch], rieul: ch === '1' || ch === '8' };
  if (/[a-zA-Z]/.test(ch)) { const low = ch.toLowerCase(); return { final: LETTER_FINAL.includes(low), rieul: low === 'l' || low === 'r' }; }
  return null;
}
export function josa(text: string): string {
  let out = text;
  for (const [re, withFinal, without] of PARTICLES) {
    out = out.replace(re, (m, offset: number) => {
      const f = hasFinal(out, offset);
      if (!f) return m;
      // 로 / 으로 is the one pair a final ㄹ joins the vowel side of
      if (withFinal === '으로' && f.rieul) return without;
      return f.final ? withFinal : without;
    });
  }
  return out;
}

export function useT() {
  const { locale } = useLocale();
  return useMemo(() => ({
    locale,
    /**
     * Page string: t('explore.title'). Pass `count` for a countable noun — when the dictionary carries a
     * `<key>_one` entry it is used for exactly one, so English never reads "1 corrections". Korean has no
     * plural marking, so a `_one` entry there is normally the same sentence.
     */
    t: (key: string, vars?: Record<string, string | number>, count?: number): string => {
      const e = (count === 1 ? PAGES[`${key}_one`] : undefined) ?? PAGES[key];
      if (!e) return key;
      const s = fmt(e[locale] ?? e.en, vars);
      return locale === 'ko' ? josa(s) : s;
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

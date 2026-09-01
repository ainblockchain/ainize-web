/**
 * Locale-aware time formatters (utils/format.elapsed / dateTime are English-only). Shared by the operator tab,
 * the Your-knowledge panel, the lesson card sheets and the data-provider page so Korean never reads "2m ago 만듦".
 */
import { useT } from '@/i18n';

export function useElapsed() {
  const { t } = useT();
  return (ts?: number | null): string => {
    if (!ts) return '—';
    const s = Math.floor(Math.max(0, Date.now() - ts) / 1000);
    if (s < 60) return t('op.time.s', { n: s });
    const m = Math.floor(s / 60);
    if (m < 60) return t('op.time.m', { n: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t('op.time.h', { n: h });
    const d = Math.floor(h / 24);
    if (d < 30) return t('op.time.d', { n: d });
    const mo = Math.floor(d / 30);
    if (mo < 12) return t('op.time.mo', { n: mo });
    return t('op.time.y', { n: Math.floor(mo / 12) });
  };
}

/** Locale-aware digit grouping — the teach UI must not hardcode 'en-US' the way utils/format does. */
export function useNumber() {
  const { locale } = useT();
  return (n: number): string => {
    try { return n.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US'); } catch { return String(n); }
  };
}

/** "2026. 8. 31. 오후 2:02" in Korean, "Aug 31, 2026, 2:02 PM" in English. */
export function useDateTime() {
  const { locale } = useT();
  return (ts?: number | string | null): string => {
    if (!ts) return '—';
    const d = new Date(typeof ts === 'string' ? Number(ts) || ts : ts);
    if (Number.isNaN(d.getTime())) return '—';
    try {
      return d.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch { return d.toISOString(); }
  };
}

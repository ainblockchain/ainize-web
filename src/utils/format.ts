export function shortAddr(addr?: string | null, n = 6): string {
  if (!addr) return '—';
  if (addr.length <= n * 2 + 2) return addr;
  return `${addr.slice(0, n + 2)}…${addr.slice(-4)}`;
}

export function shortHash(h?: string | null, n = 10): string {
  if (!h) return '—';
  return h.length > n ? `${h.slice(0, n)}…` : h;
}

export function bytes(n?: number | null): string {
  if (!n && n !== 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function num(n?: number | string | null): string {
  if (n === undefined || n === null || n === '') return '—';
  return Number(n).toLocaleString('en-US');
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "Aug. 31 2026, 14:02:11 +09:00" — ainize DateUtil style */
export function dateTime(ts?: number | string | null): string {
  if (!ts) return '—';
  const d = new Date(typeof ts === 'string' ? Number(ts) || ts : ts);
  if (Number.isNaN(d.getTime())) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${months[d.getMonth()]}. ${pad(d.getDate())} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}

export function timeOnly(ts?: number | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function elapsed(ts?: number | null): string {
  if (!ts) return '—';
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function price(amount?: string | number | null, currency = ''): string {
  if (amount === undefined || amount === null || amount === '') return '—';
  const n = Number(amount);
  const s = n === 0 ? 'Free' : `${n.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${currency}`.trim();
  return s;
}

export function scoreText(score: Record<string, string | number> | undefined): string {
  if (!score) return '—';
  const fg = score.free_generation ?? score.free_generation_vllm ?? score.chat_60;
  if (fg !== undefined) return String(fg);
  const first = Object.entries(score)[0];
  return first ? `${first[0]}: ${first[1]}` : '—';
}

/**
 * The baseline the same verifier measured BEFORE the knowledge was loaded (`pre_apply`, e.g. "1/8").
 *
 * Every attestation of every demo item carries it and nothing rendered it: "100%" alone cannot tell a buyer whether
 * the model already knew the answers. Returns null when the verifier did not report one, so the caller says so
 * instead of printing a zero it did not measure.
 */
export function preApplyText(score: Record<string, string | number> | undefined): string | null {
  const pre = score?.pre_apply ?? score?.pre_apply_vllm;
  return pre === undefined || pre === null || pre === '' ? null : String(pre);
}

/** The denominator of an "N/M" score ("26/26" → 26) — how many questions were actually put to the model. */
export function denominator(scoreStr: string | number | undefined): number | null {
  if (scoreStr === undefined) return null;
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(String(scoreStr));
  return m ? Number(m[2]) : null;
}

export function pct(scoreStr: string | number | undefined): number | null {
  if (scoreStr === undefined) return null;
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(String(scoreStr));
  if (!m) return null;
  const d = Number(m[2]);
  return d ? Math.round((Number(m[1]) / d) * 1000) / 10 : null;
}

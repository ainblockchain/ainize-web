import type { PurchaseResult, PatchQuote } from '../api/types';
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const amount = (v: unknown): v is string => typeof v === 'string' && /^\d+(?:\.\d+)?$/.test(v);
function totals(rows: { amount: string; currency: string; free?: boolean }[]) {
  const groups = new Map<string, string[]>();
  for (const r of rows) { if (!amount(r.amount) || !text(r.currency)) return null; if (!r.free) groups.set(r.currency, [...groups.get(r.currency) ?? [], r.amount]); }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).flatMap(([currency, values]) => {
    const scale = Math.max(...values.map(v => v.split('.')[1]?.length ?? 0));
    const n = values.reduce((sum, v) => { const [w, f = ''] = v.split('.'); return sum + BigInt(w + f.padEnd(scale, '0')); }, 0n);
    if (!n) return [];
    const digits = String(n).padStart(scale + 1, '0');
    return [{ currency, amount: scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, '') : digits }];
  });
}
const sameTotals = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function purchaseResult(raw: unknown, id: string, sha: string, node: string | null): PurchaseResult | null {
  const r = raw as any;
  if (!r || r.receipt_version !== 1 || !node || r.node !== node || r.patch_id !== id || r.manifest?.id !== id || r.manifest.patch_sha256 !== sha
    || !text(r.path) || !amount(r.amount) || typeof r.tx_hash !== 'string' || !text(r.scheme)
    || !Array.isArray(r.manifest.blob_urls) || !r.manifest.blob_urls.every(text)
    || !Array.isArray(r.steps) || !r.steps.every((s: any) => s && text(s.step) && typeof s.detail === 'string' && Number.isSafeInteger(s.at) && s.at >= 0 && s.at <= 8.64e15)
    || !Array.isArray(r.totals) || !r.totals.every((v: any) => v && amount(v.amount) && text(v.currency))
    || new Set(r.totals.map((v: any) => v.currency)).size !== r.totals.length
    || r.redeemed != null && typeof r.redeemed !== 'boolean') return null;
  let rows: { amount: string; currency: string; free?: boolean }[];
  if (r.purchases !== undefined) {
    if (!Array.isArray(r.purchases) || !r.purchases.every((p: any) => p && text(p.patch_id) && amount(p.amount) && text(p.currency)
      && text(p.scheme) && typeof p.tx_hash === 'string' && (p.free == null || typeof p.free === 'boolean'))
      || new Set(r.purchases.map((p: any) => p.patch_id)).size !== r.purchases.length
      || !r.redeemed && !r.purchases.some((p: any) => p.patch_id === id)) return null;
    rows = r.purchases;
    const root = r.purchases.find((p: any) => p.patch_id === id);
    if (root && (root.amount !== r.amount || root.currency !== r.currency || root.scheme !== r.scheme || root.tx_hash !== r.tx_hash)) return null;
  } else rows = r.redeemed ? [] : [{ amount: r.amount, currency: r.currency }];
  const expected = totals(rows), reported = totals(r.totals);
  if (!expected || !reported || !sameTotals(expected, reported) || r.redeemed && reported.length) return null;
  if (r.total !== undefined && (!amount(r.total) || !sameTotals(totals([{ amount: r.total, currency: r.currency || 'unknown' }]), reported))) return null;
  return { ...r, totals: reported };
}
export function purchaseQuoteTotals(quote: PatchQuote | null | undefined): string | null {
  if (!quote || !amount(quote.price) || !text(quote.currency) || !Array.isArray(quote.requires)
    || !Array.isArray(quote.unknown) || quote.unknown.length
    || !quote.requires.every(r => r && text(r.id) && r.known === true && typeof r.licensed === 'boolean' && typeof r.mine === 'boolean')
    || new Set(quote.requires.map(r => r.id)).size !== quote.requires.length) return null;
  const rows = [{ amount: quote.price, currency: quote.currency }, ...quote.requires.filter(r => !r.licensed && !r.mine).map(r => ({ amount: r.price!, currency: r.currency }))];
  const expected = totals(rows);
  if (!expected) return null;
  if (quote.totals && (!Array.isArray(quote.totals) || !quote.totals.every(r => r && amount(r.amount) && text(r.currency)) || !sameTotals(expected, totals(quote.totals)))) return null;
  return expected.map(r => `${r.amount} ${r.currency}`).join(' + ') || '0';
}

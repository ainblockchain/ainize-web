/**
 * Plain-language formatters shared by the detail pages (PatchPage, LedgerPage, NetworkPage).
 * Everything user-visible goes through the `detail.*` dictionary so Korean/English stay in sync.
 */
import { useMemo } from 'react';
import type { LedgerRecord } from '@/api/types';
import { useT } from '@/i18n';
import { num, shortAddr, shortHash } from '@/utils/format';

/** An attestation counts toward 검증 완료 only when the verifier actually ran the model ('vllm' / 'hook'); 'hash-only' is integrity only. */
export const isExecuted = (verifiedOn?: string) => !!verifiedOn && verifiedOn !== 'hash-only';

export function useDetailFormat() {
  const { t, term, locale } = useT();
  return useMemo(() => {
    /** "5분 전" / "5m ago" */
    const ago = (ts?: number | null): string => {
      if (!ts) return '—';
      const s = Math.floor(Math.max(0, Date.now() - ts) / 1000);
      if (s < 60) return t('detail.ago.s', { n: s });
      const m = Math.floor(s / 60);
      if (m < 60) return t('detail.ago.m', { n: m });
      const h = Math.floor(m / 60);
      if (h < 24) return t('detail.ago.h', { n: h });
      const d = Math.floor(h / 24);
      if (d < 30) return t('detail.ago.d', { n: d });
      const mo = Math.floor(d / 30);
      if (mo < 12) return t('detail.ago.mo', { n: mo });
      return t('detail.ago.y', { n: Math.floor(mo / 12) });
    };
    /** "5 AIN" / "5 노드 크레딧" / "무료" — never a bare currency code the reader has to guess. */
    const priceLabel = (amount?: string | number | null, currency = ''): string => {
      if (amount === undefined || amount === null || amount === '') return '—';
      const n = Number(amount);
      if (n === 0) return t('common.free');
      const unit = currency === 'CREDIT' ? term('credit') : currency;
      return `${n.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${unit}`.trim();
    };
    /** Earned amounts (revenue): a zero reads "0 AIN", never "Free" — that word belongs to prices. */
    const revenueLabel = (amount?: string | number | null, currency = ''): string => {
      const n = Number(amount ?? 0);
      const unit = currency === 'CREDIT' ? term('credit') : currency;
      return !Number.isFinite(n) || n <= 0 ? `0 ${unit}`.trim() : priceLabel(n, currency);
    };
    /** One-line note explaining what the currency is. */
    const priceNote = (currency?: string): string => (currency === 'CREDIT' ? t('price.credit_note') : currency === 'AIN' ? t('price.ain_note') : '');
    const kindLabel = (kind: string): string => { const k = t(`detail.kind.${kind}`); return k === `detail.kind.${kind}` ? kind : k; };
    const howLabel = (verifiedOn?: string): string => (verifiedOn && verifiedOn !== 'hash-only' ? t('detail.how.executed') : t('detail.how.integrity'));
    const roleLabel = (role: string): string => { const k = t(`detail.role.${role}`); return k === `detail.role.${role}` ? role : k; };
    const billingLabel = (billing: string): string => { const k = t(`detail.billing.${billing}`); return k === `detail.billing.${billing}` ? billing : k; };
    const who = (addr: unknown, name?: unknown): string => (typeof name === 'string' && name ? name : shortAddr(String(addr ?? '')));

    /** One plain sentence per public-record entry. */
    const recordSummary = (r: LedgerRecord, opts?: { withHash?: boolean }): string => {
      const b = (r.body ?? {}) as Record<string, unknown>;
      switch (r.kind) {
        case 'anchor':
          return opts?.withHash
            ? t('detail.rec.anchor_hash', { id: String(b.id), hash: shortHash(String(b.patch_sha256)) })
            : t('detail.rec.anchor', { id: String(b.id), name: String(b.name ?? '') });
        case 'attest':
          return t(b.passed === false ? 'detail.rec.attest_fail' : 'detail.rec.attest_pass', { id: String(b.patch_id ?? b.id), verifier: who(b.verifier, b.verifier_name), how: howLabel(typeof b.verified_on === 'string' ? b.verified_on : undefined) });
        case 'settle':
          return t('detail.rec.settle', { id: String(b.patch_id ?? b.resource), amount: priceLabel(String(b.amount), String(b.currency ?? '')), buyer: shortAddr(String(b.buyer)) });
        case 'supersede':
          return t('detail.rec.supersede', { new_id: String(b.new_patch_id), old_id: String(b.old_patch_id), n: num(Number(b.overlap_rows ?? 0)) });
        case 'challenge':
          return t('detail.rec.challenge', { id: String(b.patch_id ?? ''), who: shortAddr(String(b.challenger)), reason: String(b.reason ?? '') });
        case 'branch':
          return t('detail.rec.branch', { name: String(b.name), n: (b.patch_ids as string[] | undefined)?.length ?? 0 });
        case 'subscribe':
          return t(b.action === 'unsubscribe' ? 'detail.rec.unsubscribe' : 'detail.rec.subscribe', { node: shortAddr(String(b.node)), branch: String(b.branch) });
        case 'node':
          return t('detail.rec.node', { name: String(b.name), endpoint: String(b.endpoint), roles: ((b.roles as string[] | undefined) ?? []).map(roleLabel).join(', ') || '—' });
        default:
          return kindLabel(r.kind);
      }
    };
    return { ago, priceLabel, revenueLabel, priceNote, kindLabel, howLabel, roleLabel, billingLabel, recordSummary, locale };
  }, [t, term, locale]);
}

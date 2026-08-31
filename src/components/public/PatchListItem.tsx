import { Link } from 'react-router';
import styled from 'styled-components';
import type { CatalogEntry } from '@/api/types';
import { Certified, StatusChip } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { bytes, num, pct, shortAddr } from '@/utils/format';

/* ------------------------------------------------------------------ shared helpers (used by landing / explore / benchmark) */

/**
 * Accuracy is shown ONLY when an executed (non hash-only) passing attestation exists.
 * Returns null otherwise — callers must not print a number in that case.
 */
export function executedAccuracy(entry: CatalogEntry): { pct: number; raw: string } | null {
  const executed = entry.attestations.filter((a) => a.passed && a.verified_on !== 'hash-only');
  if (!executed.length) return null;
  const s = executed[executed.length - 1].score;
  const raw = s?.free_generation ?? s?.free_generation_vllm ?? s?.chat_60;
  if (raw === undefined) return null;
  const p = pct(raw);
  if (p === null) return null;
  return { pct: p, raw: String(raw) };
}

/** "25 AIN" / "3 노드 크레딧" / "무료" + a one-line note explaining the unit. Never a bare "2.5 CREDIT". */
export function usePriceLabel() {
  const { t } = useT();
  return (amount?: string | number | null, currency?: string | null): { text: string; note: string } => {
    if (amount === undefined || amount === null || amount === '') return { text: '—', note: '' };
    const n = Number(amount);
    if (!Number.isFinite(n)) return { text: String(amount), note: '' };
    if (n === 0) return { text: t('item.price_free'), note: '' };
    const f = n.toLocaleString('en-US', { maximumFractionDigits: 6 });
    switch (currency) {
      case 'AIN': return { text: t('item.price_ain', { n: f }), note: t('price.ain_note') };
      case 'CREDIT': return { text: t('item.price_credit', { n: f }), note: t('price.credit_note') };
      case 'USDC': return { text: t('item.price_usdc', { n: f }), note: t('item.price_note_usdc') };
      default: return { text: `${f} ${currency ?? ''}`.trim(), note: '' };
    }
  };
}

/** "검증 완료 (독립 검증 N/M)" or "검증 중 (독립 검증 N/M)". */
export function useVerificationLabel() {
  const { t } = useT();
  return (entry: CatalogEntry): string =>
    t(entry.quorum_ok ? 'item.verified_by' : 'item.verifying_by', { passed: entry.passed, quorum: entry.quorum });
}

/* ------------------------------------------------------------------ list item */

const Wrapper = styled(Link)`
  padding: 16px 32px;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 16px;
  background-color: ${(p) => p.theme.color.WHITE};
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  text-decoration: none;
  transition: box-shadow 0.4s ease;
  box-shadow: 0 0 0 rgba(0, 0, 0, 0.3);
  &:not(:last-child) { margin-bottom: 16px; }
  &:hover {
    box-shadow: 0 2px 6px 0 #e0e4e7, inset -1px 0 0 0 rgba(224, 227, 231, 0.3), inset 0 -1px 0 0 #e0e4e7, inset 1px 0 0 0 rgba(224, 227, 231, 0.2);
  }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: 16px; }
`;

const Icon = styled.img`
  width: 56px; height: 56px; flex: none; object-fit: contain;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { width: 40px; height: 40px; }
`;

const Info = styled.div`
  display: flex; flex-direction: column; align-items: flex-start; min-width: 0; flex: 1;
`;

const NameRow = styled.div`
  display: flex; flex-direction: row; align-items: center; flex-wrap: wrap; gap: 8px;
`;

const Name = styled.div`
  font-size: 16px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; word-break: keep-all;
`;

const Ident = styled.div`
  margin-top: 4px; font-family: ${(p) => p.theme.font.mono}; font-size: 12px; color: ${(p) => p.theme.color.GREY}; word-break: break-all;
`;

const Meta = styled.div<{ $mt?: number }>`
  margin-top: ${(p) => p.$mt ?? 8}px; font-size: 12px; color: ${(p) => p.theme.color.BLACK}; line-height: 1.6;
  b { font-weight: 500; color: ${(p) => p.theme.color.GREY}; }
  abbr { text-decoration: none; border-bottom: 1px dotted ${(p) => p.theme.color.LIGHT_GREY}; cursor: help; }
`;

const Good = styled.span`color: ${(p) => p.theme.color.SUCCESS}; font-weight: 600;`;
const Soft = styled.span`color: ${(p) => p.theme.color.GREY};`;

const Desc = styled.div`
  margin-top: 16px; font-size: 14px; line-height: 1.5; color: ${(p) => p.theme.color.BLACK};
  overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
`;

const PriceCol = styled.div`
  flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; max-width: 200px; text-align: right;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { display: none; }
`;
const Price = styled.div`font-size: 16px; font-weight: 700; color: ${(p) => p.theme.color.PRIMARY}; white-space: nowrap;`;
const PriceNote = styled.div`font-size: 11px; line-height: 1.4; color: ${(p) => p.theme.color.GREY};`;

export function PatchListItem({ entry, currency }: { entry: CatalogEntry; currency?: string }) {
  const { t, term, help, tech } = useT();
  const priceLabel = usePriceLabel();
  const verification = useVerificationLabel();
  const a = entry.anchor;
  const acc = executedAccuracy(entry);
  const p = priceLabel(a.price, a.currency ?? currency);
  const author = a.author_name ?? shortAddr(a.author);

  return (
    <Wrapper to={`/${encodeURIComponent(a.author)}/${encodeURIComponent(a.id)}`}>
      <Icon src="/static/images/ic-certified.svg" alt="" />
      <Info>
        <NameRow>
          <Name>{a.name || a.id}</Name>
          {entry.quorum_ok && <Certified label={term('verified')} />}
          <StatusChip status={entry.status} />
        </NameRow>
        <Ident>{author} / {a.id}</Ident>

        <Meta $mt={12}>
          <b>{t('common.author')}:</b> {author} · <b>{t('common.model')}:</b> {a.model.id_M}
          {' · '}<b>{t('item.topic')}:</b> <abbr title={t('explore.filter.schema_help')}>{a.benchmark.schema}</abbr>
        </Meta>
        <Meta>
          <abbr title={`${help('facts')} (${tech('facts')})`}>{t('units.facts', { n: num(a.benchmark.queries) })}</abbr>
          {' · '}<abbr title={`${help('rows')} (${tech('rows')})`}>{t('units.rows', { n: num(a.rows) })}</abbr>
          {' · '}{t('item.size', { size: bytes(a.size_bytes) })}
          {' · '}{t('item.downloads', { n: num(entry.downloads) })}
        </Meta>
        <Meta>
          <abbr title={`${help('verified')} (${tech('verified')})`}>{entry.quorum_ok ? <Good>{verification(entry)}</Good> : verification(entry)}</abbr>
          {entry.integrity_checks > 0 && <>{' · '}<Soft><abbr title={t('item.integrity_help')}>{t('item.integrity_only', { n: entry.integrity_checks })}</abbr></Soft></>}
          {acc && <>{' · '}<abbr title={`${t('item.accuracy_raw', { raw: acc.raw })} — ${help('accuracy')}`}><Good>{t('item.accuracy', { pct: acc.pct })}</Good></abbr></>}
        </Meta>
        {a.description && <Desc>{a.description}</Desc>}
      </Info>
      <PriceCol>
        <Price>{p.text}</Price>
        {p.note && <PriceNote>{p.note}</PriceNote>}
      </PriceCol>
    </Wrapper>
  );
}

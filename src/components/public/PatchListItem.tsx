import { Link, useNavigate } from 'react-router';
import styled, { css, keyframes } from 'styled-components';
import type { CatalogEntry } from '@/api/types';
import { Certified, StatusChip } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { bytes, denominator, num, pct, shortAddr } from '@/utils/format';

/* ------------------------------------------------------------------ shared helpers (used by landing / explore / benchmark) */

/**
 * Accuracy is shown ONLY when an executed (non hash-only) passing attestation exists.
 * Returns null otherwise — callers must not print a number in that case.
 *
 * `tested` is the attestation's OWN denominator (the 26 of "26/26"), which is the only denominator this percentage
 * was ever measured against. The anchor's benchmark.queries (2,761) is what the knowledge claims to cover, not what
 * the verifiers scored, and printing the two together read as an exhaustive audit of 2,761 questions.
 */
export function executedAccuracy(entry: CatalogEntry): { pct: number; raw: string; tested: number | null } | null {
  const executed = entry.attestations.filter((a) => a.passed && a.verified_on !== 'hash-only');
  if (!executed.length) return null;
  const s = executed[executed.length - 1].score;
  const raw = s?.free_generation ?? s?.free_generation_vllm ?? s?.chat_60;
  if (raw === undefined) return null;
  const p = pct(raw);
  if (p === null) return null;
  return { pct: p, raw: String(raw), tested: denominator(raw) };
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

/**
 * The seal is the biggest thing on the card, so it must MEAN something (finding 56). It is drawn only for an item
 * that passed the verifier quorum: full colour while it is the current version, greyed for a retired one, and
 * pulsing (the same treatment StatusChip uses) while verification is still arriving. An item that never reached
 * quorum — REJECTED, DRAFT, a card of a failed announce — gets no seal, and the 56 px go back to the content.
 */
const sealPulse = keyframes`0%, 100% { opacity: 0.55; } 50% { opacity: 1; }`;
const Icon = styled.img<{ $tone: 'sealed' | 'retired' | 'pending' }>`
  width: 56px; height: 56px; flex: none; object-fit: contain;
  filter: ${(p) => (p.$tone === 'retired' ? 'grayscale(1)' : 'none')};
  opacity: ${(p) => (p.$tone === 'retired' ? 0.45 : 1)};
  ${(p) => (p.$tone === 'pending' ? css`animation: ${sealPulse} 1.6s ease-in-out infinite;` : '')}
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
const TaughtChip = styled.span`
  display: inline-flex; align-items: center; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; background: #e1eef3; color: #0b5468; margin-right: 6px;
`;
const UseBtn = styled.button`
  background: none; border: 0; padding: 0; font: inherit; font-size: 12px; font-weight: 600; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer; &:hover { text-decoration: underline; }
`;
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
  const navigate = useNavigate();
  const provider = a.contributors?.find((c) => c.role === 'data_provider');
  const taught = a.origin === 'teach' || !!provider;
  const seal: 'sealed' | 'retired' | 'pending' | null = entry.quorum_ok
    ? (entry.status === 'LISTED' ? 'sealed' : entry.status === 'SUPERSEDED' ? 'retired' : null)
    : (entry.status === 'VERIFYING' || entry.status === 'ANNOUNCED' ? 'pending' : null);
  /** How the verifiers asked their questions — two knowledges scored on different forms are different exams. */
  const formats = a.benchmark.format?.length ? a.benchmark.format.join(' + ') : null;

  return (
    <Wrapper to={`/${encodeURIComponent(a.author)}/${encodeURIComponent(a.id)}`}>
      {seal && <Icon src="/static/images/ic-certified.svg" alt="" data-testid={`seal-${seal}`} title={t(`item.seal_${seal}`)} $tone={seal} />}
      <Info>
        <NameRow>
          <Name>{a.name || a.id}</Name>
          {entry.quorum_ok && <Certified label={term('verified')} />}
          <StatusChip status={entry.status} supersededBy={entry.superseded_by[0]} />
        </NameRow>
        <Ident>{author} / {a.id}</Ident>
        {taught && (
          <Meta $mt={6} data-testid="taught-chip">
            <TaughtChip>{t('detail.taught_badge')}</TaughtChip>
            {provider?.name ? t('detail.taught_by', { name: provider.name }) : t('detail.taught_by_anon')}
            {' · '}
            <UseBtn type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/chat/${encodeURIComponent(a.id)}`); }}>{t('detail.use_yourself')} →</UseBtn>
          </Meta>
        )}

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
          {acc && <>{' · '}<abbr title={`${t('item.accuracy_raw', { raw: acc.raw })} — ${help('accuracy')}`}><Good>{t('item.accuracy_checked', { pct: acc.pct, raw: acc.raw })}</Good></abbr></>}
          {/* Finding 24: an accuracy is only comparable with one measured on the same question set, in the same form. */}
          {formats && <>{' · '}<Soft data-testid="item-format"><abbr title={t('item.format_help')}>{t('item.format', { formats })}</abbr></Soft></>}
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

import { verificationCount } from '@ainize/core/browser';
import type { HTMLAttributes } from 'react';
import { Link, useNavigate } from 'react-router';
import styled, { css, keyframes } from 'styled-components';
import type { CatalogEntry } from '@/api/types';
import { Explain } from '@/components/ui/Explain';
import { Certified, StatusChip } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useNetworkKind } from '@/utils/useNetwork';
import { browseDescription } from '@/lib/describe';
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
  // Item 356: the AIN note says which chain THIS node settles on, not a fixed sentence about the demo.
  const net = useNetworkKind();
  return (amount?: string | number | null, currency?: string | null): { text: string; note: string } => {
    if (amount === undefined || amount === null || amount === '') return { text: '—', note: '' };
    const n = Number(amount);
    if (!Number.isFinite(n)) return { text: String(amount), note: '' };
    if (n === 0) return { text: t('item.price_free'), note: '' };
    const f = n.toLocaleString('en-US', { maximumFractionDigits: 6 });
    switch (currency) {
      case 'AIN': return { text: t('item.price_ain', { n: f }), note: net.note('AIN') };
      case 'CREDIT': return { text: t('item.price_credit', { n: f }), note: t('price.credit_note') };
      case 'USDC': return { text: t('item.price_usdc', { n: f }), note: t('item.price_note_usdc') };
      default: return { text: `${f} ${currency ?? ''}`.trim(), note: '' };
    }
  };
}

/** "검증 완료 (독립 검증 N/M)" or "검증 중 (독립 검증 N/M)". */
export function useVerificationLabel() {
  const { t } = useT();
  // Item 146: never render `3/2` — the numerator is clamped to the quorum; self-checks by the author are already
  // out of `passed`, and any extra independent attestations are said in words, not folded into the fraction.
  return (entry: CatalogEntry): string => {
    const passed = verificationCount(entry).shown;
    // A quorum that a verifier is disputing is not a reassurance: say so in the label itself, not only in the chip.
    if (entry.quorum_ok && entry.sellable === false) return t('item.verified_challenged', { passed, quorum: entry.quorum });
    return t(entry.quorum_ok ? 'item.verified_by' : 'item.verifying_by', { passed, quorum: entry.quorum })
      + (entry.passed > entry.quorum ? ` ${t('item.verified_extra', { n: entry.passed - entry.quorum })}` : '');
  };
}

/* ------------------------------------------------------------------ list item */

/**
 * Finding 81 — the whole card used to be one anchor, so a screen reader announced a 723-character link instead of a
 * name and the list offered no headings to skim (`document.querySelectorAll('h1,h2,h3,h4')` on /explore returned
 * exactly ["H1:Explore knowledge"]). The card is a plain box now; the NAME is the link, and it stretches an
 * invisible overlay across the box so the whole row still opens the knowledge. Everything interactive inside sits
 * above that overlay on `z-index: 1`.
 */
const Wrapper = styled.div`
  position: relative;
  padding: 16px 32px;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 16px;
  background-color: ${(p) => p.theme.color.WHITE};
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  transition: box-shadow 0.4s ease;
  box-shadow: 0 0 0 rgba(0, 0, 0, 0.3);
  &:not(:last-child) { margin-bottom: 16px; }
  &:hover, &:focus-within {
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

/** An `h3`: under the list's own `h2`, and under the question-set `h2` on /benchmarks/:schema. */
const Name = styled.h3`
  margin: 0; font-size: 16px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; word-break: keep-all;
`;
const NameLink = styled(Link)`
  color: inherit; text-decoration: none;
  /* the stretched link: the accessible name is the knowledge's name, the click target is the whole card */
  &::after { content: ''; position: absolute; inset: 0; }
  &:hover { text-decoration: underline; }
  &:focus-visible { outline: 2px solid ${(p) => p.theme.color.PRIMARY}; outline-offset: 3px; }
`;

const Ident = styled.div`
  margin-top: 4px; font-family: ${(p) => p.theme.font.mono}; font-size: 12px; color: ${(p) => p.theme.color.GREY}; word-break: break-all;
`;

const Meta = styled.div<{ $mt?: number }>`
  margin-top: ${(p) => p.$mt ?? 8}px; font-size: 12px; color: ${(p) => p.theme.color.BLACK}; line-height: 1.6;
  b { font-weight: 500; color: ${(p) => p.theme.color.GREY}; }
`;

const Good = styled.span`color: ${(p) => p.theme.color.SUCCESS}; font-weight: 600;`;
const chipCss = `display: inline-flex; align-items: center; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; line-height: 1.7;`;
const TaughtChip = styled.span`${chipCss} background: #e1eef3; color: #0b5468; margin-right: 6px;`;
/**
 * Findings 282 and 200 — the browse surfaces said nothing about a knowledge's family or its terms: a buyer choosing
 * between a 5-credit base and a 3-credit item built on it could not tell which was which until the fourth tab of the
 * detail page, and a creator could not tell whether they were allowed to build on it at all. These chips carry the
 * three facts that decide both: what it sits on, what licence it is under, and who may read its training set.
 */
const Chips = styled.div`margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px;`;
const Tag = styled.span<{ $tone: 'base' | 'family' | 'terms' }>`
  ${chipCss}
  position: relative; z-index: 1;
  background: ${(p) => (p.$tone === 'base' ? '#fff1de' : p.$tone === 'family' ? '#f0eafd' : '#eef1f4')};
  color: ${(p) => (p.$tone === 'base' ? '#8a4b00' : p.$tone === 'family' ? '#5b1ca8' : '#4a5560')};
  button { border-bottom-color: currentColor; opacity: 1; }
`;
const UseBtn = styled.button`
  position: relative; z-index: 1;
  background: none; border: 0; padding: 0; font: inherit; font-size: 12px; font-weight: 600; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer; &:hover { text-decoration: underline; }
`;
const Soft = styled.span`color: ${(p) => p.theme.color.GREY};`;

const Desc = styled.div`
  margin-top: 16px; font-size: 14px; line-height: 1.5; color: ${(p) => p.theme.color.BLACK};
  overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
`;

/** The question that made a row a search hit (items 25, 206) — quoted, so it reads as content and not as a claim. */
const Match = styled.div`
  margin-top: 10px; font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.DARK_GREY};
  background: ${(p) => p.theme.color.PALE_GREY}; border-radius: 4px; padding: 6px 10px; word-break: break-word;
`;

const PriceCol = styled.div`
  flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; max-width: 200px; text-align: right;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { display: none; }
`;
const Price = styled.div`font-size: 16px; font-weight: 700; color: ${(p) => p.theme.color.PRIMARY}; white-space: nowrap;`;
const PriceNote = styled.div`font-size: 11px; line-height: 1.4; color: ${(p) => p.theme.color.GREY};`;

/**
 * Finding 18 — the price column is the first thing a narrow card drops, and nothing took its place, so on a phone
 * the browse list showed no price at all and choosing between 0.1 and 25 AIN meant opening every item. Below the
 * breakpoint the price leads the facts row instead, in the same purple it has in the column. The unit note that
 * rides under the desktop price is NOT repeated on every card here — it is one line per page (`PriceUnitNote`),
 * because four copies of "AIN = AI Network token" is what pushed the price off the card in the first place.
 */
const PriceInline = styled.span`
  display: none;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) {
    display: inline; font-size: 13px; font-weight: 700; color: ${(p) => p.theme.color.PRIMARY};
    &::after { content: ' · '; font-weight: 400; color: ${(p) => p.theme.color.BLACK}; }
  }
`;
const UnitNote = styled.div`
  display: none;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { display: block; padding-bottom: 12px; font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.GREY}; }
`;

/**
 * The unit note for a list of cards, once — mobile only, because every desktop card carries its own under the price.
 * Renders nothing when the prices on screen need no explanation (free items, or a currency with no note).
 */
export function PriceUnitNote({ entries, currency, ...rest }: { entries: CatalogEntry[]; currency?: string } & HTMLAttributes<HTMLDivElement>) {
  const priceLabel = usePriceLabel();
  const notes = [...new Set(entries.map((e) => priceLabel(e.anchor.price, e.anchor.currency ?? currency).note).filter(Boolean))];
  if (!notes.length) return null;
  return <UnitNote {...rest}>{notes.join(' · ')}</UnitNote>;
}

const LegendLine = styled.p`
  margin: 0 0 16px; font-size: 12px; line-height: 1.7; color: ${(p) => p.theme.color.GREY}; word-break: keep-all;
  b { font-weight: 600; color: ${(p) => p.theme.color.DARK_GREY}; }
`;

/**
 * Finding 80 — the words a browse list is made of ("Verified", "facts covered", "learned memory entries",
 * "accuracy") were defined ONLY inside hover `title` attributes on `<abbr>` elements with no tabindex, so on a phone
 * and at the keyboard the definitions did not exist and what was left on screen was bare jargon. They are on the
 * page now, visibly, in one 12 px line — once per list rather than once per card, the same rule `PriceUnitNote`
 * follows, because ten copies of a definition is what drove them into tooltips to begin with.
 */
export function TermsLegend(props: HTMLAttributes<HTMLParagraphElement>) {
  const { t, term } = useT();
  const items: [Parameters<typeof term>[0], string][] = [
    ['verified', 'explore.legend.verified'],
    ['facts', 'explore.legend.facts'],
    ['rows', 'explore.legend.rows'],
    ['accuracy', 'explore.legend.accuracy'],
    ['liveTest', 'explore.legend.livetest'],
  ];
  return (
    <LegendLine data-testid="terms-legend" {...props}>
      {items.map(([k, key], i) => (
        <span key={k}>{i > 0 && ' · '}<b>{term(k)}</b> — {t(key)}</span>
      ))}
    </LegendLine>
  );
}

/** The knowledges this one sits on, and whether it can stand without them (findings 282, 200). */
function useFamily(entry: CatalogEntry, nameOf?: (id: string) => string | undefined) {
  const { t } = useT();
  const a = entry.anchor;
  const label = (ids: string[]) => ids.map((id) => nameOf?.(id) ?? id).join(', ');
  // `base.stack` is the table state the body was trained against: without it underneath, the rows mean nothing.
  const stack = a.base?.stack?.map((s) => s.patch_id) ?? [];
  if (stack.length) return { tone: 'base' as const, text: t('item.addon', { names: label(stack) }), help: t('item.addon_help') };
  if (a.parents?.length) return { tone: 'family' as const, text: t('item.built_on', { names: label(a.parents) }), help: t('item.built_on_help') };
  return null;
}

/** A day, in the reader's own calendar — the card shows dates, never "3 weeks ago", so two bakes can be compared. */
const day = (ts: number): string => { try { return new Date(ts).toISOString().slice(0, 10); } catch { return '—'; } };

/** Search hits quote the trained prompt, which can be a paragraph; the card shows the head of it. */
const clip = (v: string, n: number) => (v.length > n ? `${v.slice(0, n - 1)}…` : v);

export function PatchListItem({ entry, currency, nameOf }: { entry: CatalogEntry; currency?: string; nameOf?: (id: string) => string | undefined }) {
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
  const family = useFamily(entry, nameOf);
  /** Who may read the questions this was trained from — the thing that decides whether anyone can build on it. */
  const access = a.dataset?.access;
  /** Item 200: how often somebody has built on this, from the children the ledger records. */
  const builtOn = entry.children.length;
  const description = browseDescription(a.description);

  return (
    <Wrapper data-testid="patch-card">
      {seal && <Icon src="/static/images/ic-certified.svg" alt="" data-testid={`seal-${seal}`} title={t(`item.seal_${seal}`)} $tone={seal} />}
      <Info>
        <NameRow>
          <Name><NameLink to={`/${encodeURIComponent(a.author)}/${encodeURIComponent(a.id)}`}>{a.name || a.id}</NameLink></Name>
          {/* Item 153: no green "Verified" badge while a verifier's challenge is open — the chip beside it says
              "Re-verification requested", and the two together would read as a bug. `sellable` is undefined on a node
              running an older build, which keeps the old behaviour there. */}
          {entry.quorum_ok && entry.sellable !== false && <Certified label={term('verified')} />}
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

        {(family || a.license || access) && (
          <Chips data-testid="item-chips">
            {family && (
              <Tag $tone={family.tone} data-testid="item-family">
                <Explain text={family.help} label={family.text}>{family.text}</Explain>
              </Tag>
            )}
            {a.license && (
              <Tag $tone="terms" data-testid="item-license">
                <Explain text={t('item.license_help')} label={t('item.license', { name: a.license })}>{t('item.license', { name: a.license })}</Explain>
              </Tag>
            )}
            {access && (
              <Tag $tone="terms" data-testid="item-dataset">
                <Explain text={t('item.dataset_help')} label={t(`item.dataset_${access}`)}>{t(`item.dataset_${access}`)}</Explain>
              </Tag>
            )}
          </Chips>
        )}

        <Meta $mt={12}>
          <b>{t('common.author')}:</b> {author} · <b>{t('common.model')}:</b> {a.model.id_M}
          {' · '}<b>{t('item.topic')}:</b> {a.benchmark.schema}
        </Meta>
        {/* Item 267: a bake from three weeks ago and this morning's read identically — no date on the card at all. */}
        <Meta $mt={6} data-testid="item-dates">
          {a.as_of ? <b>{t('item.as_of', { date: a.as_of })}</b> : null}
          {a.as_of ? ' · ' : ''}
          {t('item.registered_on', { date: day(a.created_at) })}
        </Meta>
        <Meta>
          <PriceInline data-testid="item-price-inline">{p.text}</PriceInline>
          {t('units.facts', { n: num(a.benchmark.queries) })}
          {' · '}{t('units.rows', { n: num(a.rows) })}
          {' · '}{t('item.size', { size: bytes(a.size_bytes) })}
          {/* Item 201: this number is settlements — sales — and calling it "downloads" made a superseded single
              fact with 314 e2e purchases read as the most-downloaded knowledge on the marketplace. */}
          {' · '}<span data-testid="item-sales">{entry.sales
            ? t(entry.sales.sales_30d ? 'item.sales_recent' : 'item.sales', { n: num(entry.sales.sales_all), r: num(entry.sales.sales_30d) })
            : t('item.sales', { n: num(entry.downloads) })}</span>
          {builtOn > 0 && <>{' · '}<span data-testid="item-built-on">{t('explore.card.built_on', { c: num(builtOn) })}</span></>}
        </Meta>
        <Meta>
          {entry.quorum_ok && entry.sellable !== false ? <Good>{verification(entry)}</Good> : verification(entry)}
          {entry.integrity_checks > 0 && <>{' · '}<Soft><Explain text={t('item.integrity_help')}>{t('item.integrity_only', { n: entry.integrity_checks })}</Explain></Soft></>}
          {acc && <>{' · '}<Explain text={`${t('item.accuracy_raw', { raw: acc.raw })} — ${help('accuracy')}`} tech={tech('accuracy')}><Good>{t('item.accuracy_checked', { pct: acc.pct, raw: acc.raw })}</Good></Explain></>}
          {/* Finding 24: an accuracy is only comparable with one measured on the same question set, in the same form. */}
          {formats && <>{' · '}<Soft data-testid="item-format"><Explain text={t('item.format_help')}>{t('item.format', { formats })}</Explain></Soft></>}
        </Meta>
        {description && <Desc>{description}</Desc>}
        {/* Items 25 + 206: a hit on a question the knowledge answers used to look like a hit on nothing at all. */}
        {entry.matched && (
          <Match data-testid="item-match" title={t('item.match_help')}>
            {t('item.match', { prompt: clip(entry.matched.prompt, 80), expect: clip(entry.matched.expect, 40) })}
          </Match>
        )}
      </Info>
      <PriceCol>
        <Price>{p.text}</Price>
        {p.note && <PriceNote>{p.note}</PriceNote>}
      </PriceCol>
    </Wrapper>
  );
}

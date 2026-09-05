import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { errorMessage, useBuyMutation, useRequestPatchMutation } from '@/api/api';
import type { CatalogEntry, ChatLock, ChatOverlap, ElsewhereRow, RuntimeStatus } from '@/api/types';
import { useT } from '@/i18n';
import { StatusChip } from '@/components/ui/Misc';
import { Alert } from '@/components/ui/Form';
import { num, shortAddr } from '@/utils/format';
import { MAX_CHAT_PATCHES, executedAccuracy, lockJobKind, lockKind, useSince, useTicker } from './util';

const Panel = styled.aside`
  display: flex; flex-direction: column; gap: 12px; min-width: 0;
`;
const PanelTitle = styled.h2`
  margin: 0; font-size: 14px; font-weight: 700; color: ${(p) => p.theme.color.BLACK};
`;
const Hint = styled.p`margin: 0; font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.GREY};`;
const CountRow = styled.div`
  /* wrap: with the pinned count beside it (finding 225) the Korean line pushed "Clear selection" onto two lines */
  display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 8px; font-size: 12px; color: ${(p) => p.theme.color.DARK_GREY};
  > span { min-width: 0; }
  button { background: none; border: 0; padding: 0; font: inherit; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer; &:hover { text-decoration: underline; } &:disabled { color: ${(p) => p.theme.color.GREY}; cursor: default; text-decoration: none; } }
`;
const List = styled.ul`margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px;`;
const Row = styled.label<{ $active: boolean; $disabled: boolean }>`
  position: relative; display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 6px 10px; align-items: start; width: 100%; padding: 12px 14px; text-align: left;
  cursor: ${(p) => (p.$disabled ? 'not-allowed' : 'pointer')}; opacity: ${(p) => (p.$disabled ? 0.55 : 1)};
  background: ${(p) => (p.$active ? p.theme.color.PALE_GREY : '#fff')};
  border: 1px solid ${(p) => (p.$active ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)};
  border-left: 3px solid ${(p) => (p.$active ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)};
  border-radius: 4px; transition: border-color 0.2s ease, box-shadow 0.2s ease;
  ${(p) => !p.$disabled && `&:hover { border-color: ${p.theme.color.PRIMARY}; box-shadow: 0 2px 6px 0 #e0e4e7; }`}
  input { width: 18px; height: 18px; margin: 1px 0 0; accent-color: ${(p) => p.theme.color.PRIMARY}; cursor: inherit; }
  &:focus-within { outline: 2px solid ${(p) => p.theme.color.PRIMARY}; outline-offset: 1px; }
`;
const Body = styled.span`display: flex; flex-direction: column; gap: 6px; min-width: 0;`;
const Name = styled.span`font-size: 14px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; line-height: 1.4; word-break: keep-all;`;
const Id = styled.span`font-family: ${(p) => p.theme.font.mono}; font-size: 11px; color: ${(p) => p.theme.color.GREY}; word-break: break-all;`;
const MetaRow = styled.span`display: flex; flex-wrap: wrap; gap: 6px 10px; font-size: 12px; color: ${(p) => p.theme.color.DARK_GREY};`;
const Accuracy = styled.span<{ $known: boolean }>`
  font-weight: ${(p) => (p.$known ? 600 : 400)}; color: ${(p) => (p.$known ? p.theme.color.SUCCESS : p.theme.color.GREY)};
`;
const Price = styled.span`font-weight: 600; color: ${(p) => p.theme.color.PRIMARY};`;
const ChipRow = styled.span`display: flex; flex-wrap: wrap; gap: 6px; align-items: center;`;
const Small = styled.div`font-size: 12px; line-height: 1.5; margin-top: 4px; opacity: 0.9;`;
const PriceNote = styled.span`display: block; width: 100%; font-size: 11px; line-height: 1.4; color: ${(p) => p.theme.color.GREY};`;
const OrderBadge = styled.span`
  position: absolute; top: -8px; right: 10px; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center;
  background: ${(p) => p.theme.color.PRIMARY}; color: #fff; font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums;
`;
const Pinned = styled.span`
  display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; background: #fff3e0; color: #8a4b00;
`;
const Section = styled.h3`margin: 4px 0 0; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: ${(p) => p.theme.color.DARK_GREY};`;
/** Finding 62 — one alert for every overlap in the selection, with the load-order numbers instead of 50-character names. */
const OverlapList = styled.ul`
  margin: 4px 0 0; padding: 0 0 0 2px; list-style: none; display: flex; flex-direction: column; gap: 3px;
  font-size: 12px; line-height: 1.45;
  code { font-family: ${(p) => p.theme.font.mono}; font-weight: 700; }
`;
/** Finding 227 — why this card cannot be ticked, on the card, where a finger can reach it. */
const WhyNot = styled.span`display: block; width: 100%; font-size: 11px; line-height: 1.4; color: ${(p) => p.theme.color.GREY};`;
/** Finding 224 — move a ticked knowledge up or down the load order without unticking it. */
const OrderMove = styled.span`
  position: absolute; top: -9px; right: 36px; display: inline-flex; gap: 2px;
  button {
    width: 20px; height: 20px; padding: 0; display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; background: #fff; cursor: pointer;
    font-size: 10px; line-height: 1; color: ${(p) => p.theme.color.DARK_GREY};
    &:hover:not(:disabled) { border-color: ${(p) => p.theme.color.PRIMARY}; color: ${(p) => p.theme.color.PRIMARY}; }
    &:disabled { opacity: 0.35; cursor: default; }
  }
`;
/** Finding 218 — 136 cards with no way to find one. */
const Filter = styled.input`
  width: 100%; padding: 7px 10px; font-size: 13px; border-radius: 4px; color: ${(p) => p.theme.color.BLACK};
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fff;
  &:focus { outline: none; border-color: ${(p) => p.theme.color.PRIMARY}; box-shadow: 0 0 0 3px ${(p) => p.theme.color.PALE_GREY}; }
`;
const SmallButton = styled.button`
  align-self: flex-start; padding: 4px 10px; font-size: 12px; font-weight: 600; cursor: pointer;
  color: ${(p) => p.theme.color.PRIMARY}; background: #fff; border: 1px solid ${(p) => p.theme.color.PRIMARY}; border-radius: 3px;
  &:hover:not(:disabled) { background: ${(p) => p.theme.color.PALE_GREY}; }
  &:disabled { color: ${(p) => p.theme.color.GREY}; border-color: ${(p) => p.theme.color.LIGHT_GREY}; cursor: default; }
`;

export interface KnowledgePickerProps {
  items: CatalogEntry[];
  runtime: RuntimeStatus | undefined;
  lock: ChatLock | null | undefined;
  /** Browser clock minus node clock at the last poll — elapsed times are then measured against the node's clock. */
  clockSkewMs?: number;
  /** True while THIS tab's own live test holds the shared model (the banner then says so instead of blaming a stranger). */
  lockIsMine?: boolean;
  /** Selected ids in tick order (= load order). */
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** Move a ticked knowledge one place earlier (-1) or later (+1) in the load order (finding 224). */
  onReorder?: (id: string, dir: -1 | 1) => void;
  onClear: () => void;
  /** The teach job this page is showing: a lock on THAT job is the visitor's own lesson, not a stranger's (finding 65). */
  mineJobId?: string | null;
  /** Knowledge the operator keeps loaded for everyone (contamination banner). */
  applied?: string[];
  overlaps?: ChatOverlap[];
  /** The visitor's own private lessons (teach mode); empty until wired. */
  lessons?: CatalogEntry[];
  /** Bodies a recent live test found on the shared model that this node never loaded (item 211). */
  dirty?: string[];
  /** Knowledge this node's model could run but cannot load — shown with its price and seller instead of hidden (item 297). */
  elsewhere?: ElsewhereRow[];
  /** Only the operator can buy; a visitor can ask for it. */
  operator?: boolean;
}

export function KnowledgePicker({ items, runtime, lock, clockSkewMs = 0, lockIsMine = false, selectedIds, onToggle, onReorder, onClear, mineJobId, applied = [], overlaps = [], lessons = [], dirty = [], elsewhere = [], operator = false }: KnowledgePickerProps) {
  const { t, term, help, tech, locale } = useT();
  const kind = lockKind(lock, lockIsMine);
  // the banner's clock ticks every second instead of freezing until the next 20 s poll
  useTicker(kind !== 'none');
  const since = useSince(clockSkewMs);
  const runtimeOff = !!runtime && !runtime.available;
  const full = selectedIds.length >= MAX_CHAT_PATCHES;
  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of [...items, ...lessons]) m.set(e.anchor.id, e.anchor.name);
    return (id: string) => m.get(id) ?? id;
  }, [items, lessons]);
  const pinned = useMemo(() => new Set(applied), [applied]);
  /** Pinned knowledge the visitor did NOT tick is part of every "before" answer; a ticked one is unloaded for it. */
  const pinnedUnticked = applied.filter((id) => !selectedIds.includes(id));

  /**
   * Findings 62 + 225 — every overlap that matters to this selection, in ONE place.
   *
   * It used to be one full-width Alert per pair, each repeating both 50-character names and the winner's name
   * again: three ticked KRX versions produced 516 px of near-identical prose that pushed the selection count
   * below the fold. And a pair where one side is knowledge the OPERATOR keeps loaded was dropped entirely,
   * although that is the case that matters most — the visitor cannot untick it. Pinned knowledge is position 0
   * here (it is on the model before anything the visitor ticks, so anything ticked wins over it).
   */
  const selectedOverlaps = useMemo(() => {
    const pos = new Map<string, number>();
    for (const id of applied) if (!pos.has(id)) pos.set(id, 0);
    selectedIds.forEach((id, i) => pos.set(id, i + 1));
    return overlaps
      .filter((o) => pos.has(o.a) && pos.has(o.b) && (selectedIds.includes(o.a) || selectedIds.includes(o.b)))
      .map((o) => {
        const pa = pos.get(o.a) ?? 0;
        const pb = pos.get(o.b) ?? 0;
        // read the pair in load order, so the line says "#1 and #2", never "#2 and #1"
        const [first, second] = pa <= pb ? [o.a, o.b] : [o.b, o.a];
        return { ...o, a: first, b: second, winner: second, pinnedSide: pa === 0 ? o.a : pb === 0 ? o.b : null };
      })
      .sort((x, y) => y.rows - x.rows);
  }, [overlaps, selectedIds, applied]);
  /**
   * "#2" / "2번" — the load-order number a card carries, which is how an overlap line names it without repeating a
   * 50-character title. The Korean form ends in 번 on purpose: it makes the particle that follows it invariable,
   * so the sentence never has to print "2이(가)".
   */
  const tag = (id: string) => (locale === 'ko' ? `${selectedIds.indexOf(id) + 1}번` : `#${selectedIds.indexOf(id) + 1}`);

  /**
   * Finding 218 — a node that holds 136 testable knowledges listed all 136, and the only input in the panel was a
   * checkbox. The box appears once the list is long enough to need one; a ticked card is never filtered away, or
   * the visitor could not untick what they cannot see.
   */
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filterOn = items.length + lessons.length > 8;
  const matches = (e: CatalogEntry) => !q || selectedIds.includes(e.anchor.id)
    || `${e.anchor.name} ${e.anchor.id} ${e.anchor.author_name ?? ''} ${e.anchor.description ?? ''}`.toLowerCase().includes(q);
  /**
   * Finding 224 — ticked cards first, in LOAD ORDER, so the column reads the same way as the head list and as the
   * numbers on the badges. The picker used to leave them in catalogue order, so after one untick and re-tick the
   * left column read 2 / – / – / 1 while the head read 1, 2.
   */
  const shown = useMemo(() => {
    const all = [...lessons, ...items].filter(matches);
    const ticked = selectedIds.map((id) => all.find((e) => e.anchor.id === id)).filter((e): e is CatalogEntry => !!e);
    const restLessons = lessons.filter((e) => matches(e) && !selectedIds.includes(e.anchor.id));
    const restItems = items.filter((e) => matches(e) && !selectedIds.includes(e.anchor.id));
    return { ticked, restLessons, restItems, hidden: items.length + lessons.length - all.length };
  }, [items, lessons, selectedIds, q]);   // eslint-disable-line react-hooks/exhaustive-deps

  const priceLabel = (e: CatalogEntry) => {
    const n = Number(e.anchor.price);
    if (!n) return t('common.free');
    const unit = e.anchor.currency === 'CREDIT' ? term('credit') : e.anchor.currency === 'AIN' ? 'AIN' : e.anchor.currency;
    return `${n.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', { maximumFractionDigits: 6 })} ${unit}`;
  };
  const priceNote = (e: CatalogEntry) => (e.anchor.currency === 'CREDIT' ? t('price.credit_note') : e.anchor.currency === 'AIN' ? t('price.ain_note') : e.anchor.currency);

  const renderItem = (e: CatalogEntry) => {
    const a = e.anchor;
    const acc = executedAccuracy(e);
    const order = selectedIds.indexOf(a.id);
    const active = order >= 0;
    const disabled = runtimeOff || (!active && full);
    const isPinned = pinned.has(a.id);
    const title = runtimeOff ? t('chat.runtime.off') : !active && full ? t('chat.picker.max') : a.description || a.name;
    return (
      <li key={a.id}>
        <Row $active={active} $disabled={disabled} title={title}
          // Finding 224 — Alt+↑/↓ moves the load order from the keyboard, wherever focus is inside the card.
          onKeyDown={active && onReorder ? (ev) => {
            if (!ev.altKey || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
            ev.preventDefault(); onReorder(a.id, ev.key === 'ArrowUp' ? -1 : 1);
          } : undefined}>
          <input type="checkbox" checked={active} disabled={disabled} onChange={() => onToggle(a.id)} aria-label={a.name} />
          {active && onReorder && selectedIds.length > 1 && (
            /* the card is a <label>: a click on an interactive descendant must not also flip the checkbox */
            <OrderMove onClick={(ev) => ev.preventDefault()}>
              <button type="button" disabled={order === 0} aria-label={t('chat.picker.move_up')} title={t('chat.picker.move_up')}
                onClick={() => onReorder(a.id, -1)} data-testid="picker-up">▲</button>
              <button type="button" disabled={order === selectedIds.length - 1} aria-label={t('chat.picker.move_down')} title={t('chat.picker.move_down')}
                onClick={() => onReorder(a.id, 1)} data-testid="picker-down">▼</button>
            </OrderMove>
          )}
          {active && <OrderBadge title={t('chat.picker.order_help')} aria-label={t('chat.picker.order', { n: order + 1 })}>{order + 1}</OrderBadge>}
          <Body>
            <Name>{a.name}</Name>
            <Id>{a.author_name ?? shortAddr(a.author)}/{a.id}</Id>
            <MetaRow>
              <span title={`${help('facts')} (${tech('facts')})`}>{t('units.facts', { n: num(a.benchmark.queries) }, a.benchmark.queries)}</span>
              <Accuracy $known={!!acc} title={acc ? `${help('accuracy')} (${tech('accuracy')})` : t('chat.picker.not_scored_help')}>
                {acc ? (acc.pct !== null ? t('chat.picker.accuracy', { pct: acc.pct }) : t('chat.picker.accuracy_raw', { score: acc.raw })) : t('chat.picker.not_scored')}
              </Accuracy>
              <Price title={priceNote(e)}>{priceLabel(e)}</Price>
              {priceNote(e) && Number(a.price) > 0 && <PriceNote>{priceNote(e)}</PriceNote>}
            </MetaRow>
            <ChipRow>
              <StatusChip status={e.status} />
              {/* Finding 108 — the node now offers this node's operator their own unannounced drafts, because that
                  is what `--no-announce` is for and POST /api/chat has always loaded them. Say why one is here:
                  nobody else can see it, and it is not on the public record yet. */}
              {e.status === 'DRAFT' && <Hint as="span" data-testid="picker-own-draft">{t('chat.picker.own_draft')}</Hint>}
              {isPinned && <Pinned title={t(active ? 'chat.picker.pinned_ticked' : 'chat.picker.contaminated', { names: a.name })}>{t('chat.picker.always_loaded')}</Pinned>}
              {/* Finding 225 — "Always loaded · Loads 1." on one card is a contradiction: say what the test
                  actually does with a pinned knowledge the visitor ticked. */}
              {active && <Hint as="span">{isPinned ? t('chat.picker.pinned_ticked') : t('chat.picker.order', { n: order + 1 })}</Hint>}
              {/* Finding 227 — the reason a card cannot be ticked was a `title`, unreachable on a phone. */}
              {!active && full && !runtimeOff && <WhyNot data-testid="picker-why-not">{t('chat.picker.max')}</WhyNot>}
            </ChipRow>
          </Body>
        </Row>
      </li>
    );
  };

  return (
    <Panel aria-label={t('chat.picker.multi_title')}>
      <PanelTitle>{t('chat.picker.multi_title')}</PanelTitle>
      <Hint>{t('chat.picker.multi_help')} {t('chat.picker.hint')}</Hint>

      {runtimeOff && (
        <Alert $tone="warning" role="status" title={runtime?.error ?? undefined}>
          {t('chat.runtime.off')}
          <Small>{t('chat.runtime.off_detail')}</Small>
        </Alert>
      )}
      {/* D3: a lock whose holder process is gone (or whose lease expired) is broken by the very next request —
          reporting it as "another test in progress" made the banner permanent on an idle node. And when the
          holder is this node's own request, say so instead of blaming a stranger. */}
      {/* Finding 65 — a visitor is told what KIND of work holds the model, never the internal lock key or the
          node's OS process id; and a lock on the lesson THIS page is showing is their own, not a stranger's. */}
      {kind === 'other' && lock && (
        <Alert $tone="info" role="status" title={help('liveTest')} data-testid="chat-lock">
          {t(lockJobKind(lock.label, mineJobId) === 'teach_mine' ? 'chat.lock.busy_mine_lesson' : 'chat.lock.busy')}
          <Small>{t(`chat.lock.kind.${lockJobKind(lock.label, mineJobId)}`, { since: since(lock.since) })}</Small>
          <Small>{t('chat.lock.help')}</Small>
        </Alert>
      )}
      {kind === 'mine' && lock && (
        <Alert $tone="info" role="status" title={help('liveTest')} data-testid="chat-lock-mine">
          {t('chat.lock.mine', { since: since(lock.since) })}
          <Small>{t('chat.lock.help')}</Small>
        </Alert>
      )}
      {kind === 'stale' && (
        <Alert $tone="warning" role="status" data-testid="chat-lock-stale">{t('chat.lock.stale')}</Alert>
      )}
      {/* Finding 225 — a pinned knowledge the visitor TICKED is not part of the "before" answer: the test unloads
          it first and puts it back after. Only the ones they did not tick colour the comparison. */}
      {pinnedUnticked.length > 0 && (
        <Alert $tone="warning" role="status" data-testid="chat-contaminated">
          {t('chat.picker.contaminated', { names: pinnedUnticked.map(nameOf).join(', ') })}
        </Alert>
      )}
      {/* Item 211 — a body on the shared model that this node never loaded. It used to be reported to the visitor as
          "was already loaded" and measured into their Before column; now the test unloads it and says so. */}
      {dirty.length > 0 && (
        <Alert $tone="warning" role="status" data-testid="chat-dirty">
          {t('chat.picker.dirty', { names: dirty.map(nameOf).join(', ') })}
          <Small>{t('chat.picker.dirty_detail')}</Small>
        </Alert>
      )}
      {selectedOverlaps.length > 0 && (
        <Alert $tone="info" role="status" data-testid="chat-overlap">
          {t('chat.picker.overlap_head')}
          <OverlapList>
            {selectedOverlaps.map((o) => (
              <li key={`${o.a}|${o.b}`} title={`${nameOf(o.a)} / ${nameOf(o.b)}`}>
                {/* A pair can share QUESTIONS while touching different table rows (item 222) — that pair has no
                    entry overlap to report, and the question line below is the whole of what it is. */}
                {o.rows === 0 ? t('chat.picker.overlap_line_questions_only', { a: tag(o.a), b: tag(o.b) })
                  : o.pinnedSide
                    ? t('chat.picker.overlap_line_pinned', {
                      a: tag(o.pinnedSide === o.a ? o.b : o.a), n: num(o.rows), name: nameOf(o.pinnedSide),
                    })
                    : t('chat.picker.overlap_line', { a: tag(o.a), b: tag(o.b), n: num(o.rows), winner: tag(o.winner) })}
                {/* Item 222: the same overlap in questions — what the visitor is actually choosing between. */}
                {!!o.questions_shared && (
                  <Small data-testid="overlap-questions">
                    {o.questions_disagree
                      ? t('chat.picker.overlap_questions_differ', { n: num(o.questions_shared), d: num(o.questions_disagree), winner: tag(o.winner) })
                      : t('chat.picker.overlap_questions_same', { n: num(o.questions_shared) })}
                  </Small>
                )}
              </li>
            ))}
          </OverlapList>
        </Alert>
      )}

      {items.length === 0 && lessons.length === 0 ? (
        <Hint>{t('chat.picker.empty')}</Hint>
      ) : (
        <>
          <CountRow>
            <span>
              {t('chat.picker.count', { n: selectedIds.length })}
              {/* Finding 225 — what is on the MODEL is ticks plus whatever the operator pinned; the count row used
                  to report only the ticks, so three pinned made six the visitor never saw counted. */}
              {pinnedUnticked.length > 0 && <> · {t('chat.picker.count_pinned', { n: pinnedUnticked.length }, pinnedUnticked.length)}</>}
            </span>
            <button type="button" onClick={onClear} disabled={selectedIds.length === 0}>{t('chat.picker.pick_none')}</button>
          </CountRow>
          {/* Finding 227 — when the limit is reached, say so once, here, in text, not only in a hover tooltip. */}
          {full && <Hint data-testid="picker-max-note">{t('chat.picker.max')}</Hint>}
          {filterOn && (
            <>
              <Filter type="search" value={query} onChange={(ev) => setQuery(ev.target.value)}
                placeholder={t('chat.picker.filter', { n: items.length + lessons.length })} aria-label={t('chat.picker.filter', { n: items.length + lessons.length })} data-testid="picker-filter" />
              {q !== '' && <Hint data-testid="picker-filter-count">{t('chat.picker.filter_count', { n: shown.restItems.length + shown.restLessons.length + shown.ticked.length, total: items.length + lessons.length })}</Hint>}
            </>
          )}
          {shown.ticked.length > 0 && (
            <>
              <Section>{t('chat.picker.loaded_section', undefined, shown.ticked.length)}</Section>
              <List data-testid="picker-loaded">{shown.ticked.map(renderItem)}</List>
            </>
          )}
          {shown.restLessons.length > 0 && (
            <>
              <Section>{t('chat.picker.mine')}</Section>
              <List>{shown.restLessons.map(renderItem)}</List>
            </>
          )}
          {shown.restItems.length > 0 && (
            <>
              <Section>{t(shown.ticked.length > 0 || shown.restLessons.length > 0 ? 'chat.picker.rest_section' : 'chat.picker.title')}</Section>
              <List>{shown.restItems.map(renderItem)}</List>
            </>
          )}
          {q !== '' && shown.restItems.length === 0 && shown.restLessons.length === 0 && <Hint>{t('chat.picker.filter_none', { q: query.trim() })}</Hint>}
        </>
      )}

      {/* Item 297 — knowledge this node's model could run but does not hold (or holds only because it verified it).
          It used to be missing from this list entirely: no row, no price, no seller, and the terminal answered
          "unknown knowledge" — the same words a typo gets. The chained purchase the product is built on starts here. */}
      {elsewhere.length > 0 && (
        <>
          <Section>{t('chat.picker.elsewhere')}</Section>
          <Hint>{t('chat.picker.elsewhere_help')}</Hint>
          <List>{elsewhere.map((e) => <ElsewhereItem key={e.patch_id} row={e} operator={operator} />)}</List>
        </>
      )}
    </Panel>
  );
}

/** One knowledge that cannot be tested here: what it costs, who sells it, and the one thing the reader can do. */
function ElsewhereItem({ row, operator }: { row: ElsewhereRow; operator: boolean }) {
  const { t, term, locale } = useT();
  const [buy, buyState] = useBuyMutation();
  const [request, reqState] = useRequestPatchMutation();
  const [asked, setAsked] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const price = Number(row.price)
    ? `${Number(row.price).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', { maximumFractionDigits: 6 })} ${row.currency === 'CREDIT' ? term('credit') : row.currency}`
    : t('common.free');
  const asks = asked ?? row.requests;
  return (
    <li>
      <Row $active={false} $disabled as="div" data-testid="picker-elsewhere" data-patch={row.patch_id}>
        <span aria-hidden style={{ width: 18 }} />
        <Body>
          <Name>{row.name}</Name>
          <Id>{row.author_name ?? shortAddr(row.author)}/{row.patch_id}</Id>
          <MetaRow>
            <span>{t('units.facts', { n: num(row.queries) }, row.queries)}</span>
            <Price>{price}</Price>
            <StatusChip status={row.status} />
          </MetaRow>
          <PriceNote>{t(`chat.picker.why.${row.reason}`)}</PriceNote>
          {asks > 0 && <PriceNote data-testid="picker-requests">{t('chat.picker.asked', { n: asks }, asks)}</PriceNote>}
          <ChipRow>
            {operator
              ? <SmallButton type="button" disabled={!row.buyable || buyState.isLoading} onClick={() => { setError(null); buy({ id: row.patch_id }).unwrap().catch((e) => setError(errorMessage(e))); }}>
                {buyState.isLoading ? t('chat.picker.buying') : t('chat.picker.buy', { price })}
              </SmallButton>
              : <SmallButton type="button" disabled={reqState.isLoading || asked !== null} onClick={() => { setError(null); request(row.patch_id).unwrap().then((r) => setAsked(r.requests)).catch((e) => setError(errorMessage(e))); }}>
                {asked !== null ? t('chat.picker.asked_done') : t('chat.picker.ask')}
              </SmallButton>}
          </ChipRow>
          {error && <PriceNote role="alert">{error}</PriceNote>}
        </Body>
      </Row>
    </li>
  );
}

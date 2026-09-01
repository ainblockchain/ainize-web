import { useMemo } from 'react';
import styled from 'styled-components';
import type { CatalogEntry, ChatLock, ChatOverlap, RuntimeStatus } from '@/api/types';
import { useT } from '@/i18n';
import { StatusChip } from '@/components/ui/Misc';
import { Alert } from '@/components/ui/Form';
import { num, shortAddr } from '@/utils/format';
import { MAX_CHAT_PATCHES, executedAccuracy, lockKind, lockOwnerLabel, useSince, useTicker } from './util';

const Panel = styled.aside`
  display: flex; flex-direction: column; gap: 12px; min-width: 0;
`;
const PanelTitle = styled.h2`
  margin: 0; font-size: 14px; font-weight: 700; color: ${(p) => p.theme.color.BLACK};
`;
const Hint = styled.p`margin: 0; font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.GREY};`;
const CountRow = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; color: ${(p) => p.theme.color.DARK_GREY};
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
  onClear: () => void;
  /** Knowledge the operator keeps loaded for everyone (contamination banner). */
  applied?: string[];
  overlaps?: ChatOverlap[];
  /** The visitor's own private lessons (teach mode); empty until wired. */
  lessons?: CatalogEntry[];
}

export function KnowledgePicker({ items, runtime, lock, clockSkewMs = 0, lockIsMine = false, selectedIds, onToggle, onClear, applied = [], overlaps = [], lessons = [] }: KnowledgePickerProps) {
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
  const appliedNames = applied.map(nameOf);
  const pinned = new Set(applied);

  // Overlaps among the current selection; the one ticked later wins on the shared entries.
  const selectedOverlaps = useMemo(() => {
    const pos = new Map(selectedIds.map((id, i) => [id, i] as const));
    return overlaps
      .filter((o) => pos.has(o.a) && pos.has(o.b))
      .map((o) => ({ ...o, winner: (pos.get(o.a) ?? 0) > (pos.get(o.b) ?? 0) ? o.a : o.b }));
  }, [overlaps, selectedIds]);

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
    const title = runtimeOff ? t('chat.runtime.off') : !active && full ? t('chat.picker.max') : a.description || a.name;
    return (
      <li key={a.id}>
        <Row $active={active} $disabled={disabled} title={title}>
          <input type="checkbox" checked={active} disabled={disabled} onChange={() => onToggle(a.id)} aria-label={a.name} />
          {active && <OrderBadge title={t('chat.picker.order_help')} aria-label={t('chat.picker.order', { n: order + 1 })}>{order + 1}</OrderBadge>}
          <Body>
            <Name>{a.name}</Name>
            <Id>{a.author_name ?? shortAddr(a.author)}/{a.id}</Id>
            <MetaRow>
              <span title={`${help('facts')} (${tech('facts')})`}>{t('units.facts', { n: num(a.benchmark.queries) })}</span>
              <Accuracy $known={!!acc} title={acc ? `${help('accuracy')} (${tech('accuracy')})` : t('chat.picker.not_scored_help')}>
                {acc ? (acc.pct !== null ? t('chat.picker.accuracy', { pct: acc.pct }) : t('chat.picker.accuracy_raw', { score: acc.raw })) : t('chat.picker.not_scored')}
              </Accuracy>
              <Price title={priceNote(e)}>{priceLabel(e)}</Price>
              {priceNote(e) && Number(a.price) > 0 && <PriceNote>{priceNote(e)}</PriceNote>}
            </MetaRow>
            <ChipRow>
              <StatusChip status={e.status} />
              {pinned.has(a.id) && <Pinned title={t('chat.picker.contaminated', { names: a.name })}>{t('chat.picker.always_loaded')}</Pinned>}
              {active && <Hint as="span">{t('chat.picker.order', { n: order + 1 })}</Hint>}
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
      {kind === 'other' && lock && (
        <Alert $tone="info" role="status" title={help('liveTest')} data-testid="chat-lock">
          {t('chat.lock.busy')}
          <Small>{t('chat.lock.holder', { label: lock.label, pid: lockOwnerLabel(lock.owner), since: since(lock.since) })}</Small>
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
      {applied.length > 0 && (
        <Alert $tone="warning" role="status" data-testid="chat-contaminated">
          {t('chat.picker.contaminated', { names: appliedNames.join(', ') })}
        </Alert>
      )}
      {selectedOverlaps.map((o) => (
        <Alert key={`${o.a}|${o.b}`} $tone="info" role="status" data-testid="chat-overlap" title={t('chat.picker.overlap', { n: num(o.rows) })}>
          {t('chat.picker.overlap_pair', { a: nameOf(o.a), b: nameOf(o.b), n: num(o.rows), winner: nameOf(o.winner) })}
        </Alert>
      ))}

      {items.length === 0 && lessons.length === 0 ? (
        <Hint>{t('chat.picker.empty')}</Hint>
      ) : (
        <>
          <CountRow>
            <span>{t('chat.picker.count', { n: selectedIds.length })}</span>
            <button type="button" onClick={onClear} disabled={selectedIds.length === 0}>{t('chat.picker.pick_none')}</button>
          </CountRow>
          {lessons.length > 0 && (
            <>
              <Section>{t('chat.picker.mine')}</Section>
              <List>{lessons.map(renderItem)}</List>
              <Section>{t('chat.picker.title')}</Section>
            </>
          )}
          <List>{items.map(renderItem)}</List>
        </>
      )}
    </Panel>
  );
}

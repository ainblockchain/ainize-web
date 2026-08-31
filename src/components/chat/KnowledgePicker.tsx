import styled from 'styled-components';
import type { CatalogEntry, RuntimeStatus } from '@/api/types';
import { useT } from '@/i18n';
import { StatusChip } from '@/components/ui/Misc';
import { Alert } from '@/components/ui/Form';
import { elapsed, num, shortAddr } from '@/utils/format';
import { executedAccuracy } from './util';

const Panel = styled.aside`
  display: flex; flex-direction: column; gap: 12px; min-width: 0;
`;
const PanelTitle = styled.h2`
  margin: 0; font-size: 14px; font-weight: 700; color: ${(p) => p.theme.color.BLACK};
`;
const Hint = styled.p`margin: 0; font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.GREY};`;
const List = styled.ul`margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px;`;
const Item = styled.button<{ $active: boolean }>`
  display: flex; flex-direction: column; align-items: flex-start; gap: 6px; width: 100%; padding: 12px 14px; text-align: left; cursor: pointer;
  background: ${(p) => (p.$active ? p.theme.color.PALE_GREY : '#fff')};
  border: 1px solid ${(p) => (p.$active ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)};
  border-left: 3px solid ${(p) => (p.$active ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)};
  border-radius: 4px; transition: border-color 0.2s ease, box-shadow 0.2s ease;
  &:hover:not(:disabled) { border-color: ${(p) => p.theme.color.PRIMARY}; box-shadow: 0 2px 6px 0 #e0e4e7; }
  &:disabled { cursor: not-allowed; opacity: 0.55; }
`;
const Name = styled.span`font-size: 14px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; line-height: 1.4; word-break: keep-all;`;
const Id = styled.span`font-family: ${(p) => p.theme.font.mono}; font-size: 11px; color: ${(p) => p.theme.color.GREY}; word-break: break-all;`;
const MetaRow = styled.span`display: flex; flex-wrap: wrap; gap: 6px 10px; font-size: 12px; color: ${(p) => p.theme.color.DARK_GREY};`;
const Accuracy = styled.span<{ $known: boolean }>`
  font-weight: ${(p) => (p.$known ? 600 : 400)}; color: ${(p) => (p.$known ? p.theme.color.SUCCESS : p.theme.color.GREY)};
`;
const Price = styled.span`font-weight: 600; color: ${(p) => p.theme.color.PRIMARY};`;
const ChipRow = styled.span`display: flex; flex-wrap: wrap; gap: 6px; align-items: center;`;
const Small = styled.div`font-size: 12px; line-height: 1.5; margin-top: 4px; opacity: 0.9;`;

export interface KnowledgePickerProps {
  items: CatalogEntry[];
  runtime: RuntimeStatus | undefined;
  lock: { owner: string; label: string; since: number } | null | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function KnowledgePicker({ items, runtime, lock, selectedId, onSelect }: KnowledgePickerProps) {
  const { t, term, help, tech, locale } = useT();
  const runtimeOff = !!runtime && !runtime.available;
  const priceLabel = (e: CatalogEntry) => {
    const n = Number(e.anchor.price);
    if (!n) return t('common.free');
    const unit = e.anchor.currency === 'CREDIT' ? term('credit') : e.anchor.currency === 'AIN' ? 'AIN' : e.anchor.currency;
    return `${n.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', { maximumFractionDigits: 6 })} ${unit}`;
  };
  const priceNote = (e: CatalogEntry) => (e.anchor.currency === 'CREDIT' ? t('price.credit_note') : e.anchor.currency === 'AIN' ? t('price.ain_note') : e.anchor.currency);

  return (
    <Panel aria-label={t('chat.picker.title')}>
      <PanelTitle>{t('chat.picker.title')}</PanelTitle>
      <Hint>{t('chat.picker.hint')}</Hint>

      {runtimeOff && (
        <Alert $tone="warning" role="status" title={runtime?.error ?? undefined}>
          {t('chat.runtime.off')}
          <Small>{t('chat.runtime.off_detail')}</Small>
        </Alert>
      )}
      {lock && (
        <Alert $tone="info" role="status" title={help('liveTest')}>
          {t('chat.lock.busy')}
          <Small>{t('chat.lock.holder', { label: lock.label, owner: shortAddr(lock.owner), since: elapsed(lock.since) })}</Small>
          <Small>{t('chat.lock.help')}</Small>
        </Alert>
      )}

      {items.length === 0 ? (
        <Hint>{t('chat.picker.empty')}</Hint>
      ) : (
        <List>
          {items.map((e) => {
            const a = e.anchor;
            const acc = executedAccuracy(e);
            const active = e.anchor.id === selectedId;
            return (
              <li key={a.id}>
                <Item type="button" $active={active} disabled={runtimeOff} aria-pressed={active} onClick={() => onSelect(a.id)}
                  title={runtimeOff ? t('chat.runtime.off') : a.description || a.name}>
                  <Name>{a.name}</Name>
                  <Id>{a.author_name ?? shortAddr(a.author)}/{a.id}</Id>
                  <MetaRow>
                    <span title={`${help('facts')} (${tech('facts')})`}>{t('units.facts', { n: num(a.benchmark.queries) })}</span>
                    <Accuracy $known={!!acc} title={acc ? `${help('accuracy')} (${tech('accuracy')})` : t('chat.picker.not_scored_help')}>
                      {acc ? (acc.pct !== null ? t('chat.picker.accuracy', { pct: acc.pct }) : t('chat.picker.accuracy_raw', { score: acc.raw })) : t('chat.picker.not_scored')}
                    </Accuracy>
                    <Price title={priceNote(e)}>{priceLabel(e)}</Price>
                  </MetaRow>
                  <ChipRow>
                    <StatusChip status={e.status} />
                    {active && <Hint as="span">{t('chat.picker.selected')}</Hint>}
                  </ChipRow>
                </Item>
              </li>
            );
          })}
        </List>
      )}
    </Panel>
  );
}

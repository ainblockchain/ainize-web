import { useMemo, useState } from 'react';
import styled from 'styled-components';
import type { CatalogEntry } from '@/api/types';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Form';
import { Sheet, SheetNote } from './Sheet';

/**
 * SC-3 — the base picker: *what are you building on?* (lineage design §4).
 *
 * One base only, and the reason a knowledge cannot be one is on the row itself rather than hidden behind a disabled
 * button: its creator kept the questions private (nothing to inherit, §6.1), or this node does not hold its body so
 * the trainer could not load it underneath (§12.1 `base_not_held`).
 */
const Group = styled.section`
  margin-top: 14px;
  h3 { margin: 0 0 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: ${(p) => p.theme.color.GREY}; }
`;
const List = styled.ul`margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px;`;
const Row = styled.li<{ $on: boolean; $off: boolean }>`
  display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 6px; background: #fff;
  border: 1px solid ${(p) => (p.$on ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)};
  opacity: ${(p) => (p.$off ? 0.65 : 1)};
  .body { flex: 1; min-width: 0; }
  .name { font-size: 13.5px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; word-break: break-word; }
  .meta { margin-top: 2px; font-size: 12px; color: ${(p) => p.theme.color.GREY}; word-break: break-word; }
  .why { margin-top: 4px; font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.WARNING}; }
`;

export interface BaseCandidate {
  id: string;
  name: string;
  author: string;
  status: string;
  /** questions in its published training set (undefined = it has none) */
  rows?: number;
  access?: 'public' | 'derivative' | 'private';
  /** the body is on this node, so the trainer can load it under the lesson */
  held: boolean;
  loaded: boolean;
  mine?: boolean;
}

/** A catalog entry as a candidate base — the three facts the sheet needs, read from the anchor, never guessed. */
export function toCandidate(e: CatalogEntry, loadedIds: string[], mine = false, heldIds?: string[]): BaseCandidate {
  const a = e.anchor;
  return {
    id: a.id, name: a.name, author: a.author_name ?? a.author, status: e.status,
    ...(a.dataset?.rows ? { rows: a.dataset.rows } : {}),
    ...(a.dataset?.access ? { access: a.dataset.access } : {}),
    held: heldIds ? heldIds.includes(a.id) : true, loaded: loadedIds.includes(a.id), mine,
  };
}

/** Why this knowledge cannot be a base — the copy the design gives for each case, or null when it can. */
export function baseBlocked(cand: BaseCandidate, t: (k: string, v?: Record<string, string | number>) => string): string | null {
  if (!cand.mine && (cand.access ?? 'private') === 'private') return t('teach.basket.base_private', { name: cand.name });
  if (!cand.held) return t('teach.pick.not_held');
  if (cand.status === 'SUPERSEDED') return t('teach.basket.base_retired', { name: cand.name });
  if (cand.status === 'REJECTED' || cand.status === 'CHALLENGED') return t('teach.pick.not_held');
  return null;
}

export interface BasePickerProps {
  candidates: BaseCandidate[];
  value: string | null;
  onPick: (id: string | null) => void;
  onClose: () => void;
}

export function BasePicker({ candidates, value, onPick, onClose }: BasePickerProps) {
  const { t } = useT();
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const match = (c: BaseCandidate) => !term || `${c.name} ${c.id} ${c.author}`.toLowerCase().includes(term);
    const seen = new Set<string>();
    const take = (pick: (c: BaseCandidate) => boolean) => {
      const out = candidates.filter((c) => match(c) && !seen.has(c.id) && pick(c));
      for (const c of out) seen.add(c.id);
      return out;
    };
    return [
      { key: 'teach.pick.loaded', items: take((c) => c.loaded) },
      { key: 'teach.pick.mine', items: take((c) => !!c.mine) },
      { key: 'teach.pick.search', items: take(() => true) },
    ].filter((g) => g.items.length);
  }, [candidates, q]);

  return (
    <Sheet title={t('teach.pick.title')} sub={t('teach.pick.one')} onClose={onClose} width={620} testId="base-picker">
      <TextField label={t('teach.pick.search')} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('teach.pick.search_ph')} data-testid="base-search" />
      <Group>
        <List>
          <Row $on={value === null} $off={false} data-testid="base-none">
            <div className="body"><div className="name">{t('teach.pick.none')}</div></div>
            <Button size="small" variant={value === null ? 'contained' : 'outlined'} onClick={() => { onPick(null); onClose(); }}>{t('teach.basket.base_choose')}</Button>
          </Row>
        </List>
      </Group>
      {groups.map((g) => (
        <Group key={g.key}>
          <h3>{t(g.key)}</h3>
          <List>
            {g.items.map((c) => {
              const why = baseBlocked(c, t);
              return (
                <Row key={c.id} $on={value === c.id} $off={!!why} data-testid="base-option" data-id={c.id}>
                  <div className="body">
                    <div className="name">{c.name}</div>
                    <div className="meta">{t('teach.pick.row', {
                      name: c.id, author: c.author, status: c.status, n: c.rows ?? 0,
                      share: t((c.access ?? 'private') === 'private' ? 'teach.pick.private' : 'teach.pick.shareable'),
                    })}</div>
                    {why && <div className="why" data-testid="base-why">{why}</div>}
                  </div>
                  <Button size="small" variant={value === c.id ? 'contained' : 'outlined'} disabled={!!why} onClick={() => { onPick(c.id); onClose(); }} data-testid="base-use">
                    {t('teach.pick.use')}
                  </Button>
                </Row>
              );
            })}
          </List>
        </Group>
      ))}
      {!groups.length && <SheetNote data-testid="base-empty">{t('teach.pick.empty')}</SheetNote>}
    </Sheet>
  );
}

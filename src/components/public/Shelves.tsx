import styled from 'styled-components';
import { Link } from 'react-router';
import { useExploreShelvesQuery } from '@/api/api';
import type { ShelfCard } from '@/api/types';
import { StatusChip } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { num } from '@/utils/format';

/**
 * SC-17 — the shelves. Four rows a visitor can act on, each made of a number this node can defend:
 *
 *   Selling now      settle records, price-0 and self-purchases excluded (§10)
 *   Being built on   children on the ledger plus this node's derive intents
 *   Just published   the newest anchors
 *   Asked for        this node's open questions, grouped by topic — labelled "this node", because it is
 *
 * A shelf with nothing in it is not rendered: an empty "Selling now" would read as "nothing sells here", which is
 * a claim about the market rather than about this node's records.
 */
const Wrap = styled.section`display: grid; gap: 24px; padding-bottom: 28px;`;
const Shelf = styled.div`display: grid; gap: 8px;`;
const Head = styled.h2`
  margin: 0; font-size: 15px; font-weight: 700; color: ${(p) => p.theme.color.BLACK};
  small { margin-left: 8px; font-size: 11px; font-weight: 500; color: ${(p) => p.theme.color.GREY}; }
`;
const Rail = styled.div`
  display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px;
  scroll-snap-type: x proximity;
  > * { scroll-snap-align: start; }
`;
const Card = styled(Link)`
  flex: 0 0 232px; display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; text-decoration: none;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; background: #fff;
  &:hover { border-color: ${(p) => p.theme.color.PRIMARY}; }
  .nm { font-size: 14px; font-weight: 600; color: ${(p) => p.theme.color.BLACK}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* Findings 26/27/56/97 all closed "a retired version presented as current"; these rails re-opened it by
     rendering no status at all, and on this node the "Selling now" rail is headed by a SUPERSEDED knowledge
     with 320 sales. The chip says which of them a visitor could actually load today. */
  .st { display: flex; }
  .by { font-size: 12px; color: ${(p) => p.theme.color.GREY}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fact { font-size: 12px; color: ${(p) => p.theme.color.DARK_GREY}; font-variant-numeric: tabular-nums; }
  .needs { font-size: 11px; color: #8a4b00; }
`;
const AskedRow = styled.div`
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; padding: 10px 12px; font-size: 13px;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; background: #fff; color: ${(p) => p.theme.color.DARK_GREY};
  a { font-size: 12px; font-weight: 600; color: ${(p) => p.theme.color.PRIMARY}; text-decoration: none; &:hover { text-decoration: underline; } }
`;

export function Shelves() {
  const { t } = useT();
  const { data } = useExploreShelvesQuery({ limit: 6 });
  if (!data) return null;
  const fact = (c: ShelfCard, shelf: string) => {
    if (shelf === 'built_on') return t('explore.card.built_on', { c: num(c.built_on ?? 0) });
    if (shelf === 'selling') return t('explore.card.sales', { n: num(c.sales_30d ?? 0) });
    return t('explore.card.rows', { n: num(c.rows) });
  };
  const shelves = data.shelves.filter((s) => s.items.length > 0);
  if (!shelves.length && !data.asked.length) return null;
  return (
    <Wrap data-testid="explore-shelves">
      {shelves.map((s) => (
        <Shelf key={s.id} data-testid={`shelf-${s.id}`}>
          {/* the two shelves made of ledger facts say so; "Just published" needs no scope, it is the record's own order */}
          <Head>{t(`explore.shelf.${s.id}`)}{s.id !== 'fresh' && <small>{t('detail.signals.scope_net')}</small>}</Head>
          <Rail>
            {s.items.map((c) => (
              <Card key={c.id} to={`/${encodeURIComponent(c.author)}/${encodeURIComponent(c.id)}`}>
                <span className="nm">{c.name}</span>
                <span className="st"><StatusChip status={c.status} /></span>
                <span className="by">{c.author_name ?? c.topic_path}</span>
                <span className="fact">{fact(c, s.id)}</span>
                {c.requires.length > 0 && <span className="needs">{t('explore.card.needs', { name: c.requires.map((r) => r.name).join(', ') })}</span>}
              </Card>
            ))}
          </Rail>
        </Shelf>
      ))}
      {data.asked.length > 0 && (
        <Shelf data-testid="shelf-asked">
          <Head>{t('explore.shelf.asked')}</Head>
          {data.asked.map((a) => (
            <AskedRow key={a.topic}>
              <span>{t('explore.shelf.asked_row', { topic: a.topic, n: num(a.count) })}</span>
              <Link to={`/chat/${encodeURIComponent(a.patches[0] ?? '')}?teach=1`}>{t('explore.shelf.asked_teach')} →</Link>
            </AskedRow>
          ))}
        </Shelf>
      )}
    </Wrap>
  );
}

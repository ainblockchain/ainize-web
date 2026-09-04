import styled from 'styled-components';
import { usePatchSignalsQuery } from '@/api/api';
import { useT } from '@/i18n';
import { num } from '@/utils/format';

/**
 * SC-11 — "how is this knowledge doing", as the design's single line. The numbers come from two different places
 * and the caption says which: sales, holders, children, subscribers and verification are network facts anyone can
 * read off the ledger; live tests are what happened on THIS node in the last 30 days. Nothing here is estimated —
 * a node that has never been asked shows 0 live tests, not a network average it cannot see.
 */
const Wrap = styled.div`margin-top: 10px; display: flex; flex-direction: column; gap: 2px;`;
const Line = styled.div`
  font-size: 13px; color: ${(p) => p.theme.color.DARK_GREY}; word-break: keep-all; line-height: 1.6;
  font-variant-numeric: tabular-nums;
`;
const Scope = styled.div`font-size: 11px; color: ${(p) => p.theme.color.GREY};`;

export function SignalsStrip({ id }: { id: string }) {
  const { t } = useT();
  const { data } = usePatchSignalsQuery(id);
  if (!data) return null;
  const n = data.network;
  const d = data.node as unknown as Record<string, number>;
  return (
    <Wrap data-testid="signals-strip">
      <Line>{t('detail.signals.strip', {
        s: num(n.sales_all), l: num(n.loads), t: num(d.tests ?? 0), h: num(d.hits ?? 0),
        c: num(n.built_on), w: num(n.subscribers), p: n.passed, q: n.quorum,
      })}</Line>
      <Scope data-testid="signals-scope">{t('detail.signals.scope_note', { net: t('detail.signals.scope_net'), node: t('detail.signals.scope_node') })}</Scope>
    </Wrap>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import styled from 'styled-components';
import { usePatchTreeQuery } from '@/api/api';
import type { TreeEdgeKind, TreeNode, TreeResponse } from '@/api/types';
import { useT } from '@/i18n';
import { num, shortAddr } from '@/utils/format';

/**
 * SC-9 — the family tree of one knowledge (lineage design §4, §12.5).
 *
 * Ancestors sit above, this knowledge in the middle, what was built on it below; the line between two nodes is
 * labelled with what the CHILD claimed it did. A `declared` edge is drawn dashed and says "declared parent — not
 * trained on top", because a parent link written before add-ons existed is credit, not a training claim (§14).
 *
 * The drawing is an SVG in a scrollable frame. Under 600 px it is replaced (CSS only, no viewport probing) by the
 * same tree as a list of rows, so a phone gets the whole family rather than a squeezed picture of a third of it.
 */

const Wrap = styled.div`display: flex; flex-direction: column; gap: 12px;`;
const Frame = styled.div`
  width: 100%; overflow-x: auto; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; background: #fff;
  @media (max-width: 600px) { display: none; }
`;
const List = styled.ul`
  display: none; margin: 0; padding: 0; list-style: none;
  @media (max-width: 600px) { display: grid; gap: 8px; }
  li { border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; padding: 10px 12px; background: #fff; }
  li .rel { font-size: 11px; font-weight: 700; color: ${(p) => p.theme.color.GREY}; text-transform: uppercase; letter-spacing: 0.03em; }
  li .nm { display: block; font-size: 14px; font-weight: 600; color: ${(p) => p.theme.color.BLACK}; text-decoration: none; margin-top: 2px; }
  li .sub { font-size: 12px; color: ${(p) => p.theme.color.GREY}; margin-top: 2px; }
`;
const Legend = styled.div`
  display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; color: ${(p) => p.theme.color.GREY};
  span { display: inline-flex; align-items: center; gap: 5px; }
  i { width: 18px; height: 0; border-top-width: 2px; border-top-style: solid; display: inline-block; }
`;
const Lines = styled.div`
  font-size: 13px; color: ${(p) => p.theme.color.DARK_GREY}; line-height: 1.7; word-break: keep-all;
  b { color: ${(p) => p.theme.color.BLACK}; font-weight: 600; }
`;
const Controls = styled.div`
  display: flex; align-items: center; gap: 8px; font-size: 12px; color: ${(p) => p.theme.color.GREY};
  select { font: inherit; padding: 2px 6px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; background: #fff; }
`;
const Buttons = styled.div`
  display: flex; flex-wrap: wrap; gap: 8px;
  a, button { font: inherit; font-size: 13px; font-weight: 600; padding: 7px 14px; border-radius: 4px; cursor: pointer; text-decoration: none;
    border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fff; color: ${(p) => p.theme.color.BLACK}; }
  a:hover, button:hover:not(:disabled) { border-color: ${(p) => p.theme.color.PRIMARY}; color: ${(p) => p.theme.color.PRIMARY}; }
  button:disabled { opacity: 0.5; cursor: default; }
  a.primary { background: ${(p) => p.theme.color.PRIMARY}; border-color: ${(p) => p.theme.color.PRIMARY}; color: #fff; }
  a.primary:hover { background: ${(p) => p.theme.color.HOVER}; color: #fff; }
`;

/** One colour per relation — the same order as the legend in the design. */
const KIND_COLOR: Record<TreeEdgeKind, string> = {
  extend: '#1b73e8', update: '#8a4b00', contradict: '#a0102c', merge: '#5b1ca8', version: '#8a4b00', track: '#0b5468', declared: '#8d8d8f',
};
const KIND_KEY: Record<TreeEdgeKind, string> = {
  extend: 'detail.tree.k.extend', update: 'detail.tree.k.update', contradict: 'detail.tree.k.contradict',
  merge: 'detail.tree.k.merge', version: 'detail.tree.k.version', track: 'detail.tree.k.track', declared: 'detail.tree.k.declared',
};

const BOX_W = 176, BOX_H = 62, GAP_X = 26, ROW_H = 118, PAD = 16;

export function FamilyTree({ id, authorSlug, canBuildOn, datasetPrivate, datasetNone = false }: { id: string; authorSlug: string; canBuildOn: boolean; datasetPrivate: boolean; datasetNone?: boolean }) {
  const { t } = useT();
  const [depth, setDepth] = useState(4);
  const { data, isLoading } = usePatchTreeQuery({ id, depth });
  const layout = useMemo(() => (data ? place(data) : null), [data]);
  if (isLoading || !data || !layout) return null;

  const added = (n: TreeNode) => t('detail.tree.added', { m: num(n.added.questions), k: num(n.added.changed), rows: num(n.added.rows), new: num(n.added.new) });
  const hover = (n: TreeNode) => (n.missing ? t('detail.tree.missing', { id: n.id }) : t('detail.tree.node_hover', {
    name: n.name, teacher: n.taught_by ?? n.author_name ?? shortAddr(n.author ?? '', 6),
    sales: num(n.signals.sales_all ?? 0), loads: num(n.signals.loads ?? 0), c: num(n.signals.built_on ?? 0),
  }));
  const kindsShown = [...new Set(data.edges.map((e) => e.kind))];
  // SC-9's "{names}" are the knowledges whose creators share the lineage pool — not every address on the split
  const names = data.money.lineage_names.join(', ');
  // …and the people credited on THIS knowledge, named the same way the money names them: a name when the record
  // carries one, the address otherwise. Never "someone", which would hide who a creator is actually paying.
  const credited = data.money.recipients.filter((r) => r.kind === 'contributor').map((r) => r.name ?? shortAddr(r.address, 6)).join(', ');
  // one rule for both buttons: the flag holds building back, and a base with no questions to start from cannot be
  // built on at all — the note under them says which of the two it is
  const blocked = !canBuildOn || datasetPrivate || datasetNone;

  return (
    <Wrap>
      <Controls>
        <label htmlFor="tree-depth">{t('detail.tree.depth')}</label>
        <select id="tree-depth" value={depth} onChange={(e) => setDepth(Number(e.target.value))} data-testid="tree-depth">
          {[2, 4, 6, 8].map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        {data.truncated && <span data-testid="tree-truncated">{t('detail.tree.truncated', { depth })}</span>}
      </Controls>

      {kindsShown.length > 0 && (
        <Legend data-testid="tree-legend">
          {kindsShown.map((k) => <span key={k}><i style={{ borderTopColor: KIND_COLOR[k], borderTopStyle: k === 'declared' ? 'dashed' : 'solid' }} />{t(KIND_KEY[k])}</span>)}
        </Legend>
      )}

      <Frame>
        <svg width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={t('detail.tab.tree')} data-testid="tree-svg">
          {data.edges.map((e, i) => {
            const a = layout.pos.get(e.from); const b = layout.pos.get(e.to);
            if (!a || !b) return null;
            const x1 = a.x + BOX_W / 2, y1 = a.y + BOX_H, x2 = b.x + BOX_W / 2, y2 = b.y;
            const mid = (y1 + y2) / 2;
            return <path key={i} d={`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`} fill="none" stroke={KIND_COLOR[e.kind]} strokeWidth={2} strokeDasharray={e.kind === 'declared' ? '5 4' : undefined} />;
          })}
          {layout.nodes.map((n) => {
            const p = layout.pos.get(n.id)!;
            const me = n.id === data.root;
            return (
              <g key={n.id} transform={`translate(${p.x} ${p.y})`} data-testid={`tree-node-${n.id}`}>
                <title>{hover(n)}</title>
                {n.missing ? (
                  <rect width={BOX_W} height={BOX_H} rx={4} fill="#fafafa" stroke="#d9d9d9" strokeDasharray="4 3" />
                ) : (
                  <a href={`/${authorSlug}/${encodeURIComponent(n.id)}`}>
                    <rect width={BOX_W} height={BOX_H} rx={4} fill={me ? '#e8f0fe' : '#fff'} stroke={me ? '#1b73e8' : '#e0e0e0'} strokeWidth={me ? 2 : 1} />
                    <text x={10} y={20} fontSize={12} fontWeight={600} fill="#1a1a1a">{clip(n.name || n.id, 26)}</text>
                    <text x={10} y={36} fontSize={10} fill="#8d8d8f">{clip(n.taught_by ?? n.author_name ?? n.id, 30)}</text>
                    <text x={10} y={51} fontSize={10} fill="#5f6368">{added(n)}</text>
                  </a>
                )}
                {n.missing && <text x={10} y={34} fontSize={11} fill="#8d8d8f">{clip(t('detail.tree.missing', { id: n.id }), 28)}</text>}
                {n.legacy && !n.missing && <text x={10} y={BOX_H + 12} fontSize={10} fill="#8a4b00">{t('detail.tree.legacy')}</text>}
              </g>
            );
          })}
        </svg>
      </Frame>

      <List data-testid="tree-list">
        {layout.nodes.map((n) => {
          const rel = n.id === data.root ? 'detail.tree.this' : (KIND_KEY[data.edges.find((e) => e.to === n.id)?.kind ?? 'declared']);
          return (
            <li key={n.id}>
              <span className="rel">{n.depth < 0 ? t('detail.tree.k.base') : t(rel)}</span>
              {n.missing ? <span className="nm">{t('detail.tree.missing', { id: n.id })}</span> : <Link className="nm" to={`/${authorSlug}/${encodeURIComponent(n.id)}`}>{n.name}</Link>}
              {!n.missing && <div className="sub">{added(n)}</div>}
              {!n.missing && <div className="sub">{hover(n)}</div>}
            </li>
          );
        })}
      </List>

      {data.nodes.length <= 1 && <Lines data-testid="tree-empty">{t('detail.tree.empty')}</Lines>}

      <Lines>
        <div data-testid="tree-family">{t('detail.tree.family', { sales: num(data.family.sales), n: num(data.family.knowledges), authors: num(data.family.authors) })}</div>
        {data.money.lineage_pct > 0 && (
          <div data-testid="tree-money">{t('detail.tree.money', { seller: data.money.seller_pct, seller_name: data.money.seller_name ?? shortAddr(data.nodes.find((n) => n.id === data.root)?.author ?? '', 6), lineage: data.money.lineage_pct, names })}</div>
        )}
        {data.money.contributor_pct > 0 && (
          <div data-testid="tree-money-contrib">{t('detail.tree.money_contrib', { pct: data.money.contributor_pct, names: credited })}</div>
        )}
        {/* Item 325: the same sale also pays the verifiers that keep it on sale — this line is computed by the real
            splitter, so the percentages here are the ones that will move. */}
        {!!data.money.verifier_pct && (
          <div data-testid="tree-money-verify">{t('detail.tree.money_verify', { pct: data.money.verifier_pct, n: data.money.verifier_count ?? 0 })}</div>
        )}
      </Lines>

      <Buttons>
        {/* Gated by `teach.lineage` (§18): reading the family is always allowed, building on it is what the flag holds back. */}
        <a className="primary" href={blocked ? undefined : `/teach/settings?on=${encodeURIComponent(id)}`}
          aria-disabled={blocked} data-testid="tree-teach-on"
          style={blocked ? { pointerEvents: 'none', opacity: 0.5 } : undefined}>{t('detail.tree.btn_teach')}</a>
        <a href={blocked ? undefined : `/teach/settings?on=${encodeURIComponent(id)}&copy=1`} data-testid="tree-copy"
          aria-disabled={blocked} style={blocked ? { pointerEvents: 'none', opacity: 0.5 } : undefined}>{t('detail.tree.btn_copy')}</a>
      </Buttons>
      {datasetPrivate && <Lines data-testid="tree-private">{t('detail.build_on_private')}</Lines>}
      {datasetNone && <Lines data-testid="tree-no-dataset">{t('detail.build_on_none')}</Lines>}
      {!canBuildOn && !datasetPrivate && !datasetNone && <Lines data-testid="tree-flag-off">{t('detail.tree.off')}</Lines>}
    </Wrap>
  );
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Rows by depth (ancestors negative, descendants positive), nodes spread evenly inside each row. */
function place(tree: TreeResponse) {
  const rows = new Map<number, TreeNode[]>();
  for (const n of tree.nodes) {
    const r = rows.get(n.depth) ?? [];
    r.push(n);
    rows.set(n.depth, r);
  }
  const depths = [...rows.keys()].sort((a, b) => a - b);
  const widest = Math.max(1, ...depths.map((d) => rows.get(d)!.length));
  const width = PAD * 2 + widest * BOX_W + (widest - 1) * GAP_X;
  const height = PAD * 2 + depths.length * BOX_H + (depths.length - 1) * (ROW_H - BOX_H);
  const pos = new Map<string, { x: number; y: number }>();
  const nodes: TreeNode[] = [];
  depths.forEach((d, row) => {
    const list = rows.get(d)!.slice().sort((a, b) => a.id.localeCompare(b.id));
    const rowWidth = list.length * BOX_W + (list.length - 1) * GAP_X;
    const x0 = (width - rowWidth) / 2;
    list.forEach((n, i) => {
      pos.set(n.id, { x: x0 + i * (BOX_W + GAP_X), y: PAD + row * ROW_H });
      nodes.push(n);
    });
  });
  return { width: Math.max(width, 320), height, pos, nodes };
}

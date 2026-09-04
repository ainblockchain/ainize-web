import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import styled from 'styled-components';
import { useGraphQuery, useLedgerQuery, useLedgerVerifyQuery } from '@/api/api';
import type { GraphResponse } from '@/api/types';
import { STATUS_META } from '@/theme/theme';
import { CenterProgress, Description, Empty, ExternalLink, KeyValue, Mono, PageWrapper, Pagination, SelectBox, SubTitle, Title, TitleRow } from '@/components/ui/Misc';
import { Offline } from '@/components/ui/Offline';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableWrapper } from '@/components/ui/Table';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { dateTime, num, shortAddr, shortHash } from '@/utils/format';
import { useDetailFormat } from './detail/recordText';

const KINDS = ['anchor', 'attest', 'settle', 'branch', 'node', 'supersede', 'subscribe', 'challenge'];
const PAGE = 20;

const InfoCard = styled.div`
  display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1px; background: ${(p) => p.theme.color.LIGHT_GREY}; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; margin: 16px 0 24px;
`;
const InfoCell = styled.div`
  background: #fff; padding: 14px 18px;
  .k { font-size: 12px; color: ${(p) => p.theme.color.GREY}; }
  .v { margin-top: 2px; font-size: 18px; font-weight: 500; color: ${(p) => p.theme.color.BLACK}; word-break: break-all; }
  .v.small { font-size: 13px; font-family: ${(p) => p.theme.font.mono}; }
`;
const Verify = styled.span<{ $ok: boolean | undefined }>`
  display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: ${(p) => (p.$ok === undefined ? p.theme.color.GREY : p.$ok ? p.theme.color.SUCCESS : p.theme.color.ERROR)};
  &::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
`;
const KindChip = styled.span<{ $kind: string }>`
  display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; white-space: nowrap;
  background: ${(p) => ({ anchor: '#e8f0fe', attest: '#e6f4ea', settle: '#f5eefc', supersede: '#fff3e0', challenge: '#fde8ec', branch: '#e1eef3', node: '#f2f2f2', subscribe: '#e1eef3' } as Record<string, string>)[p.$kind] ?? '#f2f2f2'};
  color: ${(p) => ({ anchor: '#1b73e8', attest: '#1e6b36', settle: '#5b1ca8', supersede: '#8a4b00', challenge: '#a0102c', branch: '#0b5468', node: '#555', subscribe: '#0b5468' } as Record<string, string>)[p.$kind] ?? '#555'};
`;
const GraphBox = styled.div`
  margin-top: 16px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; overflow-x: auto; padding: 16px;
`;
const Legend = styled.div`
  display: flex; gap: 18px; flex-wrap: wrap; margin-top: 8px; font-size: 12px; color: ${(p) => p.theme.color.GREY};
  span { display: inline-flex; align-items: center; gap: 6px; }
  i { display: inline-block; width: 18px; height: 0; border-top: 2px solid; }
`;
const Errors = styled.ul`margin: 8px 0 0; padding-left: 18px; font-size: 12px; color: ${(p) => p.theme.color.ERROR};`;

/* ---------------------------------------------------------------- 원본→파생 관계도 (SVG DAG by generation) */
interface Placed { id: string; x: number; y: number; status: string; name: string; model: string; author: string; }

function layout(g: GraphResponse): { nodes: Placed[]; edges: { from: Placed; to: Placed; type: string }[]; w: number; h: number } {
  const parents = new Map<string, string[]>();
  for (const n of g.nodes) parents.set(n.id, []);
  for (const e of g.edges) if (e.type === 'extends' && parents.has(e.from) && parents.has(e.to)) parents.get(e.from)!.push(e.to);
  const gen = new Map<string, number>();
  const depth = (id: string, seen: Set<string>): number => {
    if (gen.has(id)) return gen.get(id)!;
    if (seen.has(id)) return 0;
    seen.add(id);
    const ps = parents.get(id) ?? [];
    const d = ps.length ? 1 + Math.max(...ps.map((p) => depth(p, seen))) : 0;
    gen.set(id, d);
    return d;
  };
  for (const n of g.nodes) depth(n.id, new Set());
  const cols = new Map<number, string[]>();
  for (const n of g.nodes) { const d = gen.get(n.id) ?? 0; if (!cols.has(d)) cols.set(d, []); cols.get(d)!.push(n.id); }
  const COL = 220, ROW = 64, PAD = 20;
  const placed = new Map<string, Placed>();
  let maxRows = 1;
  for (const [d, ids] of cols) {
    ids.sort();
    maxRows = Math.max(maxRows, ids.length);
    ids.forEach((id, i) => {
      const n = g.nodes.find((x) => x.id === id)!;
      placed.set(id, { id, x: PAD + d * COL, y: PAD + i * ROW, status: n.status, name: n.name, model: n.model, author: n.author });
    });
  }
  const edges = g.edges.filter((e) => placed.has(e.from) && placed.has(e.to)).map((e) => ({ from: placed.get(e.from)!, to: placed.get(e.to)!, type: e.type }));
  return { nodes: [...placed.values()], edges, w: PAD * 2 + Math.max(1, cols.size) * COL, h: PAD * 2 + maxRows * ROW };
}

function KnowledgeGraph({ g }: { g: GraphResponse }) {
  const { t } = useT();
  const L = useMemo(() => layout(g), [g]);
  const BW = 170, BH = 40;
  if (!L.nodes.length) return <Empty style={{ marginTop: 16 }}>{t('detail.ledger.graph_empty')}</Empty>;
  const statusLabel = (s: string) => { const k = t(`status.${s}`); return k === `status.${s}` ? (STATUS_META[s]?.label ?? s) : k; };
  return (
    <>
      <GraphBox>
        <svg width={L.w} height={L.h} role="img" aria-label={t('detail.ledger.graph_aria')} style={{ display: 'block', minWidth: L.w }}>
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#8d8d8f" /></marker>
            <marker id="arr2" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#f6981d" /></marker>
          </defs>
          {L.edges.map((e, i) => {
            // child (from) → parent (to): draw from child's left edge to parent's right edge
            const x1 = e.from.x, y1 = e.from.y + BH / 2, x2 = e.to.x + BW, y2 = e.to.y + BH / 2;
            const mx = (x1 + x2) / 2;
            const sup = e.type === 'supersedes';
            return <path key={i} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} fill="none" stroke={sup ? '#f6981d' : '#8d8d8f'} strokeWidth={1.5} strokeDasharray={sup ? '5 4' : undefined} markerEnd={sup ? 'url(#arr2)' : 'url(#arr)'} />;
          })}
          {L.nodes.map((n) => {
            const m = STATUS_META[n.status] ?? { color: '#8d8d8f', bg: '#f2f2f2', label: n.status, hint: '' };
            const label = statusLabel(n.status);
            return (
              <Link key={n.id} to={`/${encodeURIComponent(n.author)}/${encodeURIComponent(n.id)}`}>
                <g transform={`translate(${n.x} ${n.y})`}>
                  <title>{`${n.name}\n${n.id} · ${n.model} · ${label}`}</title>
                  <rect width={BW} height={BH} rx={4} fill="#fff" stroke={m.color} strokeWidth={1.5} />
                  <rect x={0} y={0} width={4} height={BH} rx={2} fill={m.color} />
                  <text x={12} y={17} fontSize={12} fontFamily="Inconsolata, monospace" fill="#303133">{n.id.length > 22 ? `${n.id.slice(0, 21)}…` : n.id}</text>
                  <text x={12} y={31} fontSize={10} fill="#8d8d8f">{label} · {n.model.length > 16 ? `${n.model.slice(0, 15)}…` : n.model}</text>
                </g>
              </Link>
            );
          })}
        </svg>
      </GraphBox>
      <Legend>
        <span><i style={{ borderColor: '#8d8d8f' }} /> {t('detail.ledger.legend_extends')}</span>
        <span><i style={{ borderColor: '#f6981d', borderTopStyle: 'dashed' }} /> {t('detail.ledger.legend_supersedes')}</span>
        <span>{t('detail.ledger.legend_columns')}</span>
      </Legend>
    </>
  );
}

/* ---------------------------------------------------------------- page */
export default function LedgerPage() {
  const { t, help, tech } = useT();
  useTitle(t('detail.ledger.title'));
  const f = useDetailFormat();
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const ledger = useLedgerQuery({ kind: kind || undefined, limit: 1000 }, { pollingInterval: 10_000 });
  const { data, isLoading } = ledger;
  /*
   * Finding 77: with the node unreachable this page drew its whole frame anyway — every stat an em-dash,
   * "Integrity checking…" for ever, and "No records yet." under it. On a public record an outage rendered as
   * "no records" is the worst possible lie, so nothing derived from the record is drawn while the query is failing.
   */
  const unreachable = !data && (ledger.isError || (!ledger.isLoading && !ledger.isFetching));
  const { data: verify } = useLedgerVerifyQuery(undefined, { pollingInterval: 30_000 });
  const { data: graph } = useGraphQuery(undefined, { pollingInterval: 20_000 });

  const kindOptions = useMemo(() => [{ value: '', label: t('detail.kind.all') }, ...KINDS.map((k) => ({ value: k, label: f.kindLabel(k) }))], [t, f]);
  const records = data?.records ?? [];   // API already returns newest first
  /**
   * Item 197 — the settle rows name the people they paid, and the record itself is where their names are: a `node`
   * record carries a node's name, an `anchor` carries the author's and its contributors'. No extra request, and
   * nothing invented: an address the record never named stays an address.
   */
  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of records) {
      const b = (r.body ?? {}) as Record<string, unknown>;
      if (r.kind === 'node' && typeof b.address === 'string' && typeof b.name === 'string' && b.name) m.set(b.address.toLowerCase(), b.name);
      if (r.kind === 'anchor') {
        if (typeof b.author === 'string' && typeof b.author_name === 'string' && b.author_name) m.set(b.author.toLowerCase(), b.author_name);
        for (const c of (b.contributors as { address?: string; signer?: string; name?: string }[] | undefined) ?? []) {
          if (c.name && c.address) m.set(c.address.toLowerCase(), c.name);
          if (c.name && c.signer) m.set(c.signer.toLowerCase(), c.name);
        }
      }
    }
    return (address: string) => m.get(address.toLowerCase());
  }, [records]);
  const pageCount = Math.max(1, Math.ceil(records.length / PAGE));
  const current = Math.min(page, pageCount);
  const visible = records.slice((current - 1) * PAGE, current * PAGE);
  const info = data?.info;
  const ain = info?.kind === 'ain';

  return (
    <PageWrapper $wide>
      <TitleRow>
        <Title title={tech('ledger')}>{t('detail.ledger.title')}</Title>
        <SelectBox options={kindOptions} value={kind} onChange={(v) => { setKind(v); setPage(1); }} label={t('common.kind_aria')} />
      </TitleRow>
      <Description style={{ marginTop: -12 }}>{help('ledger')}</Description>

      {unreachable && <Offline error={ledger.error} what={t('offline.what.ledger')} retrying={ledger.isFetching} onRetry={() => { void ledger.refetch(); }} />}

      {!unreachable && (<>
      <InfoCard>
        <InfoCell><div className="k">{t('detail.ledger.kind')}</div><div className="v">{info ? (ain ? t('detail.ledger_kind.ain') : t('detail.ledger_kind.local')) : '—'}</div></InfoCell>
        <InfoCell><div className="k">{t('detail.ledger.network')}</div><div className="v small">{info?.network ?? '—'}</div></InfoCell>
        <InfoCell><div className="k">{t('detail.ledger.records')}</div><div className="v">{num(info?.records)}</div></InfoCell>
        <InfoCell><div className="k">{ain ? t('detail.ledger.height') : t('detail.ledger.sequence')}</div><div className="v">{num(info?.height)}</div></InfoCell>
        <InfoCell><div className="k">{ain ? t('detail.ledger.provider') : t('detail.ledger.head')}</div><div className="v small">{ain ? info?.provider : shortHash(info?.head, 16)}</div></InfoCell>
        <InfoCell>
          <div className="k">{t('detail.ledger.integrity')}</div>
          <div className="v"><Verify $ok={verify?.valid}>{verify ? (verify.valid ? t('detail.ledger.valid', { n: num(verify.checked) }) : t('detail.ledger.invalid', { n: verify.errors.length })) : t('detail.ledger.checking')}</Verify></div>
          {verify && !verify.valid && <Errors>{verify.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}</Errors>}
        </InfoCell>
      </InfoCard>
      {ain && info?.app && (
        <KeyValue style={{ margin: '-8px 0 24px' }}>
          <dt title={t('detail.tech.app_path', { app: info.app })}>{t('detail.ledger.app_path')}</dt><dd><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#8d8d8f', marginRight: 8 }}>{t('detail.ledger.dev_title')}</span><Mono>{info.app}</Mono> — {t('detail.ledger.app_note', { app: info.app })}</dd>
          <dt>{t('detail.ledger.explorer')}</dt><dd><ExternalLink href={`${info.provider}/get_value?ref=${encodeURIComponent(info.app)}`} target="_blank" rel="noopener noreferrer">{info.provider}/get_value?ref={info.app}</ExternalLink></dd>
        </KeyValue>
      )}

      {isLoading && <CenterProgress />}
      {!isLoading && records.length === 0 && <Empty>{kind ? t('detail.ledger.empty_kind', { kind: f.kindLabel(kind) }) : t('detail.ledger.empty')}</Empty>}
      {/*
        * The node returns the NEWEST `limit` records and cannot page further back. With an unfiltered view the card
        * above says how many records exist, so a table that can only ever hold 1,000 of them has to say which part
        * of the record it is showing instead of letting the two numbers contradict each other.
        */}
      {!kind && records.length > 0 && (info?.records ?? 0) > records.length && (
        <Description data-testid="ledger-window">{t('detail.ledger.window', { shown: num(records.length), total: num(info?.records) })}</Description>
      )}
      {records.length > 0 && (
        <>
          <TableWrapper style={{ background: '#fff', border: '1px solid #dadada' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead $align="left" $padding="0 0 0 24px">{t('detail.ledger.h.time')}</TableHead><TableHead $align="left">{t('detail.ledger.h.kind')}</TableHead><TableHead $align="left">{t('detail.ledger.h.summary')}</TableHead><TableHead>{t('detail.ledger.h.author')}</TableHead><TableHead $align="right" $padding="0 24px 0 8px">{t('detail.ledger.h.hash')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((r) => {
                  const s = f.recordSummary(r, { names: nameOf });
                  return (
                    <TableRow key={r.hash}>
                      <TableData $align="left" $padding="0 0 0 24px" title={dateTime(r.ts)} $maxWidth="140px">{f.ago(r.ts)}</TableData>
                      <TableData $align="left" $maxWidth="130px"><KindChip $kind={r.kind} title={r.kind}>{f.kindLabel(r.kind)}</KindChip></TableData>
                      <TableData $align="left" $maxWidth="480px" title={s}>{s}</TableData>
                      <TableData $mono title={r.author}>{r.author.startsWith('prototype') ? 'prototype' : shortAddr(r.author, 6)}</TableData>
                      <TableData $align="right" $padding="0 24px 0 8px" $mono title={r.sig && r.sig.startsWith('0x') ? `tx ${r.sig}` : r.hash}>{shortHash(r.sig && r.sig.startsWith('0x') ? r.sig : r.hash, 14)}</TableData>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableWrapper>
          <Pagination page={current} pageCount={pageCount} onChange={setPage} />
        </>
      )}

      </>)}

      {!unreachable && (<>
      <SubTitle $mt={40} title={tech('lineage')}>{t('detail.ledger.graph_title')}</SubTitle>
      <Description>{t('detail.ledger.graph_note')}</Description>
      {!graph && <CenterProgress />}
      {graph && <KnowledgeGraph g={graph} />}
      </>)}
    </PageWrapper>
  );
}

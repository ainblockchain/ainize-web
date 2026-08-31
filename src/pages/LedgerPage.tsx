import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import styled from 'styled-components';
import { useGraphQuery, useLedgerQuery, useLedgerVerifyQuery } from '@/api/api';
import type { GraphResponse, LedgerRecord } from '@/api/types';
import { STATUS_META } from '@/theme/theme';
import { CenterProgress, Empty, ExternalLink, KeyValue, Mono, PageWrapper, Pagination, SelectBox, SubTitle, Title, TitleRow } from '@/components/ui/Misc';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableWrapper } from '@/components/ui/Table';
import { dateTime, elapsed, num, shortAddr, shortHash } from '@/utils/format';

const KIND_OPTIONS = [
  { value: '', label: 'All records' },
  { value: 'anchor', label: 'anchor' },
  { value: 'attest', label: 'attest' },
  { value: 'settle', label: 'settle' },
  { value: 'branch', label: 'branch' },
  { value: 'node', label: 'node' },
  { value: 'supersede', label: 'supersede' },
  { value: 'subscribe', label: 'subscribe' },
  { value: 'challenge', label: 'challenge' },
];
const PAGE = 20;

const InfoCard = styled.div`
  display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1px; background: ${(p) => p.theme.color.LIGHT_GREY}; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; margin-bottom: 24px;
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
  display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
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

function summary(r: LedgerRecord): string {
  const b = r.body as Record<string, unknown>;
  switch (r.kind) {
    case 'anchor': return `anchor ${String(b.id)} · ${String(b.name ?? '')}`.trim();
    case 'attest': return `attest ${String(b.patch_id ?? b.id)} ${b.passed === false ? 'FAIL' : 'PASS'} by ${String(b.verifier_name ?? shortAddr(String(b.verifier)))}`;
    case 'settle': return `settle ${String(b.patch_id ?? b.resource)} · ${String(b.amount)} ${String(b.currency ?? '')}`.trim();
    case 'branch': return `branch ${String(b.name)} (${(b.patch_ids as string[] | undefined)?.length ?? 0} patches)`;
    case 'node': return `node ${String(b.name)} @ ${String(b.endpoint)} [${((b.roles as string[]) ?? []).join(',')}]`;
    case 'supersede': return `${String(b.new_patch_id)} supersedes ${String(b.old_patch_id)} (${String(b.overlap_rows)} rows)`;
    case 'subscribe': return `${String(b.action)} ${String(b.branch)} by ${shortAddr(String(b.node))}`;
    case 'challenge': return `challenge ${String(b.patch_id)}: ${String(b.reason)}`;
    default: return r.kind;
  }
}

/* ---------------------------------------------------------------- knowledge graph (SVG DAG by generation) */
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
  const L = useMemo(() => layout(g), [g]);
  const BW = 170, BH = 40;
  if (!L.nodes.length) return <Empty>No patches on the ledger yet.</Empty>;
  return (
    <>
      <GraphBox>
        <svg width={L.w} height={L.h} role="img" aria-label="knowledge patch lineage graph" style={{ display: 'block', minWidth: L.w }}>
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
            return (
              <Link key={n.id} to={`/${encodeURIComponent(n.author)}/${encodeURIComponent(n.id)}`}>
                <g transform={`translate(${n.x} ${n.y})`}>
                  <title>{`${n.name}\n${n.model} · ${m.label}`}</title>
                  <rect width={BW} height={BH} rx={4} fill="#fff" stroke={m.color} strokeWidth={1.5} />
                  <rect x={0} y={0} width={4} height={BH} rx={2} fill={m.color} />
                  <text x={12} y={17} fontSize={12} fontFamily="Inconsolata, monospace" fill="#303133">{n.id.length > 22 ? `${n.id.slice(0, 21)}…` : n.id}</text>
                  <text x={12} y={31} fontSize={10} fill="#8d8d8f">{m.label} · {n.model.length > 16 ? `${n.model.slice(0, 15)}…` : n.model}</text>
                </g>
              </Link>
            );
          })}
        </svg>
      </GraphBox>
      <Legend>
        <span><i style={{ borderColor: '#8d8d8f' }} /> extends (lineage → royalty)</span>
        <span><i style={{ borderColor: '#f6981d', borderTopStyle: 'dashed' }} /> supersedes (same benchmark, overlapping rows)</span>
        <span>columns = generation from root patches</span>
      </Legend>
    </>
  );
}

/* ---------------------------------------------------------------- page */
export default function LedgerPage() {
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useLedgerQuery({ kind: kind || undefined, limit: 1000 }, { pollingInterval: 10_000 });
  const { data: verify } = useLedgerVerifyQuery(undefined, { pollingInterval: 30_000 });
  const { data: graph } = useGraphQuery(undefined, { pollingInterval: 20_000 });

  const records = data?.records ?? [];   // API already returns newest first
  const pageCount = Math.max(1, Math.ceil(records.length / PAGE));
  const current = Math.min(page, pageCount);
  const visible = records.slice((current - 1) * PAGE, current * PAGE);
  const info = data?.info;
  const ain = info?.kind === 'ain';

  return (
    <PageWrapper $wide>
      <TitleRow>
        <Title>Ledger</Title>
        <SelectBox options={KIND_OPTIONS} value={kind} onChange={(v) => { setKind(v); setPage(1); }} />
      </TitleRow>

      <InfoCard>
        <InfoCell><div className="k">Kind</div><div className="v">{info ? (ain ? 'AIN blockchain' : 'Local P2P DAG') : '—'}</div></InfoCell>
        <InfoCell><div className="k">Network</div><div className="v small">{info?.network ?? '—'}</div></InfoCell>
        <InfoCell><div className="k">Records</div><div className="v">{num(info?.records)}</div></InfoCell>
        <InfoCell><div className="k">{ain ? 'Block height' : 'Sequence'}</div><div className="v">{num(info?.height)}</div></InfoCell>
        <InfoCell><div className="k">{ain ? 'Provider' : 'Head'}</div><div className="v small">{ain ? info?.provider : shortHash(info?.head, 16)}</div></InfoCell>
        <InfoCell>
          <div className="k">Integrity</div>
          <div className="v"><Verify $ok={verify?.valid}>{verify ? (verify.valid ? `valid · ${num(verify.checked)} checked` : `invalid (${verify.errors.length})`) : 'checking…'}</Verify></div>
          {verify && !verify.valid && <Errors>{verify.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}</Errors>}
        </InfoCell>
      </InfoCard>
      {ain && info?.app && (
        <KeyValue style={{ margin: '-8px 0 24px' }}>
          <dt>App path</dt><dd><Mono>{info.app}</Mono> — anchors are ain-js <Mono>knowledge.explore()</Mono> entries; attestations/settlements/branches live under <Mono>{info.app}/market</Mono> with per-address write rules.</dd>
          <dt>Explorer</dt><dd><ExternalLink href={`${info.provider}/get_value?ref=${encodeURIComponent(info.app)}`} target="_blank" rel="noopener noreferrer">{info.provider}/get_value?ref={info.app}</ExternalLink></dd>
        </KeyValue>
      )}

      {isLoading && <CenterProgress />}
      {!isLoading && records.length === 0 && <Empty>No records{kind ? ` of kind ${kind}` : ''} yet.</Empty>}
      {records.length > 0 && (
        <>
          <TableWrapper style={{ background: '#fff', border: '1px solid #dadada' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead $align="left" $padding="0 0 0 24px">Time</TableHead><TableHead $align="left">Kind</TableHead><TableHead $align="left">Summary</TableHead><TableHead>Author</TableHead><TableHead $align="right" $padding="0 24px 0 8px">Hash / tx</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((r) => (
                  <TableRow key={r.hash}>
                    <TableData $align="left" $padding="0 0 0 24px" title={dateTime(r.ts)} $maxWidth="140px">{r.ts ? elapsed(r.ts) : '—'}</TableData>
                    <TableData $align="left" $maxWidth="110px"><KindChip $kind={r.kind}>{r.kind}</KindChip></TableData>
                    <TableData $align="left" $maxWidth="480px" title={summary(r)}>{summary(r)}</TableData>
                    <TableData $mono title={r.author}>{r.author.startsWith('prototype') ? 'prototype' : shortAddr(r.author, 6)}</TableData>
                    <TableData $align="right" $padding="0 24px 0 8px" $mono title={r.sig && r.sig.startsWith('0x') ? `tx ${r.sig}` : r.hash}>{shortHash(r.sig && r.sig.startsWith('0x') ? r.sig : r.hash, 14)}</TableData>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          <Pagination page={current} pageCount={pageCount} onChange={setPage} />
        </>
      )}

      <SubTitle $mt={40}>Knowledge graph</SubTitle>
      {!graph && <CenterProgress />}
      {graph && <KnowledgeGraph g={graph} />}
    </PageWrapper>
  );
}

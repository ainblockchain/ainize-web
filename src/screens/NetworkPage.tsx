import { useMemo, useState, type FormEvent } from 'react';
import styled from 'styled-components';
import { errorMessage, useBranchesQuery, useCatalogSnapshotQuery, useInfoQuery, useLedgerQuery, useNodesQuery } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Offline } from '@/components/ui/Offline';
import { Alert, Input } from '@/components/ui/Form';
import { CenterProgress, Description, Empty, ExternalLink, KeyValue, Mono, PageWrapper, StyledLink, SubTitle, Title, TitleRow } from '@/components/ui/Misc';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableWrapper } from '@/components/ui/Table';
import type { PeerInfo, RouteResponse } from '@/api/types';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { bytes, num, shortAddr } from '@/utils/format';
import { useDetailFormat } from './detail/recordText';
import { trackHref } from './TrackPage';
import { knowledgeLookupPath } from '@/lib/detailRoutes';
import { nodeApiUrl, routeCurlCommand, type RouteInput } from '@/lib/networkRoute';
import { trackSubscribeCommand, trackBranches, catalogSnapshotView } from '@/lib/trackView';
import { networkInfo, networkNodes, networkRecords } from '@/lib/networkView';
import { useNetworkRoute } from '@/hooks/useNetworkRoute';
import { networkEntryKey, orderNetworkEntries, uniqueNetworkWarnings } from '@/utils/networkOrder';

const GpuAllocation = styled.span`
  display: inline-block; margin-left: 8px; padding: 2px 7px; border-radius: 4px;
  background: #e8f0fe; color: #2458a6; font-size: 11px; font-weight: 500; white-space: nowrap;
`;

const WarningDetails = styled.details`
  summary { cursor: pointer; font-weight: 600; }
  .warning-list { max-height: 220px; overflow-y: auto; margin-top: 12px; overflow-anchor: none; }
  .warning-list > div + div { margin-top: 12px; }
`;

const Cards = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;`;
const Card = styled.div`
  background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; padding: 20px 24px;
  h3 { margin: 0 0 4px; font-size: 14px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
`;
const RoleChip = styled.span<{ $role: string }>`
  display: inline-block; margin: 0 4px 4px 0; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em;
  background: ${(p) => ({ seller: '#f5eefc', verifier: '#e6f4ea', serving: '#e8f0fe', gateway: '#fff3e0' } as Record<string, string>)[p.$role] ?? '#f2f2f2'};
  color: ${(p) => ({ seller: '#5b1ca8', verifier: '#1e6b36', serving: '#1b73e8', gateway: '#8a4b00' } as Record<string, string>)[p.$role] ?? '#555'};
`;
const CtxChip = styled.span`
  display: inline-block; margin: 0 4px 4px 0; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; font-family: ${(p) => p.theme.font.mono}; background: #e1eef3; color: #0b5468;
`;
/** A quieter aside beside a routing answer (item 234): what did not match, and what a node is not serving. */
const Muted = styled.span`font-size: 12px; color: ${(p) => p.theme.color.GREY};`;
const Dot = styled.span<{ $ok: boolean }>`
  display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; background: ${(p) => (p.$ok ? p.theme.color.SUCCESS : p.theme.color.LIGHT_GREY)};
`;
const RouterForm = styled.form`
  display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; margin-top: 16px; padding: 20px 24px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: ${(p) => p.theme.color.GREY}; min-width: 160px; }
`;
const RouteResult = styled.div`
  margin-top: 16px; padding: 20px 24px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
`;
const Cmd = styled.pre`
  margin: 12px 0 0; padding: 12px 16px; border-radius: 4px; background: #303133; color: #f2f2f2; font-size: 12px; line-height: 1.6; overflow-x: auto;
`;
const DevBox = styled.details`
  margin-top: 40px; border: 1px dashed ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; padding: 12px 20px; background: #fff;
  summary { cursor: pointer; font-size: 16px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
`;

/**
 * Item 368 — a node's terms, in the table that lists the nodes.
 *
 * `/api/info` has always exposed the creator share and the quorum, and the knowledge page printed the VIEWING
 * node's rate as if it were the network's; the peer table showed none of it, so a creator choosing where to publish
 * and a buyer wondering what their money splits into had a self-declared name and a role to go on. Every figure
 * here is the peer's own published terms — never this node's, and never a default: a peer running an older build
 * says so instead of borrowing ours.
 */
function Terms({ info, t }: { info?: Partial<PeerInfo> | null; t: (k: string, v?: Record<string, string | number>) => string }) {
  if (!info?.shares && info?.quorum === undefined) return <span title={t('detail.net.terms_help')}>{t('detail.net.terms_none')}</span>;
  const pct = (n?: number) => (typeof n === 'number' ? `${Math.round(n * 100)}%` : '—');
  return (
    <span title={t('detail.net.terms_help')} data-testid="net-terms">
      {t('detail.net.terms_creator', { pct: pct(info.shares?.royalty) })}
      <div style={{ fontSize: 11, color: '#8d8d8f' }}>
        {info.shares?.teach !== undefined ? t('detail.net.terms_teach', { pct: pct(info.shares.teach) }) : t('detail.net.terms_no_teach')}
      </div>
      <div style={{ fontSize: 11, color: '#8d8d8f' }}>
        {info.quorum !== undefined ? t('detail.net.terms_quorum', { n: info.quorum }) : ''}
        {info.default_price !== undefined ? ` · ${t('detail.net.terms_price', { price: info.default_price })}` : ''}
      </div>
    </span>
  );
}


/**
 * A peer's address, when the reader is allowed to see it.
 *
 * The node hides the endpoints that are on its own network from anyone but the operator (node `endpoints.ts`),
 * because a public page printing `http://192.168.1.41:3402` describes somebody's LAN to strangers and a
 * `localhost:3514` link sends each reader to their own machine. A hidden one is SAID to be hidden rather than
 * left blank: the row is still a real peer, and an empty cell reads as missing data.
 */
const Soft = styled.span`color: ${(p) => p.theme.color.GREY};`;

function Endpoint({ url, hidden }: { url: string | null; hidden: string }) {
  // A dash, not the sentence. The sentence is true of every hidden row, and on a table of seventy peers it
  // printed itself seventy times and pushed the columns that differ off the screen; it belongs in the legend
  // below the table, once. The cell still says something is there, and hovering says what.
  const href = nodeApiUrl(url, 'info');
  if (!href) return <Soft title={hidden}>—</Soft>;
  return <ExternalLink href={href} target="_blank" rel="noopener noreferrer">{url}</ExternalLink>;
}

export default function NetworkPage() {
  const { t, help, tech } = useT();
  useTitle(t('detail.net.title'));
  const f = useDetailFormat();
  // `isOwner`: the runtime API and the repo path are this machine's private details, and the node shows them
  // only to whoever runs it. Any connected wallet seeing them would be the old "signed in = operator" mistake.
  const { isOwner } = useAuth();
  const infoQ = useInfoQuery(undefined, { pollingInterval: 15_000 });
  const info = infoQ.isError ? null : networkInfo(infoQ.currentData);
  const nodesQ = useNodesQuery(undefined, { pollingInterval: 15_000 });
  const nodes = nodesQ.isError ? null : networkNodes(nodesQ.currentData);
  const branchesQ = useBranchesQuery(undefined, { pollingInterval: 20_000 });
  const branches = branchesQ.isError ? null : trackBranches(branchesQ.currentData);
  const catalogQ = useCatalogSnapshotQuery(undefined, { skip: !branches?.branches.length, pollingInterval: 30_000 });
  const catalog = catalogQ.isError ? null : catalogSnapshotView(catalogQ.currentData);
  /**
   * Item 348 — the table showed an endpoint, a self-declared name, an address, roles, a ledger, a model, a body
   * count and a last-seen time: two of those are asserted by the node itself and none of them says whether a
   * stranger has ever delivered anything. Choosing whom to pay in a peer-to-peer market was a trust decision the
   * product supported with self-declared fields. Everything below is aggregated from the public record instead —
   * anchors, settlements, attestations and challenges, each signed by the node it is counted against.
   */
  const ledger = useLedgerQuery({ limit: 5000 }, { pollingInterval: 60_000 });
  const record = useMemo(() => ledger.isError ? null : networkRecords(ledger.currentData), [ledger.currentData, ledger.isError]);
  const TrackRecord = ({ address }: { address?: string | null }) => {
    if (!record) return <span>{t(ledger.isFetching ? 'track.loading' : 'track.sales_unavailable')}</span>;
    if (!address) return <span>{t('track.sales_unavailable')}</span>;
    const r = record.rows.get(address.toLowerCase());
    if (!r) return <span title={t('detail.net.record_help')}>{t('detail.net.record_none')}</span>;
    return (
      <span title={t('detail.net.record_help')} data-testid="net-record">
        {t('detail.net.record_sales', { sold: num(r.sold), listed: num(r.listed) })}
        <div style={{ fontSize: 11, color: '#8d8d8f' }}>{t('detail.net.record_verify', { attested: num(r.attested), challenged: num(r.challenged) })}</div>
        {r.since > 0 && <div style={{ fontSize: 11, color: '#8d8d8f' }}>{t('detail.net.record_since', { ago: f.ago(r.since) })}</div>}
      </span>
    );
  };
  const [routeKey, setRouteKey] = useState('jurisdiction');
  const [routeValue, setRouteValue] = useState('KR');
  const route = useNetworkRoute(routeKey, routeValue);
  const routed = route.state.phase === 'ready' ? route.state.data : null;
  const routing = route.state.phase === 'loading';
  const routeError = route.state.phase === 'error' ? route.state.error : null;

  const onRoute = (e: FormEvent) => { e.preventDefault(); void route.run(); };

  if (!infoQ.currentData && infoQ.isFetching) return <PageWrapper $wide><CenterProgress /></PageWrapper>;
  /*
   * Finding 77: with the node unreachable this page used to render nothing at all between the header and the
   * footer — a visitor could not tell an outage from an empty network. Nothing below can be drawn without
   * `/api/info`, so the page says so once, in the same words `/ledger` uses, and offers the retry.
   */
  if (!info) {
    return (
      <PageWrapper $wide>
        <TitleRow><Title>{t('detail.net.title')}</Title><a href="/network/m1">M1 · 70개 작업 상태 →</a></TitleRow>
        <Offline error={infoQ.error} what={t('offline.what.network')} retrying={infoQ.isFetching} onRetry={() => { void infoQ.refetch(); }} />
      </PageWrapper>
    );
  }
  const self = info.node;
  const rt = info.runtime;
  const peers = orderNetworkEntries(nodes?.peers ?? []);
  // item 170: a peer on the other ledger answers everything and serves an empty record set forever
  const ps = info.peer_status ?? nodes?.peer_status;
  const known = orderNetworkEntries((nodes?.nodes ?? []).filter((n) => n.address.toLowerCase() !== self.address.toLowerCase()));
  const mismatches = uniqueNetworkWarnings(ps?.mismatched ?? []);
  const ledgerKind = (k: string) => k === 'ain' ? t('detail.ledger_kind.ain') : k === 'local' ? t('detail.ledger_kind.local') : '—';
  const nodeName = (name?: string | null) => <>{name ?? '—'}{name && /^ain-kpi-gpu-0?[1-5]$/.test(name) && (
    <GpuAllocation title={t('detail.net.gpu_allocation_help')}>{t('detail.net.gpu_allocation')}</GpuAllocation>
  )}</>;
  const roles = (rs: string[]) => rs.map((r) => <RoleChip key={r} $role={r} title={r}>{f.roleLabel(r)}</RoleChip>);
  const routeCommand = routeCurlCommand(self.endpoint, route.input);
  const entries = new Map((catalog?.items ?? []).map((e) => [e.anchor.id, e]));

  return (
    <PageWrapper $wide>
      <TitleRow><Title>{t('detail.net.title')}</Title><a href="/network/m1">M1 · 70개 작업 상태 →</a></TitleRow>
      <Description title={tech('node')}>{t('detail.net.intro')}</Description>

      <SubTitle $mt={32}>{t('detail.net.this_node')}</SubTitle>
      <Cards style={{ marginTop: 12 }}>
        <Card>
          <h3>{self.name}</h3>
          <KeyValue style={{ marginTop: 8 }}>
            <dt>{t('detail.net.address')}</dt><dd><Mono>{self.address}</Mono></dd>
            <dt>{t('detail.net.endpoint')}</dt><dd><Endpoint url={self.endpoint} hidden={t('detail.net.endpoint_private')} /></dd>
            <dt>{t('detail.net.roles')}</dt><dd>{roles(self.roles)}</dd>
            <dt title={tech('ledger')}>{t('detail.net.ledger')}</dt><dd>{t('detail.net.ledger_records', { kind: info.ledger.kind === 'ain' ? `${t('detail.ledger_kind.ain')} (${info.ledger.provider ?? ''})` : t('detail.ledger_kind.local'), n: num(info.ledger.records) })}</dd>
            <dt>{t('detail.net.peers')}</dt><dd>{!nodes ? t('track.sales_unavailable') : ps
              ? t('detail.net.peers_value_health', { peers: num(ps.known), answered: num(ps.reachable), verifiers: num(ps.verifiers), known: num(known.length) })
              : t('detail.net.peers_value', { peers: num(info.peers), known: num(known.length) })}</dd>
            <dt title={t('detail.tech.blobs')}>{t('detail.net.bodies')}</dt><dd>{t('detail.net.bodies_value', { n: num(self.blobs.length) })}</dd>
            {info.disk && (<>
              <dt>{t('detail.net.disk')}</dt>
              <dd>
                {t('detail.net.disk_value', { total: bytes(info.disk.total), bodies: bytes(info.disk.blobs), sets: bytes(info.disk.datasets), uploads: bytes(info.disk.uploads), db: bytes(info.disk.db) })}
                {info.disk.free !== null && <>{' · '}{t('detail.net.disk_free', { free: bytes(info.disk.free) })}</>}
                {info.disk.reclaimable_bytes > 0 && <div style={{ fontSize: 12, marginTop: 2 }}>{t('detail.net.disk_reclaimable', { bytes: bytes(info.disk.reclaimable_bytes), n: num(info.disk.reclaimable_files) })}</div>}
              </dd>
            </>)}
            <dt title={tech('branch')}>{t('detail.net.tracks')}</dt><dd>{self.branches.length ? self.branches.join(', ') : t('detail.net.no_tracks')}</dd>
            <dt>{t('detail.net.version')}</dt><dd>{self.version}</dd>
          </KeyValue>
        </Card>
        <Card>
          <h3 title={t('detail.tech.runtime')}>{t('detail.net.runtime')}</h3>
          <KeyValue style={{ marginTop: 8 }}>
            <dt>{t('detail.net.status')}</dt><dd><Dot $ok={rt.available} />{rt.available ? t('detail.net.runtime_ok') : (rt.error ?? t('detail.net.runtime_down'))}</dd>
            <dt>{t('detail.net.model')}</dt><dd>{rt.model ?? '—'}</dd>
            <dt title={`row hook — ${tech('apply')}`}>{t('detail.net.hook')}</dt><dd><Dot $ok={rt.hook} />{rt.hook ? t('detail.net.hook_ok') : t('detail.net.hook_no')}</dd>
            {/*
              * Finding 35: the serving endpoint and the directory it runs out of are the operator's infrastructure,
              * not the visitor's. They tell a stranger nothing they can use and, on a node reachable from the
              * internet, they advertise where to knock. The model id and the status stay public — they are what a
              * buyer needs to know before trusting an attestation from this node.
              */}
            {isOwner && (<>
              <dt>{t('detail.net.api')}</dt><dd><Mono>{rt.api ?? '—'}</Mono></dd>
              <dt>{t('detail.net.repo')}</dt><dd><Mono>{rt.repo ?? '—'}</Mono></dd>
            </>)}
          </KeyValue>
          <Description style={{ fontSize: 12 }} title={tech('verified')}>{t('detail.net.runtime_note')}</Description>
        </Card>
      </Cards>

      <SubTitle $mt={40}>{t('detail.net.peers_title')}</SubTitle>
      {!nodes && (!nodesQ.currentData && nodesQ.isFetching
        ? <div role="status" data-testid="network-nodes-loading"><CenterProgress /></div>
        : <Offline error={nodesQ.error} what={t('detail.net.peers_title')} retrying={nodesQ.isFetching} onRetry={() => { void nodesQ.refetch(); }} />)}
      {record ? <Description data-testid="network-record-window">{t('detail.net.record_window', { shown: num(record.shown), total: num(record.total) })}</Description>
        : !ledger.currentData && ledger.isFetching ? <div role="status">{t('detail.net.record_loading')}</div>
          : <Offline error={ledger.error} what={t('detail.net.h.record')} retrying={ledger.isFetching} onRetry={() => { void ledger.refetch(); }} />}
      {!!mismatches.length && ps && (
        <Alert $tone="warning" style={{ marginTop: 12 }}>
          <WarningDetails>
            <summary>{t('detail.net.ledger_mismatch_summary', { n: mismatches.length })}</summary>
            <div className="warning-list">
              {mismatches.map((m) => (
                <div key={networkEntryKey(m)}>
                  {t('detail.net.ledger_mismatch', { node: m.name ?? m.endpoint ?? '—', their: ledgerKind(m.ledger), ours: ledgerKind(ps.ledger) })}
                  {m.endpoint && <><br /><Mono style={{ fontSize: 12 }}>{`ainize patch ls --node ${m.endpoint}`}</Mono></>}
                </div>
              ))}
            </div>
          </WarningDetails>
        </Alert>
      )}
      {nodes && peers.length === 0 && known.length === 0 && <Empty style={{ marginTop: 12 }}>{t('detail.net.peers_empty')}</Empty>}
      {(peers.length > 0 || known.length > 0) && (
        <TableWrapper style={{ marginTop: 12, background: '#fff', border: '1px solid #dadada' }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead $align="left" $padding="0 0 0 24px">{t('detail.net.h.endpoint')}</TableHead><TableHead $align="left">{t('detail.net.h.name')}</TableHead><TableHead $align="left">{t('detail.net.h.address')}</TableHead><TableHead $align="left">{t('detail.net.h.roles')}</TableHead><TableHead $align="left" title={t('detail.net.record_help')}>{t('detail.net.h.record')}</TableHead><TableHead $align="left" title={t('detail.net.terms_help')}>{t('detail.net.h.terms')}</TableHead><TableHead>{t('detail.net.h.ledger')}</TableHead><TableHead>{t('detail.net.h.model')}</TableHead><TableHead>{t('detail.net.h.bodies')}</TableHead><TableHead>{t('detail.net.h.tracks')}</TableHead><TableHead $align="right" $padding="0 24px 0 8px">{t('detail.net.h.last_seen')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {peers.map((p, index) => (
                <TableRow key={JSON.stringify([networkEntryKey(p), p.endpoint ?? index])}>
                  <TableData $align="left" $padding="0 0 0 24px" $mono><Dot $ok={p.failures === 0 && p.last_seen > 0} /><Endpoint url={p.endpoint} hidden={t('detail.net.endpoint_private')} /></TableData>
                  <TableData $align="left">{nodeName(p.info?.name)}</TableData>
                  <TableData $align="left" $mono title={p.address ?? ''}>{shortAddr(p.address, 8)}</TableData>
                  <TableData $align="left">{roles(p.info?.roles ?? [])}</TableData>
                  <TableData $align="left"><TrackRecord address={p.address} /></TableData>
                  <TableData $align="left"><Terms info={p.info} t={t} /></TableData>
                  <TableData>{p.info ? ledgerKind(p.info.ledger) : '—'}</TableData>
                  <TableData title={p.info?.model ?? ''}>{p.info?.model ?? '—'}</TableData>
                  <TableData>{p.info ? num(p.info.blobs.length) : '—'}</TableData>
                  <TableData title={(p.info?.branches ?? []).join(', ')}>{p.info ? p.info.branches.length : '—'}</TableData>
                  <TableData $align="right" $padding="0 24px 0 8px">{p.last_seen ? f.ago(p.last_seen) : (p.failures ? t('detail.net.failed', { n: p.failures }) : t('detail.net.pending'))}</TableData>
                </TableRow>
              ))}
              {known.filter((n) => !peers.some((p) => p.address?.toLowerCase() === n.address.toLowerCase())).map((n) => (
                <TableRow key={n.address}>
                  <TableData $align="left" $padding="0 0 0 24px" $mono><Dot $ok={false} /><Endpoint url={n.endpoint} hidden={t('detail.net.endpoint_private')} /></TableData>
                  <TableData $align="left">{nodeName(n.name)}</TableData>
                  <TableData $align="left" $mono title={n.address}>{shortAddr(n.address, 8)}</TableData>
                  <TableData $align="left">{roles(n.roles)}</TableData>
                  <TableData $align="left"><TrackRecord address={n.address} /></TableData>
                  <TableData $align="left"><Terms info={n} t={t} /></TableData>
                  <TableData>{ledgerKind(n.ledger)}</TableData>
                  <TableData title={n.model ?? ''}>{n.model ?? '—'}</TableData>
                  <TableData>{num(n.blobs_advertised ?? n.blobs.length)}</TableData>
                  <TableData title={n.branches.join(', ')}>{n.branches.length}</TableData>
                  <TableData $align="right" $padding="0 24px 0 8px">{n.last_seen ? t('detail.net.seen_ledger', { ago: f.ago(n.last_seen) }) : '—'}</TableData>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}

      <SubTitle id="tracks" $mt={40} title={`${help('branch')} (${tech('branch')})`}>{t('detail.net.tracks_title')}</SubTitle>
      <Description>{t('detail.net.tracks_note')}</Description>
      {!branches && (!branchesQ.currentData && branchesQ.isFetching
        ? <div role="status" data-testid="network-tracks-loading"><CenterProgress /></div>
        : <Offline error={branchesQ.error} what={t('detail.net.tracks_title')} retrying={branchesQ.isFetching} onRetry={() => { void branchesQ.refetch(); }} />)}
      {!!branches?.branches.length && !catalog && (!catalogQ.currentData && catalogQ.isFetching
        ? <div role="status">{t('track.loading')}</div>
        : <Offline error={catalogQ.error} what={t('track.net.h.updated')} retrying={catalogQ.isFetching} onRetry={() => { void catalogQ.refetch(); }} />)}
      {branches && branches.branches.length === 0 && <Empty style={{ marginTop: 12 }}>{t('detail.net.tracks_empty')}</Empty>}
      {branches && branches.branches.length > 0 && (
        <TableWrapper style={{ marginTop: 12, background: '#fff', border: '1px solid #dadada' }}>
          <Table>
            <TableHeader>
              <TableRow><TableHead $align="left" $padding="0 0 0 24px">{t('detail.net.h.track')}</TableHead><TableHead $align="left">{t('detail.net.h.context')}</TableHead><TableHead $align="left" title={t('track.net.current_title')}>{t('track.net.h.current')}</TableHead><TableHead title={t('track.net.updated_title')}>{t('track.net.h.updated')}</TableHead><TableHead>{t('detail.net.h.owner')}</TableHead><TableHead $align="right" $padding="0 24px 0 8px">{t('detail.net.h.subscribers')}</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {branches.branches.map((b) => {
                const current = b.current ?? [];
                const newest = catalog && current.every(id => entries.has(id)) ? current.map((id) => entries.get(id)!.anchor.created_at).reduce((x, y) => Math.max(x, y), 0) : null;
                return (
                <TableRow key={b.name}>
                  <TableData $align="left" $padding="0 0 0 24px" $weight={600} title={b.description}><StyledLink to={trackHref(b.name)}>{b.name}</StyledLink>{branches.mine.includes(b.name) && <span style={{ marginLeft: 8, fontSize: 11, color: '#44a45f' }}>{t('detail.net.subscribed')}</span>}</TableData>
                  <TableData $align="left">{Object.entries(b.context).map(([k, v]) => <CtxChip key={k}>{k}={v}</CtxChip>)}{Object.keys(b.context).length === 0 && '—'}</TableData>
                  <TableData $align="left" $maxWidth="360px" title={current.join(', ') || t('track.net.none')}>{current.slice(0, 2).map((id, i) => <span key={id}>{i > 0 && ', '}<StyledLink to={knowledgeLookupPath(id)}>{id}</StyledLink></span>)}{current.length > 2 && ` +${current.length - 2}`}{current.length === 0 && t('track.net.none')}</TableData>
                  <TableData>{newest === null ? t(catalogQ.isFetching ? 'track.loading' : 'track.sales_unavailable') : newest ? f.ago(newest) : '—'}</TableData>
                  <TableData $mono title={b.owner}>{shortAddr(b.owner, 6)}</TableData>
                  <TableData $align="right" $padding="0 24px 0 8px" title={b.subscribers.map((s) => s.name ?? s.address ?? '').join(', ')}>{num(b.subscribers.length)}</TableData>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableWrapper>
      )}

      <SubTitle $mt={40} title={t('detail.tech.router')}>{t('detail.net.router_title')}</SubTitle>
      <Description>{t('detail.net.router_note')}</Description>
      <RouterForm onSubmit={onRoute}>
        <label>{t('detail.net.attribute')}<Input value={routeKey} onChange={(e) => setRouteKey(e.target.value)} placeholder="jurisdiction" /></label>
        <label>{t('detail.net.value')}<Input value={routeValue} onChange={(e) => setRouteValue(e.target.value)} placeholder="KR" /></label>
        <Button type="submit" disabled={!route.input} loading={routing} loadingText={t('detail.net.routing')}>{t('detail.net.route')}</Button>
      </RouterForm>
      {!route.input && <Alert $tone="warning" style={{ marginTop: 12 }}>{t('detail.net.route_invalid')}</Alert>}
      {route.state.phase === 'error' && <Alert $tone="error" role="alert" style={{ marginTop: 12 }}>{t('detail.net.route_failed')} {errorMessage(routeError)}</Alert>}
      {routed && route.input && <NetworkRouteResult routed={routed} input={route.input} />}

      <DevBox>
        <summary title={tech('node')}>{t('detail.net.dev_title')}</summary>
        <Description>{t('detail.net.dev_selected')}</Description>
        {routeCommand && <Cmd>{`${t('detail.net.dev_route')}\n${routeCommand}`}</Cmd>}
        {routed?.branch && <><Cmd>{`${t('detail.net.dev_subscribe')}\n${trackSubscribeCommand(routed.branch.name)}`}</Cmd><Description>{t('detail.net.dev_subscription_cost')}</Description></>}
      </DevBox>
    </PageWrapper>
  );
}

/** The result is rendered only after the submitted input and response have been matched. */
export function NetworkRouteResult({ routed, input }: { routed: RouteResponse; input: RouteInput }) {
  const { t } = useT();
  return (
        <RouteResult>
          {!routed.branch && <Alert $tone="warning">{t('detail.net.no_match', { key: input.key, value: input.value })}</Alert>}
          {routed.branch && (
            <KeyValue style={{ marginTop: 0 }}>
              <dt>{t('detail.net.r.track')}</dt><dd><StyledLink to={trackHref(routed.branch.name)}>{routed.branch.name}</StyledLink> — {routed.branch.description || t('detail.net.r.no_description')}</dd>
              <dt>{t('detail.net.r.context')}</dt><dd>{Object.entries(routed.branch.context).map(([k, v]) => <CtxChip key={k}>{k}={v}</CtxChip>)}</dd>
              <dt>{t('detail.net.r.patches')}</dt><dd>{routed.branch.patch_ids.map((id, i) => <span key={id}>{i > 0 && ', '}<StyledLink to={knowledgeLookupPath(id)}>{id}</StyledLink></span>)}{routed.branch.patch_ids.length === 0 && '—'}</dd>
              {/* Item 234 — which attributes actually matched, and whether the answer was one of several. */}
              <dt>{t('detail.net.r.matched')}</dt>
              <dd>
                {(routed.matched ?? []).map((k) => <CtxChip key={k}>{k}</CtxChip>)}
                {(routed.unmatched ?? []).length > 0 && <Muted> {t('detail.net.r.unmatched', { keys: routed.unmatched!.join(', ') })}</Muted>}
                {routed.ambiguous && <Muted style={{ display: 'block' }}>{t('detail.net.r.ambiguous', { n: routed.candidates?.length ?? 0, names: (routed.candidates ?? []).map((cd) => cd.name).join(', ') })}</Muted>}
              </dd>
              <dt>{t('detail.net.r.nodes')}</dt>
              <dd>
                {routed.nodes.length === 0 && t('detail.net.r.no_nodes')}
                {/* A subscribe record says a node once subscribed; `applied` says what it is serving right now. */}
                {routed.nodes.map((n) => (
                  <div key={n.address}>
                    <Endpoint url={n.endpoint} hidden={t('detail.net.endpoint_private')} /> <Mono>{shortAddr(n.address, 6)}</Mono> {n.model ? `· ${n.model}` : ''}
                    {routed.current?.length === 0 ? <Muted> · {t('detail.net.r.no_current')}</Muted> : n.current === false
                      ? <Muted style={{ color: '#e6173e' }}> · {t('detail.net.r.stale', { ids: (n.missing ?? []).join(', ') })}</Muted>
                      : n.current === true ? <Muted> · {t('detail.net.r.serving')}</Muted>
                        : <Muted> · {t('detail.net.r.unknown_load')}</Muted>}
                  </div>
                ))}
              </dd>
            </KeyValue>
          )}
        </RouteResult>
  );
}

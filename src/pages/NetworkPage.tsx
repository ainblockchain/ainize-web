import { useMemo, useState, type FormEvent } from 'react';
import styled from 'styled-components';
import { errorMessage, useBranchesQuery, useCatalogQuery, useInfoQuery, useLazyRouteQuery, useLedgerQuery, useNodesQuery } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Offline } from '@/components/ui/Offline';
import { Alert, Input } from '@/components/ui/Form';
import { CenterProgress, Description, Empty, ExternalLink, KeyValue, Mono, PageWrapper, StyledLink, SubTitle, Title, TitleRow } from '@/components/ui/Misc';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableWrapper } from '@/components/ui/Table';
import type { PeerInfo } from '@/api/types';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { bytes, num, shortAddr } from '@/utils/format';
import { useDetailFormat } from './detail/recordText';
import { trackHref } from './TrackPage';

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

export default function NetworkPage() {
  const { t, term, help, tech } = useT();
  useTitle(t('detail.net.title'));
  const f = useDetailFormat();
  const { isSignedIn } = useAuth();
  const infoQ = useInfoQuery(undefined, { pollingInterval: 15_000 });
  const info = infoQ.data;
  const { data: nodes } = useNodesQuery(undefined, { pollingInterval: 15_000 });
  const { data: branches } = useBranchesQuery(undefined, { pollingInterval: 20_000 });
  // Finding 268: the track table said what a track contains but not what a subscriber would get today, nor how old
  // it is. Both come from the catalogue, which is one cached request shared with /explore.
  const { data: catalog } = useCatalogQuery({ limit: 200 });
  /**
   * Item 348 — the table showed an endpoint, a self-declared name, an address, roles, a ledger, a model, a body
   * count and a last-seen time: two of those are asserted by the node itself and none of them says whether a
   * stranger has ever delivered anything. Choosing whom to pay in a peer-to-peer market was a trust decision the
   * product supported with self-declared fields. Everything below is aggregated from the public record instead —
   * anchors, settlements, attestations and challenges, each signed by the node it is counted against.
   */
  const ledger = useLedgerQuery({ limit: 5000 }, { pollingInterval: 60_000 });
  const record = useMemo(() => {
    const m = new Map<string, { listed: number; sold: number; bought: number; attested: number; challenged: number; since: number }>();
    const at = (address: string) => {
      const k = address.toLowerCase();
      const cur = m.get(k) ?? { listed: 0, sold: 0, bought: 0, attested: 0, challenged: 0, since: 0 };
      m.set(k, cur);
      return cur;
    };
    const seen = (row: { since: number }, ts: number) => { row.since = row.since ? Math.min(row.since, ts) : ts; };
    for (const r of ledger.data?.records ?? []) {
      const b = (r.body ?? {}) as Record<string, unknown>;
      if (r.kind === 'anchor' && typeof b.author === 'string') { const row = at(b.author); row.listed += 1; seen(row, r.ts); }
      if (r.kind === 'attest' && typeof b.verifier === 'string') { const row = at(b.verifier); row.attested += 1; seen(row, r.ts); }
      if (r.kind === 'challenge' && typeof b.challenger === 'string') { const row = at(b.challenger); row.challenged += 1; seen(row, r.ts); }
      if (r.kind === 'settle') {
        if (typeof b.seller === 'string') { const row = at(b.seller); row.sold += 1; seen(row, r.ts); }
        if (typeof b.buyer === 'string') { const row = at(b.buyer); row.bought += 1; seen(row, r.ts); }
      }
      if (r.kind === 'node' && typeof b.address === 'string') seen(at(b.address), r.ts);
    }
    return (address?: string | null) => (address ? m.get(address.toLowerCase()) ?? null : null);
  }, [ledger.data]);
  /** One cell: what the record says this node has actually done. Never a guess — an unknown node reads "nothing yet". */
  const TrackRecord = ({ address }: { address?: string | null }) => {
    const r = record(address);
    if (!r || (!r.listed && !r.sold && !r.attested && !r.challenged && !r.since)) return <span title={t('detail.net.record_help')}>{t('detail.net.record_none')}</span>;
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
  const [route, { data: routed, isFetching: routing, error: routeError }] = useLazyRouteQuery();

  const onRoute = (e: FormEvent) => { e.preventDefault(); if (routeKey.trim()) void route({ [routeKey.trim()]: routeValue.trim() }); };

  if (infoQ.isLoading) return <PageWrapper $wide><CenterProgress /></PageWrapper>;
  /*
   * Finding 77: with the node unreachable this page used to render nothing at all between the header and the
   * footer — a visitor could not tell an outage from an empty network. Nothing below can be drawn without
   * `/api/info`, so the page says so once, in the same words `/ledger` uses, and offers the retry.
   */
  if (!info) {
    return (
      <PageWrapper $wide>
        <TitleRow><Title>{t('detail.net.title')}</Title></TitleRow>
        <Offline error={infoQ.error} what={t('offline.what.network')} retrying={infoQ.isFetching} onRetry={() => { void infoQ.refetch(); }} />
      </PageWrapper>
    );
  }
  const self = info.node;
  const rt = info.runtime;
  const peers = nodes?.peers ?? [];
  // item 170: a peer on the other ledger answers everything and serves an empty record set forever
  const ps = info.peer_status ?? nodes?.peer_status;
  const known = (nodes?.nodes ?? []).filter((n) => n.address !== self.address);
  const ledgerKind = (k: string) => (k === 'ain' ? t('detail.ledger_kind.ain') : t('detail.ledger_kind.local'));
  const roles = (rs: string[]) => rs.map((r) => <RoleChip key={r} $role={r} title={r}>{f.roleLabel(r)}</RoleChip>);
  const routeExample = routed?.branch?.name ?? branches?.branches[0]?.name ?? 'law/KR';
  const entries = new Map((catalog?.items ?? []).map((e) => [e.anchor.id, e]));

  return (
    <PageWrapper $wide>
      <TitleRow><Title>{t('detail.net.title')}</Title></TitleRow>
      <Description title={tech('node')}>{t('detail.net.intro')}</Description>

      <SubTitle $mt={32}>{t('detail.net.this_node')}</SubTitle>
      <Cards style={{ marginTop: 12 }}>
        <Card>
          <h3>{self.name}</h3>
          <KeyValue style={{ marginTop: 8 }}>
            <dt>{t('detail.net.address')}</dt><dd><Mono>{self.address}</Mono></dd>
            <dt>{t('detail.net.endpoint')}</dt><dd><ExternalLink href={`${self.endpoint}/api/info`} target="_blank" rel="noopener noreferrer">{self.endpoint}</ExternalLink></dd>
            <dt>{t('detail.net.roles')}</dt><dd>{roles(self.roles)}</dd>
            <dt title={tech('ledger')}>{t('detail.net.ledger')}</dt><dd>{t('detail.net.ledger_records', { kind: info.ledger.kind === 'ain' ? `${t('detail.ledger_kind.ain')} (${info.ledger.provider ?? ''})` : t('detail.ledger_kind.local'), n: num(info.ledger.records) })}</dd>
            <dt>{t('detail.net.peers')}</dt><dd>{ps
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
            {isSignedIn && (<>
              <dt>{t('detail.net.api')}</dt><dd><Mono>{rt.api ?? '—'}</Mono></dd>
              <dt>{t('detail.net.repo')}</dt><dd><Mono>{rt.repo ?? '—'}</Mono></dd>
            </>)}
          </KeyValue>
          <Description style={{ fontSize: 12 }} title={tech('verified')}>{t('detail.net.runtime_note')}</Description>
        </Card>
      </Cards>

      <SubTitle $mt={40}>{t('detail.net.peers_title')}</SubTitle>
      {!!ps?.mismatched.length && (
        <Alert $tone="warning" style={{ marginTop: 12 }}>
          {ps.mismatched.map((m) => (
            <div key={m.endpoint}>
              {t('detail.net.ledger_mismatch', { node: m.name ?? m.endpoint, their: ledgerKind(m.ledger), ours: ledgerKind(ps.ledger) })}
              <br /><Mono style={{ fontSize: 12 }}>{`ainize patch ls --node ${m.endpoint}`}</Mono>
            </div>
          ))}
        </Alert>
      )}
      {peers.length === 0 && known.length === 0 && <Empty style={{ marginTop: 12 }}>{t('detail.net.peers_empty')}</Empty>}
      {(peers.length > 0 || known.length > 0) && (
        <TableWrapper style={{ marginTop: 12, background: '#fff', border: '1px solid #dadada' }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead $align="left" $padding="0 0 0 24px">{t('detail.net.h.endpoint')}</TableHead><TableHead $align="left">{t('detail.net.h.name')}</TableHead><TableHead $align="left">{t('detail.net.h.address')}</TableHead><TableHead $align="left">{t('detail.net.h.roles')}</TableHead><TableHead $align="left" title={t('detail.net.record_help')}>{t('detail.net.h.record')}</TableHead><TableHead $align="left" title={t('detail.net.terms_help')}>{t('detail.net.h.terms')}</TableHead><TableHead>{t('detail.net.h.ledger')}</TableHead><TableHead>{t('detail.net.h.model')}</TableHead><TableHead>{t('detail.net.h.bodies')}</TableHead><TableHead>{t('detail.net.h.tracks')}</TableHead><TableHead $align="right" $padding="0 24px 0 8px">{t('detail.net.h.last_seen')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {peers.map((p) => (
                <TableRow key={p.endpoint}>
                  <TableData $align="left" $padding="0 0 0 24px" $mono><Dot $ok={p.failures === 0 && p.last_seen > 0} /><ExternalLink href={`${p.endpoint}/api/info`} target="_blank" rel="noopener noreferrer">{p.endpoint}</ExternalLink></TableData>
                  <TableData $align="left">{p.info?.name ?? '—'}</TableData>
                  <TableData $align="left" $mono title={p.address ?? ''}>{shortAddr(p.address, 8)}</TableData>
                  <TableData $align="left">{roles(p.info?.roles ?? [])}</TableData>
                  <TableData $align="left"><TrackRecord address={p.address} /></TableData>
                  <TableData $align="left"><Terms info={p.info} t={t} /></TableData>
                  <TableData>{p.info ? ledgerKind(p.info.ledger) : '—'}</TableData>
                  <TableData title={p.info?.model ?? ''}>{p.info?.model ?? '—'}</TableData>
                  <TableData>{num(p.info?.blobs.length ?? 0)}</TableData>
                  <TableData title={(p.info?.branches ?? []).join(', ')}>{p.info?.branches.length ?? 0}</TableData>
                  <TableData $align="right" $padding="0 24px 0 8px">{p.last_seen ? f.ago(p.last_seen) : (p.failures ? t('detail.net.failed', { n: p.failures }) : t('detail.net.pending'))}</TableData>
                </TableRow>
              ))}
              {known.filter((n) => !peers.some((p) => p.address === n.address)).map((n) => (
                <TableRow key={n.address}>
                  <TableData $align="left" $padding="0 0 0 24px" $mono><Dot $ok={false} /><ExternalLink href={`${n.endpoint}/api/info`} target="_blank" rel="noopener noreferrer">{n.endpoint}</ExternalLink></TableData>
                  <TableData $align="left">{n.name}</TableData>
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

      <SubTitle $mt={40} title={`${help('branch')} (${tech('branch')})`}>{t('detail.net.tracks_title')}</SubTitle>
      <Description>{t('detail.net.tracks_note')}</Description>
      {!branches && <CenterProgress />}
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
                const newest = current.map((id) => entries.get(id)?.anchor.created_at ?? 0).reduce((x, y) => Math.max(x, y), 0);
                return (
                <TableRow key={b.name}>
                  <TableData $align="left" $padding="0 0 0 24px" $weight={600} title={b.description}><StyledLink to={trackHref(b.name)}>{b.name}</StyledLink>{branches.mine.includes(b.name) && <span style={{ marginLeft: 8, fontSize: 11, color: '#44a45f' }}>{t('detail.net.subscribed')}</span>}</TableData>
                  <TableData $align="left">{Object.entries(b.context).map(([k, v]) => <CtxChip key={k}>{k}={v}</CtxChip>)}{Object.keys(b.context).length === 0 && '—'}</TableData>
                  <TableData $align="left" $maxWidth="360px" title={current.join(', ') || t('track.net.none')}>{current.slice(0, 2).map((id, i) => <span key={id}>{i > 0 && ', '}<StyledLink to={`/${encodeURIComponent(entries.get(id)?.anchor.author ?? b.owner)}/${encodeURIComponent(id)}`}>{id}</StyledLink></span>)}{current.length > 2 && ` +${current.length - 2}`}{current.length === 0 && t('track.net.none')}</TableData>
                  <TableData>{newest ? f.ago(newest) : '—'}</TableData>
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
        <Button type="submit" loading={routing} loadingText={t('detail.net.routing')}>{t('detail.net.route')}</Button>
      </RouterForm>
      {routeError && <Alert $tone="error" style={{ marginTop: 12 }}>{errorMessage(routeError)}</Alert>}
      {routed && (
        <RouteResult>
          {!routed.branch && <Alert $tone="warning">{t('detail.net.no_match', { key: routeKey, value: routeValue })}</Alert>}
          {routed.branch && (
            <KeyValue style={{ marginTop: 0 }}>
              <dt>{t('detail.net.r.track')}</dt><dd><b>{routed.branch.name}</b> — {routed.branch.description || t('detail.net.r.no_description')}</dd>
              <dt>{t('detail.net.r.context')}</dt><dd>{Object.entries(routed.branch.context).map(([k, v]) => <CtxChip key={k}>{k}={v}</CtxChip>)}</dd>
              <dt>{t('detail.net.r.patches')}</dt><dd>{routed.branch.patch_ids.map((id, i) => <span key={id}>{i > 0 && ', '}<StyledLink to={`/${encodeURIComponent(routed.branch!.owner)}/${encodeURIComponent(id)}`}>{id}</StyledLink></span>)}{routed.branch.patch_ids.length === 0 && '—'}</dd>
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
                    <ExternalLink href={`${n.endpoint}/api/info`} target="_blank" rel="noopener noreferrer">{n.endpoint}</ExternalLink> <Mono>{shortAddr(n.address, 6)}</Mono> {n.model ? `· ${n.model}` : ''}
                    {n.current === false
                      ? <Muted style={{ color: '#e6173e' }}> · {t('detail.net.r.stale', { ids: (n.missing ?? []).join(', ') })}</Muted>
                      : n.current === true ? <Muted> · {t('detail.net.r.serving')}</Muted>
                        : <Muted> · {t('detail.net.r.unknown_load')}</Muted>}
                  </div>
                ))}
              </dd>
            </KeyValue>
          )}
        </RouteResult>
      )}

      <DevBox>
        <summary title={tech('node')}>{t('detail.net.dev_title')}</summary>
        <Description>{t('detail.net.dev_note')} <span title={tech('autoPay')}>({term('autoPay')})</span></Description>
        <Cmd>{`${t('detail.net.dev_route')}\ncurl "${self.endpoint}/api/route?${encodeURIComponent(routeKey)}=${encodeURIComponent(routeValue)}"\n\n${t('detail.net.dev_peer')}\nainize peers add http://host:port\n\n${t('detail.net.dev_subscribe')}\nainize branch subscribe ${routeExample}\n\n${t('detail.net.dev_agent')}\nnode packages/agent/dist/bin.js run --market ${self.endpoint}`}</Cmd>
      </DevBox>
    </PageWrapper>
  );
}

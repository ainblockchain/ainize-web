import { useState, type FormEvent } from 'react';
import styled from 'styled-components';
import { errorMessage, useBranchesQuery, useInfoQuery, useLazyRouteQuery, useNodesQuery } from '@/api/api';
import { Button } from '@/components/ui/Button';
import { Alert, Input } from '@/components/ui/Form';
import { CenterProgress, Description, Empty, ExternalLink, KeyValue, Mono, PageWrapper, StyledLink, SubTitle, Title, TitleRow } from '@/components/ui/Misc';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableWrapper } from '@/components/ui/Table';
import { useT } from '@/i18n';
import { num, shortAddr } from '@/utils/format';
import { useDetailFormat } from './detail/recordText';

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

export default function NetworkPage() {
  const { t, term, help, tech } = useT();
  const f = useDetailFormat();
  const { data: info, isLoading } = useInfoQuery(undefined, { pollingInterval: 15_000 });
  const { data: nodes } = useNodesQuery(undefined, { pollingInterval: 15_000 });
  const { data: branches } = useBranchesQuery(undefined, { pollingInterval: 20_000 });
  const [routeKey, setRouteKey] = useState('jurisdiction');
  const [routeValue, setRouteValue] = useState('KR');
  const [route, { data: routed, isFetching: routing, error: routeError }] = useLazyRouteQuery();

  const onRoute = (e: FormEvent) => { e.preventDefault(); if (routeKey.trim()) void route({ [routeKey.trim()]: routeValue.trim() }); };

  if (isLoading || !info) return <PageWrapper $wide><CenterProgress /></PageWrapper>;
  const self = info.node;
  const rt = info.runtime;
  const peers = nodes?.peers ?? [];
  const known = (nodes?.nodes ?? []).filter((n) => n.address !== self.address);
  const ledgerKind = (k: string) => (k === 'ain' ? t('detail.ledger_kind.ain') : t('detail.ledger_kind.local'));
  const roles = (rs: string[]) => rs.map((r) => <RoleChip key={r} $role={r} title={r}>{f.roleLabel(r)}</RoleChip>);
  const routeExample = routed?.branch?.name ?? branches?.branches[0]?.name ?? 'law/KR';

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
            <dt>{t('detail.net.peers')}</dt><dd>{t('detail.net.peers_value', { peers: num(info.peers), known: num(known.length) })}</dd>
            <dt title={t('detail.tech.blobs')}>{t('detail.net.bodies')}</dt><dd>{t('detail.net.bodies_value', { n: num(self.blobs.length) })}</dd>
            <dt title={tech('branch')}>{t('detail.net.tracks')}</dt><dd>{self.branches.length ? self.branches.join(', ') : t('detail.net.no_tracks')}</dd>
            <dt>{t('detail.net.version')}</dt><dd>{self.version}</dd>
          </KeyValue>
        </Card>
        <Card>
          <h3 title={t('detail.tech.runtime')}>{t('detail.net.runtime')}</h3>
          <KeyValue style={{ marginTop: 8 }}>
            <dt>{t('detail.net.status')}</dt><dd><Dot $ok={rt.available} />{rt.available ? t('detail.net.runtime_ok') : (rt.error ?? t('detail.net.runtime_down'))}</dd>
            <dt>{t('detail.net.model')}</dt><dd>{rt.model ?? '—'}</dd>
            <dt>{t('detail.net.api')}</dt><dd><Mono>{rt.api ?? '—'}</Mono></dd>
            <dt title={`row hook — ${tech('apply')}`}>{t('detail.net.hook')}</dt><dd><Dot $ok={rt.hook} />{rt.hook ? t('detail.net.hook_ok') : t('detail.net.hook_no')}</dd>
            <dt>{t('detail.net.repo')}</dt><dd><Mono>{rt.repo ?? '—'}</Mono></dd>
          </KeyValue>
          <Description style={{ fontSize: 12 }} title={tech('verified')}>{t('detail.net.runtime_note')}</Description>
        </Card>
      </Cards>

      <SubTitle $mt={40}>{t('detail.net.peers_title')}</SubTitle>
      {peers.length === 0 && known.length === 0 && <Empty style={{ marginTop: 12 }}>{t('detail.net.peers_empty')}</Empty>}
      {(peers.length > 0 || known.length > 0) && (
        <TableWrapper style={{ marginTop: 12, background: '#fff', border: '1px solid #dadada' }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead $align="left" $padding="0 0 0 24px">{t('detail.net.h.endpoint')}</TableHead><TableHead $align="left">{t('detail.net.h.name')}</TableHead><TableHead $align="left">{t('detail.net.h.address')}</TableHead><TableHead $align="left">{t('detail.net.h.roles')}</TableHead><TableHead>{t('detail.net.h.ledger')}</TableHead><TableHead>{t('detail.net.h.model')}</TableHead><TableHead>{t('detail.net.h.bodies')}</TableHead><TableHead>{t('detail.net.h.tracks')}</TableHead><TableHead $align="right" $padding="0 24px 0 8px">{t('detail.net.h.last_seen')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {peers.map((p) => (
                <TableRow key={p.endpoint}>
                  <TableData $align="left" $padding="0 0 0 24px" $mono><Dot $ok={p.failures === 0 && p.last_seen > 0} /><ExternalLink href={`${p.endpoint}/api/info`} target="_blank" rel="noopener noreferrer">{p.endpoint}</ExternalLink></TableData>
                  <TableData $align="left">{p.info?.name ?? '—'}</TableData>
                  <TableData $align="left" $mono title={p.address ?? ''}>{shortAddr(p.address, 8)}</TableData>
                  <TableData $align="left">{roles(p.info?.roles ?? [])}</TableData>
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
                  <TableData>{ledgerKind(n.ledger)}</TableData>
                  <TableData title={n.model ?? ''}>{n.model ?? '—'}</TableData>
                  <TableData>{num(n.blobs.length)}</TableData>
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
              <TableRow><TableHead $align="left" $padding="0 0 0 24px">{t('detail.net.h.track')}</TableHead><TableHead $align="left">{t('detail.net.h.context')}</TableHead><TableHead $align="left">{t('detail.net.h.patches')}</TableHead><TableHead>{t('detail.net.h.owner')}</TableHead><TableHead $align="right" $padding="0 24px 0 8px">{t('detail.net.h.subscribers')}</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {branches.branches.map((b) => (
                <TableRow key={b.name}>
                  <TableData $align="left" $padding="0 0 0 24px" $weight={600} title={b.description}>{b.name}{branches.mine.includes(b.name) && <span style={{ marginLeft: 8, fontSize: 11, color: '#44a45f' }}>{t('detail.net.subscribed')}</span>}</TableData>
                  <TableData $align="left">{Object.entries(b.context).map(([k, v]) => <CtxChip key={k}>{k}={v}</CtxChip>)}{Object.keys(b.context).length === 0 && '—'}</TableData>
                  <TableData $align="left" $maxWidth="360px" title={b.patch_ids.join(', ')}>{b.patch_ids.slice(0, 3).map((id, i) => <span key={id}>{i > 0 && ', '}<StyledLink to={`/${encodeURIComponent(b.owner)}/${encodeURIComponent(id)}`}>{id}</StyledLink></span>)}{b.patch_ids.length > 3 && ` +${b.patch_ids.length - 3}`}</TableData>
                  <TableData $mono title={b.owner}>{shortAddr(b.owner, 6)}</TableData>
                  <TableData $align="right" $padding="0 24px 0 8px" title={b.subscribers.map((s) => s.name ?? s.address ?? '').join(', ')}>{num(b.subscribers.length)}</TableData>
                </TableRow>
              ))}
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
              <dt>{t('detail.net.r.nodes')}</dt>
              <dd>
                {routed.nodes.length === 0 && t('detail.net.r.no_nodes')}
                {routed.nodes.map((n) => <div key={n.address}><ExternalLink href={`${n.endpoint}/api/info`} target="_blank" rel="noopener noreferrer">{n.endpoint}</ExternalLink> <Mono>{shortAddr(n.address, 6)}</Mono> {n.model ? `· ${n.model}` : ''}</div>)}
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

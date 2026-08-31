import { useState, type FormEvent } from 'react';
import styled from 'styled-components';
import { errorMessage, useBranchesQuery, useInfoQuery, useLazyRouteQuery, useNodesQuery } from '@/api/api';
import { Button } from '@/components/ui/Button';
import { Alert, Input } from '@/components/ui/Form';
import { CenterProgress, Description, Empty, ExternalLink, KeyValue, Mono, PageWrapper, StyledLink, SubTitle, Title, TitleRow } from '@/components/ui/Misc';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableWrapper } from '@/components/ui/Table';
import { elapsed, num, shortAddr } from '@/utils/format';

const Cards = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;`;
const Card = styled.div`
  background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; padding: 20px 24px;
  h3 { margin: 0 0 4px; font-size: 14px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
`;
const RoleChip = styled.span<{ $role: string }>`
  display: inline-block; margin: 0 4px 4px 0; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
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

export default function NetworkPage() {
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

  return (
    <PageWrapper $wide>
      <TitleRow><Title>AI network</Title></TitleRow>
      <Description>
        Nodes that share the same base model (<Mono>id_M</Mono>) differ only by the patches they hold. Each node subscribes to knowledge branches; a gateway routes a request by its context attributes to a node whose checkout matches, and switching a branch is an apply/remove of MB-sized row diffs — seconds, no restart.
      </Description>

      <SubTitle $mt={32}>This node</SubTitle>
      <Cards style={{ marginTop: 12 }}>
        <Card>
          <h3>{self.name}</h3>
          <KeyValue style={{ marginTop: 8 }}>
            <dt>Address</dt><dd><Mono>{self.address}</Mono></dd>
            <dt>Endpoint</dt><dd><ExternalLink href={`${self.endpoint}/api/info`} target="_blank" rel="noopener noreferrer">{self.endpoint}</ExternalLink></dd>
            <dt>Roles</dt><dd>{self.roles.map((r) => <RoleChip key={r} $role={r}>{r}</RoleChip>)}</dd>
            <dt>Ledger</dt><dd>{info.ledger.kind === 'ain' ? `AIN blockchain (${info.ledger.provider})` : 'local P2P DAG'} · {num(info.ledger.records)} records</dd>
            <dt>Peers</dt><dd>{num(info.peers)} configured · {num(known.length)} known nodes</dd>
            <dt>Bodies held</dt><dd>{num(self.blobs.length)} patch bodies</dd>
            <dt>Branches</dt><dd>{self.branches.length ? self.branches.join(', ') : 'none subscribed'}</dd>
            <dt>Version</dt><dd>{self.version}</dd>
          </KeyValue>
        </Card>
        <Card>
          <h3>Serving runtime</h3>
          <KeyValue style={{ marginTop: 8 }}>
            <dt>Status</dt><dd><Dot $ok={rt.available} />{rt.available ? 'available — patches can be applied live' : (rt.error ?? 'unavailable')}</dd>
            <dt>Model</dt><dd>{rt.model ?? '—'}</dd>
            <dt>API</dt><dd><Mono>{rt.api ?? '—'}</Mono></dd>
            <dt>Row hook</dt><dd><Dot $ok={rt.hook} />{rt.hook ? 'connected (read/write table rows without restart)' : 'not connected'}</dd>
            <dt>Repo</dt><dd><Mono>{rt.repo ?? '—'}</Mono></dd>
          </KeyValue>
          <Description style={{ fontSize: 12 }}>Verifiers with a compatible runtime run the benchmark for real; others attest integrity only (<Mono>hash-only</Mono>).</Description>
        </Card>
      </Cards>

      <SubTitle $mt={40}>Peers &amp; known nodes</SubTitle>
      {peers.length === 0 && known.length === 0 && <Empty style={{ marginTop: 12 }}>No peers yet. Add one with <Mono>ngram peers add http://host:port</Mono> or from Account settings.</Empty>}
      {(peers.length > 0 || known.length > 0) && (
        <TableWrapper style={{ marginTop: 12, background: '#fff', border: '1px solid #dadada' }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead $align="left" $padding="0 0 0 24px">Endpoint</TableHead><TableHead $align="left">Name</TableHead><TableHead $align="left">Address</TableHead><TableHead $align="left">Roles</TableHead><TableHead>Ledger</TableHead><TableHead>Model</TableHead><TableHead>Bodies</TableHead><TableHead>Branches</TableHead><TableHead $align="right" $padding="0 24px 0 8px">Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {peers.map((p) => (
                <TableRow key={p.endpoint}>
                  <TableData $align="left" $padding="0 0 0 24px" $mono><Dot $ok={p.failures === 0 && p.last_seen > 0} /><ExternalLink href={`${p.endpoint}/api/info`} target="_blank" rel="noopener noreferrer">{p.endpoint}</ExternalLink></TableData>
                  <TableData $align="left">{p.info?.name ?? '—'}</TableData>
                  <TableData $align="left" $mono title={p.address ?? ''}>{shortAddr(p.address, 8)}</TableData>
                  <TableData $align="left">{(p.info?.roles ?? []).map((r) => <RoleChip key={r} $role={r}>{r}</RoleChip>)}</TableData>
                  <TableData>{p.info?.ledger ?? '—'}</TableData>
                  <TableData title={p.info?.model ?? ''}>{p.info?.model ?? '—'}</TableData>
                  <TableData>{num(p.info?.blobs.length ?? 0)}</TableData>
                  <TableData title={(p.info?.branches ?? []).join(', ')}>{p.info?.branches.length ?? 0}</TableData>
                  <TableData $align="right" $padding="0 24px 0 8px">{p.last_seen ? elapsed(p.last_seen) : (p.failures ? `${p.failures} failed` : 'pending')}</TableData>
                </TableRow>
              ))}
              {known.filter((n) => !peers.some((p) => p.address === n.address)).map((n) => (
                <TableRow key={n.address}>
                  <TableData $align="left" $padding="0 0 0 24px" $mono><Dot $ok={false} /><ExternalLink href={`${n.endpoint}/api/info`} target="_blank" rel="noopener noreferrer">{n.endpoint}</ExternalLink></TableData>
                  <TableData $align="left">{n.name}</TableData>
                  <TableData $align="left" $mono title={n.address}>{shortAddr(n.address, 8)}</TableData>
                  <TableData $align="left">{n.roles.map((r) => <RoleChip key={r} $role={r}>{r}</RoleChip>)}</TableData>
                  <TableData>{n.ledger}</TableData>
                  <TableData title={n.model ?? ''}>{n.model ?? '—'}</TableData>
                  <TableData>{num(n.blobs.length)}</TableData>
                  <TableData title={n.branches.join(', ')}>{n.branches.length}</TableData>
                  <TableData $align="right" $padding="0 24px 0 8px">{n.last_seen ? `${elapsed(n.last_seen)} (ledger)` : '—'}</TableData>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}

      <SubTitle $mt={40}>Knowledge branches</SubTitle>
      <Description>Contradictory knowledge (a different jurisdiction, a competing hypothesis, a customer-specific policy) cannot share one table, but it can share one network: each branch is a set of patches, and a node checks a branch out by applying its patches.</Description>
      {!branches && <CenterProgress />}
      {branches && branches.branches.length === 0 && <Empty style={{ marginTop: 12 }}>No branches yet.</Empty>}
      {branches && branches.branches.length > 0 && (
        <TableWrapper style={{ marginTop: 12, background: '#fff', border: '1px solid #dadada' }}>
          <Table>
            <TableHeader>
              <TableRow><TableHead $align="left" $padding="0 0 0 24px">Branch</TableHead><TableHead $align="left">Context</TableHead><TableHead $align="left">Patches</TableHead><TableHead>Owner</TableHead><TableHead $align="right" $padding="0 24px 0 8px">Subscribers</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {branches.branches.map((b) => (
                <TableRow key={b.name}>
                  <TableData $align="left" $padding="0 0 0 24px" $weight={600} title={b.description}>{b.name}{branches.mine.includes(b.name) && <span style={{ marginLeft: 8, fontSize: 11, color: '#44a45f' }}>● subscribed</span>}</TableData>
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

      <SubTitle $mt={40}>Gateway router</SubTitle>
      <Description>Give the gateway a request context; it picks the branch whose context attributes match best and returns the nodes currently subscribed to it. A node that is not on that branch switches checkout by removing its current branch's rows and applying the target branch's rows.</Description>
      <RouterForm onSubmit={onRoute}>
        <label>Attribute<Input value={routeKey} onChange={(e) => setRouteKey(e.target.value)} placeholder="jurisdiction" /></label>
        <label>Value<Input value={routeValue} onChange={(e) => setRouteValue(e.target.value)} placeholder="KR" /></label>
        <Button type="submit" loading={routing} loadingText="Routing…">Route</Button>
      </RouterForm>
      {routeError && <Alert $tone="error" style={{ marginTop: 12 }}>{errorMessage(routeError)}</Alert>}
      {routed && (
        <RouteResult>
          {!routed.branch && <Alert $tone="warning">No branch matches <Mono>{routeKey}={routeValue}</Mono>.</Alert>}
          {routed.branch && (
            <>
              <KeyValue style={{ marginTop: 0 }}>
                <dt>Branch</dt><dd><b>{routed.branch.name}</b> — {routed.branch.description || 'no description'}</dd>
                <dt>Context</dt><dd>{Object.entries(routed.branch.context).map(([k, v]) => <CtxChip key={k}>{k}={v}</CtxChip>)}</dd>
                <dt>Patches</dt><dd>{routed.branch.patch_ids.join(', ') || '—'}</dd>
                <dt>Serving nodes</dt>
                <dd>
                  {routed.nodes.length === 0 && 'none subscribed yet — a node can `ngram branch subscribe ' + routed.branch.name + '`'}
                  {routed.nodes.map((n) => <div key={n.address}><ExternalLink href={`${n.endpoint}/api/info`} target="_blank" rel="noopener noreferrer">{n.endpoint}</ExternalLink> <Mono>{shortAddr(n.address, 6)}</Mono> {n.model ? `· ${n.model}` : ''}</div>)}
                </dd>
              </KeyValue>
              <Cmd>{`curl "${self.endpoint}/api/route?${encodeURIComponent(routeKey)}=${encodeURIComponent(routeValue)}"`}</Cmd>
            </>
          )}
        </RouteResult>
      )}
    </PageWrapper>
  );
}

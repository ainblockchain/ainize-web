import { useState } from 'react';
import { Link, useParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useBuyMutation, usePatchQuery, usePatchRecordsQuery } from '@/api/api';
import type { LedgerRecord, PatchDetail, PurchaseResult } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Divider, Empty, ExternalLink, KeyValue, Mono, ScoreBar, StatusChip, StyledLink, Tabs } from '@/components/ui/Misc';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableWrapper } from '@/components/ui/Table';
import { bytes, dateTime, elapsed, num, pct, price, scoreText, shortAddr, shortHash } from '@/utils/format';
import NotFoundPage from './NotFoundPage';

/* ---------------------------------------------------------------- layout ported from ainize DeploymentPage.js */
const Wrapper = styled.div`width: 100%; flex: 1; display: flex; flex-direction: column;`;
const Band = styled.div`width: 100%; display: flex; justify-content: center; background-color: #ffffff;`;
const BandContent = styled.div`
  width: 100%; max-width: ${(p) => p.theme.layout.maxWidth}; padding: 32px 16px; display: flex; flex-wrap: wrap; align-items: flex-start; gap: 16px;
  @media (min-width: ${(p) => p.theme.layout.maxWidth}) { padding: 32px 0; }
`;
const HeadLeft = styled.div`flex: 1 1 320px; min-width: 0;`;
const PatchTitle = styled.h1`
  margin: 0; font-size: 20px; font-weight: 700; color: #1b73e8; word-break: break-all;
  span { color: ${(p) => p.theme.color.GREY}; font-weight: 500; }
`;
const Branch = styled.div`margin-top: 8px; font-size: 14px; color: ${(p) => p.theme.color.GREY};`;
const ViewAll = styled(Link)`
  height: 38px; display: inline-flex; align-items: center; font-size: 14px; font-weight: 500; color: ${(p) => p.theme.color.GREY}; text-decoration: none;
  &:hover { border-bottom: 1px solid ${(p) => p.theme.color.GREY}; }
`;
const Content = styled.div`width: 100%; flex: 1; display: flex; flex-direction: column; align-items: center; background-color: #fafafa;`;
const ContentInner = styled.div`
  width: 100%; max-width: ${(p) => p.theme.layout.maxWidth}; padding: 32px 16px 56px;
  @media (min-width: ${(p) => p.theme.layout.maxWidth}) { padding: 32px 0 56px; }
`;
const NameRow = styled.div`display: flex; align-items: center; gap: 10px; flex-wrap: wrap;`;
const Name = styled.h2`margin: 0; font-size: 16px; font-weight: 700; color: ${(p) => p.theme.color.BLACK};`;
const Quorum = styled.span`font-size: 12px; color: ${(p) => p.theme.color.GREY};`;
const Info = styled.div`margin-top: 9px; font-size: 12px; color: ${(p) => p.theme.color.GREY}; b { color: ${(p) => p.theme.color.BLACK}; font-weight: 500; }`;
const Stats = styled.div`
  margin-top: 24px; display: flex; flex-wrap: wrap; gap: 32px; padding: 20px 24px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
`;
const Stat = styled.div`display: flex; flex-direction: column; align-items: center; min-width: 72px;`;
const StatValue = styled.div`font-size: 20px; font-weight: 500; color: ${(p) => p.theme.color.BLACK}; font-variant-numeric: tabular-nums;`;
const StatName = styled.div`margin-top: 4px; font-size: 12px; font-weight: 500; color: ${(p) => p.theme.color.GREY};`;
const Section = styled.section`margin-top: 24px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; padding: 24px 32px;`;
const H3 = styled.h3`margin: 0 0 8px; font-size: 14px; font-weight: 700; color: ${(p) => p.theme.color.BLACK};`;
const P = styled.p`margin: 0; font-size: 14px; line-height: 1.6; color: ${(p) => p.theme.color.DARK_GREY}; white-space: pre-wrap;`;
const Hash = styled.div`display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-family: ${(p) => p.theme.font.mono}; font-size: 13px; word-break: break-all;`;
const Samples = styled.ul`
  margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 6px;
  li { font-family: ${(p) => p.theme.font.mono}; font-size: 12px; color: ${(p) => p.theme.color.DARK_GREY}; }
  li b { color: ${(p) => p.theme.color.PRIMARY}; font-weight: 500; }
`;
const Pre = styled.pre`
  margin: 8px 0 0; padding: 12px 16px; border-radius: 4px; background: #303133; color: #f2f2f2; font-size: 12px; line-height: 1.6; overflow-x: auto;
`;
const ManageMenu = styled(Link)`
  display: inline-flex; align-items: center; gap: 8px; font-size: 16px; color: ${(p) => p.theme.color.GREY}; text-decoration: none; margin-left: auto;
  img { width: 14px; height: 14px; }
`;
const TabBar = styled.div`margin-top: 32px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-bottom: 0; padding: 0 24px;`;
const Timeline = styled.ol`
  margin: 16px 0 0; padding: 0; list-style: none; display: grid; gap: 0;
  li { position: relative; padding: 0 0 16px 28px; font-size: 13px; }
  li::before { content: ''; position: absolute; left: 6px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: ${(p) => p.theme.color.SUCCESS}; }
  li:not(:last-child)::after { content: ''; position: absolute; left: 10px; top: 16px; bottom: 0; width: 2px; background: #e0e0e0; }
  li .step { font-weight: 700; color: ${(p) => p.theme.color.BLACK}; margin-right: 8px; text-transform: uppercase; font-size: 11px; letter-spacing: 0.06em; }
  li .t { color: ${(p) => p.theme.color.GREY}; font-family: ${(p) => p.theme.font.mono}; margin-left: 8px; font-size: 11px; }
`;
const KindChip = styled.span<{ $kind: string }>`
  display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
  background: ${(p) => ({ anchor: '#e8f0fe', attest: '#e6f4ea', settle: '#f5eefc', supersede: '#fff3e0', challenge: '#fde8ec', branch: '#e1eef3', node: '#f2f2f2', subscribe: '#e1eef3' } as Record<string, string>)[p.$kind] ?? '#f2f2f2'};
  color: ${(p) => ({ anchor: '#1b73e8', attest: '#1e6b36', settle: '#5b1ca8', supersede: '#8a4b00', challenge: '#a0102c', branch: '#0b5468', node: '#555', subscribe: '#0b5468' } as Record<string, string>)[p.$kind] ?? '#555'};
`;
const Tree = styled.div`display: flex; flex-direction: column; gap: 12px; margin-top: 8px;`;
const TreeLevel = styled.div`
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px;
  span.lbl { width: 72px; color: ${(p) => p.theme.color.GREY}; font-size: 12px; }
`;
const TreeNode = styled(Link)<{ $me?: boolean }>`
  padding: 6px 12px; border-radius: 4px; border: 1px solid ${(p) => (p.$me ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)}; background: ${(p) => (p.$me ? p.theme.color.PALE_GREY : '#fff')};
  color: ${(p) => p.theme.color.BLACK}; text-decoration: none; font-family: ${(p) => p.theme.font.mono}; font-size: 12px;
  &:hover { border-color: ${(p) => p.theme.color.PRIMARY}; }
`;

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'attestations', label: 'Attestations' },
  { id: 'lineage', label: 'Lineage' },
  { id: 'trade', label: 'Trade' },
  { id: 'ledger', label: 'Ledger' },
];

function scoreOf(d: PatchDetail): { text: string; pct: number | null } {
  const real = d.attestations.filter((a) => a.passed && a.verified_on !== 'hash-only');
  const src = real.length ? real : d.attestations.filter((a) => a.passed);
  if (!src.length) return { text: '—', pct: null };
  const s = src[src.length - 1].score;
  return { text: scoreText(s), pct: pct(s.free_generation ?? s.free_generation_vllm ?? s.chat_60) };
}

function recordSummary(r: LedgerRecord): string {
  const b = r.body as Record<string, unknown>;
  switch (r.kind) {
    case 'anchor': return `anchor ${String(b.id)} · sha256 ${shortHash(String(b.patch_sha256))}`;
    case 'attest': return `attest ${String(b.patch_id ?? b.id)} ${b.passed === false ? 'FAIL' : 'PASS'} by ${String(b.verifier_name ?? shortAddr(String(b.verifier)))} (${String(b.verified_on ?? '—')})`;
    case 'settle': return `settle ${String(b.patch_id ?? b.resource)} · ${String(b.amount)} ${String(b.currency ?? '')} from ${shortAddr(String(b.buyer))}`;
    case 'supersede': return `${String(b.new_patch_id)} supersedes ${String(b.old_patch_id)} (${String(b.overlap_rows)} shared rows)`;
    case 'challenge': return `challenge by ${shortAddr(String(b.challenger))}: ${String(b.reason)}`;
    case 'branch': return `branch ${String(b.name)} (${(b.patch_ids as string[] | undefined)?.length ?? 0} patches)`;
    case 'subscribe': return `${String(b.action)} ${String(b.branch)} by ${shortAddr(String(b.node))}`;
    case 'node': return `node ${String(b.name)} @ ${String(b.endpoint)}`;
    default: return r.kind;
  }
}

export default function PatchPage() {
  const { author = '', patchId = '' } = useParams();
  const { isSignedIn } = useAuth();
  const { data, isLoading, error } = usePatchQuery(patchId, { pollingInterval: 10_000 });
  const [tab, setTab] = useState('overview');

  if (isLoading) return <Wrapper><CenterProgress /></Wrapper>;
  if (error || !data) return <NotFoundPage message={`Patch "${patchId}" is not known to this node. It may not have propagated yet, or the id is wrong.`} />;

  const a = data.anchor;
  const authorLabel = a.author_name ?? shortAddr(a.author);
  const authorSlug = decodeURIComponent(author) === a.author ? author : encodeURIComponent(a.author);
  const score = scoreOf(data);
  const listedAgo = data.listed_at ? elapsed(data.listed_at) : elapsed(a.created_at);

  return (
    <Wrapper>
      <Band>
        <BandContent>
          <HeadLeft>
            <PatchTitle><span>{authorLabel}/</span>{a.id}</PatchTitle>
            <Branch>Branch: {a.branch ?? (data.branches[0]?.name ?? 'main')} · Topic: {a.topic_path}</Branch>
          </HeadLeft>
          <ViewAll to={`/benchmarks/${encodeURIComponent(a.benchmark.schema)}`}>View all patches for this benchmark &gt;</ViewAll>
        </BandContent>
      </Band>
      <Divider />
      <Content>
        <ContentInner>
          <NameRow>
            <Name>{a.name}</Name>
            <StatusChip status={data.status} />
            <Quorum>{data.passed}/{data.quorum} attestations{data.quorum_ok ? ' · quorum reached' : ''}</Quorum>
            {data.owned && <ManageMenu to={`/project/${authorSlug}/${encodeURIComponent(a.id)}`}>Manage <img src="/static/images/ic-openwindow.svg" alt="" /></ManageMenu>}
          </NameRow>
          <Info>Published by <b title={a.author}>{authorLabel}</b> ∙ model <b>{a.model.id_M}</b> ∙ {data.status === 'LISTED' ? `listed ${listedAgo}` : `announced ${elapsed(a.created_at)}`}{data.superseded_by.length > 0 && <> ∙ superseded by <StyledLink to={`/${authorSlug}/${encodeURIComponent(data.superseded_by[0])}`}>{data.superseded_by[0]}</StyledLink></>}</Info>

          <Stats>
            <Stat><StatValue>{num(data.downloads)}</StatValue><StatName>Downloads</StatName></Stat>
            <Stat><StatValue>{score.text}</StatValue><StatName>Score</StatName></Stat>
            <Stat><StatValue>{num(a.rows)}</StatValue><StatName>Rows</StatName></Stat>
            <Stat><StatValue>{bytes(a.size_bytes)}</StatValue><StatName>Size</StatName></Stat>
            <Stat><StatValue>{price(a.price, a.currency)}</StatValue><StatName>Price</StatName></Stat>
            <Stat><StatValue>{num(data.revenue)}</StatValue><StatName>Revenue</StatName></Stat>
          </Stats>

          <TabBar><Tabs tabs={TABS} value={tab} onChange={setTab} /></TabBar>

          {tab === 'overview' && <Overview d={data} authorSlug={authorSlug} score={score} />}
          {tab === 'attestations' && <Attestations d={data} />}
          {tab === 'lineage' && <Lineage d={data} authorSlug={authorSlug} />}
          {tab === 'trade' && <Trade d={data} authorSlug={authorSlug} isOperator={isSignedIn} />}
          {tab === 'ledger' && <LedgerTab id={a.id} />}
        </ContentInner>
      </Content>
    </Wrapper>
  );
}

/* ---------------------------------------------------------------- tabs */
function Overview({ d, authorSlug, score }: { d: PatchDetail; authorSlug: string; score: { text: string; pct: number | null } }) {
  const a = d.anchor;
  return (
    <>
      <Section>
        <H3>Description</H3>
        <P>{a.description || 'No description.'}</P>
        {score.pct !== null && <div style={{ marginTop: 16, maxWidth: 360 }}><ScoreBar pct={score.pct} /><Quorum>{score.text} free-generation on the benchmark</Quorum></div>}
      </Section>
      <Section>
        <H3>Model identity (id_M)</H3>
        <KeyValue>
          <dt>Model</dt><dd>{a.model.id_M}</dd>
          {a.model.checkpoint_hash && <><dt>Checkpoint</dt><dd><Mono>{a.model.checkpoint_hash}</Mono></dd></>}
          {a.model.tokenizer_hash && <><dt>Tokenizer</dt><dd><Mono>{a.model.tokenizer_hash}</Mono></dd></>}
          {a.model.hash_const && <><dt>Hash constant</dt><dd><Mono>{a.model.hash_const}</Mono></dd></>}
          <dt>Row width</dt><dd>{a.model.row_dim ?? '—'}</dd>
          <dt>Billing</dt><dd>{a.billing}</dd>
          <dt>License</dt><dd>{a.license ?? 'use on the identified model; no resale of raw rows'}</dd>
          <dt>Created</dt><dd>{dateTime(a.created_at)}</dd>
        </KeyValue>
      </Section>
      <Section>
        <H3>Benchmark</H3>
        <KeyValue>
          <dt>Schema</dt><dd><StyledLink to={`/benchmarks/${encodeURIComponent(a.benchmark.schema)}`}>{a.benchmark.schema}</StyledLink></dd>
          <dt>Queries</dt><dd>{num(a.benchmark.queries)}</dd>
          <dt>Formats</dt><dd>{a.benchmark.format.join(', ') || '—'}</dd>
          <dt>Collateral bound</dt><dd>{a.benchmark.collateral_bound_nat !== undefined ? `≤ ${a.benchmark.collateral_bound_nat} nat on unrelated text` : '—'}</dd>
          <dt>Benchmark hash</dt><dd><Mono>{a.benchmark_hash}</Mono></dd>
          {a.benchmark.answers_hash && <><dt>Sealed answers</dt><dd><Mono>{a.benchmark.answers_hash}</Mono></dd></>}
        </KeyValue>
        {!!a.benchmark.samples?.length && (
          <>
            <H3 style={{ marginTop: 16 }}>Sample prompts ({a.benchmark.samples.length})</H3>
            <Samples>
              {a.benchmark.samples.slice(0, 12).map((s, i) => <li key={i}>{JSON.stringify(s.prompt)} → <b>{s.expect}</b></li>)}
              {a.benchmark.samples.length > 12 && <li>… {a.benchmark.samples.length - 12} more</li>}
            </Samples>
          </>
        )}
        {a.recipe && (
          <>
            <H3 style={{ marginTop: 16 }}>Recipe (portable across models)</H3>
            <Pre>{JSON.stringify(a.recipe, null, 2)}</Pre>
          </>
        )}
      </Section>
      <Section>
        <H3>Integrity</H3>
        <Hash>sha256 {a.patch_sha256}<CopyButton text={a.patch_sha256} label="Copy" /></Hash>
        <KeyValue>
          <dt>Ledger record</dt><dd><Mono>{d.record_hash || '— (draft)'}</Mono></dd>
          {a.entry_id && <><dt>AIN knowledge entry</dt><dd><Mono>{a.entry_id}</Mono></dd></>}
          {a.node_id && <><dt>AIN graph node</dt><dd><Mono>{a.node_id}</Mono></dd></>}
          <dt>Body held by this node</dt><dd>{d.has_body ? 'yes' : 'no'}</dd>
        </KeyValue>
      </Section>
      <Section>
        <H3>Conflicts (address-set intersection)</H3>
        {d.conflicts.length === 0 && <P>No overlapping rows with any other patch this node holds a body for. Patches with disjoint address sets compose by union.</P>}
        {d.conflicts.length > 0 && (
          <TableWrapper>
            <Table>
              <TableHeader><TableRow><TableHead $align="left" $padding="0 8px 0 0">Patch</TableHead><TableHead>Shared rows</TableHead><TableHead>Same benchmark</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {d.conflicts.map((c) => (
                  <TableRow key={c.patch_id}>
                    <TableData $align="left" $padding="0 8px 0 0" $weight={600}><StyledLink to={`/${authorSlug}/${encodeURIComponent(c.patch_id)}`}>{c.patch_id}</StyledLink></TableData>
                    <TableData>{num(c.overlap_rows)}</TableData>
                    <TableData>{c.same_schema ? 'yes — contradictory or updating' : 'no — rebase intersecting rows'}</TableData>
                    <TableData><StatusChip status={c.status} /></TableData>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        )}
        {d.supersedes.length > 0 && <Alert $tone="info" style={{ marginTop: 12 }}>This patch supersedes {d.supersedes.map((s, i) => <span key={s}>{i > 0 && ', '}<StyledLink to={`/${authorSlug}/${encodeURIComponent(s)}`}>{s}</StyledLink></span>)} — same benchmark schema, overlapping rows, newer listing.</Alert>}
        {d.superseded_by.length > 0 && <Alert $tone="warning" style={{ marginTop: 12 }}>Superseded by {d.superseded_by.map((s, i) => <span key={s}>{i > 0 && ', '}<StyledLink to={`/${authorSlug}/${encodeURIComponent(s)}`}>{s}</StyledLink></span>)}. Subscribers are advised to update.</Alert>}
      </Section>
      {d.branches.length > 0 && (
        <Section>
          <H3>Branches</H3>
          <P>{d.branches.map((b) => `${b.name} (${Object.entries(b.context).map(([k, v]) => `${k}=${v}`).join(', ') || 'no context'})`).join(' · ')}</P>
        </Section>
      )}
    </>
  );
}

function Attestations({ d }: { d: PatchDetail }) {
  return (
    <Section style={{ padding: '8px 0 0' }}>
      {d.attestations.length === 0 && <Empty style={{ border: 0 }}>No attestations yet. Verifier nodes pick up announced patches automatically.</Empty>}
      {d.attestations.length > 0 && (
        <TableWrapper>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead $align="left" $padding="0 0 0 32px">Verifier</TableHead><TableHead>Verified on</TableHead><TableHead>Score</TableHead><TableHead>Restarts</TableHead><TableHead>Stake</TableHead><TableHead>Result</TableHead><TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.attestations.map((at) => (
                <TableRow key={at.verifier + at.created_at}>
                  <TableData $align="left" $padding="0 0 0 32px" $weight={600} title={at.verifier}>{at.verifier_name ?? shortAddr(at.verifier)}<div style={{ fontSize: 11, color: '#8d8d8f', fontWeight: 400 }}>{shortAddr(at.verifier, 8)}</div></TableData>
                  <TableData $mono title={at.verified_on}>{at.verified_on}</TableData>
                  <TableData $mono title={JSON.stringify(at.score)}>{scoreText(at.score)}</TableData>
                  <TableData>{at.restarts_detected ?? 0}</TableData>
                  <TableData>{at.stake}</TableData>
                  <TableData $color={at.passed ? '#44a45f' : '#e6173e'} $weight={600}>{at.passed ? 'PASS' : 'FAIL'}</TableData>
                  <TableData title={dateTime(at.created_at)}>{at.created_at ? elapsed(at.created_at) : '—'}</TableData>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}
      <P style={{ padding: '16px 32px', fontSize: 12 }}>
        <b>hash-only</b> means the verifier confirmed sha256 and row count but did not run the benchmark (no compatible serving runtime on that node).
        Restart-aware verification re-applies the patch and re-measures when the serving table reverted mid-run.
      </P>
    </Section>
  );
}

function Lineage({ d, authorSlug }: { d: PatchDetail; authorSlug: string }) {
  const { parents, children } = d.lineage;
  return (
    <Section>
      <H3>Lineage</H3>
      <P>Derived patches record their parents on the ledger; a share of every sale flows to the ancestors' authors as royalty.</P>
      <Tree>
        <TreeLevel><span className="lbl">Parents</span>{parents.length === 0 && <Quorum>none — root patch</Quorum>}{parents.map((p) => <TreeNode key={p.id} to={`/${authorSlug}/${encodeURIComponent(p.id)}`} title={`${p.name} · ${p.status}`}>{p.id}</TreeNode>)}</TreeLevel>
        <TreeLevel><span className="lbl">↓</span></TreeLevel>
        <TreeLevel><span className="lbl">This</span><TreeNode $me to="#" onClick={(e) => e.preventDefault()}>{d.anchor.id}</TreeNode></TreeLevel>
        <TreeLevel><span className="lbl">↓</span></TreeLevel>
        <TreeLevel><span className="lbl">Children</span>{children.length === 0 && <Quorum>no derived patches yet</Quorum>}{children.map((c) => <TreeNode key={c.id} to={`/${authorSlug}/${encodeURIComponent(c.id)}`} title={`${c.name} · ${c.status}`}>{c.id}</TreeNode>)}</TreeLevel>
      </Tree>
      {d.anchor.parent_authors.length > 0 && <KeyValue><dt>Royalty recipients</dt><dd>{[...new Set(d.anchor.parent_authors)].map((x) => shortAddr(x, 8)).join(', ')}</dd></KeyValue>}
    </Section>
  );
}

function Trade({ d, authorSlug, isOperator }: { d: PatchDetail; authorSlug: string; isOperator: boolean }) {
  const [buy, { data: result, isLoading, error, reset }] = useBuyMutation();
  const gw = d.gateway_url ?? `${window.location.origin}/x402/patch/${d.anchor.id}`;
  const a = d.anchor;
  const canBuy = d.quorum_ok && !d.owned;
  return (
    <>
      <Section>
        <H3>How trading works (HTTP 402 / x402)</H3>
        <P>
          1. <b>GET</b> the patch resource — the seller node answers <b>402 Payment Required</b> with the payment requirements (scheme, asset, amount, payTo, nonce) in the <Mono>x-payment-required</Mono> header.{'\n'}
          2. Pay: on the AIN ledger an <b>AIN transfer</b> to payTo (ain-js <Mono>AinTransferSchemeClient</Mono>); on the local ledger a signed credit intent.{'\n'}
          3. Retry the same GET with <Mono>X-PAYMENT</Mono>. The seller verifies the payment, writes a <b>settle</b> record with the lineage royalty split, and returns the manifest (its sha256 is checked against the on-chain content hash).{'\n'}
          4. Download the body from any peer that holds it by content hash and verify <Mono>sha256 == {shortHash(a.patch_sha256)}</Mono>. Apply with the runtime applier (seconds, no restart) — and revert just as fast.
        </P>
        <KeyValue>
          <dt>Gateway</dt><dd><ExternalLink href={gw} target="_blank" rel="noopener noreferrer">{gw}</ExternalLink></dd>
          <dt>Price</dt><dd>{price(a.price, a.currency)} · {a.billing}</dd>
          <dt>Seller</dt><dd><Mono>{a.author}</Mono></dd>
        </KeyValue>
        <Pre>{`# 1) ask → 402 with requirements\ncurl -i ${gw}\n\n# 2) pay, then retry with the proof\ncurl -i -H "X-PAYMENT: $(echo -n '{"scheme":"ain-transfer","network":"ain:local","txHash":"0x…"}' | base64 -w0)" ${gw}\n\n# or let the CLI do the whole loop\nngram patch buy ${a.id}`}</Pre>
      </Section>
      <Section>
        <H3>Buy from this node</H3>
        {!isOperator && <P>Sign in to the operator console of this node to buy with its identity, or use <Mono>ngram patch buy {a.id}</Mono> from any node.</P>}
        {isOperator && d.owned && <P>You published this patch. <StyledLink to={`/project/${authorSlug}/${encodeURIComponent(a.id)}`}>Manage it</StyledLink>.</P>}
        {isOperator && !d.owned && d.purchased && <Alert $tone="success">Already purchased{d.applied ? ' and applied on the serving runtime' : ''}. Body {d.has_body ? 'is stored on this node' : 'is not stored locally'}.</Alert>}
        {isOperator && !d.owned && !d.quorum_ok && <Alert $tone="warning">Not listed yet ({d.passed}/{d.quorum} attestations). Buying requires verifier quorum.</Alert>}
        {isOperator && canBuy && (
          <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="contained" loading={isLoading} loadingText="Paying…" onClick={() => { reset(); void buy({ id: a.id }); }}>
              {d.purchased ? 'Buy again' : `Buy with x402 · ${price(a.price, a.currency)}`}
            </Button>
            <Quorum>Pays from this node's {a.currency === 'AIN' ? 'AIN wallet' : 'credit balance'} and stores the body locally.</Quorum>
          </div>
        )}
        {error && <Alert $tone="error" style={{ marginTop: 12 }}>{errorMessage(error)}</Alert>}
        {result && <PurchaseTimeline r={result} />}
      </Section>
    </>
  );
}

function PurchaseTimeline({ r }: { r: PurchaseResult }) {
  return (
    <>
      <Alert $tone="success" style={{ marginTop: 16 }}>Purchased {r.patch_id} for {r.amount} ({r.scheme}) · tx <Mono>{shortHash(r.tx_hash, 18)}</Mono></Alert>
      <Timeline>
        {r.steps.map((s, i) => <li key={i}><span className="step">{s.step}</span>{s.detail}<span className="t">{new Date(s.at).toLocaleTimeString()}</span></li>)}
      </Timeline>
      <KeyValue>
        <dt>Body</dt><dd><Mono>{r.path}</Mono></dd>
        <dt>sha256</dt><dd><Mono>{r.manifest.patch_sha256}</Mono></dd>
        <dt>Blob URLs</dt><dd>{r.manifest.blob_urls.map((u) => <div key={u}><Mono>{u}</Mono></div>)}</dd>
      </KeyValue>
    </>
  );
}

function LedgerTab({ id }: { id: string }) {
  const { data, isLoading } = usePatchRecordsQuery(id, { pollingInterval: 10_000 });
  if (isLoading) return <CenterProgress />;
  const recs = [...(data?.records ?? [])].sort((a, b) => b.ts - a.ts);
  return (
    <Section style={{ padding: '8px 0 0' }}>
      {recs.length === 0 && <Empty style={{ border: 0 }}>No ledger records yet — drafts live only on this node until announced.</Empty>}
      {recs.length > 0 && (
        <TableWrapper>
          <Table>
            <TableHeader><TableRow><TableHead $align="left" $padding="0 0 0 32px">Kind</TableHead><TableHead $align="left">Summary</TableHead><TableHead>Author</TableHead><TableHead>Time</TableHead><TableHead $align="right" $padding="0 32px 0 8px">Hash / tx</TableHead></TableRow></TableHeader>
            <TableBody>
              {recs.map((r) => (
                <TableRow key={r.hash}>
                  <TableData $align="left" $padding="0 0 0 32px"><KindChip $kind={r.kind}>{r.kind}</KindChip></TableData>
                  <TableData $align="left" $maxWidth="420px" title={recordSummary(r)}>{recordSummary(r)}</TableData>
                  <TableData $mono title={r.author}>{shortAddr(r.author, 6)}</TableData>
                  <TableData title={dateTime(r.ts)}>{r.ts ? elapsed(r.ts) : '—'}</TableData>
                  <TableData $align="right" $padding="0 32px 0 8px" $mono title={r.sig || r.hash}>{shortHash(r.sig && r.sig.startsWith('0x') ? r.sig : r.hash, 14)}</TableData>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}
    </Section>
  );
}

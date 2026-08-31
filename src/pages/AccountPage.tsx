import { useState, type FormEvent } from 'react';
import styled from 'styled-components';
import {
  errorMessage, useAddPeerMutation, useChainSetupMutation, useCompleteMutation, useInfoQuery, useMeQuery, useNodesQuery, useRemovePeerMutation, useRuntimeQuery, useWalletQuery,
} from '@/api/api';
import { Button } from '@/components/ui/Button';
import { Alert, TextField } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Description, KeyValue, Mono, PageWrapper, StyledLink, SubTitle, Title } from '@/components/ui/Misc';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableRowEmpty, TableWrapper } from '@/components/ui/Table';
import { MonoBox, Muted, Pre, RadioGroup, Row, Stack } from '@/components/operator/common';
import { dateTime, elapsed, num, price, shortAddr, shortHash } from '@/utils/format';

const Section = styled.div`margin-top: 16px;`;
const Balance = styled.div`font-size: 28px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; margin-top: 12px; span { font-size: 14px; font-weight: 400; color: ${(p) => p.theme.color.GREY}; margin-left: 8px; }`;
const Grid = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; margin-top: 16px;`;
const Danger = styled.div`margin-top: 16px; padding: 16px 20px; border: 1px solid #f3c1cb; background: #fff7f8; font-size: 14px; color: ${(p) => p.theme.color.GREY};`;

const EMAIL_OPTIONS = [
  { value: 'all', label: 'All updates — trades, verifications, new patches on subscribed branches' },
  { value: 'important', label: 'Important only — challenges, rejections, payment failures' },
  { value: 'none', label: 'No emails' },
];
const EMAIL_KEY = 'km.emailPreference';

export default function AccountPage() {
  const { data: me } = useMeQuery();
  const { data: info } = useInfoQuery();
  const wallet = useWalletQuery();
  const nodes = useNodesQuery();
  const runtime = useRuntimeQuery();
  const [chainSetup, chainState] = useChainSetupMutation();
  const [addPeer, addState] = useAddPeerMutation();
  const [removePeer, removeState] = useRemovePeerMutation();
  const [complete, completeState] = useCompleteMutation();

  const [endpoint, setEndpoint] = useState('');
  const [prompt, setPrompt] = useState('종목코드 픽셀플러스 ');
  const [completion, setCompletion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [emailPref, setEmailPref] = useState(() => { try { return localStorage.getItem(EMAIL_KEY) ?? 'important'; } catch { return 'important'; } });
  const [emailSaved, setEmailSaved] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok?: string) => { setError(null); setNotice(null); try { await fn(); if (ok) setNotice(ok); } catch (err) { setError(errorMessage(err)); } };
  const onAddPeer = (e: FormEvent) => { e.preventDefault(); if (!endpoint.trim()) return; void run(async () => { await addPeer({ endpoint: endpoint.trim().replace(/\/+$/, '') }).unwrap(); setEndpoint(''); }, 'Peer added.'); };
  const onTry = () => { setCompletion(null); void run(async () => { const r = await complete({ prompt, max_tokens: 16 }).unwrap(); setCompletion(r.text); }); };

  const currency = info?.currency ?? wallet.data?.network ?? '';
  const isAin = info?.ledger.kind === 'ain';

  return (
    <PageWrapper>
      <Title>Account settings</Title>
      <Description>This console operates one node. Its identity, wallet, peers and serving runtime are configured here; patches and branches live on the dashboard.</Description>
      {error && <Alert $tone="error" style={{ marginTop: 16 }}>{error}</Alert>}
      {notice && <Alert $tone="success" style={{ marginTop: 16 }}>{notice}</Alert>}

      {/* ------------------------------------------------------------ identity */}
      <SubTitle $mt={48}>Node identity</SubTitle>
      {!me || !info ? <CenterProgress /> : (
        <KeyValue>
          <dt>Name</dt><dd>{me.name}</dd>
          <dt>Address</dt><dd><Mono>{me.address}</Mono> <CopyButton text={me.address} label="Copy" /></dd>
          <dt>Roles</dt><dd>{me.roles.join(', ')}</dd>
          <dt>Endpoint</dt><dd><Mono>{info.node.endpoint}</Mono></dd>
          <dt>Ledger</dt><dd>{info.ledger.kind === 'ain' ? <>AIN blockchain · <Mono>{info.ledger.provider}</Mono> · app <Mono>{info.ledger.app}</Mono></> : 'local P2P ledger (signed record DAG, gossip-replicated)'}</dd>
          <dt>Height / records</dt><dd>{num(info.ledger.height ?? 0)} / {num(info.ledger.records)}</dd>
          <dt>Quorum</dt><dd>{info.quorum} independent attestations to list a patch</dd>
          <dt>Version</dt><dd>{info.node.version}</dd>
        </KeyValue>
      )}

      {/* ------------------------------------------------------------ wallet */}
      <SubTitle $mt={56}>Wallet</SubTitle>
      <Description>{isAin ? 'AIN balance of the node account. x402 purchases are AIN transfers; sales and lineage royalties arrive here.' : 'Local dev credit derived from the ledger (initial credit + royalties received − purchases). Switch the node to the AIN ledger for real settlement.'}</Description>
      {wallet.isLoading ? <CenterProgress /> : wallet.data && (
        <>
          <Balance>{wallet.data.balance === null ? '—' : num(wallet.data.balance)}<span>{currency}</span></Balance>
          <Muted>{wallet.data.purchases} purchase(s) · {wallet.data.sales.length} sale(s) · {wallet.data.royalties.length} royalty payment(s) received</Muted>
          {isAin && (
            <Row $gap={12} style={{ marginTop: 12 }}>
              <Button size="small" loading={chainState.isLoading} loadingText="Setting up…" onClick={() => run(() => chainSetup().unwrap(), 'Knowledge app + market rules are set on chain.')}>Setup app on chain</Button>
              <Muted>runs ain-js <Mono>knowledge.setupApp()</Mono> and installs the market write rules (idempotent)</Muted>
            </Row>
          )}
          <Grid>
            <div>
              <strong style={{ fontSize: 14 }}>Sales</strong>
              <TableWrapper style={{ marginTop: 8 }}>
                <Table>
                  <TableHeader><TableRow><TableHead $align="left" $padding="0 8px">Patch</TableHead><TableHead>Buyer</TableHead><TableHead>Amount</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {wallet.data.sales.slice(0, 20).map((s) => (
                      <TableRow key={s.tx_hash}>
                        <TableData $align="left" $padding="0 8px">{s.patch_id}</TableData>
                        <TableData title={s.buyer}>{shortAddr(s.buyer)}</TableData>
                        <TableData>{price(s.amount, s.currency)}</TableData>
                        <TableData title={dateTime(s.created_at)}>{elapsed(s.created_at)}</TableData>
                      </TableRow>
                    ))}
                    {wallet.data.sales.length === 0 && <TableRowEmpty $height={72}><td colSpan={4}>No sales yet.</td></TableRowEmpty>}
                  </TableBody>
                </Table>
              </TableWrapper>
            </div>
            <div>
              <strong style={{ fontSize: 14 }}>Royalties received</strong>
              <TableWrapper style={{ marginTop: 8 }}>
                <Table>
                  <TableHeader><TableRow><TableHead $align="left" $padding="0 8px">Derived patch</TableHead><TableHead>Amount</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {wallet.data.royalties.slice(0, 20).map((r, i) => (
                      <TableRow key={`${r.patch_id}-${i}`}>
                        <TableData $align="left" $padding="0 8px">{r.patch_id}</TableData>
                        <TableData>{price(r.amount, currency)}</TableData>
                        <TableData title={dateTime(r.created_at)}>{elapsed(r.created_at)}</TableData>
                      </TableRow>
                    ))}
                    {wallet.data.royalties.length === 0 && <TableRowEmpty $height={72}><td colSpan={3}>No royalties yet — publish patches others derive from.</td></TableRowEmpty>}
                  </TableBody>
                </Table>
              </TableWrapper>
            </div>
          </Grid>
        </>
      )}

      {/* ------------------------------------------------------------ peers */}
      <SubTitle $mt={56}>Peers</SubTitle>
      <Description>Seed peers this node gossips with (peer exchange discovers the rest). See the whole network on the <StyledLink to="/network">Network</StyledLink> page.</Description>
      <TableWrapper style={{ marginTop: 12 }}>
        <Table>
          <TableHeader><TableRow><TableHead $align="left" $padding="0 8px">Endpoint</TableHead><TableHead>Name</TableHead><TableHead>Address</TableHead><TableHead>Roles</TableHead><TableHead>Last seen</TableHead><TableHead>Failures</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {(nodes.data?.peers ?? []).map((p) => (
              <TableRow key={p.endpoint}>
                <TableData $align="left" $padding="0 8px" $mono title={p.endpoint}>{p.endpoint}</TableData>
                <TableData>{p.info?.name ?? '—'}</TableData>
                <TableData title={p.address ?? ''}>{shortAddr(p.address)}</TableData>
                <TableData>{p.info?.roles.join(', ') ?? '—'}</TableData>
                <TableData>{p.last_seen ? elapsed(p.last_seen) : 'never'}</TableData>
                <TableData $color={p.failures > 0 ? '#e6173e' : undefined}>{p.failures}</TableData>
                <TableData><Button size="small" variant="text" color="secondary" loading={removeState.isLoading && removeState.originalArgs?.endpoint === p.endpoint} onClick={() => run(() => removePeer({ endpoint: p.endpoint }).unwrap(), 'Peer removed.')}>Remove</Button></TableData>
              </TableRow>
            ))}
            {(nodes.data?.peers ?? []).length === 0 && <TableRowEmpty $height={72}><td colSpan={7}>No peers configured — add one below or pass --peers on start.</td></TableRowEmpty>}
          </TableBody>
        </Table>
      </TableWrapper>
      <form onSubmit={onAddPeer} style={{ marginTop: 16, maxWidth: 560 }}>
        <Row $gap={12} $align="flex-end">
          <TextField label="Add peer endpoint" placeholder="http://127.0.0.1:3403" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
          <Button type="submit" loading={addState.isLoading}>Add</Button>
        </Row>
      </form>

      {/* ------------------------------------------------------------ runtime */}
      <SubTitle $mt={56}>Runtime</SubTitle>
      <Description>The serving model this node can patch live (row read/write hook, no restart) and score benchmarks against.</Description>
      {runtime.isLoading ? <CenterProgress /> : runtime.data && (
        <Section>
          <KeyValue>
            <dt>Status</dt><dd style={{ color: runtime.data.available ? '#44a45f' : '#e6173e', fontWeight: 600 }}>{runtime.data.available ? 'available' : `unavailable${runtime.data.error ? ` — ${runtime.data.error}` : ''}`}</dd>
            <dt>Serving API</dt><dd><Mono>{runtime.data.api ?? '—'}</Mono></dd>
            <dt>Model</dt><dd>{runtime.data.model ?? '—'}</dd>
            <dt>Patch hook</dt><dd>{runtime.data.hook ? 'connected' : 'not connected'}</dd>
            <dt>Repo</dt><dd><Mono>{runtime.data.repo ?? '—'}</Mono></dd>
            <dt>Applied patches</dt><dd>{runtime.data.applied.length ? runtime.data.applied.map((a) => <span key={a.patch_id} style={{ marginRight: 12 }}>{a.patch_id} <Muted>({a.reason}, {elapsed(a.applied_at)})</Muted></span>) : <Muted>none</Muted>}</dd>
          </KeyValue>
          <Stack $gap={12} style={{ marginTop: 20, maxWidth: 640 }}>
            <strong style={{ fontSize: 14 }}>Try the model</strong>
            <Muted>Ask the live model — apply a patch from the dashboard and ask again to see the knowledge take effect (e.g. 픽셀플러스 → 087600).</Muted>
            <Row $gap={12} $align="flex-end">
              <TextField label="Prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              <Button disabled={!runtime.data.model} loading={completeState.isLoading} loadingText="Generating…" onClick={onTry}>Complete</Button>
            </Row>
            {completion !== null && <MonoBox><span style={{ color: '#8d8d8f' }}>{prompt}</span><strong>{completion}</strong></MonoBox>}
          </Stack>
        </Section>
      )}

      {/* ------------------------------------------------------------ email preference */}
      <SubTitle $mt={56}>Email preference</SubTitle>
      <RadioGroup role="radiogroup" aria-label="email preference">
        {EMAIL_OPTIONS.map((o) => (
          <label key={o.value}><input type="radio" name="emailPreference" value={o.value} checked={emailPref === o.value} onChange={() => { setEmailPref(o.value); setEmailSaved(false); }} />{o.label}</label>
        ))}
      </RadioGroup>
      <Row $gap={12} style={{ marginTop: 16 }}>
        <Button onClick={() => { try { localStorage.setItem(EMAIL_KEY, emailPref); } catch { /* ignore */ } setEmailSaved(true); }}>Update</Button>
        {emailSaved && <Muted>Saved on this browser.</Muted>}
      </Row>

      {/* ------------------------------------------------------------ danger zone */}
      <SubTitle $mt={56}>Danger zone</SubTitle>
      <Danger>
        Node identities cannot be deleted from the web console: the address is referenced by ledger records other peers already hold. To retire this node, stop it and remove <Mono>~/.ngram</Mono> (CLI: <Mono>ngram node retire</Mono>). Keys are never uploaded anywhere.
      </Danger>
      {info && <Pre style={{ marginTop: 24 }}>{JSON.stringify({ address: me?.address, ledger: info.ledger, peers: info.peers, counts: info.counts, chain_tx_sample: shortHash(info.ledger.head ?? '', 20) }, null, 2)}</Pre>}
    </PageWrapper>
  );
}

import { useState } from 'react';
import { Link, useParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useBuyMutation, useInfoQuery, usePatchQuery, usePatchRecordsQuery } from '@/api/api';
import type { Attestation, ConflictInfo, PatchDetail, PurchaseResult } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Divider, Empty, ExternalLink, KeyValue, Mono, ScoreBar, StatusChip, StyledLink, Tabs } from '@/components/ui/Misc';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableWrapper } from '@/components/ui/Table';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { bytes, dateTime, num, pct, scoreText, shortAddr, shortHash } from '@/utils/format';
import NotFoundPage from './NotFoundPage';
import { isExecuted, useDetailFormat } from './detail/recordText';

/* ---------------------------------------------------------------- layout ported from ainize DeploymentPage.js */
const Wrapper = styled.div`width: 100%; flex: 1; display: flex; flex-direction: column;`;
const Band = styled.div`width: 100%; display: flex; justify-content: center; background-color: #ffffff;`;
const BandContent = styled.div`
  width: 100%; max-width: ${(p) => p.theme.layout.maxWidth}; padding: 32px 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 16px 24px;
  @media (min-width: ${(p) => p.theme.layout.maxWidth}) { padding: 32px 0; }
`;
const HeadLeft = styled.div`flex: 1 1 320px; min-width: 0;`;
const PatchTitle = styled.h1`margin: 0; font-size: 22px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; word-break: keep-all; line-height: 1.35;`;
const IdLine = styled.div`
  margin-top: 6px; font-size: 13px; color: ${(p) => p.theme.color.GREY}; display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center;
  code { font-family: ${(p) => p.theme.font.mono}; color: #1b73e8; word-break: break-all; }
`;
const Branch = styled.div`margin-top: 6px; font-size: 13px; color: ${(p) => p.theme.color.GREY};`;
const TaughtLine = styled.div`
  margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: 13px; color: ${(p) => p.theme.color.DARK_GREY};
  button { background: none; border: 0; padding: 0; font: inherit; font-weight: 600; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer; &:hover { text-decoration: underline; } }
`;
const TaughtChip = styled.span`display: inline-flex; align-items: center; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; background: #e1eef3; color: #0b5468;`;
const HeadRight = styled.div`display: flex; flex-direction: column; align-items: flex-end; gap: 8px;`;
const LiveTestLink = styled(Link)`
  display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 10px 26px; border-radius: 4px; text-decoration: none;
  background: ${(p) => p.theme.color.PRIMARY}; color: #fff; font-size: 15px; font-weight: 700; line-height: 1.3; white-space: nowrap;
  small { font-size: 11px; font-weight: 400; opacity: 0.9; }
  &:hover { background: ${(p) => p.theme.color.HOVER}; }
`;
const ViewAll = styled(Link)`
  height: 30px; display: inline-flex; align-items: center; font-size: 13px; font-weight: 500; color: ${(p) => p.theme.color.GREY}; text-decoration: none;
  &:hover { border-bottom: 1px solid ${(p) => p.theme.color.GREY}; }
`;
const Content = styled.div`width: 100%; flex: 1; display: flex; flex-direction: column; align-items: center; background-color: #fafafa;`;
const ContentInner = styled.div`
  width: 100%; max-width: ${(p) => p.theme.layout.maxWidth}; padding: 32px 16px 56px;
  @media (min-width: ${(p) => p.theme.layout.maxWidth}) { padding: 32px 0 56px; }
`;
const NameRow = styled.div`display: flex; align-items: center; gap: 10px; flex-wrap: wrap;`;
const Quorum = styled.span`font-size: 12px; color: ${(p) => p.theme.color.GREY};`;
const Info = styled.div`margin-top: 9px; font-size: 12px; color: ${(p) => p.theme.color.GREY}; b { color: ${(p) => p.theme.color.BLACK}; font-weight: 500; }`;
const Stats = styled.div`
  margin-top: 24px; display: flex; flex-wrap: wrap; gap: 24px 32px; padding: 20px 24px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
`;
const Stat = styled.div`display: flex; flex-direction: column; align-items: center; min-width: 72px;`;
const StatValue = styled.div`font-size: 20px; font-weight: 500; color: ${(p) => p.theme.color.BLACK}; font-variant-numeric: tabular-nums; white-space: nowrap;`;
const StatName = styled.div`margin-top: 4px; font-size: 12px; font-weight: 500; color: ${(p) => p.theme.color.GREY}; border-bottom: 1px dotted transparent; &[title] { border-bottom-color: ${(p) => p.theme.color.LIGHT_GREY}; cursor: help; }`;
const StatNote = styled.div`margin-top: 2px; font-size: 10px; color: ${(p) => p.theme.color.GREY}; text-align: center; max-width: 150px; line-height: 1.3;`;
const Section = styled.section`margin-top: 24px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; padding: 24px 32px;`;
const H3 = styled.h3`margin: 0 0 8px; font-size: 14px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; &[title] { cursor: help; }`;
const P = styled.p`margin: 0; font-size: 14px; line-height: 1.6; color: ${(p) => p.theme.color.DARK_GREY}; white-space: pre-wrap; word-break: keep-all;`;
const Note = styled.p`margin: 0 0 12px; font-size: 12px; line-height: 1.6; color: ${(p) => p.theme.color.GREY}; word-break: keep-all;`;
const Hash = styled.div`display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-family: ${(p) => p.theme.font.mono}; font-size: 13px; word-break: break-all;`;
const Samples = styled.ul`
  margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 6px;
  li { font-family: ${(p) => p.theme.font.mono}; font-size: 12px; color: ${(p) => p.theme.color.DARK_GREY}; }
  li b { color: ${(p) => p.theme.color.PRIMARY}; font-weight: 500; }
`;
const Pre = styled.pre`
  margin: 8px 0 0; padding: 12px 16px; border-radius: 4px; background: #303133; color: #f2f2f2; font-size: 12px; line-height: 1.6; overflow-x: auto;
`;
const Details = styled.details`
  margin-top: 16px; border: 1px dashed ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; padding: 10px 14px; background: #fafafa;
  summary { cursor: pointer; font-size: 13px; font-weight: 600; color: ${(p) => p.theme.color.GREY}; }
  &[open] summary { margin-bottom: 8px; }
`;
const ManageMenu = styled(Link)`
  display: inline-flex; align-items: center; gap: 8px; font-size: 16px; color: ${(p) => p.theme.color.GREY}; text-decoration: none; margin-left: auto;
  img { width: 14px; height: 14px; }
`;
const TabBar = styled.div`margin-top: 32px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-bottom: 0; padding: 0 24px;`;
const SummaryRow = styled.div`
  display: flex; flex-wrap: wrap; gap: 24px 40px; padding: 16px 32px; border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  div { display: flex; flex-direction: column; gap: 2px; }
  span.k { font-size: 12px; color: ${(p) => p.theme.color.GREY}; }
  span.v { font-size: 18px; font-weight: 500; color: ${(p) => p.theme.color.BLACK}; }
`;
const Timeline = styled.ol`
  margin: 16px 0 0; padding: 0; list-style: none; display: grid; gap: 0;
  li { position: relative; padding: 0 0 16px 28px; font-size: 13px; }
  li::before { content: ''; position: absolute; left: 6px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: ${(p) => p.theme.color.SUCCESS}; }
  li:not(:last-child)::after { content: ''; position: absolute; left: 10px; top: 16px; bottom: 0; width: 2px; background: #e0e0e0; }
  li .step { font-weight: 700; color: ${(p) => p.theme.color.BLACK}; margin-right: 8px; font-size: 12px; }
  li .t { color: ${(p) => p.theme.color.GREY}; font-family: ${(p) => p.theme.font.mono}; margin-left: 8px; font-size: 11px; }
`;
const KindChip = styled.span<{ $kind: string }>`
  display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; white-space: nowrap;
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
  color: ${(p) => p.theme.color.BLACK}; text-decoration: none; font-size: 12px; display: inline-flex; flex-direction: column; gap: 2px;
  code { font-family: ${(p) => p.theme.font.mono}; font-size: 11px; color: ${(p) => p.theme.color.GREY}; }
  &:hover { border-color: ${(p) => p.theme.color.PRIMARY}; }
`;

type Score = { text: string; pct: number | null };

/** Accuracy shown in the header comes only from attestations that ran the real model — never from integrity-only checks. */
function scoreOf(d: PatchDetail): Score {
  const real = d.attestations.filter((a) => a.passed && isExecuted(a.verified_on));
  if (!real.length) return { text: '—', pct: null };
  const s = real[real.length - 1].score;
  return { text: scoreText(s), pct: pct(s.free_generation ?? s.free_generation_vllm ?? s.chat_60) };
}

export default function PatchPage() {
  const { author = '', patchId = '' } = useParams();
  const { isSignedIn } = useAuth();
  const { t, term, help, tech } = useT();
  const f = useDetailFormat();
  const { data, isLoading, error } = usePatchQuery(patchId, { pollingInterval: 10_000 });
  const [tab, setTab] = useState('overview');
  // before the early returns: the tab is named after the knowledge as soon as the node answers
  useTitle(data ? data.anchor.name || data.anchor.id : undefined);

  if (isLoading) return <Wrapper><CenterProgress /></Wrapper>;
  if (error || !data) return <NotFoundPage message={t('detail.patch.not_found', { id: patchId })} />;

  const a = data.anchor;
  const authorLabel = a.author_name ?? shortAddr(a.author);
  const authorSlug = decodeURIComponent(author) === a.author ? author : encodeURIComponent(a.author);
  const score = scoreOf(data);
  const when = data.status === 'LISTED' ? t('detail.patch.listed_when', { ago: f.ago(data.listed_at ?? a.created_at) }) : t('detail.patch.registered_when', { ago: f.ago(a.created_at) });
  const provider = a.contributors?.find((c) => c.role === 'data_provider');
  const taught = a.origin === 'teach' || !!provider;
  const providerName = provider?.name ?? t('detail.taught_by_anon');
  const tabs = [
    { id: 'overview', label: t('detail.tab.overview') },
    { id: 'verification', label: t('detail.tab.verification') },
    { id: 'lineage', label: t('detail.tab.lineage') },
    { id: 'buy', label: t('detail.tab.buy') },
    { id: 'history', label: t('detail.tab.history') },
  ];

  return (
    <Wrapper>
      <Band>
        <BandContent>
          <HeadLeft>
            <PatchTitle>{a.name}</PatchTitle>
            <IdLine><span>{t('detail.patch.id')} <code>{a.id}</code></span><span>{t('common.author')}: <b title={a.author}>{authorLabel}</b></span></IdLine>
            <Branch title={`${tech('branch')} · topic_path`}>{t('detail.patch.track_topic', { branch: a.branch ?? (data.branches[0]?.name ?? 'main'), topic: a.topic_path })}</Branch>
            {taught && (
              <TaughtLine data-testid="taught-by">
                <TaughtChip>{t('detail.taught_badge')}</TaughtChip>
                <span>{provider ? t('detail.people', { author_name: authorLabel, name: provider.name ?? t('detail.taught_by_anon'), share: Math.round(provider.share * 100) }) : t('detail.published_by', { name: providerName, node: authorLabel })}</span>
                {provider && <StyledLink to={`/teacher/${encodeURIComponent(provider.signer ?? provider.address)}`} title={provider.address}>{t('detail.teacher_page')} →</StyledLink>}
                <button type="button" onClick={() => setTab('buy')}>{t('detail.use_yourself')} →</button>
              </TaughtLine>
            )}
          </HeadLeft>
          <HeadRight>
            <LiveTestLink to={`/chat/${encodeURIComponent(a.id)}`} title={`${help('liveTest')} (${tech('liveTest')})`}>
              {term('liveTest')}<small>{t('detail.patch.live_test_sub')}</small>
            </LiveTestLink>
            <ViewAll to={`/benchmarks/${encodeURIComponent(a.benchmark.schema)}`}>{t('detail.patch.view_same_subject')}</ViewAll>
          </HeadRight>
        </BandContent>
      </Band>
      <Divider />
      <Content>
        <ContentInner>
          <NameRow>
            <StatusChip status={data.status} />
            <Quorum title={`${t('detail.patch.quorum_help', { quorum: data.quorum })} (${tech('verified')})`}>
              {t('detail.patch.verified_executed', { passed: data.passed, quorum: data.quorum })}{data.quorum_ok ? ` · ${term('verified')}` : ''}
              {data.integrity_checks > 0 && <> · {t('detail.patch.integrity_n', { n: data.integrity_checks })}</>}
            </Quorum>
            {isSignedIn && data.owned && <ManageMenu to={`/project/${authorSlug}/${encodeURIComponent(a.id)}`}>{t('detail.patch.manage')} <img src="/static/images/ic-openwindow.svg" alt="" /></ManageMenu>}
          </NameRow>
          <Info>
            {t('detail.patch.meta', { author: authorLabel, model: a.model.id_M, when })}
            {data.superseded_by.length > 0 && <> ∙ <StyledLink to={`/${authorSlug}/${encodeURIComponent(data.superseded_by[0])}`} title={help('superseded')}>{t('detail.patch.newer_version', { id: data.superseded_by[0] })}</StyledLink></>}
          </Info>

          <Stats>
            <Stat><StatValue>{num(data.downloads)}</StatValue><StatName>{t('detail.stat.downloads')}</StatName></Stat>
            <Stat><StatValue>{score.pct !== null ? `${score.pct}%` : score.text === '—' ? t('detail.stat.not_yet') : score.text}</StatValue><StatName title={`${t('detail.stat.accuracy_help')} (${tech('accuracy')})`}>{term('accuracy')}</StatName>{score.pct !== null && <StatNote>{score.text}</StatNote>}</Stat>
            <Stat><StatValue>{num(a.rows)}</StatValue><StatName title={`${help('rows')} (${tech('rows')})`}>{t('detail.stat.entries')}</StatName></Stat>
            <Stat><StatValue>{num(a.benchmark.queries)}</StatValue><StatName title={`${help('facts')} (${tech('facts')})`}>{t('detail.stat.facts')}</StatName></Stat>
            <Stat><StatValue>{bytes(a.size_bytes)}</StatValue><StatName>{t('detail.stat.size')}</StatName></Stat>
            <Stat><StatValue>{f.priceLabel(a.price, a.currency)}</StatValue><StatName>{t('detail.stat.price')}</StatName>{Number(a.price) > 0 && <StatNote>{f.priceNote(a.currency)}</StatNote>}</Stat>
            <Stat><StatValue>{f.revenueLabel(data.revenue, a.currency)}</StatValue><StatName>{t('detail.stat.revenue')}</StatName></Stat>
          </Stats>

          <TabBar><Tabs tabs={tabs} value={tab} onChange={setTab} /></TabBar>

          {tab === 'overview' && <Overview d={data} score={score} />}
          {tab === 'verification' && <Verification d={data} />}
          {tab === 'lineage' && <Lineage d={data} authorSlug={authorSlug} />}
          {tab === 'buy' && <Buy d={data} authorSlug={authorSlug} isOperator={isSignedIn} />}
          {tab === 'history' && <HistoryTab id={a.id} />}
        </ContentInner>
      </Content>
    </Wrapper>
  );
}

/* ---------------------------------------------------------------- 개요 */
function Overview({ d, score }: { d: PatchDetail; score: Score }) {
  const { t, term, help, tech } = useT();
  const f = useDetailFormat();
  const a = d.anchor;
  return (
    <>
      <Section>
        <H3>{t('detail.ov.description')}</H3>
        <P>{a.description || t('detail.ov.no_description')}</P>
        {score.pct !== null && <div style={{ marginTop: 16, maxWidth: 360 }}><ScoreBar pct={score.pct} /><Quorum>{t('detail.ov.accuracy_line', { score: `${score.pct}% (${score.text})`, facts: num(a.benchmark.queries) })}</Quorum></div>}
      </Section>
      <Section>
        <H3 title={t('detail.tech.model_identity')}>{t('detail.ov.model')}</H3>
        <Note>{t('detail.ov.model_note')}</Note>
        <KeyValue style={{ marginTop: 0 }}>
          <dt>{t('detail.ov.model_name')}</dt><dd>{a.model.id_M}</dd>
          {a.model.checkpoint_hash && <><dt>{t('detail.ov.checkpoint')}</dt><dd><Mono>{a.model.checkpoint_hash}</Mono></dd></>}
          {a.model.tokenizer_hash && <><dt>{t('detail.ov.tokenizer')}</dt><dd><Mono>{a.model.tokenizer_hash}</Mono></dd></>}
          {a.model.hash_const && <><dt title="hash_const">{t('detail.ov.hash_const')}</dt><dd><Mono>{a.model.hash_const}</Mono></dd></>}
          {a.model.row_dim !== undefined && <><dt title="row_dim">{t('detail.ov.row_dim')}</dt><dd>{a.model.row_dim}</dd></>}
          <dt>{t('detail.ov.billing')}</dt><dd title={a.billing}>{f.billingLabel(a.billing)}</dd>
          <dt>{t('detail.ov.license')}</dt><dd>{a.license ?? t('detail.ov.license_default')}</dd>
          <dt>{t('detail.ov.created')}</dt><dd>{dateTime(a.created_at)}</dd>
        </KeyValue>
      </Section>
      <Section>
        <H3 title={tech('facts')}>{t('detail.ov.benchmark')}</H3>
        <Note>{t('detail.ov.benchmark_note')}</Note>
        <KeyValue style={{ marginTop: 0 }}>
          <dt title="benchmark.schema">{t('detail.ov.subject')}</dt><dd><StyledLink to={`/benchmarks/${encodeURIComponent(a.benchmark.schema)}`}>{a.benchmark.schema}</StyledLink></dd>
          <dt title={tech('facts')}>{term('facts')}</dt><dd>{t('units.facts', { n: num(a.benchmark.queries) })}</dd>
          <dt>{t('detail.ov.formats')}</dt><dd>{a.benchmark.format.join(', ') || '—'}</dd>
          <dt title={`${help('sideEffects')} (${tech('sideEffects')})`}>{t('detail.ov.side_effect_bound')}</dt><dd>{a.benchmark.collateral_bound_nat !== undefined ? <span title={t('detail.ov.side_effect_tech', { n: a.benchmark.collateral_bound_nat })}>{t('detail.ov.side_effect_value')}</span> : '—'}</dd>
          <dt title="benchmark_hash">{t('detail.ov.benchmark_hash')}</dt><dd><Mono>{a.benchmark_hash}</Mono></dd>
          {a.benchmark.answers_hash && <><dt title="answers_hash (commit–reveal)">{t('detail.ov.answers_hash')}</dt><dd><Mono>{a.benchmark.answers_hash}</Mono></dd></>}
        </KeyValue>
        {!!a.benchmark.samples?.length && (
          <>
            <H3 style={{ marginTop: 16 }}>{t('detail.ov.samples', { n: a.benchmark.samples.length })}</H3>
            <Samples>
              {a.benchmark.samples.slice(0, 12).map((s, i) => <li key={i}>{JSON.stringify(s.prompt)} → <b>{s.expect}</b></li>)}
              {a.benchmark.samples.length > 12 && <li>{t('detail.ov.more', { n: a.benchmark.samples.length - 12 })}</li>}
            </Samples>
          </>
        )}
        {a.recipe && (
          <Details>
            <summary title={t('detail.tech.recipe')}>{t('detail.dev_section')} · {t('detail.ov.recipe')}</summary>
            <Pre>{JSON.stringify(a.recipe, null, 2)}</Pre>
          </Details>
        )}
      </Section>
      <Section>
        <H3 title={t('detail.tech.integrity')}>{t('detail.ov.integrity')}</H3>
        <Note>{t('detail.ov.integrity_note')}</Note>
        <Hash>{t('detail.ov.content_hash')} {a.patch_sha256}<CopyButton text={a.patch_sha256} label={t('common.copy')} /></Hash>
        <KeyValue>
          <dt title={tech('ledger')}>{t('detail.ov.record')}</dt><dd><Mono>{d.record_hash || t('detail.ov.record_draft')}</Mono></dd>
          {a.entry_id && <><dt title={t('detail.tech.ain_entry')}>{t('detail.ov.ain_entry')}</dt><dd><Mono>{a.entry_id}</Mono></dd></>}
          {a.node_id && <><dt title={t('detail.tech.ain_node')}>{t('detail.ov.ain_node')}</dt><dd><Mono>{a.node_id}</Mono></dd></>}
          <dt title="has_body">{t('detail.ov.body_here')}</dt><dd>{d.has_body ? t('detail.yes') : t('detail.no')}</dd>
        </KeyValue>
      </Section>
      {d.branches.length > 0 && (
        <Section>
          <H3 title={`${help('branch')} (${tech('branch')})`}>{t('detail.ov.tracks')}</H3>
          <P>{d.branches.map((b) => `${b.name} (${Object.entries(b.context).map(([k, v]) => `${k}=${v}`).join(', ') || t('detail.ov.no_context')})`).join(' · ')}</P>
        </Section>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- 검증 결과 */
function sideEffectCell(at: Attestation, bound: number | undefined, t: (k: string, v?: Record<string, string | number>) => string): { text: string; ok: boolean | null; detail?: string } {
  if (!isExecuted(at.verified_on)) return { text: '—', ok: null };
  if (at.collateral_nat === undefined || at.collateral_nat === null) return { text: t('detail.ver.side_na'), ok: null };
  const over = bound !== undefined && at.collateral_nat > bound;
  // Primary text stays plain; the nat measurement lives in the tooltip only.
  return { text: t(over ? 'detail.ver.side_over' : 'detail.ver.side_ok'), ok: !over, detail: t('detail.ver.side_nat', { n: at.collateral_nat, bound: bound ?? '—' }) };
}

function Verification({ d }: { d: PatchDetail }) {
  const { t, term, help, tech } = useT();
  const f = useDetailFormat();
  const bound = d.anchor.benchmark.collateral_bound_nat;
  return (
    <Section style={{ padding: 0 }}>
      <SummaryRow>
        <div title={tech('verified')}><span className="k">{t('detail.ver.summary_executed')}</span><span className="v">{d.passed}/{d.quorum}</span></div>
        <div title="verified_on = hash-only"><span className="k">{t('detail.ver.summary_integrity')}</span><span className="v">{num(d.integrity_checks)}</span></div>
        <div><span className="k">{t('detail.ver.summary_status')}</span><span className="v"><StatusChip status={d.status} /></span></div>
      </SummaryRow>
      {d.attestations.length === 0 && <Empty style={{ border: 0 }}>{t('detail.ver.empty')}</Empty>}
      {d.attestations.length > 0 && (
        <TableWrapper>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead $align="left" $padding="0 0 0 32px">{t('detail.ver.h.verifier')}</TableHead>
                <TableHead $align="left">{t('detail.ver.h.method')}</TableHead>
                <TableHead>{t('detail.ver.h.accuracy')}</TableHead>
                <TableHead>{t('detail.ver.h.side')}</TableHead>
                <TableHead>{t('detail.ver.h.restarts')}</TableHead>
                <TableHead>{t('detail.ver.h.stake')}</TableHead>
                <TableHead>{t('detail.ver.h.result')}</TableHead>
                <TableHead $align="right" $padding="0 32px 0 8px">{t('detail.ver.h.time')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.attestations.map((at) => {
                const executed = isExecuted(at.verified_on);
                const side = sideEffectCell(at, bound, t);
                return (
                  <TableRow key={at.verifier + at.created_at}>
                    <TableData $align="left" $padding="0 0 0 32px" $weight={600} title={at.verifier}>{at.verifier_name ?? shortAddr(at.verifier)}<div style={{ fontSize: 11, color: '#8d8d8f', fontWeight: 400 }}>{shortAddr(at.verifier, 8)}</div></TableData>
                    <TableData $align="left" title={`verified_on: ${at.verified_on}`}>{f.howLabel(at.verified_on)}</TableData>
                    <TableData $mono title={executed ? JSON.stringify(at.score) : t('detail.how.integrity')}>{executed ? scoreText(at.score) : '—'}</TableData>
                    <TableData $color={side.ok === null ? undefined : side.ok ? '#44a45f' : '#e6173e'} title={side.detail ? `${side.detail} — ${help('sideEffects')} (${tech('sideEffects')})` : `${help('sideEffects')} (${tech('sideEffects')})`}>{side.text}</TableData>
                    <TableData title="restarts_detected">{at.restarts_detected === undefined ? '—' : at.restarts_detected === 0 ? t('detail.none') : t('detail.ver.restarts_n', { n: at.restarts_detected })}</TableData>
                    <TableData title={`${help('stake')} (${tech('stake')})${f.priceNote(d.anchor.currency) ? ` · ${f.priceNote(d.anchor.currency)}` : ''}`}>{f.priceLabel(at.stake, d.anchor.currency)}</TableData>
                    <TableData $color={at.passed ? '#44a45f' : '#e6173e'} $weight={600}>{at.passed ? t('detail.pass') : t('detail.fail')}</TableData>
                    <TableData $align="right" $padding="0 32px 0 8px" title={dateTime(at.created_at)}>{f.ago(at.created_at)}</TableData>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableWrapper>
      )}
      <div style={{ padding: '16px 32px 20px' }}>
        <Note title={tech('verified')}><b>{term('verified')}</b> — {t('detail.ver.explain_count', { passed: d.passed, quorum: d.quorum, integrity: d.integrity_checks })}</Note>
        <Note>{t('detail.ver.explain_restart')}</Note>
        <Note style={{ margin: 0 }} title={tech('stake')}>{t('detail.ver.explain_stake')}</Note>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- 원본과 파생 */
function Lineage({ d, authorSlug }: { d: PatchDetail; authorSlug: string }) {
  const { t, term, help, tech } = useT();
  const { data: info } = useInfoQuery();
  const share = (info as { royalty_share?: number } | undefined)?.royalty_share;
  const { parents, children } = d.lineage;
  const relation = (c: ConflictInfo) => {
    const cross = (c as ConflictInfo & { cross_branch?: boolean }).cross_branch === true;
    return cross ? t('detail.lin.rel_cross_branch') : c.same_schema ? t('detail.lin.rel_same') : t('detail.lin.rel_other');
  };
  return (
    <>
      <Section>
        <H3 title={tech('lineage')}>{t('detail.lin.title')}</H3>
        <Note><b>{term('lineage')}</b> — {t('detail.lin.note')}{typeof share === 'number' ? ` ${t('detail.lin.note_share', { pct: Math.round(share * 100) })}` : ''}</Note>
        <Tree>
          <TreeLevel><span className="lbl">{t('detail.lin.parents')}</span>{parents.length === 0 && <Quorum>{t('detail.lin.no_parents')}</Quorum>}{parents.map((p) => <TreeNode key={p.id} to={`/${authorSlug}/${encodeURIComponent(p.id)}`} title={p.status}>{p.name}<code>{p.id}</code></TreeNode>)}</TreeLevel>
          <TreeLevel><span className="lbl">↓</span></TreeLevel>
          <TreeLevel><span className="lbl">{t('detail.lin.this')}</span><TreeNode $me to="#" onClick={(e) => e.preventDefault()}>{d.anchor.name}<code>{d.anchor.id}</code></TreeNode></TreeLevel>
          <TreeLevel><span className="lbl">↓</span></TreeLevel>
          <TreeLevel><span className="lbl">{t('detail.lin.children')}</span>{children.length === 0 && <Quorum>{t('detail.lin.no_children')}</Quorum>}{children.map((c) => <TreeNode key={c.id} to={`/${authorSlug}/${encodeURIComponent(c.id)}`} title={c.status}>{c.name}<code>{c.id}</code></TreeNode>)}</TreeLevel>
        </Tree>
        {d.anchor.parent_authors.length > 0 && <KeyValue><dt>{t('detail.lin.royalty_to')}</dt><dd>{[...new Set(d.anchor.parent_authors)].map((x) => shortAddr(x, 8)).join(', ')}</dd></KeyValue>}
      </Section>
      <Section>
        <H3 title={`${help('conflict')} (${tech('conflict')})`}>{term('conflict')}</H3>
        <Note>{t('detail.lin.conflicts_note')}</Note>
        {d.conflicts.length === 0 && <P>{t('detail.lin.conflicts_none')}</P>}
        {d.conflicts.length > 0 && (
          <TableWrapper>
            <Table>
              <TableHeader><TableRow><TableHead $align="left" $padding="0 8px 0 0">{t('detail.lin.h.patch')}</TableHead><TableHead>{t('detail.lin.h.overlap')}</TableHead><TableHead $align="left">{t('detail.lin.h.relation')}</TableHead><TableHead>{t('detail.lin.h.status')}</TableHead></TableRow></TableHeader>
              <TableBody>
                {d.conflicts.map((c) => (
                  <TableRow key={c.patch_id}>
                    <TableData $align="left" $padding="0 8px 0 0" $weight={600}><StyledLink to={`/${authorSlug}/${encodeURIComponent(c.patch_id)}`}>{c.patch_id}</StyledLink></TableData>
                    <TableData title={tech('rows')}>{t('units.rows', { n: num(c.overlap_rows) })}</TableData>
                    <TableData $align="left">{relation(c)}</TableData>
                    <TableData><StatusChip status={c.status} /></TableData>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        )}
        {d.supersedes.length > 0 && <Alert $tone="info" style={{ marginTop: 12 }}>{t('detail.lin.supersedes')}{d.supersedes.map((s, i) => <span key={s}>{i > 0 && ', '}<StyledLink to={`/${authorSlug}/${encodeURIComponent(s)}`}>{s}</StyledLink></span>)}{t('detail.lin.supersedes_tail')}</Alert>}
        {d.superseded_by.length > 0 && <Alert $tone="warning" style={{ marginTop: 12 }} title={help('superseded')}>{t('detail.lin.superseded_by')}{d.superseded_by.map((s, i) => <span key={s}>{i > 0 && ', '}<StyledLink to={`/${authorSlug}/${encodeURIComponent(s)}`}>{s}</StyledLink></span>)}{t('detail.lin.superseded_tail')}</Alert>}
      </Section>
    </>
  );
}

/* ---------------------------------------------------------------- 구매 */
function Buy({ d, authorSlug, isOperator }: { d: PatchDetail; authorSlug: string; isOperator: boolean }) {
  const { t, term, help, tech } = useT();
  const f = useDetailFormat();
  const [buy, { data: result, isLoading, error, reset }] = useBuyMutation();
  const gw = d.gateway_url ?? `${window.location.origin}/x402/patch/${d.anchor.id}`;
  const a = d.anchor;
  const canBuy = d.quorum_ok && !d.owned;
  const priceText = f.priceLabel(a.price, a.currency);
  const note = f.priceNote(a.currency);
  return (
    <>
      <Section>
        <H3 title={`${help('autoPay')} (${tech('autoPay')})`}>{t('detail.buy.title')}</H3>
        <P>{t('detail.buy.explain')}</P>
        <KeyValue>
          <dt>{t('detail.buy.price')}</dt><dd>{priceText} · {f.billingLabel(a.billing)}{note && <div style={{ fontSize: 12, color: '#8d8d8f' }}>{note}</div>}</dd>
          <dt>{t('detail.buy.seller')}</dt><dd>{a.author_name ? <>{a.author_name} <Mono style={{ color: '#8d8d8f' }}>{shortAddr(a.author, 8)}</Mono></> : <Mono>{a.author}</Mono>}</dd>
          <dt title={t('detail.tech.gateway')}>{t('detail.buy.gateway')}</dt><dd><ExternalLink href={gw} target="_blank" rel="noopener noreferrer">{gw}</ExternalLink></dd>
        </KeyValue>
        <Alert $tone="info" style={{ marginTop: 16 }}>
          <b>{t('detail.buy.agent_title')}</b> — {t('detail.buy.agent_text')} <StyledLink to="/docs">{t('detail.buy.agent_link')}</StyledLink>
        </Alert>
        <Details>
          <summary title={tech('autoPay')}>{t('detail.buy.dev_summary')}</summary>
          <Note style={{ margin: '0 0 4px' }} title={tech('autoPay')}>{t('detail.buy.dev_note')}</Note>
          <Pre>{`${t('detail.buy.curl_1')}\ncurl -i ${gw}\n\n${t('detail.buy.curl_2')}\ncurl -i -H "X-PAYMENT: $(echo -n '{"scheme":"ain-transfer","network":"ain:local","txHash":"0x…"}' | base64 -w0)" ${gw}\n\n${t('detail.buy.curl_3')}\nainize patch buy ${a.id}\n\n${t('detail.buy.curl_4')}\nnode packages/agent/dist/bin.js run --market ${window.location.origin} --patch ${a.id}`}</Pre>
        </Details>
      </Section>
      <Section>
        <H3>{t('detail.buy.from_node')}</H3>
        {!isOperator && <P>{t('detail.buy.signin')}</P>}
        {isOperator && d.owned && <P>{t('detail.buy.owned')}<StyledLink to={`/project/${authorSlug}/${encodeURIComponent(a.id)}`}>{t('detail.buy.owned_manage')}</StyledLink></P>}
        {isOperator && !d.owned && d.purchased && <Alert $tone="success">{t('detail.buy.purchased', { applied: d.applied ? t('detail.buy.purchased_applied') : '', stored: d.has_body ? t('detail.buy.stored_yes') : t('detail.buy.stored_no') })}</Alert>}
        {isOperator && !d.owned && !d.quorum_ok && <Alert $tone="warning" title={tech('verified')}>{t('detail.buy.not_verified', { passed: d.passed, quorum: d.quorum })}</Alert>}
        {isOperator && canBuy && (
          <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="contained" loading={isLoading} loadingText={t('detail.buy.paying')} onClick={() => { reset(); void buy({ id: a.id }); }} title={help('autoPay')}>
              {d.purchased ? t('detail.buy.button_again') : t('detail.buy.button', { price: priceText })}
            </Button>
            <Quorum>{a.currency === 'AIN' ? t('detail.buy.pays_from_ain') : t('detail.buy.pays_from_credit')}{note && <> · {note}</>}</Quorum>
          </div>
        )}
        {error && <Alert $tone="error" style={{ marginTop: 12 }}>{errorMessage(error)}</Alert>}
        {result && <PurchaseTimeline r={result} currency={a.currency} />}
        <Note style={{ margin: '16px 0 0' }}>{term('apply')}: {help('apply')} {term('remove')}: {help('remove')}</Note>
      </Section>
    </>
  );
}

function PurchaseTimeline({ r, currency }: { r: PurchaseResult; currency: string }) {
  const { t } = useT();
  const f = useDetailFormat();
  const stepLabel = (s: string) => { const k = t(`detail.buy.step.${s}`); return k === `detail.buy.step.${s}` ? s : k; };
  return (
    <>
      <Alert $tone="success" style={{ marginTop: 16 }}>{t('detail.buy.done', { id: r.patch_id, amount: f.priceLabel(r.amount, currency), tx: shortHash(r.tx_hash, 18) })} <Mono style={{ fontSize: 11, opacity: 0.8 }}>({r.scheme})</Mono></Alert>
      <Timeline>
        {r.steps.map((s, i) => <li key={i}><span className="step" title={s.step}>{stepLabel(s.step)}</span>{s.detail}<span className="t">{new Date(s.at).toLocaleTimeString()}</span></li>)}
      </Timeline>
      <KeyValue>
        <dt>{t('detail.buy.body_path')}</dt><dd><Mono>{r.path}</Mono></dd>
        <dt>{t('detail.ov.content_hash')}</dt><dd><Mono>{r.manifest.patch_sha256}</Mono></dd>
        <dt>{t('detail.buy.blob_urls')}</dt><dd>{r.manifest.blob_urls.map((u) => <div key={u}><Mono>{u}</Mono></div>)}</dd>
      </KeyValue>
    </>
  );
}

/* ---------------------------------------------------------------- 기록 */
function HistoryTab({ id }: { id: string }) {
  const { t } = useT();
  const f = useDetailFormat();
  const { data, isLoading } = usePatchRecordsQuery(id, { pollingInterval: 10_000 });
  if (isLoading) return <CenterProgress />;
  const recs = [...(data?.records ?? [])].sort((a, b) => b.ts - a.ts);
  return (
    <Section style={{ padding: '8px 0 0' }}>
      {recs.length === 0 && <Empty style={{ border: 0 }}>{t('detail.hist.empty')}</Empty>}
      {recs.length > 0 && (
        <TableWrapper>
          <Table>
            <TableHeader><TableRow><TableHead $align="left" $padding="0 0 0 32px">{t('detail.hist.h.kind')}</TableHead><TableHead $align="left">{t('detail.hist.h.summary')}</TableHead><TableHead>{t('detail.hist.h.author')}</TableHead><TableHead>{t('detail.hist.h.time')}</TableHead><TableHead $align="right" $padding="0 32px 0 8px">{t('detail.hist.h.hash')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {recs.map((r) => {
                const s = f.recordSummary(r, { withHash: true });
                return (
                  <TableRow key={r.hash}>
                    <TableData $align="left" $padding="0 0 0 32px"><KindChip $kind={r.kind} title={r.kind}>{f.kindLabel(r.kind)}</KindChip></TableData>
                    <TableData $align="left" $maxWidth="420px" title={s}>{s}</TableData>
                    <TableData $mono title={r.author}>{shortAddr(r.author, 6)}</TableData>
                    <TableData title={dateTime(r.ts)}>{f.ago(r.ts)}</TableData>
                    <TableData $align="right" $padding="0 32px 0 8px" $mono title={r.sig || r.hash}>{shortHash(r.sig && r.sig.startsWith('0x') ? r.sig : r.hash, 14)}</TableData>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableWrapper>
      )}
    </Section>
  );
}

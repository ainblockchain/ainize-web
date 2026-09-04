import { useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import styled from 'styled-components';
import {
  errorMessage, useApplyMutation, useBenchmarkQuery, useBuyMutation, useCollectMutation, useInfoQuery, useMyCreditQuery, useMyPurchasesQuery,
  usePatchIssuesQuery, usePatchQuery, usePatchRecordsQuery, useTeachPolicyQuery,
} from '@/api/api';
import type { Attestation, CatalogEntry, ConflictInfo, PatchDetail, PurchaseResult } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Divider, Empty, ExternalLink, KeyValue, Mono, ScoreBar, StatusChip, StyledLink, Tabs } from '@/components/ui/Misc';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableWrapper } from '@/components/ui/Table';
import { useT } from '@/i18n';
import { sourceKind } from '@/components/teach/util';
import { useTitle } from '@/utils/useTitle';
import { bytes, dateTime, denominator, num, pct, preApplyText, scoreText, shortAddr, shortHash } from '@/utils/format';
import { FamilyTree } from '@/components/detail/FamilyTree';
import { OpenQuestions } from '@/components/detail/OpenQuestions';
import { SignalsStrip } from '@/components/detail/SignalsStrip';
import { TrainingSetBlock } from '@/components/detail/TrainingSetBlock';
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
const AddonBadge = styled.div`
  margin-top: 8px; display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 12px; font-weight: 600;
  background: #fff3e0; color: #8a4b00;
`;
const BuildOn = styled.button`
  font: inherit; font-size: 13px; font-weight: 700; padding: 8px 18px; border-radius: 4px; cursor: pointer; white-space: nowrap;
  border: 1px solid ${(p) => p.theme.color.PRIMARY}; background: #fff; color: ${(p) => p.theme.color.PRIMARY};
  &:hover:not(:disabled) { background: ${(p) => p.theme.color.PALE_GREY}; }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;
/**
 * Item 30 — the header used to carry Live test, Build on this and a view-all link, and nothing at all about
 * money: the price was the sixth of seven equal-weight numbers in the strip, with the seller's Revenue in the
 * same 24 px face beside it, and buying was the fourth tab. The filled purple slot now belongs to the price,
 * Live test keeps the outlined face it shares with Build on this, and the button says what leaves the wallet.
 */
const BuyNow = styled.button<{ $muted?: boolean }>`
  font: inherit; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  padding: 10px 26px; border-radius: 4px; cursor: pointer; white-space: nowrap; text-align: center;
  font-size: 15px; font-weight: 700; line-height: 1.3;
  border: 1px solid ${(p) => (p.$muted ? p.theme.color.LIGHT_GREY : p.theme.color.PRIMARY)};
  background: ${(p) => (p.$muted ? '#fff' : p.theme.color.PRIMARY)}; color: ${(p) => (p.$muted ? p.theme.color.DARK_GREY : '#fff')};
  small { font-size: 11px; font-weight: 400; opacity: ${(p) => (p.$muted ? 0.75 : 0.9)}; }
  &:hover { background: ${(p) => (p.$muted ? p.theme.color.PALE_GREY : p.theme.color.HOVER)}; }
`;
const LiveTestLink = styled(Link)`
  display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 9px 22px; border-radius: 4px; text-decoration: none;
  border: 1px solid ${(p) => p.theme.color.PRIMARY}; background: #fff; color: ${(p) => p.theme.color.PRIMARY};
  font-size: 14px; font-weight: 700; line-height: 1.3; white-space: nowrap;
  small { font-size: 11px; font-weight: 400; color: ${(p) => p.theme.color.GREY}; }
  &:hover { background: ${(p) => p.theme.color.PALE_GREY}; }
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
const StatValue = styled.div<{ $muted?: boolean }>`font-size: ${(p) => (p.$muted ? 16 : 20)}px; font-weight: 500; color: ${(p) => (p.$muted ? p.theme.color.GREY : p.theme.color.BLACK)}; font-variant-numeric: tabular-nums; white-space: nowrap;`;
const StatName = styled.div`margin-top: 4px; font-size: 12px; font-weight: 500; color: ${(p) => p.theme.color.GREY}; border-bottom: 1px dotted transparent; &[title] { border-bottom-color: ${(p) => p.theme.color.LIGHT_GREY}; cursor: help; }`;
const StatNote = styled.div`margin-top: 2px; font-size: 10px; color: ${(p) => p.theme.color.GREY}; text-align: center; max-width: 150px; line-height: 1.3;`;
const Section = styled.section`margin-top: 24px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; padding: 24px 32px;`;
const H3 = styled.h3`margin: 0 0 8px; font-size: 14px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; &[title] { cursor: help; }`;
const P = styled.p`margin: 0; font-size: 14px; line-height: 1.6; color: ${(p) => p.theme.color.DARK_GREY}; white-space: pre-wrap; word-break: keep-all;`;
const Note = styled.p`margin: 0 0 12px; font-size: 12px; line-height: 1.6; color: ${(p) => p.theme.color.GREY}; word-break: keep-all;`;
/** A promise the evidence does not (yet) back: warning tone, and a way straight to the evidence. */
const Warn = styled.span`
  color: #8a4b00;
  button { background: none; border: 0; padding: 0; font: inherit; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer; &:hover { text-decoration: underline; } }
`;
/**
 * The evidence under a failed verification (item 155): the questions the run got wrong, with the answer the model
 * actually gave. Monospaced because the whole point is to compare two strings character by character.
 */
const FailureBlock = styled.div`
  margin: 0 32px 16px; padding: 14px 16px; border: 1px solid #f0d8c0; border-radius: 8px; background: #fffaf4;
  font-size: 13px; color: ${(p) => p.theme.color.BLACK};
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; margin: 10px 0 0; }
  dt { font-size: 11px; color: ${(p) => p.theme.color.GREY}; }
  dd { margin: 0; font-family: ${(p) => p.theme.font.mono}; font-size: 12px; word-break: break-all; }
  dd.ok { color: #2f7d43; }
  dd.bad { color: #b4232f; }
  p { margin: 12px 0 0; font-size: 12px; line-height: 1.6; color: ${(p) => p.theme.color.GREY}; word-break: keep-all; }
`;
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
/**
 * Item 205: measured at 360 px the six tabs were a 586 px strip inside a 278 px box, so *Buy* and *History* sat off
 * the right edge with no fade, no chevron and nothing to say they existed — a phone visitor never saw that a
 * knowledge had origins, and Playwright could not click Buy at all. Below the phone breakpoint the strip wraps
 * instead of scrolling: every tab is on screen and hittable, and no swipe has to be discovered first.
 */
const TabBar = styled.div`
  margin-top: 32px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-bottom: 0; padding: 0 24px;
  @media (max-width: 599px) {
    padding: 0 12px;
    [role='tablist'] { flex-wrap: wrap; overflow-x: visible; gap: 0 14px; }
    [role='tab'] { padding: 10px 2px; font-size: 14px; }
  }
`;
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

/** The two versions set side by side inside the "newer version" warning — price, accuracy and verification of each. */
const Versions = styled.div`
  margin-top: 10px; display: grid; gap: 8px;
  > div { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
  span.lbl { font-size: 12px; font-weight: 700; min-width: 104px; }
  span.v { font-size: 13px; }
  code { font-family: ${(p) => p.theme.font.mono}; font-size: 11px; opacity: 0.85; word-break: break-all; }
`;

/** The two ways to buy that need no account here (item 3): a numbered path, its sentence, its one line to copy. */
const Ways = styled.ol`
  margin: 12px 0 0; padding: 0; list-style: none; display: grid; gap: 18px;
  li { display: grid; gap: 6px; }
  b { font-size: 13px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
  li > span { font-size: 13px; line-height: 1.6; color: ${(p) => p.theme.color.DARK_GREY}; word-break: keep-all; }
`;
const CmdRow = styled.div`
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px;
  code {
    flex: 1 1 260px; min-width: 0; padding: 10px 14px; border-radius: 4px; background: #303133; color: #f2f2f2;
    font-family: ${(p) => p.theme.font.mono}; font-size: 12px; line-height: 1.6; word-break: break-all;
  }
`;
/** The controls on a knowledge this node has already paid for (item 271). */
const Actions = styled.div`margin-top: 12px; display: flex; flex-wrap: wrap; gap: 12px 16px; align-items: center;`;
const TextBtn = styled.button`
  background: none; border: 0; padding: 0; font: inherit; font-size: 13px; color: ${(p) => p.theme.color.GREY}; cursor: pointer;
  text-decoration: underline; &:hover { color: ${(p) => p.theme.color.BLACK}; }
`;

type Score = { text: string; pct: number | null; tested: number | null; before: string | null };

/** Accuracy shown in the header comes only from attestations that ran the real model — never from integrity-only checks. */
function scoreOf(d: CatalogEntry): Score {
  const real = d.attestations.filter((a) => a.passed && isExecuted(a.verified_on));
  if (!real.length) return { text: '—', pct: null, tested: null, before: null };
  const s = real[real.length - 1].score;
  const raw = s.free_generation ?? s.free_generation_vllm ?? s.chat_60;
  // `before` is the same verifier's pre_apply run — the half of the measurement that says whether the model
  // already knew these answers. Without it "100%" is not evidence of anything.
  return { text: scoreText(s), pct: pct(raw), tested: denominator(raw), before: preApplyText(s) };
}

/** RTK Query reports either an HTTP status or a client-side marker ('FETCH_ERROR', 'TIMEOUT_ERROR', 'PARSING_ERROR'). */
function httpStatus(err: unknown): number | null {
  const s = (err as { status?: unknown } | undefined)?.status;
  return typeof s === 'number' ? s : null;
}

/**
 * Item 11: only a 404 from api/patches/:id means "this node does not know it". Every other failure — a 5xx, a
 * dropped connection, a node restarting under the 10 s poll — keeps the page and offers a retry, because the
 * knowledge behind the link may well be listed, verified and on sale.
 */
function LoadFailed({ id, error, busy, onRetry }: { id: string; error: unknown; busy: boolean; onRetry: () => void }) {
  const { t } = useT();
  const status = httpStatus(error);
  useTitle(id);
  return (
    <Wrapper>
      <Band>
        <BandContent>
          <HeadLeft>
            <PatchTitle>{id}</PatchTitle>
            <IdLine><span>{t('detail.patch.id')} <code>{id}</code></span></IdLine>
          </HeadLeft>
        </BandContent>
      </Band>
      <Divider />
      <Content>
        <ContentInner>
          <Section style={{ marginTop: 0 }} data-testid="patch-load-failed">
            <H3>{t('detail.patch.error_title')}</H3>
            <P>{status !== null ? t('detail.patch.error_http', { id, status }) : t('detail.patch.error_offline', { id })}</P>
            <Note style={{ margin: '8px 0 0' }}><Mono>{errorMessage(error)}</Mono></Note>
            <div style={{ marginTop: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button variant="contained" loading={busy} loadingText={t('detail.patch.error_retrying')} onClick={onRetry}>{t('detail.patch.error_retry')}</Button>
              <StyledLink to="/explore">{t('detail.patch.error_explore')} →</StyledLink>
            </div>
            <Note style={{ margin: '12px 0 0' }}>{t('detail.patch.error_auto')}</Note>
          </Section>
        </ContentInner>
      </Content>
    </Wrapper>
  );
}

export default function PatchPage() {
  const { author = '', patchId = '' } = useParams();
  const { isSignedIn } = useAuth();
  const { t, term, help, tech } = useT();
  const f = useDetailFormat();
  const { data, isLoading, error, isFetching, refetch } = usePatchQuery(patchId, { pollingInterval: 10_000 });
  // `teach.lineage` gates the CREATOR affordances only (§18): the tree, the strip and the open questions are read-only
  // and ship on every node, including the demo cluster where the flag is off.
  const { data: policy } = useTeachPolicyQuery();
  const { data: issues } = usePatchIssuesQuery({ id: patchId, limit: 1 });
  /**
   * Item 73: the open tab used to live in `useState`, so "look at the verification results" could not be sent to
   * anyone, a reload came back to Overview, and Back from the third tab ejected the reader to /explore instead of
   * stepping back through the page. It is a search param now — deep-linkable, reloadable, and every switch is a
   * history entry Back can walk. An unknown or absent `?tab=` reads as Overview.
   */
  const [sp, setSp] = useSearchParams();
  const tabsRef = useRef<HTMLDivElement>(null);
  const setTab = (id: string) => setSp((prev) => {
    const next = new URLSearchParams(prev);
    if (id === 'overview') next.delete('tab'); else next.set('tab', id);
    return next;
  });
  // before the early returns: the tab is named after the knowledge as soon as the node answers
  useTitle(data ? data.anchor.name || data.anchor.id : undefined);

  if (isLoading) return <Wrapper><CenterProgress /></Wrapper>;
  if (!data) {
    if (error && httpStatus(error) !== 404) return <LoadFailed id={patchId} error={error} busy={isFetching} onRetry={() => { void refetch(); }} />;
    return <NotFoundPage message={t('detail.patch.not_found', { id: patchId })} />;
  }

  const a = data.anchor;
  const authorLabel = a.author_name ?? shortAddr(a.author);
  const authorSlug = decodeURIComponent(author) === a.author ? author : encodeURIComponent(a.author);
  const score = scoreOf(data);
  const when = data.status === 'LISTED' ? t('detail.patch.listed_when', { ago: f.ago(data.listed_at ?? a.created_at) }) : t('detail.patch.registered_when', { ago: f.ago(a.created_at) });
  const provider = a.contributors?.find((c) => c.role === 'data_provider');
  const taught = a.origin === 'teach' || !!provider;
  const providerName = provider?.name ?? t('detail.taught_by_anon');
  const canBuildOn = policy?.lineage === true && policy?.enabled !== false;
  // Two different refusals, and a knowledge published before training sets were kept must not be described as one
  // whose creator chose privacy: `private` is a decision somebody made, `none` is a record from before the choice
  // existed (§14). Both stop *Build on this* today — the doors start from the base's questions.
  const datasetPrivate = !!a.dataset && a.dataset.access === 'private';
  const datasetNone = !a.dataset;
  const noBase = datasetPrivate || datasetNone;
  const base = a.base?.stack?.[0];
  const baseName = data.requires?.find((r) => r.id === base?.patch_id)?.name ?? base?.patch_id ?? '';
  const tabs = [
    { id: 'overview', label: t('detail.tab.overview') },
    { id: 'verification', label: t('detail.tab.verification') },
    { id: 'tree', label: t('detail.tab.tree') },
    { id: 'lineage', label: t('detail.tab.lineage') },
    { id: 'buy', label: t('detail.tab.buy') },
    { id: 'history', label: t('detail.tab.history') },
  ];
  const wanted = sp.get('tab');
  const tab = tabs.some((x) => x.id === wanted) ? wanted! : 'overview';

  return (
    <Wrapper>
      <Band>
        <BandContent>
          <HeadLeft>
            <PatchTitle>{a.name}</PatchTitle>
            <IdLine><span>{t('detail.patch.id')} <code>{a.id}</code></span><span>{t('common.author')}: <b title={a.author}>{authorLabel}</b></span></IdLine>
            <Branch title={`${tech('branch')} · topic_path`}>{t('detail.patch.track_topic', { branch: a.branch ?? (data.branches[0]?.name ?? 'main'), topic: a.topic_path })}</Branch>
            {/* SC-9: an add-on is not usable alone, and the header is the first place a buyer can be told so. */}
            {base && <AddonBadge data-testid="addon-badge">{t('detail.addon_badge', { name: baseName })}</AddonBadge>}
            <SignalsStrip id={a.id} />
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
            {/* Item 30: the commercial intent of the page, above the fold — price on the control that spends it.
                `owned` is "this node published it", which is true of every knowledge a visitor browses on its
                author's own node: the operator gets Manage instead, everyone else gets the price. */}
            {!(isSignedIn && data.owned) && (
              <BuyNow
                type="button" data-testid="head-buy" $muted={!data.sellable && !data.purchased}
                onClick={() => { setTab('buy'); requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }}
              >
                {data.purchased ? t('detail.head.buy_have')
                  : !data.sellable ? t('detail.head.buy_off')
                  : Number(a.price) > 0 ? t('detail.head.buy', { price: f.priceLabel(a.price, a.currency) })
                  : t('detail.head.buy_free')}
                {data.sellable && !data.purchased && <small>{f.billingLabel(a.billing)}</small>}
              </BuyNow>
            )}
            <LiveTestLink to={`/chat/${encodeURIComponent(a.id)}`} title={`${help('liveTest')} (${tech('liveTest')})`}>
              {term('liveTest')}<small>{t('detail.patch.live_test_sub')}</small>
            </LiveTestLink>
            {/* SC-9 *Build on this* — the flag holds it back, and a private training set says why nobody can. */}
            <BuildOn type="button" data-testid="build-on" disabled={!canBuildOn || noBase}
              title={datasetPrivate ? t('detail.build_on_private') : datasetNone ? t('detail.build_on_none') : undefined}
              onClick={() => { window.location.href = `/teach/settings?on=${encodeURIComponent(a.id)}`; }}>{t('detail.build_on')}</BuildOn>
            <ViewAll to={`/benchmarks/${encodeURIComponent(a.benchmark.schema)}`}>{t('detail.patch.view_same_subject')}</ViewAll>
          </HeadRight>
        </BandContent>
      </Band>
      <Divider />
      <Content>
        <ContentInner>
          <NameRow>
            <StatusChip status={data.status} supersededBy={data.superseded_by[0]} />
            <Quorum title={`${t('detail.patch.quorum_help', { quorum: data.quorum })} (${tech('verified')})`}>
              {/* Item 146: the numerator is clamped to the quorum — `3/2` is not a fraction a reader can use —
                  and the extra independent attestations are stated instead of being folded into the ratio. */}
              {t('detail.patch.verified_executed', { passed: Math.min(data.passed, data.quorum), quorum: data.quorum })}{data.sellable ? ` · ${term('verified')}` : ''}
              {data.passed > data.quorum && <> · {t('detail.patch.extra_n', { n: data.passed - data.quorum })}</>}
              {data.integrity_checks > 0 && <> · {t('detail.patch.integrity_n', { n: data.integrity_checks })}</>}
              {data.self_checks > 0 && <> · {t('detail.patch.self_n', { n: data.self_checks })}</>}
            </Quorum>
            {isSignedIn && data.owned && <ManageMenu to={`/project/${authorSlug}/${encodeURIComponent(a.id)}`}>{t('detail.patch.manage')} <img src="/static/images/ic-openwindow.svg" alt="" /></ManageMenu>}
          </NameRow>
          {data.open_challenge && (
            <Alert $tone="warning" style={{ marginTop: 12 }} data-testid="challenge-banner">
              {t('detail.challenge.banner', { who: shortAddr(data.open_challenge.challenger, 8), reason: data.open_challenge.reason, when: f.ago(data.open_challenge.created_at) })}
              {' '}{t('detail.challenge.what_next')}
            </Alert>
          )}
          {error && (
            <Alert $tone="warning" style={{ marginTop: 12 }} data-testid="patch-stale">
              {t('detail.patch.stale', { message: errorMessage(error) })}{' '}
              <Button size="small" variant="text" loading={isFetching} loadingText={t('detail.patch.error_retrying')} onClick={() => { void refetch(); }}>{t('detail.patch.error_retry')}</Button>
            </Alert>
          )}
          <Info>
            {t('detail.patch.meta', { author: authorLabel, model: a.model.id_M, when })}
            {data.superseded_by.length > 0 && <> ∙ <StyledLink to={`/${authorSlug}/${encodeURIComponent(data.superseded_by[0])}`} title={help('superseded')}>{t('detail.patch.newer_version', { id: data.superseded_by[0] })}</StyledLink></>}
          </Info>

          <Stats>
            <Stat><StatValue>{num(data.downloads)}</StatValue><StatName>{t('detail.stat.downloads')}</StatName></Stat>
            {/* Finding 28: the pair is the evidence — "1/8 → 26/26" says the model did NOT already know the answers.
                The percentage moves to the note; with no pre_apply reported the value stays the plain score. */}
            <Stat data-testid="stat-accuracy">
              <StatValue title={score.before ? t('detail.stat.before_after_help', { before: score.before, after: score.text }) : undefined}>
                {score.before && score.pct !== null ? `${score.before} → ${score.text}` : score.pct !== null ? `${score.pct}%` : score.text === '—' ? t('detail.stat.not_yet') : score.text}
              </StatValue>
              <StatName title={`${t('detail.stat.accuracy_help')} (${tech('accuracy')})`}>{term('accuracy')}</StatName>
              {score.pct !== null && <StatNote>{score.before ? t('detail.stat.before_after_note', { pct: score.pct }) : score.text}</StatNote>}
            </Stat>
            <Stat><StatValue>{num(a.rows)}</StatValue><StatName title={`${help('rows')} (${tech('rows')})`}>{t('detail.stat.entries')}</StatName></Stat>
            <Stat><StatValue>{num(a.benchmark.queries)}</StatValue><StatName title={`${help('facts')} (${tech('facts')})`}>{t('detail.stat.facts')}</StatName></Stat>
            <Stat><StatValue>{bytes(a.size_bytes)}</StatValue><StatName>{t('detail.stat.size')}</StatName></Stat>
            <Stat><StatValue>{f.priceLabel(a.price, a.currency)}</StatValue><StatName>{t('detail.stat.price')}</StatName>{Number(a.price) > 0 && <StatNote>{f.priceNote(a.currency)}</StatNote>}</Stat>
            {/* Item 30: two large AIN numbers side by side invited reading the seller's takings as the price. The
                figure stays public — it is the settlement record — in the face of the seller metric it is, and the
                purchases it came from are summarised on the History tab beside the records themselves. */}
            <Stat><StatValue $muted>{f.revenueLabel(data.revenue, a.currency)}</StatValue><StatName>{t('detail.stat.revenue')}</StatName><StatNote>{t('detail.stat.revenue_note')}</StatNote></Stat>
          </Stats>

          <TabBar ref={tabsRef}><Tabs tabs={tabs} value={tab} onChange={setTab} /></TabBar>

          {tab === 'overview' && <Overview d={data} score={score} onSeeVerification={() => setTab('verification')} />}
          {tab === 'verification' && <Verification d={data} />}
          {tab === 'tree' && (
            <>
              <Section>
                <H3>{t('detail.tab.tree')}</H3>
                <FamilyTree id={a.id} authorSlug={authorSlug} canBuildOn={canBuildOn} datasetPrivate={datasetPrivate} datasetNone={datasetNone} />
              </Section>
              {a.dataset && (
                <Section>
                  <H3>{t('detail.ds.title')}</H3>
                  <TrainingSetBlock d={data} canBuildOn={canBuildOn} />
                </Section>
              )}
              <Section>
                <H3>{t('detail.missing.title', { n: issues?.total ?? 0 })}</H3>
                <OpenQuestions id={a.id} totalQuestions={a.benchmark.queries} canBuildOn={canBuildOn} />
              </Section>
            </>
          )}
          {tab === 'lineage' && <Lineage d={data} authorSlug={authorSlug} />}
          {tab === 'buy' && <Buy d={data} authorSlug={authorSlug} isOperator={isSignedIn} />}
          {tab === 'history' && <HistoryTab d={data} />}
        </ContentInner>
      </Content>
    </Wrapper>
  );
}

/* ---------------------------------------------------------------- 개요 */
function Overview({ d, score, onSeeVerification }: { d: PatchDetail; score: Score; onSeeVerification: () => void }) {
  const { t, term, help, tech } = useT();
  const f = useDetailFormat();
  const a = d.anchor;
  // How many verifiers actually ran the model, and how many of those reported a side-effect measurement.
  const executedAtts = d.attestations.filter((at) => isExecuted(at.verified_on));
  const executedCount = executedAtts.length;
  const sideMeasured = executedAtts.filter((at) => at.collateral_nat !== undefined && at.collateral_nat !== null).length;
  return (
    <>
      <Section>
        <H3>{t('detail.ov.description')}</H3>
        <P>{a.description || t('detail.ov.no_description')}</P>
        {/* The denominator under the bar is the attestation's own ("26 of 2,761 checked"), never the anchor's
            benchmark.queries alone — "over 2,761 benchmark questions" claimed an audit 100× the size of the real one. */}
        {score.pct !== null && (
          <div style={{ marginTop: 16, maxWidth: 360 }}>
            <ScoreBar pct={score.pct} />
            <Quorum>{score.tested !== null && score.tested < a.benchmark.queries
              ? t('detail.ov.accuracy_line', { score: `${score.pct}%`, tested: num(score.tested), facts: num(a.benchmark.queries) })
              : t('detail.ov.accuracy_line_all', { score: `${score.pct}%`, facts: num(a.benchmark.queries) })}</Quorum>
            {/* the baseline the same verifier measured before loading the knowledge — the other half of the claim */}
            {score.before && <Quorum as="div" data-testid="ov-before-after" style={{ display: 'block', marginTop: 2 }}>{t('detail.ov.before_after', { before: score.before, after: score.text })}</Quorum>}
          </div>
        )}
      </Section>
      {/* Taught knowledge carries hash-only provenance (design §D12): enough for a buyer to verify a re-train used the
          same input, never enough to read the teacher's questions — which is exactly what the note says. */}
      {a.dataset && (
        <Section data-testid="dataset-provenance">
          <H3>{t('detail.ov.dataset')}</H3>
          <Note>{t('detail.ov.dataset_note')}</Note>
          <KeyValue style={{ marginTop: 0 }}>
            <dt>{t('detail.ov.dataset_fingerprint')}</dt>
            <dd><Mono data-testid="dataset-sha">{a.dataset.sha256.slice(0, 12)}</Mono><CopyButton text={a.dataset.sha256} label={t('common.copy')} /></dd>
            <dt>{t('detail.ov.dataset_rows')}</dt><dd>{t('teach.data.count', { n: a.dataset.rows })}</dd>
            <dt>{t('teach.data.h.source')}</dt><dd data-testid="dataset-source">{sourceKind(a.dataset.source, t)}</dd>
          </KeyValue>
        </Section>
      )}
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
          {/* Finding 55: "Threshold set" read as "checked", while the Verification tab said "not reported" for every
              verifier. The row now says which of the two it is, and links to the evidence. */}
          <dt title={`${help('sideEffects')} (${tech('sideEffects')})`}>{t('detail.ov.side_effect_bound')}</dt>
          <dd data-testid="ov-side-effect">{a.benchmark.collateral_bound_nat === undefined ? '—' : sideMeasured > 0 ? (
            <span title={t('detail.ov.side_effect_tech', { n: a.benchmark.collateral_bound_nat })}>{t('detail.ov.side_effect_measured', { n: sideMeasured, of: executedCount })}</span>
          ) : (
            <Warn title={t('detail.ov.side_effect_tech', { n: a.benchmark.collateral_bound_nat })}>
              {t('detail.ov.side_effect_unmeasured', { n: a.benchmark.collateral_bound_nat })}{' '}
              <button type="button" onClick={onSeeVerification}>{t('detail.ov.side_effect_see')} →</button>
            </Warn>
          )}</dd>
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
  // `self_checks` is the number of the author's own attestations this node EXCLUDED (0 when a dev node counts them).
  const self = (at: Attestation) => d.self_checks > 0 && at.verifier.toLowerCase() === d.anchor.author.toLowerCase();
  // How many DISTINCT model servers produced the counted attestations (item 329). Attestations written before the
  // fingerprint existed count as one unknown machine each — that can understate independence, never overstate it.
  const machines = (d.executors?.length ?? 0) + (d.executors_unknown ?? 0);
  const sharedEngine = (d.executors?.length ?? 0) > 0 && machines < d.passed;
  const failing = d.attestations.filter((at) => !at.passed && at.failures?.length);
  return (
    <Section style={{ padding: 0 }}>
      <SummaryRow>
        <div title={tech('verified')}><span className="k">{t('detail.ver.summary_executed')}</span><span className="v">{Math.min(d.passed, d.quorum)}/{d.quorum}</span></div>
        {/* Item 329: "2/2 independent" was two signatures; two verifier processes on ONE vLLM look identical to two
            machines unless the record says how many engines were behind them. */}
        {machines > 0 && <div title="Attestation.executor.instance"><span className="k">{t('detail.ver.summary_executors')}</span><span className="v" data-testid="ver-executors" style={sharedEngine ? { color: '#8a4b00' } : undefined}>{machines}</span></div>}
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
                {/* Finding 28: every attestation carries pre_apply and it reached the DOM only inside a title=. */}
                <TableHead title={t('detail.ver.h.before_help')}>{t('detail.ver.h.before')}</TableHead>
                <TableHead>{t('detail.ver.h.accuracy')}</TableHead>
                <TableHead>{t('detail.ver.h.side')}</TableHead>
                <TableHead>{t('detail.ver.h.restarts')}</TableHead>
                <TableHead title={tech('signedResult')}>{t('detail.ver.h.counts')}</TableHead>
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
                    <TableData $mono data-testid="ver-before" title={executed ? t('detail.ver.h.before_help') : t('detail.how.integrity')}>{executed ? preApplyText(at.score) ?? t('detail.ver.side_na') : '—'}</TableData>
                    <TableData $mono data-testid="ver-after" title={executed ? JSON.stringify(at.score) : t('detail.how.integrity')}>{executed ? scoreText(at.score) : '—'}</TableData>
                    <TableData $color={side.ok === null ? undefined : side.ok ? '#44a45f' : '#e6173e'} title={side.detail ? `${side.detail} — ${help('sideEffects')} (${tech('sideEffects')})` : `${help('sideEffects')} (${tech('sideEffects')})`}>{side.text}</TableData>
                    <TableData title="restarts_detected">{at.restarts_detected === undefined ? '—' : at.restarts_detected === 0 ? t('detail.none') : t('detail.ver.restarts_n', { n: at.restarts_detected })}</TableData>
                    {/* Item 146: an attestation by the author is shown but marked as not counting; item 127: no deposit column, because no deposit exists. */}
                    <TableData $color={self(at) ? '#8a4b00' : undefined} title={`${help('signedResult')} (${tech('signedResult')})`}>{self(at) ? t('detail.ver.counts_self') : t('detail.ver.counts_yes')}</TableData>
                    <TableData $color={at.passed ? '#44a45f' : '#e6173e'} $weight={600}>{at.passed ? t('detail.pass') : t('detail.fail')}</TableData>
                    <TableData $align="right" $padding="0 32px 0 8px" title={dateTime(at.created_at)}>{f.ago(at.created_at)}</TableData>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableWrapper>
      )}
      {/* Item 155: the single most important moment in a publisher's life — "my knowledge was rejected" — used to be a
          fraction and nothing else. The verifier signs up to five of the questions it got wrong with the model's own
          answer; this is where the author reads them. */}
      {failing.map((at) => (
        <FailureBlock key={`f-${at.verifier}-${at.created_at}`} data-testid="ver-failures">
          <b>{at.verifier_name ?? shortAddr(at.verifier, 8)}</b> — {t('detail.ver.failures', { n: at.failures!.length })}
          {at.failures!.map((f, i) => (
            <dl key={i}>
              <dt>{t('detail.ver.f_asked')}</dt><dd>{f.prompt}</dd>
              <dt>{t('detail.ver.f_expected')}</dt><dd className="ok">{f.expect}</dd>
              <dt>{t('detail.ver.f_answered')}</dt><dd className="bad">{f.got || t('detail.ver.f_empty')}</dd>
            </dl>
          ))}
          {d.status === 'REJECTED' && <p>{t('detail.ver.rejected_what', { n: d.quorum })}</p>}
        </FailureBlock>
      ))}
      <div style={{ padding: '16px 32px 20px' }}>
        <Note title={tech('verified')}><b>{term('verified')}</b> — {t('detail.ver.explain_count', { passed: d.passed, quorum: d.quorum, integrity: d.integrity_checks })}</Note>
        {machines > 0 && d.passed > 1 && <Note style={sharedEngine ? { color: '#8a4b00' } : undefined}>{t('detail.ver.executors_shared', { passed: d.passed, n: machines })}</Note>}
        {!!d.executors_unknown && <Note>{t('detail.ver.executors_unknown', { n: d.executors_unknown })}</Note>}
        {!!d.no_baseline && <Note>{t('detail.ver.no_baseline', { n: d.no_baseline })}</Note>}
        <Note>{t('detail.ver.explain_before')}</Note>
        <Note>{t('detail.ver.explain_restart')}</Note>
        {d.self_checks > 0 && <Note>{t('detail.ver.explain_self', { n: d.self_checks })}</Note>}
        <Note style={{ margin: 0 }} title={tech('signedResult')}>{t('detail.ver.explain_backing')}</Note>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- 원본과 파생 */
function Lineage({ d, authorSlug }: { d: PatchDetail; authorSlug: string }) {
  const { t, term, help, tech } = useT();
  const { data: info } = useInfoQuery();
  // Item 191: this line used to print the VIEWING node's config as if it were the promise on this knowledge. The
  // promise lives on the anchor (`royalty_share`), is floored at the network minimum, and cannot be lowered later.
  const anchorShare = (d.anchor as { royalty_share?: number }).royalty_share;
  const share = anchorShare ?? (info as { royalty_share?: number } | undefined)?.royalty_share;
  const verifierShare = (d.anchor as { verifier_share?: number }).verifier_share;
  const { parents, children } = d.lineage;
  const relation = (c: ConflictInfo) => {
    const cross = (c as ConflictInfo & { cross_branch?: boolean }).cross_branch === true;
    return cross ? t('detail.lin.rel_cross_branch') : c.same_schema ? t('detail.lin.rel_same') : t('detail.lin.rel_other');
  };
  return (
    <>
      <Section>
        <H3 title={tech('lineage')}>{t('detail.lin.title')}</H3>
        <Note><b>{term('lineage')}</b> — {t('detail.lin.note')}{typeof share === 'number' ? ` ${t(anchorShare === undefined ? 'detail.lin.note_share_network' : 'detail.lin.note_share', { pct: Math.round(share * 100) })}` : ''}</Note>
        {typeof verifierShare === 'number' && <Note data-testid="lin-verifier-share">{t('detail.lin.note_verifier', { pct: Math.round(verifierShare * 100) })}</Note>}
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

/**
 * Item 3: a signed-out visitor used to get one sentence — "sign in as this node's operator" — under an explainer
 * that promises no sign-up, with the only real paths (a raw gateway URL, a curl snippet) folded away behind a
 * developer disclosure. Both doors that need no account here are now open on the page, and the sign-in is last
 * because it is the only one that needs one.
 *
 * The command is byte-identical to lifecycle step 3 (components/public/lifecycleSteps.ts), which the landing page
 * and README are tested against — `ainize use` checks the verification, pays, downloads and loads in one line.
 */
function VisitorBuy({ id, gw, priceText }: { id: string; gw: string; priceText: string }) {
  const { t } = useT();
  const cmd = `ainize login && ainize use ${id}`;
  return (
    <>
      <P>{t('detail.buy.visitor_lead')}</P>
      <Ways data-testid="buy-visitor">
        <li>
          <b>{t('detail.buy.way_cli')}</b>
          <span>{t('detail.buy.way_cli_note', { price: priceText })}</span>
          <CmdRow><code>{cmd}</code><CopyButton text={cmd} label={t('common.copy')} /></CmdRow>
          <StyledLink to="/docs/get-started/install">{t('detail.buy.way_cli_link')} →</StyledLink>
        </li>
        <li>
          <b>{t('detail.buy.way_gw')}</b>
          <span>{t('detail.buy.way_gw_note')}</span>
          <CmdRow><code>{gw}</code><CopyButton text={gw} label={t('common.copy')} /></CmdRow>
        </li>
      </Ways>
      <Note style={{ margin: '18px 0 0' }}>{t('detail.buy.visitor_operator')}<StyledLink to="/signing">{t('detail.buy.visitor_signin')}</StyledLink></Note>
    </>
  );
}

/**
 * Item 271: "Buy again" was the only control on a body this node had already paid for, and `market.buy` re-runs the
 * whole 402 loop with no check for an existing settlement (market.ts:814) while `store.putPurchase` overwrites the
 * first row's tx hash (store.ts:283 `ON CONFLICT(patch_id) DO UPDATE`). So the licence now leads with what it is
 * for — loading the knowledge into the model — and a second payment is a separate, confirmed act that says what it
 * costs and what it overwrites. A free re-download would need a node-side route; nothing here promises one.
 */
function PaidFor({ d, priceText, runtimeReady, onBuyAgain, buying }: {
  d: PatchDetail; priceText: string; runtimeReady: boolean; onBuyAgain: () => void; buying: boolean;
}) {
  const { t } = useT();
  const f = useDetailFormat();
  const [again, setAgain] = useState(false);
  const [apply, applyState] = useApplyMutation();
  const [collect, collectState] = useCollectMutation();
  const { data: purchases } = useMyPurchasesQuery();
  const row = purchases?.items.find((x) => x.patch_id === d.anchor.id);
  return (
    <div data-testid="buy-paid">
      <Alert $tone="success">{t('detail.buy.purchased', { applied: d.applied ? t('detail.buy.purchased_applied') : '', stored: d.has_body ? t('detail.buy.stored_yes') : t('detail.buy.stored_no') })}</Alert>
      {row && (
        <Note style={{ margin: '8px 0 0' }} title={dateTime(row.created_at)}>
          {t('detail.buy.paid_when', { amount: f.priceLabel(row.amount, d.anchor.currency), when: f.ago(row.created_at), tx: shortHash(row.tx_hash, 16) })}
        </Note>
      )}
      {/* Item 273: the body is gone but the payment is not. The seller re-issues the manifest against the
          settlement it already recorded, so getting it back is free — it used to say the opposite. */}
      {!d.has_body && (
        <Alert $tone="warning" style={{ marginTop: 12 }} data-testid="buy-paid-gone">
          {t('detail.buy.paid_gone')}
          <Actions>
            <Button
              variant="contained" loading={collectState.isLoading} loadingText={t('detail.buy.collecting')}
              onClick={() => { void collect(d.anchor.id); }} data-testid="buy-collect"
            >{t('detail.buy.collect')}</Button>
          </Actions>
        </Alert>
      )}
      {collectState.error && <Alert $tone="error" style={{ marginTop: 12 }}>{errorMessage(collectState.error)}</Alert>}
      {collectState.data && <Alert $tone="success" style={{ marginTop: 12 }} data-testid="buy-collected">{t('detail.buy.collected', { amount: f.priceLabel(collectState.data.amount, d.anchor.currency), tx: shortHash(collectState.data.tx_hash, 16) })}</Alert>}
      <Actions>
        {d.has_body && !d.applied && (
          <Button
            variant="contained" disabled={!runtimeReady} loading={applyState.isLoading} loadingText={t('detail.buy.paid_loading')}
            onClick={() => { void apply(d.anchor.id); }} data-testid="buy-paid-load"
          >{t('detail.buy.paid_load')}</Button>
        )}
        {d.applied && <Quorum>{t('detail.buy.paid_loaded')}</Quorum>}
        {d.has_body && !d.applied && !runtimeReady && <Quorum>{t('detail.buy.paid_no_runtime')}</Quorum>}
        <StyledLink to="/dashboard">{t('detail.buy.paid_manage')} →</StyledLink>
      </Actions>
      {applyState.error && <Alert $tone="error" style={{ marginTop: 12 }}>{errorMessage(applyState.error)}</Alert>}
      {!again
        ? <Actions><TextBtn type="button" onClick={() => setAgain(true)} data-testid="buy-again-open">{t('detail.buy.again_open')}</TextBtn></Actions>
        : (
          <Alert $tone="warning" style={{ marginTop: 12 }} data-testid="buy-again-confirm">
            <b>{t('detail.buy.again_title')}</b> {t('detail.buy.again_body', { id: d.anchor.id, price: priceText })}
            <Actions>
              <Button color="secondary" loading={buying} loadingText={t('detail.buy.paying')} onClick={onBuyAgain} data-testid="buy-again-pay">{t('detail.buy.again_confirm', { price: priceText })}</Button>
              <TextBtn type="button" onClick={() => setAgain(false)}>{t('common.cancel')}</TextBtn>
            </Actions>
          </Alert>
        )}
    </div>
  );
}

/* ---------------------------------------------------------------- 구매 */
function Buy({ d, authorSlug, isOperator }: { d: PatchDetail; authorSlug: string; isOperator: boolean }) {
  const { t, term, help, tech } = useT();
  const f = useDetailFormat();
  const [buy, { data: result, isLoading, error, reset }] = useBuyMutation();
  /**
   * Item 275: `gateway_url` is frozen into the anchor and stops resolving the moment the seller changes its port,
   * so what a visitor is told to call is the address the node says answers TODAY; the record's is shown only when
   * it differs, as the stale hint it is.
   */
  const gw = d.gateway?.url ?? d.gateway_url ?? `${window.location.origin}/x402/patch/${d.anchor.id}`;
  const gwStale = !!d.gateway_url && d.gateway?.url !== undefined && d.gateway.url !== d.gateway_url;
  const a = d.anchor;
  /**
   * Item 4: a retired version used to sell exactly like the current one — the only warning sat in the Origins tab,
   * which is not open while someone is buying. The successor's price and accuracy come from the same-subject list
   * this page already links to, so naming it costs one request and no node change.
   */
  const successorIds = [...new Set(d.superseded_by)].filter((id) => id !== a.id);
  const family = useBenchmarkQuery(a.benchmark.schema, { skip: successorIds.length === 0 });
  const successors = successorIds
    .map((id) => family.data?.items.find((e: CatalogEntry) => e.anchor.id === id))
    .filter((e): e is CatalogEntry => !!e)
    // the version to send a buyer to is the newest one that has not itself been replaced
    .sort((x, y) => (x.superseded_by.length ? 1 : 0) - (y.superseded_by.length ? 1 : 0) || y.anchor.created_at - x.anchor.created_at);
  const head = successors[0];
  const unresolved = successorIds.filter((id) => !successors.some((e) => e.anchor.id === id));
  const superseded = successorIds.length > 0;
  // Item 153: `sellable` is quorum met AND no open challenge — a disputed knowledge is off sale, not discounted.
  // Item 271: a knowledge this node has already paid for is not offered for sale again here — PaidFor holds it.
  const canBuy = d.sellable && !d.owned && !d.purchased;
  const { data: info } = useInfoQuery();
  const runtimeReady = info?.runtime.available === true;
  const priceText = f.priceLabel(a.price, a.currency);
  const note = f.priceNote(a.currency);
  const mine = scoreOf(d);
  /**
   * Item 270: buying a child bought the child alone, and this page said nothing about whether its base was needed,
   * already inside it, or a second unbudgeted purchase from another node. The node answers all three now.
   */
  const quote = d.quote;
  const needs = quote?.requires ?? [];
  const missing = needs.filter((r) => !r.licensed && !r.mine);
  const totalText = quote ? f.priceLabel(quote.total, quote.currency) : priceText;
  // Item 364: on a local-credit node the money is issued BY this node — say so where it is about to be spent.
  const { data: credit } = useMyCreditQuery(undefined, { skip: !isOperator || a.currency !== 'CREDIT' });
  return (
    <>
      {superseded && (
        <Alert $tone="warning" style={{ marginTop: 24 }} data-testid="buy-superseded" title={help('superseded')}>
          <b>{t('detail.buy.old_title')}</b> {t('detail.buy.old_note')}
          {head && (
            <Versions>
              <div>
                <span className="lbl">{t('detail.buy.old_this')}</span>
                <span className="v">{priceText} · {mine.pct !== null ? t('detail.buy.old_accuracy', { score: mine.text }) : t('detail.buy.old_unverified')}</span>
                <code>{a.id}</code>
              </div>
              <div>
                <span className="lbl">{t('detail.buy.old_newer')}</span>
                <span className="v">
                  {f.priceLabel(head.anchor.price, head.anchor.currency)} · {scoreOf(head).pct !== null ? t('detail.buy.old_accuracy', { score: scoreOf(head).text }) : t('detail.buy.old_unverified')}
                  {!head.sellable && ` · ${t('detail.buy.old_notsale')}`}
                </span>
                <StyledLink to={`/${authorSlug}/${encodeURIComponent(head.anchor.id)}`}>{head.anchor.name || head.anchor.id} →</StyledLink>
                <code>{head.anchor.id}</code>
              </div>
            </Versions>
          )}
          {successors.length > 1 && (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              {t('detail.buy.old_more')}
              {successors.slice(1).map((e, i) => <span key={e.anchor.id}>{i > 0 && ', '}<StyledLink to={`/${authorSlug}/${encodeURIComponent(e.anchor.id)}`}>{e.anchor.name || e.anchor.id}</StyledLink></span>)}
            </div>
          )}
          {unresolved.length > 0 && <div style={{ marginTop: 8, fontSize: 13 }}>{t('detail.buy.old_unknown', { ids: unresolved.join(', ') })}</div>}
        </Alert>
      )}
      <Section>
        <H3 title={`${help('autoPay')} (${tech('autoPay')})`}>{t('detail.buy.title')}</H3>
        <P>{t('detail.buy.explain')}</P>
        <KeyValue>
          <dt>{t('detail.buy.price')}</dt><dd>{priceText} · {f.billingLabel(a.billing)}{note && <div style={{ fontSize: 12, color: '#8d8d8f' }}>{note}</div>}</dd>
          {/* One sentence that answers "is this file complete on its own?" — and, when it is not, what the rest costs. */}
          <dt>{t('detail.buy.needs')}</dt>
          <dd data-testid="buy-requires">
            {needs.length === 0
              ? t('detail.buy.needs_none')
              : (
                <>
                  <div>{t('detail.buy.needs_lead')}</div>
                  {needs.map((r) => (
                    <div key={r.id} style={{ marginTop: 4 }}>
                      <StyledLink to={`/${encodeURIComponent(r.author ?? authorSlug)}/${encodeURIComponent(r.id)}`}>{r.name || r.id}</StyledLink>
                      {' — '}
                      {r.mine ? t('detail.buy.needs_mine')
                        : r.licensed ? t('detail.buy.needs_have')
                        : r.known ? t('detail.buy.needs_buy', { price: f.priceLabel(r.price ?? '0', r.currency ?? a.currency), who: r.author_name ?? shortAddr(r.author ?? '', 6) })
                        : t('detail.buy.needs_unknown')}
                    </div>
                  ))}
                  {missing.length > 0 && <div style={{ marginTop: 6, fontWeight: 600 }}>{t('detail.buy.needs_total', { total: totalText, n: missing.length })}</div>}
                </>
              )}
            {quote?.export === 'squash' && needs.length === 0 && <div style={{ fontSize: 12, color: '#8d8d8f' }}>{t('detail.buy.needs_squash')}</div>}
          </dd>
          <dt>{t('detail.buy.seller')}</dt><dd>{a.author_name ? <>{a.author_name} <Mono style={{ color: '#8d8d8f' }}>{shortAddr(a.author, 8)}</Mono></> : <Mono>{a.author}</Mono>}</dd>
          <dt title={t('detail.tech.gateway')}>{t('detail.buy.gateway')}</dt>
          <dd>
            <ExternalLink href={gw} target="_blank" rel="noopener noreferrer">{gw}</ExternalLink>
            {gwStale && (
              <div style={{ fontSize: 12, color: '#8d8d8f' }} data-testid="buy-gateway-moved">
                {t('detail.buy.gateway_moved', { old: d.gateway_url ?? '' })}
                {d.gateway?.via === 'peer' && d.gateway.last_seen ? ` ${t('detail.buy.gateway_seen', { when: f.ago(d.gateway.last_seen) })}` : ''}
              </div>
            )}
          </dd>
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
        <H3>{isOperator ? t('detail.buy.from_node') : t('detail.buy.visitor_title')}</H3>
        {isOperator && d.owned && <P>{t('detail.buy.owned')}<StyledLink to={`/project/${authorSlug}/${encodeURIComponent(a.id)}`}>{t('detail.buy.owned_manage')}</StyledLink></P>}
        {isOperator && !d.owned && d.purchased && (
          <PaidFor d={d} priceText={priceText} runtimeReady={runtimeReady} buying={isLoading} onBuyAgain={() => { reset(); void buy({ id: a.id, again: true }); }} />
        )}
        {/* Item 3: why it cannot be bought is public — a visitor used to be shown the price and no reason at all. */}
        {!d.owned && !d.quorum_ok && <Alert $tone="warning" title={tech('verified')}>{t('detail.buy.not_verified', { passed: d.passed, quorum: d.quorum })}</Alert>}
        {/* Item 148: a knowledge its author retired is not disputed — saying "a verifier has challenged this" about
            a withdrawal would be a lie, and the two have different answers ("wait for re-verification" vs "never"). */}
        {!d.owned && d.status === 'RETIRED' && (
          <Alert $tone="warning" data-testid="buy-retired">
            {t('detail.buy.retired')}{d.retire_reason ? ` ${t('detail.buy.retired.reason', { reason: d.retire_reason })}` : ''}
          </Alert>
        )}
        {!d.owned && d.quorum_ok && !d.sellable && d.status !== 'RETIRED' && (
          <Alert $tone="warning" data-testid="buy-challenged">
            {t('detail.buy.challenged')}{d.open_challenge ? ` ${t('detail.challenge.banner', { who: shortAddr(d.open_challenge.challenger, 8), reason: d.open_challenge.reason, when: f.ago(d.open_challenge.created_at) })}` : ''}
          </Alert>
        )}
        {/* Item 3: the two doors that need no account here — shown only while the knowledge is actually on sale. */}
        {!isOperator && d.sellable && <VisitorBuy id={a.id} gw={gw} priceText={priceText} />}
        {isOperator && canBuy && (
          <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Item 4: on a replaced version the loud control is the link to the successor; paying for the old one
                stays possible, but as an outlined button that says which version the money buys. */}
            <Button
              variant={superseded ? 'outlined' : 'contained'} loading={isLoading} loadingText={t('detail.buy.paying')}
              onClick={() => { reset(); void buy({ id: a.id, with_required: missing.length > 0 }); }} title={help('autoPay')} data-testid="buy-button"
            >
              {/* The button says what leaves the wallet: the family total when a base has to come with it. */}
              {missing.length > 0 ? t('detail.buy.button_family', { price: totalText, n: missing.length + 1 })
                : superseded ? t('detail.buy.button_old', { price: priceText })
                : t('detail.buy.button', { price: priceText })}
            </Button>
            {superseded && head && <StyledLink to={`/${authorSlug}/${encodeURIComponent(head.anchor.id)}`}>{t('detail.buy.old_open')} →</StyledLink>}
            <Quorum>{a.currency === 'AIN' ? t('detail.buy.pays_from_ain') : t('detail.buy.pays_from_credit')}{note && <> · {note}</>}</Quorum>
            {credit && credit.issuance.issues && (
              <Quorum data-testid="buy-credit-note">{t('detail.buy.credit_issued', { balance: credit.balance, currency: credit.currency, node: credit.issued_by.name ?? shortAddr(credit.issued_by.address, 6), n: credit.issuance.addresses, cap: credit.issuance.cap })}</Quorum>
            )}
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
function HistoryTab({ d }: { d: PatchDetail }) {
  const { t } = useT();
  const f = useDetailFormat();
  const { data, isLoading } = usePatchRecordsQuery(d.anchor.id, { pollingInterval: 10_000 });
  if (isLoading) return <CenterProgress />;
  const recs = [...(data?.records ?? [])].sort((a, b) => b.ts - a.ts);
  return (
    <Section style={{ padding: '8px 0 0' }}>
      {/* Item 30: the sales figures belong beside the settlements they are counted from, not beside the price. */}
      <SummaryRow data-testid="hist-summary">
        <div><span className="k">{t('detail.stat.downloads')}</span><span className="v">{num(d.downloads)}</span></div>
        <div title={t('detail.hist.revenue_help')}><span className="k">{t('detail.stat.revenue')}</span><span className="v">{f.revenueLabel(d.revenue, d.anchor.currency)}</span></div>
        <div><span className="k">{t('detail.hist.records')}</span><span className="v">{num(recs.length)}</span></div>
      </SummaryRow>
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

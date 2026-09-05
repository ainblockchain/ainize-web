import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import styled from 'styled-components';
import {
  errorMessage, useBenchmarkQuery, useBuyMutation, useCollectMutation, useInfoQuery, useMyCreditQuery, useMyPurchasesQuery, usePatchTreeQuery,
  usePatchIssuesQuery, usePatchQuery, usePatchRecordsQuery, useTeachPolicyQuery,
} from '@/api/api';
import type { Attestation, CatalogEntry, ConflictInfo, LineageRef, PatchDetail, PurchaseResult, TreeResponse } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Divider, Empty, ExternalLink, KeyValue, Mono, ScoreBar, StatusChip, StyledLink, Tabs } from '@/components/ui/Misc';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableWrapper } from '@/components/ui/Table';
import { useT } from '@/i18n';
import { sourceKind } from '@/components/teach/util';
import { selectionPath } from '@/components/chat/util';
import { useTitle } from '@/utils/useTitle';
import { bytes, dateTime, denominator, num, pct, preApplyText, scoreText, shortAddr, shortHash } from '@/utils/format';
import { FamilyTree } from '@/components/detail/FamilyTree';
import { useLoadChain } from '@/components/detail/LoadChain';
import { OpenQuestions } from '@/components/detail/OpenQuestions';
import { SignalsStrip } from '@/components/detail/SignalsStrip';
import { TrainingSetBlock } from '@/components/detail/TrainingSetBlock';
import NotFoundPage from './NotFoundPage';
import { isExecuted, useDetailFormat } from './detail/recordText';
import { trackHref } from './TrackPage';

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
const Branch = styled.div`margin-top: 6px; font-size: 13px; color: ${(p) => p.theme.color.GREY}; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px;`;
/** Item 207: a track this knowledge is a MEMBER of, named as one of several — never promoted to "the" track. */
const TrackChip = styled.span`
  display: inline-flex; align-items: center; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;
  background: #e1eef3; color: #0b5468; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
`;
/**
 * Item 268 — the track a knowledge belongs to is the thing a returning consumer actually wants to subscribe to,
 * and until `/tracks/<name>` existed these chips were deliberately plain text (a dead link is worse than a word).
 * The route landed in e3bd678; this is the link the finding asked for, so the path from "today's bake" to
 * "give me this every day" no longer runs through a 35-row table at the bottom of /network.
 */
const TrackChipLink = styled(TrackChip).attrs({ as: Link })`
  text-decoration: none;
  &:hover { background: #cfe4ec; }
  &:focus-visible { outline: 2px solid ${(p) => p.theme.color.PRIMARY}; outline-offset: 1px; }
`;
const TrackLink = styled(Link)`
  color: inherit; text-decoration: underline; text-underline-offset: 2px; text-decoration-color: #b7ccd4;
  &:hover { color: #0b5468; text-decoration-color: #0b5468; }
`;
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
/**
 * Item 250 — `scoreOf` keeps only attestations that PASSED, so a version one verifier rejected still read
 * "Accuracy 100%" beside "Verifying 1/2", and the one fact that explained the wait (node-c scored 3/4 and refused
 * it) was reachable only from the operator's own log page. The headline number stays what it is — one verifier's
 * before/after pair, which a failing run cannot be averaged into — and the disagreement is stated next to it, in
 * the challenge palette, one click from the evidence.
 */
const FailChip = styled.button`
  display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 12px; font: inherit;
  font-size: 12px; font-weight: 600; letter-spacing: 0.02em; border: 0; cursor: pointer;
  background: #fde8ec; color: #a0102c;
  &:hover { text-decoration: underline; }
`;
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
/**
 * Item 75 — the one section that shows what the knowledge actually does used to render `JSON.stringify(prompt)`:
 * `"종목코드 픽셀플러스 " → 087600`, quotes and all, with the trailing space that is deliberately part of the
 * trained prompt invisible inside them. The Live test already had the answer (ChatComposer): the prompt as it was
 * trained, with a ␣ marker carrying its own tooltip. Same treatment here, and the 12-of-26 cut-off is a control.
 */
const Samples = styled.ul`
  margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 6px;
  li { font-family: ${(p) => p.theme.font.mono}; font-size: 12px; color: ${(p) => p.theme.color.DARK_GREY}; word-break: break-word; }
  li b { color: ${(p) => p.theme.color.PRIMARY}; font-weight: 500; }
  li span.sp { opacity: 0.55; }
`;
const MoreBtn = styled.button`
  margin-top: 10px; padding: 5px 14px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 14px; background: #fff;
  font: inherit; font-size: 12px; color: ${(p) => p.theme.color.DARK_GREY}; cursor: pointer;
  &:hover { border-color: ${(p) => p.theme.color.PRIMARY}; color: ${(p) => p.theme.color.PRIMARY}; }
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
/** Items 296 / 203: an origin's status was a hover `title` — invisible on a phone, and the CLI prints it in words. */
const TreeCell = styled.div`
  display: inline-flex; flex-direction: column; gap: 3px; align-items: flex-start;
  .newer { font-size: 11px; color: #8a4b00; text-decoration: underline; text-underline-offset: 2px; }
`;

/** Items 193 / 323: who a sale actually pays, one row each — a name, what they are paid for, and how much. */
const Payees = styled.ul`
  margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 6px;
  li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; font-size: 13px; color: ${(p) => p.theme.color.BLACK}; }
  li .amt { font-weight: 700; font-variant-numeric: tabular-nums; }
  li .for { font-size: 12px; color: ${(p) => p.theme.color.GREY}; }
  li code { font-family: ${(p) => p.theme.font.mono}; font-size: 11px; color: ${(p) => p.theme.color.GREY}; }
`;

/**
 * Item 205 — at 360 px the overlap table was 709 px wide inside a 360 px viewport, so Relation (the column this
 * whole section exists for) and Status were simply not on screen. Below the phone breakpoint the same rows are
 * cards: every field labelled, nothing to scroll sideways for.
 */
const OverlapCards = styled.ul`
  margin: 12px 0 0; padding: 0; list-style: none; display: grid; gap: 10px;
  li { border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 6px; padding: 12px 14px; display: grid; gap: 6px; }
  li .top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; justify-content: space-between; }
  li .k { font-size: 11px; color: ${(p) => p.theme.color.GREY}; }
  li .v { font-size: 13px; color: ${(p) => p.theme.color.BLACK}; }
`;
/** Item 226: what the overlap MEANS, and the second line that says which version came first. */
const RelCell = styled.div`
  font-size: 13px; line-height: 1.5;
  small { display: block; margin-top: 2px; font-size: 11px; color: ${(p) => p.theme.color.GREY}; }
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

/**
 * Item 205: the phone layout of the overlap block is a different shape, not a hidden column — rendering both and
 * hiding one with CSS would put the same rows in the accessibility tree twice.
 */
function useNarrow(px: number): boolean {
  const query = `(max-width: ${px - 1}px)`;
  const [on, setOn] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(query).matches));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setOn(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);
  return on;
}

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

/** Executed verifications that did NOT pass — the half of the record the headline score cannot show (item 250). */
function failedRuns(d: CatalogEntry): Attestation[] {
  return d.attestations.filter((a) => !a.passed && isExecuted(a.verified_on));
}

/**
 * Item 353 — the receipt printed a transaction hash as plain text and the product's own promise ("final once
 * executed") had no one-click way to confirm it. An AIN provider answers `GET /get_transaction?hash=…` with the
 * state, the block and `is_executed`, so on an AIN ledger the hash becomes the link it always should have been.
 * On a local ledger there is nothing to look a hash up in, and no link is offered.
 */
function txLookup(info: { ledger?: { kind?: string; provider?: string } } | undefined, tx?: string | null): string | null {
  const provider = info?.ledger?.provider;
  if (!provider || info?.ledger?.kind !== 'ain' || !tx || !tx.startsWith('0x')) return null;
  return `${provider.replace(/\/+$/, '')}/get_transaction?hash=${encodeURIComponent(tx)}`;
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
  // item 249 — the END of the supersede chain, not the next link in it
  const newest = useNewestVersion(data);

  if (isLoading) return <Wrapper><CenterProgress /></Wrapper>;
  if (!data) {
    if (error && httpStatus(error) !== 404) return <LoadFailed id={patchId} error={error} busy={isFetching} onRetry={() => { void refetch(); }} />;
    return <NotFoundPage message={t('detail.patch.not_found', { id: patchId })} />;
  }

  const a = data.anchor;
  const authorLabel = a.author_name ?? shortAddr(a.author);
  const authorSlug = decodeURIComponent(author) === a.author ? author : encodeURIComponent(a.author);
  const score = scoreOf(data);
  const failed = failedRuns(data);
  const when = data.status === 'LISTED' ? t('detail.patch.listed_when', { ago: f.ago(data.listed_at ?? a.created_at) }) : t('detail.patch.registered_when', { ago: f.ago(a.created_at) });
  /**
   * Item 324 — an anchor may carry up to MAX_CONTRIBUTORS data providers and this page rendered `find(…)`: the
   * first one, with the second, third and fourth invisible to every buyer and to the seller checking what their
   * own record promises. All of them are named here; what each is PAID is in the money block on the Origins tab,
   * where finding 41 put it (the share is not published beside a person's name in the header).
   */
  const providers = (a.contributors ?? []).filter((c) => c.role === 'data_provider');
  const provider = providers[0];
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
            <TrackLine declared={a.branch} memberships={data.branches} topic={a.topic_path} />
            {/* SC-9: an add-on is not usable alone, and the header is the first place a buyer can be told so. */}
            {base && <AddonBadge data-testid="addon-badge">{t('detail.addon_badge', { name: baseName })}</AddonBadge>}
            <SignalsStrip id={a.id} />
            {taught && (
              <TaughtLine data-testid="taught-by">
                <TaughtChip>{t('detail.taught_badge')}</TaughtChip>
                <span>{provider ? t('detail.people', { author_name: authorLabel, name: provider.name ?? t('detail.taught_by_anon'), share: Math.round(provider.share * 100) }) : t('detail.published_by', { name: providerName, node: authorLabel })}</span>
                {providers.length > 1 && (
                  <span data-testid="taught-by-more">{t('detail.people_more', { names: providers.slice(1).map((c) => c.name ?? t('detail.taught_by_anon')).join(', ') })}</span>
                )}
                {providers.map((c) => (
                  <StyledLink key={c.address} to={`/teacher/${encodeURIComponent(c.signer ?? c.address)}`} title={c.address}>
                    {providers.length > 1 ? `${c.name ?? t('detail.taught_by_anon')} →` : `${t('detail.teacher_page')} →`}
                  </StyledLink>
                ))}
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
              onClick={() => { window.location.href = `/teach/upload?on=${encodeURIComponent(a.id)}`; }}>{t('detail.build_on')}</BuildOn>
            <ViewAll to={`/benchmarks/${encodeURIComponent(a.benchmark.schema)}`}>{t('detail.patch.view_same_subject')}</ViewAll>
          </HeadRight>
        </BandContent>
      </Band>
      <Divider />
      <Content>
        <ContentInner>
          <NameRow>
            <StatusChip status={data.status} supersededBy={newest?.id} />
            <Quorum title={`${t('detail.patch.quorum_help', { quorum: data.quorum })} (${tech('verified')})`}>
              {/* Item 146: the numerator is clamped to the quorum — `3/2` is not a fraction a reader can use —
                  and the extra independent attestations are stated instead of being folded into the ratio. */}
              {t('detail.patch.verified_executed', { passed: Math.min(data.passed, data.quorum), quorum: data.quorum })}{data.sellable ? ` · ${term('verified')}` : ''}
              {data.passed > data.quorum && <> · {t('detail.patch.extra_n', { n: data.passed - data.quorum })}</>}
              {data.integrity_checks > 0 && <> · {t('detail.patch.integrity_n', { n: data.integrity_checks })}</>}
              {data.self_checks > 0 && <> · {t('detail.patch.self_n', { n: data.self_checks })}</>}
            </Quorum>
            {failed.length > 0 && (
              <FailChip type="button" data-testid="failed-chip" onClick={() => setTab('verification')} title={t('detail.patch.failed_help')}>
                {failed.length === 1 ? t('detail.patch.failed_chip_one') : t('detail.patch.failed_chip', { n: failed.length })} →
              </FailChip>
            )}
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
            {/*
              * Item 267 — the header's one date was `listed_at`, the newest ATTESTATION, printed as "verified 38s
              * ago" on a bake registered four minutes earlier and mistaken for the age of the data. The three are
              * separated now: the day the data is true of (when the publisher declares one), the day the file was
              * registered, and the verification time the sentence above already carries.
              */}
            {a.as_of && <> ∙ <b data-testid="head-as-of" title={t('detail.patch.as_of_help')}>{t('item.as_of', { date: a.as_of })}</b></>}
            {' ∙ '}<span data-testid="head-registered">{t('item.registered_on', { date: new Date(a.created_at).toISOString().slice(0, 10) })}</span>
            {newest && <> ∙ <StyledLink to={`/${authorSlug}/${encodeURIComponent(newest.id)}`} title={help('superseded')} data-testid="head-newest">
              {newest.hops > 1 ? t('detail.patch.newest_version', { id: newest.id, n: newest.hops }) : t('detail.patch.newer_version', { id: newest.id })}
            </StyledLink></>}
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
  const failed = failedRuns(d);
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
        {/* Item 250: the run that disagreed, with its own number, wherever the headline number is read. */}
        {failed.length > 0 && (
          <Note style={{ margin: '10px 0 0' }} data-testid="ov-failed">
            <Warn>
              {failed.map((at) => t('detail.ov.failed_line', { who: at.verifier_name ?? shortAddr(at.verifier, 8), score: scoreText(at.score) })).join(' ')}{' '}
              <button type="button" onClick={onSeeVerification}>{t('detail.ov.side_effect_see')} →</button>
            </Warn>
          </Note>
        )}
      </Section>
      {/* Taught knowledge carries hash-only provenance (design §D12): enough for a buyer to verify a re-train used the
          same input, never enough to read the teacher's questions — which is exactly what the note says. */}
      {a.dataset && (
        <Section data-testid="dataset-provenance">
          <H3>{t('detail.ov.dataset')}</H3>
          {/*
            * Item 190 — the private-set note said "the questions and answers themselves were never published" on a
            * page whose Overview lists every one of them two sections lower: a lesson's benchmark samples ARE its
            * questions and answers, and for a small lesson the record carries all of them. The sentence is counted
            * now: it claims privacy only for the questions that really are not on the record, and says how many of
            * each there are. The publisher reads the same number the buyer does.
            */}
          <Note data-testid="dataset-note">{(a.dataset.access ?? 'private') !== 'private'
            ? t('detail.ov.dataset_note_shared', { license: a.dataset.license ?? '—' })
            : (a.benchmark.samples?.length ?? 0) >= a.dataset.rows && a.dataset.rows > 0
              ? t('detail.ov.dataset_note_all_public', { n: num(a.dataset.rows) })
              : t('detail.ov.dataset_note_partly', { samples: num(a.benchmark.samples?.length ?? 0), rows: num(a.dataset.rows) })}</Note>
          <KeyValue style={{ marginTop: 0 }}>
            <dt>{t('detail.ov.dataset_fingerprint')}</dt>
            <dd><Mono data-testid="dataset-sha">{a.dataset.sha256.slice(0, 12)}</Mono><CopyButton text={a.dataset.sha256} label={t('common.copy')} /></dd>
            <dt>{t('detail.ov.dataset_rows')}</dt><dd>{t('teach.data.count', { n: a.dataset.rows })}</dd>
            <dt>{t('teach.data.h.source')}</dt><dd data-testid="dataset-source">{sourceKind(a.dataset.source, t)}</dd>
            {/* Provenance BY SHA (§5.2, §6.3): the record says which set each inherited row came from, and the
                fingerprint is what a reader checks the claim against. Without it this block says "copied from a
                lesson" and names neither the lesson nor the bytes. */}
            {!!a.dataset.parents?.length && (
              <>
                <dt>{t('detail.ov.dataset_from')}</dt>
                <dd data-testid="dataset-parents">
                  {a.dataset.parents.map((p) => (
                    <div key={p.patch_id}>
                      <StyledLink to={`/${encodeURIComponent(a.author)}/${encodeURIComponent(p.patch_id)}`}>{p.patch_id}</StyledLink>
                      {' · '}{t('teach.data.count', { n: p.rows })}{' · '}<Mono>{p.sha256.slice(0, 12)}</Mono>
                      <CopyButton text={p.sha256} label={t('common.copy')} />
                    </div>
                  ))}
                </dd>
              </>
            )}
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
          {/* Item 187: every anchor in the live catalogue has `license` undefined, and the fallback sentence read as a
              term the creator had chosen. It is the marketplace default from the terms, so it is named as that — and
              it says the thing a derivative publisher needs and the old line never did: it covers use, not building. */}
          <dt>{t('detail.ov.license')}</dt>
          <dd data-testid="ov-license">
            {a.license ?? (
              <>
                <div>{t('detail.ov.license_none')}</div>
                <Note style={{ margin: '2px 0 0' }}>
                  {t('detail.ov.license_none_note')} <StyledLink to="/terms">{t('detail.ov.license_terms')} →</StyledLink>
                </Note>
              </>
            )}
          </dd>
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
        {!!a.benchmark.samples?.length && <SampleQuestions samples={a.benchmark.samples} />}
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

/**
 * Item 207 — the header printed `a.branch ?? branches[0]?.name ?? 'main'`, so a knowledge in no track claimed to be
 * on "main" (a version-control default this product does not have) and one in 32 test tracks was announced as
 * belonging to whichever the node happened to list first. A track is only named as THE track when the anchor
 * declares it or the knowledge is in exactly one; otherwise the memberships are chips, or the line says there are
 * none. Every track name here links to `/tracks/<name>` (item 268); the sentence keeps its own word order in both
 * languages because `{branch}` is left uninterpolated and the link is spliced into the gap.
 */
function TrackLine({ declared, memberships, topic }: { declared?: string; memberships: { name: string; context: Record<string, string> }[]; topic: string }) {
  const { t, tech } = useT();
  const title = `${tech('branch')} · topic_path`;
  const one = declared ?? (memberships.length === 1 ? memberships[0].name : null);
  if (one) {
    // `branch` is deliberately not interpolated: the two halves of the sentence go either side of the link.
    const [before, after] = t('detail.patch.track_topic', { topic }).split('{branch}');
    return (
      // one <span>: `Branch` is a flex row with a gap, and three bare children would space the sentence apart
      <Branch title={title} data-testid="track-line">
        <span>{after === undefined ? before : <>{before}<TrackLink to={trackHref(one)}>{one}</TrackLink>{after}</>}</span>
      </Branch>
    );
  }
  if (memberships.length === 0) return <Branch title={title} data-testid="track-line">{t('detail.patch.no_track_topic', { topic })}</Branch>;
  const ctx = (c: Record<string, string>) => Object.entries(c).map(([k, v]) => `${k}=${v}`).join(', ');
  const shown = memberships.slice(0, 3);
  const rest = memberships.slice(3);
  return (
    <Branch title={title} data-testid="track-line">
      <span>{t('detail.patch.tracks_topic', { n: memberships.length, topic })}</span>
      {shown.map((b) => <TrackChipLink key={b.name} to={trackHref(b.name)} title={ctx(b.context) || undefined}>{b.name}</TrackChipLink>)}
      {rest.length > 0 && <TrackChip title={rest.map((b) => b.name).join(', ')}>{t('detail.patch.tracks_more', { n: rest.length })}</TrackChip>}
    </Branch>
  );
}

/** Item 75: the trained prompt as it was trained — trailing space marked, never quoted — and all of them on request. */
function SampleQuestions({ samples }: { samples: { prompt: string; expect: string }[] }) {
  const { t } = useT();
  const [all, setAll] = useState(false);
  const shown = all ? samples : samples.slice(0, 12);
  const anyTrailing = samples.some((s) => s.prompt !== s.prompt.replace(/\s+$/, ''));
  return (
    <>
      <H3 style={{ marginTop: 16 }}>{t('detail.ov.samples', { n: samples.length })}</H3>
      {anyTrailing && <Note style={{ margin: '4px 0 0' }}>{t('chat.samples.verbatim')}</Note>}
      <Samples data-testid="ov-samples">
        {shown.map((s, i) => {
          const trailing = s.prompt !== s.prompt.replace(/\s+$/, '');
          return (
            <li key={`${i}-${s.prompt}`}>
              {s.prompt.trim()}{trailing && <span className="sp" title={t('chat.samples.trailing_space')}>␣</span>} → <b>{s.expect}</b>
            </li>
          );
        })}
      </Samples>
      {samples.length > 12 && (
        <MoreBtn type="button" data-testid="ov-samples-more" onClick={() => setAll((v) => !v)}>
          {all ? t('detail.ov.less') : t('detail.ov.more', { n: samples.length - 12 })}
        </MoreBtn>
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

/**
 * How often the safeguard has actually fired, on everything this node can read (item 338).
 *
 * "Any node that thinks a result is wrong can challenge it" is true and is the whole of what backs a verification
 * now that nothing is escrowed. On the demo chain that mechanism had fired zero times in 501 attestations, and no
 * screen said so — so a reader inferred oversight that had never once happened.
 */
function BaseRate() {
  const { t } = useT();
  const { data: info } = useInfoQuery();
  const s = info?.verification_stats;
  if (!s || !s.attestations) return null;
  const quiet = s.failed === 0 && s.challenges === 0;
  return (
    <Note style={{ margin: '8px 0 0' }} data-testid="ver-base-rate">
      {t(quiet ? 'verifier.base_rate_zero' : 'verifier.base_rate', {
        attestations: num(s.attestations), failed: num(s.failed), challenges: num(s.challenges), upheld: num(s.upheld),
      })}
    </Note>
  );
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
  // Item 330 — while a challenge is open, a record written BEFORE it answers nothing. It stays here, shown for what
  // it is, instead of quietly filling the second quorum slot with the very attestation its own author disputed.
  const challengedAt = d.open_challenge?.created_at ?? 0;
  const stale = (at: Attestation) => challengedAt > 0 && at.created_at <= challengedAt;
  // Item 179 — a knowledge trained on top of another is only meaningful with that other underneath. A verifier that
  // does not hold the base measures the child's OWN questions and nothing else, and the tick must say so.
  const bases = [...new Set([...(d.anchor.base?.stack ?? []).map((b) => b.patch_id), ...(d.anchor.parents ?? [])])];
  const perSource = (at: Attestation) => (typeof at.score?.per_source === 'string' ? at.score.per_source : null);
  const alone = (at: Attestation) => bases.length > 0 && isExecuted(at.verified_on) && !perSource(at);
  // Item 303 — how much of this body is its parents', address for address. Only a verifier holding both files can
  // say it, so it says it here: a one-fact lesson shipping 2,992 of its base's rows is a resale, not an addition.
  const resale = d.attestations.map((at) => {
    const shared = at.rows_shared_with_parents;
    if (!shared || !at.rows) return null;
    const worst = Object.entries(shared).sort((a, b) => b[1] - a[1])[0];
    return worst && worst[1] > 0 ? { base: worst[0], n: worst[1], total: at.rows } : null;
  }).find(Boolean) ?? null;
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
      {/* Item 330: what is set aside while the challenge is open, and what it takes to come back. */}
      {(d.stale_attestations ?? 0) > 0 && (
        <Note data-testid="ver-stale-note">{t('verifier.stale_note', { n: d.stale_attestations ?? 0, quorum: d.quorum })}</Note>
      )}
      {/* Item 179: a derivative verified without its base underneath was measured on its own questions alone. */}
      {bases.length > 0 && d.attestations.some(alone) && (
        <Note data-testid="ver-alone" title={t('verifier.alone_help', { base: bases[0] })}>{t('verifier.alone')} — {t('verifier.alone_help', { base: bases[0] })}</Note>
      )}
      {/* Item 303: the rows this file did not add. */}
      {resale && <Note data-testid="ver-resale">{t('verifier.resale', { n: num(resale.n), total: num(resale.total), base: resale.base })}</Note>}
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
                {/* Item 340: a 4-question run and a 40-question one were the same record to every reader. */}
                <TableHead title={t('verifier.work_help')}>{t('verifier.h.work')}</TableHead>
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
                    {/* Item 337: the name was a dead end — this is the verifier's own record. */}
                    <TableData $align="left" $padding="0 0 0 32px" $weight={600} title={at.verifier}>
                      <StyledLink as={Link} to={`/verifier/${at.verifier}`}>{at.verifier_name ?? shortAddr(at.verifier)}</StyledLink>
                      <div style={{ fontSize: 11, color: '#8d8d8f', fontWeight: 400 }}>{shortAddr(at.verifier, 8)}</div>
                    </TableData>
                    <TableData $align="left" title={`verified_on: ${at.verified_on}`}>{f.howLabel(at.verified_on)}</TableData>
                    <TableData $mono data-testid="ver-before" title={executed ? t('detail.ver.h.before_help') : t('detail.how.integrity')}>{executed ? preApplyText(at.score) ?? t('detail.ver.side_na') : '—'}</TableData>
                    <TableData $mono data-testid="ver-after" title={executed ? JSON.stringify(at.score) : t('detail.how.integrity')}>{executed ? scoreText(at.score) : '—'}</TableData>
                    <TableData $color={side.ok === null ? undefined : side.ok ? '#44a45f' : '#e6173e'} title={side.detail ? `${side.detail} — ${help('sideEffects')} (${tech('sideEffects')})` : `${help('sideEffects')} (${tech('sideEffects')})`}>{side.text}</TableData>
                    <TableData title="restarts_detected">{at.restarts_detected === undefined ? '—' : at.restarts_detected === 0 ? t('detail.none') : t('detail.ver.restarts_n', { n: at.restarts_detected })}</TableData>
                    <TableData $mono data-testid="ver-work" title={t('verifier.work_help')}>
                      {at.samples_run !== undefined && at.duration_ms !== undefined
                        ? t('verifier.work_cell', { run: at.samples_run, available: at.samples_available ?? at.samples_run, seconds: Math.round(at.duration_ms / 1000) })
                        : t('verifier.work_none')}
                    </TableData>
                    {/* Item 146: an attestation by the author is shown but marked as not counting; item 127: no deposit column, because no deposit exists. */}
                    <TableData $color={self(at) || stale(at) ? '#8a4b00' : undefined} title={stale(at) ? t('verifier.stale_help') : `${help('signedResult')} (${tech('signedResult')})`}>
                      {self(at) ? t('detail.ver.counts_self') : stale(at) ? t('verifier.stale') : t('detail.ver.counts_yes')}
                    </TableData>
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
        {/* Item 338: the sentence above points at challenges as the safeguard that replaced the deposit. Keep the
            sentence; attach the base rate, so a reader can see how often that safeguard has actually fired. */}
        <BaseRate />
      </div>
    </Section>
  );
}

/**
 * Item 249 — "Newer version:" pointed ONE hop up a chain that grows by one every day, so a buyer opening a
 * 30-day-old version was sent to another retired page, and an agent reading `superseded_by[0]` bought a retired
 * version. This follows the chain to the end using the same-subject list the page already loads (a supersede is
 * always same-schema), stops on anything it cannot resolve, and counts the hops so the link can say how far the
 * reader actually is from the current version. Cycle-safe: every id is visited once.
 */
function useNewestVersion(d: PatchDetail | undefined): { id: string; hops: number; entry?: CatalogEntry } | null {
  // called before the page's early returns, so it has to survive not having an answer yet
  const family = useBenchmarkQuery(d?.anchor.benchmark.schema ?? '', { skip: !d?.superseded_by.length });
  const first = d?.superseded_by[0];
  if (!d || !first) return null;
  const byId = new Map((family.data?.items ?? []).map((e: CatalogEntry) => [e.anchor.id, e]));
  const seen = new Set<string>([d.anchor.id]);
  let cur = first;
  let hops = 1;
  for (;;) {
    seen.add(cur);
    const next = byId.get(cur)?.superseded_by?.[0];
    if (!next || seen.has(next)) break;
    cur = next;
    hops += 1;
  }
  return { id: cur, hops, entry: byId.get(cur) };
}

/**
 * One relative in the Origins tree (items 296, 203).
 *
 * The status used to be a `title` attribute: invisible on a phone, invisible at the keyboard, and invisible to
 * anyone who does not think to hover — so a base that had been replaced the same morning, or one a verifier had
 * challenged, looked exactly as healthy as a current one. The CLI has always printed `parents: pixel-parent
 * (SUPERSEDED)` in plain sight. The chip says it here, and where the tree knows the replacement it links to it, so
 * the buyer completing a family a day later is not sent to the retired base with nothing pointing forward.
 */
function RelativeNode({ rel, tree, authorSlug }: { rel: LineageRef; tree?: TreeResponse; authorSlug: string }) {
  const { t } = useT();
  const node = tree?.nodes.find((n) => n.id === rel.id);
  const newer = node?.superseded_by?.[0];
  return (
    <TreeCell>
      <TreeNode to={`/${authorSlug}/${encodeURIComponent(rel.id)}`}>{rel.name}<code>{rel.id}</code></TreeNode>
      {rel.status && <StatusChip status={rel.status} supersededBy={newer} />}
      {newer && (
        <StyledLink className="newer" to={`/${authorSlug}/${encodeURIComponent(newer)}`} data-testid="lin-parent-newer">
          {t('detail.lin.newer_of', { id: newer })} →
        </StyledLink>
      )}
    </TreeCell>
  );
}

/**
 * Who a sale of THIS knowledge actually pays (items 193, 323, 324).
 *
 * `royalty_preview` in the finding's fix is `tree.money`, which the node computes with `royaltyPlan` — the same
 * code that settles the sale — so every line here is the split that will actually move, named: the seller, the
 * creators of each ancestor (with the ancestor they are paid for), the data providers credited on this knowledge,
 * and the verifiers that keep it on sale. Amounts are the percentages against this knowledge's own price, so the
 * reader sees "1.5 CREDIT to alice" rather than a percentage of an unnamed whole. When the whole family is one
 * creator, that is said in words instead of printing the seller paying himself.
 */
function RevenueShared({ d, tree, authorSlug }: { d: PatchDetail; tree?: TreeResponse; authorSlug: string }) {
  const { t } = useT();
  const f = useDetailFormat();
  const a = d.anchor;
  const price = Number(a.price);
  const money = tree?.money;
  if (!money) return null;
  const amount = (pct: number) => (price > 0 ? f.priceLabel(String(Math.round((price * pct) / 100 * 1e6) / 1e6), a.currency) : null);
  const shared = money.recipients.filter((r) => r.pct > 0);
  const sellerName = money.seller_name ?? a.author_name ?? shortAddr(a.author, 8);
  const sameCreator = shared.every((r) => r.address.toLowerCase() === a.author.toLowerCase());
  const label = (r: { name: string | null; address: string }) => r.name ?? shortAddr(r.address, 8);
  const forWhat = (r: { kind: string; for_id?: string; for_name?: string }) => (
    r.kind === 'lineage' ? t('detail.lin.pay_for_base', { name: r.for_name ?? r.for_id ?? '—' })
      : r.kind === 'contributor' ? t('detail.lin.pay_for_data')
        : t('detail.lin.pay_for_verify')
  );
  return (
    <KeyValue data-testid="lin-royalty">
      <dt>{t('detail.lin.royalty_to')}</dt>
      <dd>
        <div>{t('detail.lin.pay_seller', { name: sellerName, pct: money.seller_pct, amount: amount(money.seller_pct) ?? t('common.free') })}</div>
        {shared.length === 0 && <Quorum>{t('detail.lin.pay_none')}</Quorum>}
        {shared.length > 0 && sameCreator && <Quorum data-testid="lin-same-creator">{t('detail.lin.pay_same_creator')}</Quorum>}
        <Payees>
          {shared.map((r) => (
            <li key={`${r.kind}-${r.address}-${r.for_id ?? ''}`}>
              <span>{r.kind === 'lineage' && r.for_id
                ? <StyledLink to={`/${encodeURIComponent(r.address)}/${encodeURIComponent(r.for_id)}`}>{label(r)}</StyledLink>
                : label(r)}</span>
              <span className="amt">{amount(r.pct) ?? `${r.pct}%`}</span>
              <span className="for">{r.pct}% · {forWhat(r)}</span>
              <code title={r.address}>{shortAddr(r.address, 6)}</code>
            </li>
          ))}
        </Payees>
        {/* Item 193's last limb: how often this has been built on — the number the ancestor share exists for. */}
        <Quorum as="div" style={{ display: 'block', marginTop: 6 }} data-testid="lin-built-on">
          {t('detail.lin.built_on_n', { n: num(d.children.length) }, d.children.length)}
        </Quorum>
      </dd>
    </KeyValue>
  );
}

/* ---------------------------------------------------------------- 원본과 파생 */
function Lineage({ d, authorSlug }: { d: PatchDetail; authorSlug: string }) {
  const { t, term, help, tech } = useT();
  const { data: info } = useInfoQuery();
  /**
   * Items 193 + 323 — "Revenue shared with 0x1A4eBAA0…E84f" named the wrong people in the wrong units: the direct
   * parents' AUTHORS, computed at draft time, truncated to an address with no name, no share and no amount, while
   * the settlement pays the whole ancestor set, the credited teachers and the verifiers. On the flagship, whose
   * parent is its own earlier epoch, it printed the seller paying himself. The tree endpoint already answers this
   * with the same `royaltyPlan` that settles the sale: every recipient with a name, a percentage and the ancestor
   * it is paid FOR. Same query args as the Family-tree tab, so the two share one request.
   */
  const { data: tree } = usePatchTreeQuery({ id: d.anchor.id, depth: 4 });
  // Item 191: this line used to print the VIEWING node's config as if it were the promise on this knowledge. The
  // promise lives on the anchor (`royalty_share`), is floored at the network minimum, and cannot be lowered later.
  const anchorShare = (d.anchor as { royalty_share?: number }).royalty_share;
  const share = anchorShare ?? (info as { royalty_share?: number } | undefined)?.royalty_share;
  const verifierShare = (d.anchor as { verifier_share?: number }).verifier_share;
  const { parents, children } = d.lineage;
  const narrow = useNarrow(600);
  /**
   * Items 226 + 283 — `relation()` picked one of three fixed sentences from `same_schema` and `cross_branch` and
   * knew nothing about lineage, so the declared parent drawn as "Origins" ten lines above appeared in this table as
   * "Different subject — overlapping entries need reconciling", and every same-schema row said "contradictory or a
   * newer version" without knowing which. The response already carries the answer: `lineage.parents/children`,
   * `supersedes` and `superseded_by` say what the pair IS, and the partner's own row count — read from the
   * same-subject list this page already loads — turns the overlap into the sentence a buyer needs: whether this
   * knowledge covers all of the other one's entries or only some of them.
   */
  const family = useBenchmarkQuery(d.anchor.benchmark.schema, { skip: d.conflicts.length === 0 });
  const rowsOf = (id: string): number | undefined => family.data?.items.find((e: CatalogEntry) => e.anchor.id === id)?.anchor.rows;
  const parentIds = new Set(parents.map((p) => p.id));
  const childIds = new Set(children.map((c) => c.id));
  const older = new Set(d.supersedes);
  const newer = new Set(d.superseded_by);
  /** The relation itself: origin / built on this / older / newer / coexisting — in that order of consequence. */
  const relation = (c: ConflictInfo): string => {
    if (parentIds.has(c.patch_id)) return t('detail.lin.rel_parent');
    if (childIds.has(c.patch_id)) return t('detail.lin.rel_child');
    if (older.has(c.patch_id)) return t('detail.lin.rel_older');
    if (newer.has(c.patch_id)) return t('detail.lin.rel_newer');
    const cross = (c as ConflictInfo & { cross_branch?: boolean }).cross_branch === true;
    return cross ? t('detail.lin.rel_cross_branch') : c.same_schema ? t('detail.lin.rel_same') : t('detail.lin.rel_other');
  };
  /** The arithmetic under it: how much of the other knowledge is already in this one (item 283). */
  const overlapNote = (c: ConflictInfo): string | null => {
    const of = rowsOf(c.patch_id);
    if (of === undefined || of <= 0) return null;
    if (c.overlap_rows >= of) return t('detail.lin.ov_all', { n: num(of) });
    return t('detail.lin.ov_some', { n: num(c.overlap_rows), of: num(of), rest: num(of - c.overlap_rows) });
  };
  const versionNote = (c: ConflictInfo): string | null => (
    parentIds.has(c.patch_id) && older.has(c.patch_id) ? t('detail.lin.rel_also_older')
      : childIds.has(c.patch_id) && newer.has(c.patch_id) ? t('detail.lin.rel_also_newer') : null
  );
  const bothPath = (id: string) => selectionPath([d.anchor.id, id]);
  return (
    <>
      <Section>
        <H3 title={tech('lineage')}>{t('detail.lin.title')}</H3>
        <Note><b>{term('lineage')}</b> — {t('detail.lin.note')}{typeof share === 'number' ? ` ${t(anchorShare === undefined ? 'detail.lin.note_share_network' : 'detail.lin.note_share', { pct: Math.round(share * 100) })}` : ''}</Note>
        {typeof verifierShare === 'number' && <Note data-testid="lin-verifier-share">{t('detail.lin.note_verifier', { pct: Math.round(verifierShare * 100) })}</Note>}
        <Tree>
          <TreeLevel><span className="lbl">{t('detail.lin.parents')}</span>{parents.length === 0 && <Quorum>{t('detail.lin.no_parents')}</Quorum>}{parents.map((p) => <RelativeNode key={p.id} rel={p} tree={tree} authorSlug={authorSlug} />)}</TreeLevel>
          <TreeLevel><span className="lbl">↓</span></TreeLevel>
          <TreeLevel><span className="lbl">{t('detail.lin.this')}</span><TreeNode $me to="#" onClick={(e) => e.preventDefault()}>{d.anchor.name}<code>{d.anchor.id}</code></TreeNode></TreeLevel>
          <TreeLevel><span className="lbl">↓</span></TreeLevel>
          <TreeLevel><span className="lbl">{t('detail.lin.children')}</span>{children.length === 0 && <Quorum>{t('detail.lin.no_children')}</Quorum>}{children.map((c) => <RelativeNode key={c.id} rel={c} tree={tree} authorSlug={authorSlug} />)}</TreeLevel>
        </Tree>
        {/* Item 203: the family beyond one hop lives on the Family-tree tab of this same page — until this line
            the only way to it was noticing the tab, and the SVG map on /ledger was never linked from here at all. */}
        <Note style={{ marginTop: 10 }} data-testid="lin-whole-family">
          <StyledLink to={{ search: '?tab=tree' }}>{t('detail.lin.whole_family')} →</StyledLink>
          {' · '}
          <StyledLink to="/ledger#graph">{t('detail.lin.ledger_map')} →</StyledLink>
        </Note>
        <RevenueShared d={d} tree={tree} authorSlug={authorSlug} />
      </Section>
      <Section>
        <H3 title={`${help('conflict')} (${tech('conflict')})`}>{term('conflict')}</H3>
        <Note>{t('detail.lin.conflicts_note')} {t('detail.lin.conflicts_note2')}</Note>
        {d.conflicts.length === 0 && <P>{t('detail.lin.conflicts_none')}</P>}
        {d.conflicts.length > 0 && !narrow && (
          <TableWrapper>
            <Table>
              <TableHeader><TableRow><TableHead $align="left" $padding="0 8px 0 0">{t('detail.lin.h.patch')}</TableHead><TableHead>{t('detail.lin.h.overlap')}</TableHead><TableHead $align="left">{t('detail.lin.h.relation')}</TableHead><TableHead>{t('detail.lin.h.status')}</TableHead><TableHead $align="right">{t('detail.lin.h.try')}</TableHead></TableRow></TableHeader>
              <TableBody>
                {d.conflicts.map((c) => (
                  <TableRow key={c.patch_id}>
                    <TableData $align="left" $padding="0 8px 0 0" $weight={600}><StyledLink to={`/${authorSlug}/${encodeURIComponent(c.patch_id)}`}>{c.patch_id}</StyledLink></TableData>
                    <TableData title={tech('rows')}>{t('units.rows', { n: num(c.overlap_rows) })}</TableData>
                    {/* the shared cell is one ellipsised line by default; a relation is two sentences, so it wraps here */}
                    <TableData $align="left" $maxWidth="420px" style={{ whiteSpace: 'normal', overflow: 'visible', padding: '8px' }}>
                      <RelCell>{relation(c)}{[overlapNote(c), versionNote(c)].filter(Boolean).map((x) => <small key={x as string}>{x}</small>)}</RelCell>
                    </TableData>
                    <TableData><StatusChip status={c.status} /></TableData>
                    <TableData $align="right"><StyledLink to={bothPath(c.patch_id)}>{t('detail.lin.try_both')} →</StyledLink></TableData>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        )}
        {d.conflicts.length > 0 && narrow && (
          <OverlapCards data-testid="overlap-cards">
            {d.conflicts.map((c) => (
              <li key={c.patch_id}>
                <div className="top">
                  <StyledLink to={`/${authorSlug}/${encodeURIComponent(c.patch_id)}`} style={{ fontWeight: 600, fontSize: 13 }}>{c.patch_id}</StyledLink>
                  <StatusChip status={c.status} />
                </div>
                <div><span className="k">{t('detail.lin.h.overlap')}</span> <span className="v" title={tech('rows')}>{num(c.overlap_rows)}</span></div>
                <div><span className="k">{t('detail.lin.h.relation')}</span><RelCell>{relation(c)}{[overlapNote(c), versionNote(c)].filter(Boolean).map((x) => <small key={x as string}>{x}</small>)}</RelCell></div>
                <StyledLink to={bothPath(c.patch_id)} style={{ fontSize: 13 }}>{t('detail.lin.try_both')} →</StyledLink>
              </li>
            ))}
          </OverlapCards>
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
  const [collect, collectState] = useCollectMutation();
  const { data: purchases } = useMyPurchasesQuery();
  const { data: info } = useInfoQuery();
  const row = purchases?.items.find((x) => x.patch_id === d.anchor.id);
  // SC-15 — the knowledge just bought may be an add-on: loading it means loading what it was trained on top of.
  const chain = useLoadChain((id) => d.quote?.requires.find((r) => r.id === id)?.name || (id === d.anchor.id ? d.anchor.name : id) || id);
  return (
    <div data-testid="buy-paid">
      <Alert $tone="success">{t('detail.buy.purchased', { applied: d.applied ? t('detail.buy.purchased_applied') : '', stored: d.has_body ? t('detail.buy.stored_yes') : t('detail.buy.stored_no') })}</Alert>
      {row && (
        <Note style={{ margin: '8px 0 0' }} title={dateTime(row.created_at)}>
          {t('detail.buy.paid_when', { amount: f.priceLabel(row.amount, d.anchor.currency), when: f.ago(row.created_at), tx: shortHash(row.tx_hash, 16) })}
          {txLookup(info, row.tx_hash) && <> <ExternalLink href={txLookup(info, row.tx_hash)!} target="_blank" rel="noopener noreferrer">{t('detail.buy.tx_link')} →</ExternalLink></>}
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
            variant="contained" disabled={!runtimeReady} loading={chain.busy} loadingText={t('detail.buy.paid_loading')}
            onClick={() => { void chain.load(d.anchor.id); }} data-testid="buy-paid-load"
          >{t('detail.buy.paid_load')}</Button>
        )}
        {d.applied && <Quorum>{t('detail.buy.paid_loaded')}</Quorum>}
        {d.has_body && !d.applied && !runtimeReady && <Quorum>{t('detail.buy.paid_no_runtime')}</Quorum>}
        <StyledLink to="/dashboard">{t('detail.buy.paid_manage')} →</StyledLink>
      </Actions>
      {chain.error && <Alert $tone="error" style={{ marginTop: 12 }} data-testid="apply-error">{chain.error}</Alert>}
      {chain.notice && <Alert $tone="success" style={{ marginTop: 12 }} data-testid="apply-order">{chain.notice}</Alert>}
      {chain.dialog}
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
  // the same-subject list answers two questions here: which successor to send a buyer to, and (item 283) how much
  // of a declared origin this knowledge already carries — the one fact that decides whether the base is needed too.
  const family = useBenchmarkQuery(a.benchmark.schema, { skip: successorIds.length === 0 && d.lineage.parents.length === 0 });
  const successors = successorIds
    .map((id) => family.data?.items.find((e: CatalogEntry) => e.anchor.id === id))
    .filter((e): e is CatalogEntry => !!e)
    // the version to send a buyer to is the newest one that has not itself been replaced
    .sort((x, y) => (x.superseded_by.length ? 1 : 0) - (y.superseded_by.length ? 1 : 0) || y.anchor.created_at - x.anchor.created_at);
  // Item 249: the version to send a buyer to is the END of the chain, not the first link — on a daily track the
  // direct successor was itself replaced this morning. `useNewestVersion` walks it; `successors` stays the set of
  // direct replacements, which is what "also replaced by" below is about.
  const newest = useNewestVersion(d);
  const head = newest?.entry ?? successors[0];
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
  /**
   * Item 283: the buyer of a child had to work out for themselves whether the base was a second purchase. When the
   * child's blob already carries every address of a declared origin, this says so by name — and only when the node's
   * own quote agrees that nothing else has to be bought.
   */
  const originsCovered = d.lineage.parents
    .map((pnt) => ({ name: pnt.name || pnt.id, overlap: d.conflicts.find((c) => c.patch_id === pnt.id)?.overlap_rows, rows: family.data?.items.find((e: CatalogEntry) => e.anchor.id === pnt.id)?.anchor.rows }))
    .filter((x): x is { name: string; overlap: number; rows: number } => x.overlap !== undefined && x.rows !== undefined && x.rows > 0 && x.overlap >= x.rows);
  // Item 364: on a local-credit node the money is issued BY this node — say so where it is about to be spent.
  const { data: credit } = useMyCreditQuery(undefined, { skip: !isOperator || a.currency !== 'CREDIT' });
  /**
   * Item 196 — a buyer composing a family paid 10 + 10 + 10 + 10 for four bodies that overlap on every address,
   * and the Buy panel, which reads price/billing/purchased/has_body, said nothing: the overlap was in `conflicts`
   * on the same response the whole time. What it can honestly say is which of the entries on this shelf the buyer
   * ALREADY holds — a purchase of this node's own, or something it published — and how much of this knowledge is
   * the same rows. It is not a refusal: the newer rows win when both are loaded, which is what the note says.
   */
  const { data: purchased } = useMyPurchasesQuery(undefined, { skip: !isOperator });
  const held = new Set((purchased?.items ?? []).map((x) => x.patch_id));
  const ownedOverlap = d.conflicts
    .filter((c) => held.has(c.patch_id) && c.overlap_rows > 0)
    .sort((x, y) => y.overlap_rows - x.overlap_rows);

  /**
   * SC-15 `buy.twice_note` — worked example 7 of §11: a buyer who needs the base pays for the base AND pays the
   * base's creators again out of this sale. The percentage is not written here: it is read from the tree's money
   * line, which `royaltyPlan` computes on a unit price — the same code that will settle the sale — and each
   * recipient names the ancestor it is paid FOR, so the sentence goes against the right knowledge or is not shown.
   */
  const { data: tree } = usePatchTreeQuery({ id: a.id, depth: 4, dir: 'up' }, { skip: needs.length === 0 });
  /**
   * Item 296 — a base that has been replaced, or one a verifier has challenged, kept quoting its old price with
   * nothing pointing at the current version, because `requires` carries the price and not the state. The tree this
   * panel already loads for the split does carry it, so each base says what it is and links to its replacement.
   * The child's own sale is NOT gated on it: it passed its own verification.
   */
  const baseState = (id: string) => {
    const n = tree?.nodes.find((x) => x.id === id);
    return n?.status && n.status !== 'LISTED' ? { status: n.status, newer: n.superseded_by?.[0], author: n.author } : null;
  };
  const paidTwice = (id: string) => {
    const pct = (tree?.money.recipients ?? []).filter((r) => r.kind === 'lineage' && r.for_id === id).reduce((n, r) => n + r.pct, 0);
    return pct > 0 ? Math.round(pct * 10) / 10 : null;
  };
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
                {!!newest && newest.hops > 1 && <span className="v" data-testid="buy-newest-hops">{t('detail.buy.old_hops', { n: newest.hops })}</span>}
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
                      {(() => {
                        const st = baseState(r.id);
                        return st && (
                          <div style={{ fontSize: 12, color: '#8a4b00' }} data-testid="buy-base-status">
                            {t('detail.buy.needs_status', { status: t(`status.${st.status}`) })}
                            {st.newer ? <> <StyledLink to={`/${encodeURIComponent(st.author ?? r.author ?? authorSlug)}/${encodeURIComponent(st.newer)}`}>{t('detail.lin.newer_of', { id: st.newer })} →</StyledLink></> : null}
                          </div>
                        );
                      })()}
                      {paidTwice(r.id) !== null && (
                        <div style={{ fontSize: 12, color: '#8d8d8f' }} data-testid="buy-twice-note">
                          {t('detail.buy.twice_note', { name: r.name || r.id, lineage: String(paidTwice(r.id)) })}
                        </div>
                      )}
                    </div>
                  ))}
                  {missing.length > 0 && <div style={{ marginTop: 6, fontWeight: 600 }}>{t('detail.buy.needs_total', { total: totalText, n: missing.length })}</div>}
                </>
              )}
            {quote?.export === 'squash' && needs.length === 0 && <div style={{ fontSize: 12, color: '#8d8d8f' }}>{t('detail.buy.needs_squash')}</div>}
            {needs.length === 0 && originsCovered.map((o) => (
              <div key={o.name} style={{ marginTop: 4, fontSize: 13 }} data-testid="buy-origin-covered">{t('detail.buy.needs_contains', { name: o.name, n: num(o.rows) })}</div>
            ))}
          </dd>
          {ownedOverlap.length > 0 && (
            <>
              <dt>{t('detail.buy.owned_already')}</dt>
              <dd data-testid="buy-owned-overlap">
                {ownedOverlap.map((c) => (
                  <div key={c.patch_id} style={{ marginTop: 4 }}>
                    {t('detail.buy.owned_overlap', { n: num(c.overlap_rows), total: num(a.rows), name: c.patch_id })}
                  </div>
                ))}
                <Note style={{ margin: '4px 0 0' }}>{t('detail.buy.owned_overlap_note')}</Note>
              </dd>
            </>
          )}
          {/* Item 349: `author_name` is written by the seller itself (`author_name: this.cfg.name`) and can be changed
              at any time; the address is the only part of this row the chain enforces. So the address leads, the name
              is quoted as the claim it is, and the record it can be checked against is one click away. */}
          <dt>{t('detail.buy.seller')}</dt>
          <dd data-testid="buy-seller">
            <Mono>{a.author}</Mono>
            {a.author_name && <div style={{ fontSize: 13, marginTop: 2 }}>{t('detail.buy.seller_selfnamed', { name: a.author_name })}</div>}
            <Note style={{ margin: '4px 0 0' }}>
              {t('detail.buy.seller_check')} <StyledLink to={{ search: '?tab=history' }}>{t('detail.buy.seller_record')} →</StyledLink>
            </Note>
          </dd>
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
              onClick={() => { reset(); void buy({ id: a.id, bundle: missing.length > 0 }); }} title={help('autoPay')} data-testid="buy-button"
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
        {result && <PurchaseTimeline r={result} d={d} />}
        <Note style={{ margin: '16px 0 0' }}>{term('apply')}: {help('apply')} {term('remove')}: {help('remove')}</Note>
      </Section>
    </>
  );
}

function PurchaseTimeline({ r, d }: { r: PurchaseResult; d: PatchDetail }) {
  const { t } = useT();
  const f = useDetailFormat();
  const { data: info } = useInfoQuery();
  const currency = d.anchor.currency;
  const machines = (d.executors?.length ?? 0) + (d.executors_unknown ?? 0);
  const url = txLookup(info, r.tx_hash);
  /**
   * Item 354 — this step was a green "verification confirmed" at the moment of payment, while the terms say
   * verification is best-effort, nothing is escrowed, and Verified does not promise the knowledge is correct. It
   * now says what was actually checked (how many independent runs, on how many distinct model servers), and the
   * caveat is on the receipt instead of only on a page nobody opens while buying.
   */
  const stepLabel = (s: string) => {
    if (s === 'quorum') return t('detail.buy.step.quorum', { passed: Math.min(d.passed, d.quorum), quorum: d.quorum });
    const k = t(`detail.buy.step.${s}`);
    return k === `detail.buy.step.${s}` ? s : k;
  };
  return (
    <>
      <Alert $tone="success" style={{ marginTop: 16 }}>
        {t('detail.buy.done', { id: r.patch_id, amount: f.priceLabel(r.amount, currency), tx: shortHash(r.tx_hash, 18) })} <Mono style={{ fontSize: 11, opacity: 0.8 }}>({r.scheme})</Mono>
        {url && <> <ExternalLink href={url} target="_blank" rel="noopener noreferrer" data-testid="buy-tx-link">{t('detail.buy.tx_link')} →</ExternalLink></>}
      </Alert>
      <Timeline>
        {r.steps.map((s, i) => <li key={i}><span className="step" title={s.step}>{stepLabel(s.step)}</span>{s.detail}<span className="t">{new Date(s.at).toLocaleTimeString()}</span></li>)}
      </Timeline>
      <Note style={{ margin: '4px 0 0' }} data-testid="buy-quorum-caveat">
        {machines > 0 ? t('detail.buy.quorum_caveat_n', { n: machines }) : t('detail.buy.quorum_caveat')}{' '}
        <StyledLink to="/terms">{t('detail.buy.quorum_terms')} →</StyledLink>
      </Note>
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
  const { data: info } = useInfoQuery();
  if (isLoading) return <CenterProgress />;
  const recs = [...(data?.records ?? [])].sort((a, b) => b.ts - a.ts);
  /**
   * Item 197 — the settle rows here name their payees too, and this page knows more names than /ledger does: the
   * anchor in front of it carries the author's and every contributor's. An address nobody named stays an address.
   */
  const names = new Map<string, string>();
  if (d.anchor.author_name) names.set(d.anchor.author.toLowerCase(), d.anchor.author_name);
  for (const c of d.anchor.contributors ?? []) {
    if (c.name) names.set(c.address.toLowerCase(), c.name);
    if (c.name && c.signer) names.set(c.signer.toLowerCase(), c.name);
  }
  const nameOf = (address: string) => names.get(address.toLowerCase());
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
                const s = f.recordSummary(r, { withHash: true, names: nameOf });
                return (
                  <TableRow key={r.hash}>
                    <TableData $align="left" $padding="0 0 0 32px"><KindChip $kind={r.kind} title={r.kind}>{f.kindLabel(r.kind)}</KindChip></TableData>
                    <TableData $align="left" $maxWidth="420px" title={s}>{s}</TableData>
                    <TableData $mono title={r.author}>{shortAddr(r.author, 6)}</TableData>
                    <TableData title={dateTime(r.ts)}>{f.ago(r.ts)}</TableData>
                    {/* Item 353: a settlement's payment is a transaction the chain can be asked about — so ask it. */}
                    <TableData $align="right" $padding="0 32px 0 8px" $mono title={r.sig || r.hash}>
                      {(() => {
                        const tx = r.kind === 'settle' ? (r.body as { tx_hash?: string } | undefined)?.tx_hash : undefined;
                        const url = txLookup(info, tx);
                        const label = shortHash(r.sig && r.sig.startsWith('0x') ? r.sig : r.hash, 14);
                        return url ? <ExternalLink href={url} target="_blank" rel="noopener noreferrer" title={t('detail.buy.tx_link')}>{label}</ExternalLink> : label;
                      })()}
                    </TableData>
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

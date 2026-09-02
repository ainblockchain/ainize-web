import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useCancelChatMutation, useChatMutation, useChatPatchesQuery, useChatStatusQuery, useInfoQuery, useTeachPolicyQuery } from '@/api/api';
import type { ChatMessage, TeachJob } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { KnowledgePicker } from '@/components/chat/KnowledgePicker';
import { TurnView, type Turn } from '@/components/chat/TurnView';
import { MAX_HISTORY, answerHits, matchSampleAny, parseSelection, selectionPath, useSince, useTicker, MAX_CHAT_PATCHES, type ChatModeKind, type ChatQueueView } from '@/components/chat/util';
import { TeachDrawer } from '@/components/chat/TeachDrawer';
import { LessonBasket } from '@/components/chat/LessonBasket';
import { CreditSheet } from '@/components/chat/CreditSheet';
import { PreflightSheet } from '@/components/chat/PreflightList';
import { LessonCard } from '@/components/chat/LessonCard';
import { PublishSheet } from '@/components/chat/PublishSheet';
import { KeepPrivateSheet } from '@/components/chat/KeepPrivateSheet';
import { MyKnowledgePanel } from '@/components/chat/MyKnowledgePanel';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, Description, PageWrapper, StatusChip, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { currentTeacherKey, onTeacherKeyChange, shortKey, type TeacherKey } from '@/lib/teacherKey';
import { bannerDismissed, clearBasket, dismissBanner, loadBasket, loadJobs, newCorrectionId, rememberJob, saveBasket, DEFAULT_FACTS_PER_JOB, type Basket } from '@/lib/teachStore';
import { num } from '@/utils/format';

/* ---------------------------------------------------------------- layout */
const Grid = styled.div`
  display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 24px; align-items: start; margin-top: 24px;
  @media (max-width: ${(p) => p.theme.breakpoint.md}px) { grid-template-columns: 1fr; }
`;
const Side = styled.div`display: flex; flex-direction: column; gap: 20px; min-width: 0;`;
const Main = styled.section`
  display: flex; flex-direction: column; min-width: 0; background: #fafafa; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  min-height: 560px; max-height: calc(100vh - 200px);
  /*
   * Single column (mobile): let the panel grow and the PAGE scroll. Clamping it to the viewport here only made
   * its own children overflow the box — at 360 px the composer, the quota footer and the D3 "Stop waiting" row
   * were drawn 230 px below the panel, on top of the developer note, and a tap on the question box landed on
   * that note instead of the textarea.
   */
  @media (max-width: ${(p) => p.theme.breakpoint.md}px) { max-height: none; }
`;
const MainHead = styled.div`
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 14px 16px; background: #fff; border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  h2 { margin: 0; font-size: 15px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
  small { font-size: 12px; color: ${(p) => p.theme.color.GREY}; }
`;
const HeadList = styled.ol`
  display: flex; flex-wrap: wrap; gap: 6px 12px; margin: 0; padding: 8px 16px 10px; list-style: none; background: #fff; border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; font-size: 12px; color: ${(p) => p.theme.color.DARK_GREY};
  li { display: inline-flex; align-items: center; gap: 6px; }
  b { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: ${(p) => p.theme.color.PRIMARY}; color: #fff; font-size: 11px; }
`;
const Transcript = styled.div`
  flex: 1; min-height: 200px; overflow-y: auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 24px;
`;
/** centred in whatever space the lesson card (first block of the transcript) leaves; never hidden under it */
const EmptyState = styled.div`
  margin: auto; padding: 24px 0; max-width: 48ch; text-align: center; color: ${(p) => p.theme.color.GREY}; font-size: 14px; line-height: 1.6;
  b { display: block; color: ${(p) => p.theme.color.BLACK}; font-size: 16px; margin-bottom: 6px; }
`;
const ModelChip = styled.span`
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 14px; background: ${(p) => p.theme.color.PALE_GREY}; color: ${(p) => p.theme.color.HOVER};
  font-size: 12px; font-weight: 600; b { font-family: ${(p) => p.theme.font.mono}; font-weight: 500; }
`;
const DevNote = styled.section`
  margin-top: 32px; padding: 16px 20px; background: #fff; border: 1px dashed ${(p) => p.theme.color.LIGHT_GREY}; font-size: 12px; line-height: 1.6; color: ${(p) => p.theme.color.GREY};
  h3 { margin: 0 0 4px; font-size: 12px; font-weight: 700; color: ${(p) => p.theme.color.DARK_GREY}; letter-spacing: 0.04em; text-transform: uppercase; }
`;
/** Compare mode, second turn on: the one line that says the two columns do not share a conversation. */
const SplitNote = styled.p`
  margin: 0; padding: 8px 16px; background: #fff; border-top: 1px dashed ${(p) => p.theme.color.LIGHT_GREY};
  font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.GREY};
`;
const CancelRow = styled.div`
  display: flex; align-items: center; justify-content: center; gap: 12px; padding: 8px 16px; background: #fff; border-top: 1px dashed ${(p) => p.theme.color.LIGHT_GREY};
  font-size: 12px; color: ${(p) => p.theme.color.GREY};
`;
const TeachBanner = styled(Alert)`
  margin-top: 16px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
  span { flex: 1; min-width: 240px; }
  button.x { background: none; border: 0; font: inherit; font-size: 12px; color: inherit; opacity: 0.8; cursor: pointer; text-decoration: underline; }
`;

/* ---------------------------------------------------------------- helpers */
type Tr = (key: string, vars?: Record<string, string | number>) => string;

/** Turn server / transport errors into one plain-language sentence. */
function mapChatError(err: unknown, t: Tr): string {
  const e = err as { status?: number | string; name?: string } | undefined;
  const raw = errorMessage(err);
  const m = raw.toLowerCase();
  if (e?.status === 499 || m.includes('cancelled while it was still queued')) return t('chat.queue.cancelled');
  if (e?.name === 'AbortError' || m.includes('aborted')) return t('chat.err.cancelled');
  if (e?.status === 'FETCH_ERROR') return t('chat.err.network');
  if (e?.status === 'TIMEOUT_ERROR' || m.includes('timeout') || m.includes('timed out')) return t('chat.err.timeout');
  if (m.includes('does not hold the patch body')) return t('chat.err.no_body');
  if (e?.status === 429 || m.includes('quota')) return t('chat.err.quota');
  if (m.includes('runtime busy')) return t('chat.err.busy');
  if (e?.status === 503 || m.includes('runtime unavailable') || m.includes('model unavailable') || m.includes('unreachable') || m.includes('econnrefused') || m.includes('not available') || m.includes('not responding')) return t('chat.err.runtime');
  if (m.includes('patch targets')) return t('chat.err.model');
  if (m.includes('patch not found')) return t('chat.err.not_found');
  if (m.includes('at most') && m.includes('together')) return t('chat.picker.max');
  if (e?.status === 400) return t('chat.err.too_long');
  return t('chat.err.generic', { message: raw });
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Build ONE column's outgoing history: only completed turns whose own column produced a NON-EMPTY answer, capped to
 * the server limit, plus the new question.
 *
 * `column` is what makes the comparison honest. Replaying the patched answer to the un-patched model tells it that
 * it already produced the knowledge's answer, so from turn 2 the "Before loading" column repeats it and the live
 * test disproves the very thing it exists to show. A turn the other column never answered (mode 'base' / 'patched'
 * only, or an empty answer) is left out of this column's conversation rather than faked.
 */
function buildHistory(prior: Turn[], text: string, column: 'base' | 'patched'): ChatMessage[] {
  const history: ChatMessage[] = [];
  for (const tr of prior) {
    if (tr.status !== 'done' || !tr.response) continue;
    const answer = tr.response[column]?.content?.trim();
    if (!answer) continue;                 // empty answers stay visible in the UI but never go back to the model
    history.push({ role: 'user', content: tr.prompt });
    history.push({ role: 'assistant', content: answer });
  }
  const capped = history.slice(-MAX_HISTORY);
  capped.push({ role: 'user', content: text });
  return capped;
}

type SheetKind = 'credit' | 'preflight' | 'publish' | 'keep' | null;

/* ---------------------------------------------------------------- page */
export default function ChatPage() {
  const { t, help, tech, audience } = useT();
  useTitle(t('chat.title'));
  const { patchId } = useParams<{ patchId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSignedIn } = useAuth();
  const { data, isLoading, error, refetch } = useChatPatchesQuery(undefined, { pollingInterval: 20_000 });
  const { data: info } = useInfoQuery();
  // Teach mode: policy is public and cached 10 s on the node; a pre-teach node answers 404 → the teach UI stays hidden.
  const { data: policy } = useTeachPolicyQuery(undefined, { pollingInterval: 60_000 });
  // how many corrections one lesson holds is THIS node's answer, not a constant in the bundle (design §D1)
  const factsPerJob = policy?.limits?.facts_per_job ?? DEFAULT_FACTS_PER_JOB;
  const [sendChat, { isLoading: busy }] = useChatMutation();
  const [cancelChat] = useCancelChatMutation();
  const inflight = useRef<{ abort: () => void } | null>(null);
  /** Set by cancel() so the aborted request reports what actually happened (and whether a try was charged). */
  const cancelNote = useRef<string | null>(null);

  const items = useMemo(() => data?.items ?? [], [data]);
  /** The visitor's own lessons; a published one is already a public item, so it is listed once (under the public list). */
  const lessons = useMemo(() => (data?.lessons ?? []).filter((l) => !(data?.items ?? []).some((e) => e.anchor.id === l.anchor.id)), [data]);
  const pickable = useMemo(() => [...lessons, ...items], [lessons, items]);
  /** Route `/chat/a,b,c` = ordered selection (tick order = load order). */
  const routeIds = useMemo(() => parseSelection(patchId), [patchId]);
  const selectedList = useMemo(() => routeIds.map((id) => pickable.find((e) => e.anchor.id === id)).filter((e): e is NonNullable<typeof e> => !!e), [routeIds, pickable]);
  const selectedIds = useMemo(() => selectedList.map((e) => e.anchor.id), [selectedList]);
  const selectionKey = selectedIds.join(',');
  /** First selected knowledge — the one whose name heads the transcript and whose details link is shown alone. */
  const selected = selectedList[0];
  const runtimeOff = !!data && !data.runtime.available;
  const userCleared = useRef(false);
  /** Navigate to a selection path while keeping the teach-mode query params (?teach / ?lesson / ?mine). */
  const go = useCallback((path: string, replace = false) => navigate({ pathname: path, search: location.search }, { replace }), [navigate, location.search]);

  const [mode, setMode] = useState<ChatModeKind>('compare');
  const [thinking, setThinking] = useState(false);
  const [transcripts, setTranscripts] = useState<Record<string, Turn[]>>({});
  /** undefined = not asked yet; null = unlimited (operator); number = remaining free tries */
  const [quota, setQuota] = useState<number | null | undefined>(undefined);
  const [quotaLimit, setQuotaLimit] = useState<number | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [missingId, setMissingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Optimistic selection: the route update is a React transition, so the checkboxes flip from this state first. */
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);
  useEffect(() => { setPendingIds(null); }, [patchId]);
  const shownIds = pendingIds ?? selectedIds;

  // ---------------------------------------------------------------- teach-mode state (spec §4, §7.7)
  const teachParam = searchParams.get('teach') === '1';
  const lessonParam = searchParams.get('lesson');
  const mineParam = searchParams.get('mine') === '1';
  const teachOn = !!policy?.enabled;
  const setParam = useCallback((key: string, value: string | null) => {
    setSearchParams((prev) => { const next = new URLSearchParams(prev); if (value === null) next.delete(key); else next.set(key, value); return next; }, { replace: true });
  }, [setSearchParams]);
  const [teacherKey, setTeacherKey] = useState<TeacherKey | null>(() => currentTeacherKey());
  useEffect(() => onTeacherKeyChange(() => { setTeacherKey(currentTeacherKey()); void refetch(); }), [refetch]);
  const [basket, setBasket] = useState<Basket>(() => loadBasket([]));
  useEffect(() => { setBasket(loadBasket(selectedIds)); }, [selectionKey]);   // eslint-disable-line react-hooks/exhaustive-deps
  const updateBasket = useCallback((fn: (b: Basket) => Basket) => { setBasket((prev) => { const next = fn(prev); saveBasket(selectedIds, next); return next; }); }, [selectedIds]);
  const [basketOpen, setBasketOpen] = useState<boolean>(() => teachParam || loadBasket(parseSelection(patchId)).facts.length > 0);
  /** the basket panel — scrolled into view on ?teach=1 and after "Add to lesson" so the visitor sees where the correction went */
  const basketRef = useRef<HTMLDivElement>(null);
  const [basketNudge, setBasketNudge] = useState(0);
  useEffect(() => {
    if (!basketNudge || !basketRef.current) return;
    const el = basketRef.current;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [basketNudge]);
  const [drawer, setDrawer] = useState<{ question: string; answer: string } | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [sheetJob, setSheetJob] = useState<TeachJob | null>(null);
  const [cardJobId, setCardJobId] = useState<string | null>(() => lessonParam ?? loadJobs()[0]?.id ?? null);
  const [cardHidden, setCardHidden] = useState(false);
  const [bannerOff, setBannerOff] = useState<boolean>(() => bannerDismissed());
  useEffect(() => { if (lessonParam) { setCardJobId(lessonParam); setCardHidden(false); } }, [lessonParam]);
  useEffect(() => { if (teachParam && policy) { setBasketOpen(true); setBasketNudge((n) => n + 1); } }, [teachParam, !!policy]);   // eslint-disable-line react-hooks/exhaustive-deps
  const showBanner = teachOn && (teachParam || !bannerOff);

  // Preselect from the route; fall back to the first testable knowledge (and remember what the route asked for).
  // Ids the route names but this node cannot test are dropped from the address (and reported once).
  useEffect(() => {
    if (!data || items.length === 0) return;
    const missing = routeIds.filter((id) => !selectedIds.includes(id));
    if (missing.length > 0) {
      setMissingId(missing.join(', '));
      go(selectedIds.length ? selectionPath(selectedIds) : '/chat', true);
      return;
    }
    if (selectedIds.length === 0 && !userCleared.current) go(selectionPath([items[0].anchor.id]), true);
  }, [data, items, routeIds, selectedIds, go]);

  // Abort any in-flight request when leaving the page. `alive` guards the refreshes that outlive the page: a
  // request aborted by this cleanup settles one microtask later, and RTK Query's refetch() throws
  // ("Cannot refetch a query that has not been started yet") once the hook's own cleanup has run.
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; inflight.current?.abort(); }, []);
  const refreshPatches = useCallback(() => { if (alive.current) void refetch(); }, [refetch]);

  // '' is a real transcript key: teaching with nothing loaded. Treating it as "no selection → no turns" threw away
  // every answer the conversational door produced on a node with an empty catalog.
  const turns = useMemo(() => transcripts[selectionKey] ?? [], [transcripts, selectionKey]);
  const lastStatus = turns[turns.length - 1]?.status;

  // ---------------------------------------------------------------- D3: where is this request in the queue?
  // While a turn is pending the node is asked every 1.5 s whether it is still queued behind the shared model,
  // who holds it and since when. The counters tick on the client between polls (anchored to the node's own
  // measurement via fulfilledTimeStamp) so a wait never looks frozen — and never looks like a silent failure.
  const pending = useMemo(() => turns.find((x) => x.status === 'pending'), [turns]);
  const pendingId = pending?.requestId;
  const pendingRef = useRef<string | null>(null);
  useEffect(() => { pendingRef.current = pendingId ?? null; }, [pendingId]);
  const { data: qs, fulfilledTimeStamp: qsAt } = useChatStatusQuery(pendingId ?? '', { skip: !pendingId, pollingInterval: 1500 });
  useTicker(!!pending);
  const lockSkew = qs?.now ? (qsAt ?? Date.now()) - qs.now : data?.now ? Date.now() - data.now : 0;
  const since = useSince(lockSkew);
  const queue: ChatQueueView | undefined = !pending || !qs || qs.state === 'gone' ? undefined : {
    state: qs.state,
    waited_ms: qs.queued_ms + (qsAt ? Math.max(0, Date.now() - qsAt) : 0),
    position: qs.position,
    // our own request is the one waiting, so a live holder is by definition someone else's test
    holder: qs.state === 'queued' && qs.lock && qs.lock.alive && !qs.lock.stale ? { label: qs.lock.label, since: since(qs.lock.since) } : null,
  };
  const queuedNow = queue?.state === 'queued';
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [turns.length, lastStatus]);

  const patchTurns = useCallback((pid: string, fn: (prev: Turn[]) => Turn[]) => {
    setTranscripts((prev) => ({ ...prev, [pid]: fn(prev[pid] ?? []) }));
  }, []);

  const send = useCallback(async (text: string, opts?: { mode?: ChatModeKind; thinking?: boolean; replaceId?: string }) => {
    // An empty selection is allowed while teaching: you are correcting the model itself, and a node with an empty
    // catalog has nothing to pick. There is no "with knowledge" side then, so the turn is base-only.
    if ((selectedIds.length === 0 && !teachOn) || busy || exhausted) return;
    const pid = selectionKey;
    const ids = selectedIds;
    const useMode: ChatModeKind = selectedIds.length === 0 ? 'base' : (opts?.mode ?? mode);
    const useThinking = opts?.thinking ?? thinking;
    const sample = matchSampleAny(selectedList, text);
    const id = newId();
    const prior = (transcripts[pid] ?? []).filter((x) => x.id !== opts?.replaceId);
    // One conversation per column. In compare mode both go on the wire (messages = the patched one, so a client or
    // node that ignores the split behaves exactly as before); a single-column mode sends only its own.
    const basePast = buildHistory(prior, text, 'base');
    const patchedPast = buildHistory(prior, text, 'patched');
    const history = useMode === 'base' ? basePast : patchedPast;
    const split = useMode === 'compare' ? { messages_base: basePast, messages_patched: patchedPast } : {};

    // D3: the node registers this id the moment the request arrives, so GET /api/chat/status can answer
    // "queued" (and a give-up while queued costs nothing) long before the answer exists.
    const requestId = newId();
    const turn: Turn = { id, prompt: text, mode: useMode, thinking: useThinking, status: 'pending', expect: sample?.expect, patchIds: ids, requestId };
    patchTurns(pid, (prev) => [...prev.filter((x) => x.id !== opts?.replaceId), turn]);
    // one knowledge → patch_id (works on every node); several → patch_ids (teach-mode nodes)
    const target = ids.length === 1 ? { patch_id: ids[0] } : { patch_ids: ids };
    const request = sendChat({ ...target, mode: useMode, messages: history, ...split, thinking: useThinking, request_id: requestId });
    inflight.current = request;
    // show the shared-model lock (held by this very request, or by someone ahead of it) right away instead of on the next 20 s poll
    const lockPeek = setTimeout(refreshPatches, 800);
    try {
      const res = await request.unwrap();
      setQuota(res.remaining_quota);
      if (res.quota_limit !== undefined) setQuotaLimit(res.quota_limit);
      if (res.remaining_quota !== null && res.remaining_quota <= 0) setExhausted(true);
      patchTurns(pid, (prev) => prev.map((x) => (x.id === id ? { ...x, status: 'done', response: res, baseHit: answerHits(res.base?.content, sample?.expect) } : x)));
    } catch (err) {
      const e = err as { status?: number | string; name?: string; data?: { quota_reset?: number | null } } | undefined;
      const quotaHit = e?.status === 429;
      if (quotaHit) { setQuota(0); setExhausted(true); }
      const msg = cancelNote.current ?? mapChatError(err, t);
      cancelNote.current = null;
      // A Retry button is only offered where send() would actually send. On a 429 it would not: send() returns at the
      // `exhausted` guard, so the click was measured as zero requests. A cancel (499 / AbortError) leaves `busy` and
      // `exhausted` false and its Retry does issue a real request — AZ-089/AZ-093 press it and get a completed turn —
      // so that one stays.
      const first = selectedList[0]?.anchor;
      const quota = quotaHit
        ? { resetAt: e?.data?.quota_reset ?? null, buyHref: first ? `/${encodeURIComponent(first.author)}/${encodeURIComponent(first.id)}` : null }
        : undefined;
      patchTurns(pid, (prev) => prev.map((x) => (x.id === id ? { ...x, status: 'error', error: msg, retryable: !quotaHit, quota } : x)));
    } finally {
      clearTimeout(lockPeek);
      if (inflight.current === request) inflight.current = null;
      refreshPatches();   // lock released (or still queued) — refresh the banner without waiting for the poll
    }
  }, [selectedIds, selectedList, selectionKey, busy, exhausted, teachOn, mode, thinking, transcripts, patchTurns, sendChat, refreshPatches, t]);

  /**
   * D3 — "Stop waiting". While the request is still queued the node drops it before touching the model and no free
   * try is spent; once it is running the work (and the charge) stands. Either way the transcript SAYS which
   * happened instead of leaving a silently cancelled turn behind.
   */
  const cancel = useCallback(async () => {
    const id = pendingRef.current;
    if (id) {
      const out = await cancelChat(id).unwrap().catch(() => null);
      cancelNote.current = out?.cancelled ? t('chat.queue.cancelled') : out?.reason === 'already_running' ? t('chat.queue.cancelled_late') : t('chat.err.cancelled');
    }
    inflight.current?.abort();
  }, [cancelChat, t]);
  const retry = useCallback((turn: Turn) => { void send(turn.prompt, { mode: turn.mode, thinking: turn.thinking, replaceId: turn.id }); }, [send]);
  const clear = useCallback(() => { if (selectionKey) patchTurns(selectionKey, () => []); }, [selectionKey, patchTurns]);
  const toggle = useCallback((id: string) => {
    setMissingId(null);
    userCleared.current = false;
    const cur = shownIds;
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_CHAT_PATCHES ? cur : [...cur, id];
    if (next.length === 0) userCleared.current = true;
    setPendingIds(next);
    go(next.length ? selectionPath(next) : '/chat');
  }, [shownIds, go]);
  const clearSelection = useCallback(() => { userCleared.current = true; setMissingId(null); setPendingIds([]); go('/chat'); }, [go]);
  /** Selected knowledge whose benchmark format has no chat form — the live test asks through the chat template. */
  const templateOnly = useMemo(() => selectedList.filter((e) => { const f = e.anchor.benchmark.format ?? []; return f.length > 0 && !f.includes('chat') && !f.includes('natural'); }), [selectedList]);
  /** Sample questions of every selected knowledge (deduplicated by prompt), in load order. */
  const samples = useMemo(() => {
    const seen = new Set<string>();
    const out: { prompt: string; expect: string }[] = [];
    // dedupe on the exact prompt: two samples that differ only by the trained trailing space are different prompts
    for (const e of selectedList) for (const s of e.anchor.benchmark.samples ?? []) { if (!seen.has(s.prompt)) { seen.add(s.prompt); out.push(s); } }
    return out;
  }, [selectedList]);

  // ---------------------------------------------------------------- teach-mode handlers
  const onTeach = useCallback((turn: Turn, answer: string) => { setDrawer({ question: turn.prompt, answer }); }, []);
  const addCorrection = useCallback((c: { prompt: string; answer: string; alt_prompt?: string; model_answer?: string }) => {
    updateBasket((b) => (b.facts.length >= factsPerJob ? b : { ...b, facts: [...b.facts, { ...c, id: newCorrectionId(), added_at: Date.now() }] }));
    setDrawer(null); setBasketOpen(true); setBasketNudge((n) => n + 1);
  }, [updateBasket, factsPerJob]);
  const onTrain = useCallback(() => { setSheet(teacherKey ? 'preflight' : 'credit'); }, [teacherKey]);
  const onQueued = useCallback((job: TeachJob) => {
    rememberJob({ id: job.id, name: job.name, created_at: job.created_at });
    clearBasket(selectedIds); setBasket({ facts: [], builds_on: false });
    setSheet(null); setCardJobId(job.id); setCardHidden(false); setParam('lesson', job.id);
  }, [selectedIds, setParam]);
  const onTry = useCallback(async (job: TeachJob) => {
    const id = job.draft_id ?? job.patch_id; if (!id) return;
    await refetch();   // the draft must be in `lessons` before the route names it (otherwise it is dropped as untestable)
    userCleared.current = false;
    const next = selectedIds.includes(id) ? selectedIds : selectedIds.length >= MAX_CHAT_PATCHES ? [...selectedIds.slice(0, MAX_CHAT_PATCHES - 1), id] : [...selectedIds, id];
    navigate({ pathname: selectionPath(next), search: `?lesson=${encodeURIComponent(job.id)}` });
  }, [refetch, selectedIds, navigate]);
  const onImprove = useCallback((job: TeachJob) => {
    updateBasket(() => ({ facts: job.facts.map((f) => ({ prompt: f.prompt, answer: f.answer, ...(f.alt_prompt ? { alt_prompt: f.alt_prompt } : {}), ...(f.base_answer ? { model_answer: f.base_answer } : {}), id: newCorrectionId(), added_at: Date.now() })), builds_on: job.builds_on_context, retry_of: job.id }));
    setBasketOpen(true);
  }, [updateBasket]);
  const openSheet = useCallback((kind: SheetKind, job: TeachJob | null) => { setSheetJob(job); setSheet(kind); }, []);
  const hideCard = useCallback(() => { setCardHidden(true); setParam('lesson', null); }, [setParam]);
  const closeMine = useCallback(() => setParam('mine', null), [setParam]);

  const quotaText = isSignedIn || quota === null
    ? t('chat.quota.operator')
    : quota === undefined ? t('chat.quota.visitor')
      : exhausted || quota <= 0 ? t('chat.quota.none')
        : quotaLimit ? t('chat.quota.left_of', { n: quota, limit: quotaLimit }) : t('chat.quota.left', { n: quota });

  const composerDisabled = (selectedIds.length === 0 && !teachOn) || runtimeOff || (exhausted && !isSignedIn);
  const disabledReason = selectedIds.length === 0 && !teachOn ? t('chat.input.pick_first') : runtimeOff ? t('chat.runtime.off') : exhausted && !isSignedIn ? t('chat.quota.none') : undefined;
  const keyLabel = !teacherKey ? undefined
    : teacherKey.name ? t('teach.key.chip', { name: teacherKey.name, short: shortKey(teacherKey.address) })
      : t('teach.key.chip_anon', { short: shortKey(teacherKey.address) });

  return (
    <PageWrapper $wide>
      <TitleRow>
        <Title title={`${help('liveTest')} (${tech('liveTest')})`}>{t('chat.title')}</Title>
        {data && (
          <ModelChip title={data.runtime.api ?? undefined}>
            {t('chat.model')} <b>{data.runtime.model ?? t('chat.model_unknown')}</b>
          </ModelChip>
        )}
      </TitleRow>
      <Description>{t('chat.subtitle')}</Description>

      {isLoading && <CenterProgress />}
      {!!error && !data && <Alert $tone="error" style={{ marginTop: 24 }}>{t('common.error', { message: errorMessage(error) })}</Alert>}

      {data && (
        <>
          {showBanner && (
            <TeachBanner $tone="info" role="status" data-testid="teach-banner">
              <span>{t('chat.banner.teach')}</span>
              <button type="button" className="x" onClick={() => { dismissBanner(); setBannerOff(true); if (teachParam) setParam('teach', null); }}>{t('chat.banner.dismiss')}</button>
            </TeachBanner>
          )}
          {missingId && <Alert $tone="warning" style={{ marginTop: 16 }}>{t('chat.picker.route_missing', { id: missingId })}</Alert>}
          {exhausted && !isSignedIn && <Alert $tone="warning" style={{ marginTop: 16 }} role="status">{t('chat.quota.none')}</Alert>}
          <Grid>
            <Side>
              {/* The basket heads the column when this node teaches (§5.5: the visitor must see it without scrolling past every knowledge card); a node that does not accept lessons shows the "does not accept" line under the picker instead. */}
              {policy && teachOn && (
                <div ref={basketRef}>
                  <LessonBasket basket={basket} policy={policy} stackNames={selectedList.map((e) => e.anchor.name)} expanded={basketOpen} onToggle={() => setBasketOpen((v) => !v)}
                    onRemove={(id) => updateBasket((b) => ({ ...b, facts: b.facts.filter((f) => f.id !== id) }))} onBuildsOn={(v) => updateBasket((b) => ({ ...b, builds_on: v }))}
                    onTrain={onTrain} onOpenMine={() => setParam('mine', '1')} keyLabel={keyLabel} />
                </div>
              )}
              {/* D3: "your test" is driven by THIS TAB's in-flight request, so it must read `queue`, not `qs`.
                  RTK Query keeps `data` from the last fetch after the query is skipped, so once a visitor had run
                  one live test `qs.state` stayed 'running' for ever and every later holder — another visitor, a
                  verifier, another node — was announced as "Your test has the shared model". `queue` is undefined
                  unless a turn of this tab is actually pending, which is exactly the condition wanted here. */}
              <KnowledgePicker items={items} lessons={lessons} runtime={data.runtime} lock={data.lock} clockSkewMs={lockSkew}
                lockIsMine={queue?.state === 'running'} selectedIds={shownIds}
                onToggle={toggle} onClear={clearSelection} applied={data.applied ?? []} overlaps={data.overlaps ?? []} />
              {policy && !teachOn && (
                <div ref={basketRef}>
                  <LessonBasket basket={basket} policy={policy} stackNames={selectedList.map((e) => e.anchor.name)} expanded={basketOpen} onToggle={() => setBasketOpen((v) => !v)}
                    onRemove={(id) => updateBasket((b) => ({ ...b, facts: b.facts.filter((f) => f.id !== id) }))} onBuildsOn={(v) => updateBasket((b) => ({ ...b, builds_on: v }))}
                    onTrain={onTrain} onOpenMine={() => setParam('mine', '1')} keyLabel={keyLabel} />
                </div>
              )}
            </Side>

            <Main aria-live="polite">
              {selected && selectedList.length === 1 && (
                <MainHead>
                  <h2>{selected.anchor.name}</h2>
                  <StatusChip status={selected.status} />
                  <small title={`${help('facts')} (${tech('facts')})`}>{t('units.facts', { n: num(selected.anchor.benchmark.queries) })}</small>
                  <small style={{ marginLeft: 'auto' }}>
                    <StyledLink to={`/${encodeURIComponent(selected.anchor.author)}/${encodeURIComponent(selected.anchor.id)}`}>{t('common.details')} →</StyledLink>
                  </small>
                </MainHead>
              )}
              {selectedList.length > 1 && (
                <>
                  <MainHead>
                    <h2 title={t('chat.head.multi_help')}>{t('chat.head.multi', { n: selectedList.length })}</h2>
                    <small title={`${help('facts')} (${tech('facts')})`}>{t('units.facts', { n: num(selectedList.reduce((a, e) => a + e.anchor.benchmark.queries, 0)) })}</small>
                    <small style={{ marginLeft: 'auto' }}>{t('chat.head.multi_help')}</small>
                  </MainHead>
                  <HeadList aria-label={t('chat.head.multi', { n: selectedList.length })}>
                    {selectedList.map((e, i) => (
                      <li key={e.anchor.id}>
                        <b>{i + 1}</b>
                        <StyledLink to={`/${encodeURIComponent(e.anchor.author)}/${encodeURIComponent(e.anchor.id)}`} title={t('common.details')}>{e.anchor.name}</StyledLink>
                        <StatusChip status={e.status} />
                      </li>
                    ))}
                  </HeadList>
                </>
              )}
              {/* D2: a knowledge trained and verified only in the completion form answers a chat-format question
                  less well (measured 6/6 vs 4/6). Say so rather than silently switching the live test's form. */}
              {templateOnly.length > 0 && (
                <Alert $tone="info" role="status" style={{ marginBottom: 12 }} data-testid="chat-format-note">
                  {t('chat.samples.format_note')}
                </Alert>
              )}
              <Transcript ref={scrollRef}>
                {policy && cardJobId && !cardHidden && (
                  <LessonCard key={cardJobId} jobId={cardJobId} policy={policy} nodeAddress={info?.node.address} teacherAddress={teacherKey?.address}
                    onTry={(j) => { void onTry(j); }} onPublish={(j) => openSheet('publish', j)} onKeep={(j) => openSheet('keep', j)} onImprove={onImprove} onHide={hideCard} />
                )}
                {turns.length === 0 ? (
                  <EmptyState><b>{t('chat.empty.title')}</b>{t('chat.empty.body')}</EmptyState>
                ) : turns.map((turn) => <TurnView key={turn.id} turn={turn.id === pending?.id ? { ...turn, queue } : turn} onRetry={retry} onTeach={teachOn ? onTeach : undefined} />)}
              </Transcript>
              {/*
                * Finding 1: from turn 2 the two columns are two different conversations — the base call replays base
                * answers, the patched call patched ones (buildHistory above). Say it where the follow-up is typed.
                */}
              {mode === 'compare' && turns.some((x) => x.status === 'done') && (
                <SplitNote role="note" data-testid="chat-split-history">{t('chat.history.split')}</SplitNote>
              )}
              {busy && (
                <CancelRow role="status">
                  <span>{queuedNow ? t('chat.queue.waiting') : t('chat.input.in_flight')}</span>
                  <Button size="small" color="secondary" onClick={() => { void cancel(); }}>{queuedNow ? t('chat.queue.stop_waiting') : t('chat.input.cancel')}</Button>
                </CancelRow>
              )}
              <ChatComposer
                disabled={composerDisabled} disabledReason={disabledReason} busy={busy}
                mode={mode} onMode={setMode} thinking={thinking} onThinking={setThinking}
                samples={samples}
                onSend={(text) => { void send(text); }} onClear={clear} canClear={turns.length > 0}
                footer={quotaText}
              />
            </Main>
          </Grid>

          <DevNote>
            <h3 title={audience('operator').help}>{audience('operator').title}</h3>
            {t('chat.dev.body')}
          </DevNote>
        </>
      )}

      {/* ------------------------------------------------------------ teach-mode overlays */}
      {drawer && (
        <TeachDrawer question={drawer.question} modelAnswer={drawer.answer} full={basket.facts.length >= factsPerJob} max={factsPerJob} limits={policy?.limits}
          onAdd={addCorrection} onClose={() => setDrawer(null)} />
      )}
      {sheet === 'credit' && <CreditSheet onDone={(k) => { setTeacherKey(k); setSheet('preflight'); }} onClose={() => setSheet(null)} />}
      {sheet === 'preflight' && policy && (
        <PreflightSheet patchIds={selectedIds} basket={basket} policy={policy} contributorName={teacherKey?.name} onQueued={onQueued} onClose={() => setSheet(null)} />
      )}
      {sheet === 'publish' && sheetJob && policy && teacherKey && (
        <PublishSheet job={sheetJob} policy={policy} teacherKey={teacherKey} onClose={() => setSheet(null)} onPublished={() => undefined} />
      )}
      {sheet === 'keep' && sheetJob && policy && (
        <KeepPrivateSheet job={sheetJob} policy={policy} runtimeModel={data?.runtime.model ?? info?.node.model} onClose={() => setSheet(null)} onPublishLater={() => setSheet('publish')} onDeleted={() => setSheet(null)} />
      )}
      {mineParam && (
        <MyKnowledgePanel teacherKey={teacherKey} lessonEntries={lessons} onKeyChanged={() => setTeacherKey(currentTeacherKey())}
          onOpenLesson={(j) => { setCardJobId(j.id); setCardHidden(false); setSearchParams({ lesson: j.id }, { replace: true }); }} onClose={closeMine} />
      )}
    </PageWrapper>
  );
}

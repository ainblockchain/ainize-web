import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useCancelChatMutation, useChatMutation, useChatPatchesQuery, useChatStatusQuery, useInfoQuery, useTeachPolicyQuery } from '@/api/api';
import type { ChatMessage, TeachJob } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { KnowledgePicker } from '@/components/chat/KnowledgePicker';
import { TurnView, type Turn } from '@/components/chat/TurnView';
import { MAX_HISTORY, answerHits, loadTurns, matchSampleAny, matchSampleEach, parseSelection, saveTurns, selectionPath, useSince, useTicker, MAX_CHAT_PATCHES, type ChatModeKind, type ChatQueueView } from '@/components/chat/util';
import { TeachDrawer } from '@/components/chat/TeachDrawer';
import { toCandidate } from '@/components/chat/BasePicker';
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
import { bannerDismissed, carryBasket, clearBasket, dismissBanner, loadBasket, loadJobs, newCorrectionId, rememberJob, saveBasket, strandedBaskets, DEFAULT_FACTS_PER_JOB, type Basket } from '@/lib/teachStore';
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
/**
 * Finding 87 — what this knowledge IS. The description was rendered only into the picker row's `title`, so an
 * English-speaking visitor got a 50-character title, a fact count and eight buttons of Korean, and nothing that
 * says what the comparison they are about to run is about.
 */
const HeadDesc = styled.p`
  margin: 0; padding: 0 16px 10px; background: #fff; border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.GREY};
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
`;
/** Findings 218 + 228 — the stack as an object: a link you can send, and what owning all of it costs. */
const HeadActions = styled.div`
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; padding: 8px 16px 10px; background: #fff;
  border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; font-size: 12px; color: ${(p) => p.theme.color.DARK_GREY};
  b { font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
  button { background: none; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 3px; padding: 3px 10px; font: inherit; font-size: 12px; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer;
    &:hover { border-color: ${(p) => p.theme.color.PRIMARY}; background: ${(p) => p.theme.color.PALE_GREY}; } }
  code { font-family: ${(p) => p.theme.font.mono}; font-size: 11px; color: ${(p) => p.theme.color.DARK_GREY}; background: ${(p) => p.theme.color.PALE_GREY}; padding: 2px 6px; border-radius: 3px; }
`;
/** Finding 228 — a member of the stack that a newer version already replaces. */
const Replaced = styled.span`font-size: 11px; color: #8a4b00; background: #fff3e0; padding: 1px 7px; border-radius: 9px;`;
/** Finding 57 — the ONE place the exhausted trial makes its offer: the knowledge, its price, and when it comes back. */
const QuotaOffer = styled.span`
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; font-size: 12px; color: ${(p) => p.theme.color.DARK_GREY};
  a { color: ${(p) => p.theme.color.PRIMARY}; font-weight: 600; text-decoration: none; &:hover { text-decoration: underline; } }
  em { font-style: normal; color: ${(p) => p.theme.color.GREY}; }
`;
const HeadList = styled.ol`
  display: flex; flex-wrap: wrap; gap: 6px 12px; margin: 0; padding: 8px 16px 10px; list-style: none; background: #fff; border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; font-size: 12px; color: ${(p) => p.theme.color.DARK_GREY};
  li { display: inline-flex; align-items: center; gap: 6px; }
  /* one knowledge per line on a phone: side by side, a 50-character name was squeezed into a four-word column */
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { li { width: 100%; flex-wrap: wrap; } }
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
/**
 * Finding 14 — the line that marks where the loaded knowledge changed. Turns are no longer thrown away when the
 * selection changes, so the transcript has to say which knowledge each run of questions was asked with.
 */
const StackMark = styled.p`
  display: flex; align-items: center; gap: 10px; margin: 0; font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.GREY};
  &::before, &::after { content: ''; flex: 1; border-top: 1px dashed ${(p) => p.theme.color.LIGHT_GREY}; }
  b { font-weight: 600; color: ${(p) => p.theme.color.DARK_GREY}; }
`;
/** Corrections saved under another stack's key: named, with one click to go back to them (finding 14). */
const StrandedNote = styled(Alert)`
  /* column, not a row: the side panel is 300 px wide and an inline button broke the sentence across it */
  display: flex; flex-direction: column; align-items: flex-start; gap: 6px; font-size: 12px; line-height: 1.5;
  button { background: none; border: 0; padding: 0; font: inherit; font-weight: 700; color: inherit; cursor: pointer; text-decoration: underline; }
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
/** The knowledge a turn was asked with, as one comparable key — load order matters, so it is a list, not a set. */
const stackKey = (ids: string[] | undefined) => (ids ?? []).join(',');

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
  const { t, help, tech, term, audience, locale } = useT();
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
  /** SC-13's consent line names the knowledge, not its id ("Share this question with {name}'s creator?"). */
  const nameOf = useCallback((id: string) => [...items, ...lessons].find((e) => e.anchor.id === id)?.anchor.name ?? id, [items, lessons]);
  const pickable = useMemo(() => [...lessons, ...items], [lessons, items]);
  /** Route `/chat/a,b,c` = ordered selection (tick order = load order). */
  const routeIds = useMemo(() => parseSelection(patchId), [patchId]);
  const selectedList = useMemo(() => routeIds.map((id) => pickable.find((e) => e.anchor.id === id)).filter((e): e is NonNullable<typeof e> => !!e), [routeIds, pickable]);
  /**
   * SC-3 — what this lesson could be built ON: the loaded stack first (that is what the visitor was testing when the
   * answer came out wrong), then this key's own lessons, then the rest of the catalog. `mine` is what lets a visitor
   * build on their own unpublished draft (Story A3) even though its questions are not published.
   */
  const baseCandidates = useMemo(() => {
    const mineIds = new Set((lessons ?? []).map((e) => e.anchor.id));
    return [...selectedList, ...(lessons ?? []), ...pickable].reduce<ReturnType<typeof toCandidate>[]>((acc, e) => {
      if (acc.some((c) => c.id === e.anchor.id)) return acc;
      acc.push(toCandidate(e, routeIds, mineIds.has(e.anchor.id)));
      return acc;
    }, []);
  }, [selectedList, lessons, pickable, routeIds]);
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
  /**
   * Finding 14 — ONE transcript, not one per selection. Keying it by the selected ids meant that ticking a second
   * knowledge — the natural next move, "now add this one and ask again" — swapped in an empty record and the panel
   * said "No questions yet", throwing away (to the eye) answers bought with scarce free tries. Every turn carries
   * the knowledge it was asked with instead, and the transcript marks where that changed.
   */
  const [turns, setTurns] = useState<Turn[]>(() => loadTurns<Turn>());
  /**
   * Finding 67 — and it survives leaving the page. The only route to the price is the head's *Details →*; the
   * transcript that persuaded the visitor used to die on that click, together with the free tries it cost.
   */
  useEffect(() => { saveTurns(turns); }, [turns]);
  /** undefined = not asked yet; null = unlimited (operator); number = remaining free tries */
  const [quota, setQuota] = useState<number | null | undefined>(undefined);
  const [quotaLimit, setQuotaLimit] = useState<number | null>(null);
  const [exhausted, setExhausted] = useState(false);
  /** When the measured free hour ends (from the node's 429 body) — printed once, in the composer footer. */
  const [quotaReset, setQuotaReset] = useState<number | null>(null);
  /** Finding 61 — the question a failed send must put back in the box (nonce = "this is a new failure"). */
  const [restore, setRestore] = useState<{ text: string; nonce: number }>({ text: '', nonce: 0 });
  const [missingId, setMissingId] = useState<string | null>(null);
  /** Optimistic selection: the route update is a React transition, so the checkboxes flip from this state first. */
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);
  useEffect(() => { setPendingIds(null); }, [patchId]);
  const shownIds = pendingIds ?? selectedIds;

  // ---------------------------------------------------------------- teach-mode state (spec §4, §7.7)
  const teachParam = searchParams.get('teach') === '1';
  const lessonParam = searchParams.get('lesson');
  const mineParam = searchParams.get('mine') === '1';
  /** SC-12 *Teach this on top*: the open question travels in the link and lands in the box, unsent. */
  const askParam = searchParams.get('q') ?? undefined;
  const teachOn = !!policy?.enabled;
  const setParam = useCallback((key: string, value: string | null) => {
    setSearchParams((prev) => { const next = new URLSearchParams(prev); if (value === null) next.delete(key); else next.set(key, value); return next; }, { replace: true });
  }, [setSearchParams]);
  const [teacherKey, setTeacherKey] = useState<TeacherKey | null>(() => currentTeacherKey());
  useEffect(() => onTeacherKeyChange(() => { setTeacherKey(currentTeacherKey()); void refetch(); }), [refetch]);
  const [basket, setBasket] = useState<Basket>(() => loadBasket(parseSelection(patchId)));
  /**
   * Finding 14 — the lesson FOLLOWS the selection. Loading `loadBasket(selectedIds)` on every change swapped the
   * panel for a different, empty record the moment a knowledge was ticked, and the correction being written looked
   * deleted. `carryBasket` moves the draft to the new stack unless that stack already has one of its own; anything
   * that does stay behind is named below the panel instead of vanishing.
   */
  const basketStack = useRef<string[]>(parseSelection(patchId));
  const [stranded, setStranded] = useState<{ ids: string[]; facts: number }[]>([]);
  useEffect(() => {
    if (!data) return;   // the route's ids are not resolved against this node's catalog yet
    const from = basketStack.current;
    basketStack.current = selectedIds;
    if (stackKey(from) !== selectionKey) setBasket(carryBasket(from, selectedIds));
    const next = strandedBaskets(selectedIds);
    setStranded((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [selectionKey, data, basket, selectedIds]);
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
  /**
   * The teach drawer. `editId` (finding 21) is set when it is EDITING a correction the lesson already holds — the
   * "Improve & retry" path, where the card asks for another phrasing of a correction that is already written.
   */
  const [drawer, setDrawer] = useState<{ question: string; answer: string; editId?: string; initial?: { answer?: string; alt_prompt?: string }; focusAlt?: boolean } | null>(null);
  /** Corrections "Improve & retry" could not bring back because the lesson is already full. */
  const [improveFull, setImproveFull] = useState<{ n: number; max: number } | null>(null);
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

  const lastStatus = turns[turns.length - 1]?.status;
  /** Did the loaded knowledge ever change during this conversation? Only then is a turn marked with what it used. */
  const mixedStacks = useMemo(() => new Set(turns.map((x) => stackKey(x.patchIds))).size > 1, [turns]);

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
  /**
   * Finding 19 — bring the NEWEST TURN on screen, not the bottom of a box that may not be scrolling anything.
   * Below md the panel is deliberately un-clamped (`max-height: none` on Main), so the transcript is not its own
   * scroller — the page is. `scrollTo` on the transcript then moved nothing at all: at 360 px the answer was drawn
   * below the fold and the only visible change was the free-try counter going down. `scrollIntoView` scrolls
   * whichever ancestors actually scroll (the transcript at desktop widths, the window on a phone), and `nearest`
   * puts the top of an answer taller than the viewport at the top of it instead of its last line.
   */
  const lastTurnRef = useRef<HTMLElement>(null);
  useEffect(() => {
    lastTurnRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [turns.length, lastStatus]);

  /** Finding 229 — what a stack actually took, measured in this session, keyed by the stack and the view. */
  const measured = useRef(new Map<string, number>());
  const send = useCallback(async (text: string, opts?: { mode?: ChatModeKind; thinking?: boolean; replaceId?: string }) => {
    // An empty selection is allowed while teaching: you are correcting the model itself, and a node with an empty
    // catalog has nothing to pick. There is no "with knowledge" side then, so the turn is base-only.
    if ((selectedIds.length === 0 && !teachOn) || busy || exhausted) return;
    const ids = selectedIds;
    const useMode: ChatModeKind = selectedIds.length === 0 ? 'base' : (opts?.mode ?? mode);
    const useThinking = opts?.thinking ?? thinking;
    const sample = matchSampleAny(selectedList, text);
    // finding 223 — every selected knowledge's own expected value for this question, so the hit row can show them
    const expects = matchSampleEach(selectedList, text);
    const id = newId();
    // The conversation SENT is still one selection's own: a turn answered with other knowledge loaded is shown (it is
    // the visitor's transcript) but never replayed here, so neither column is told it once produced another stack's
    // answer. This is the same set of messages the per-selection transcript used to build.
    const prior = turns.filter((x) => x.id !== opts?.replaceId && stackKey(x.patchIds) === selectionKey);
    // One conversation per column. In compare mode both go on the wire (messages = the patched one, so a client or
    // node that ignores the split behaves exactly as before); a single-column mode sends only its own.
    const basePast = buildHistory(prior, text, 'base');
    const patchedPast = buildHistory(prior, text, 'patched');
    const history = useMode === 'base' ? basePast : patchedPast;
    const split = useMode === 'compare' ? { messages_base: basePast, messages_patched: patchedPast } : {};

    // D3: the node registers this id the moment the request arrives, so GET /api/chat/status can answer
    // "queued" (and a give-up while queued costs nothing) long before the answer exists.
    const requestId = newId();
    const turn: Turn = {
      id, prompt: text, mode: useMode, thinking: useThinking, status: 'pending', expect: sample?.expect, expects,
      patchIds: ids, patchNames: selectedList.map((e) => e.anchor.name), requestId,
      // finding 229 — what is being loaded, and what the same stack measured last time in this session
      loadBytes: selectedList.reduce((a, e) => a + (e.anchor.size_bytes ?? 0), 0) || null,
      estimateMs: measured.current.get(stackKey(ids) + (useMode === 'compare' ? '|c' : '')) ?? null,
    };
    setTurns((prev) => [...prev.filter((x) => x.id !== opts?.replaceId), turn]);
    // one knowledge → patch_id (works on every node); several → patch_ids (teach-mode nodes)
    const target = ids.length === 1 ? { patch_id: ids[0] } : { patch_ids: ids };
    const startedAt = Date.now();
    // D1/finding 58 — thinking shares the answer's token budget (the node defaults to 200), so a thinking turn was
    // routinely cut mid-sentence or came back empty with the reasoning full. Ask for the room it needs; the node's
    // own ceiling (1024) still applies.
    const request = sendChat({ ...target, mode: useMode, messages: history, ...split, thinking: useThinking, request_id: requestId, ...(useThinking ? { max_tokens: 900 } : {}) });
    inflight.current = request;
    // show the shared-model lock (held by this very request, or by someone ahead of it) right away instead of on the next 20 s poll
    const lockPeek = setTimeout(refreshPatches, 800);
    try {
      const res = await request.unwrap();
      setQuota(res.remaining_quota);
      if (res.quota_limit !== undefined) setQuotaLimit(res.quota_limit);
      if (res.remaining_quota !== null && res.remaining_quota <= 0) setExhausted(true);
      // finding 229 — this is the only honest source of "how long does this take": what it just took, here.
      measured.current.set(stackKey(ids) + (useMode === 'compare' ? '|c' : ''), Date.now() - startedAt);
      setTurns((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'done', response: res, baseHit: answerHits(res.base?.content, sample?.expect) } : x)));
    } catch (err) {
      const e = err as { status?: number | string; name?: string; data?: { quota_reset?: number | null } } | undefined;
      const quotaHit = e?.status === 429;
      if (quotaHit) { setQuota(0); setExhausted(true); setQuotaReset(e?.data?.quota_reset ?? null); }
      const msg = cancelNote.current ?? mapChatError(err, t);
      cancelNote.current = null;
      // Finding 61 — the box was cleared on submit, so a rejected question was simply gone: an over-long prompt
      // came back as "clear the conversation and try again" with nothing left to shorten. Put it back.
      setRestore((r) => ({ text, nonce: r.nonce + 1 }));
      // A Retry button is only offered where send() would actually send. On a 429 it would not: send() returns at the
      // `exhausted` guard, so the click was measured as zero requests. A cancel (499 / AbortError) leaves `busy` and
      // `exhausted` false and its Retry does issue a real request — AZ-089/AZ-093 press it and get a completed turn —
      // so that one stays.
      const first = selectedList[0]?.anchor;
      const quota = quotaHit
        ? { resetAt: e?.data?.quota_reset ?? null, buyHref: first ? `/${encodeURIComponent(first.author)}/${encodeURIComponent(first.id)}` : null }
        : undefined;
      setTurns((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'error', error: msg, retryable: !quotaHit, quota } : x)));
    } finally {
      clearTimeout(lockPeek);
      if (inflight.current === request) inflight.current = null;
      refreshPatches();   // lock released (or still queued) — refresh the banner without waiting for the poll
    }
  }, [selectedIds, selectedList, selectionKey, busy, exhausted, teachOn, mode, thinking, turns, sendChat, refreshPatches, t]);

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
  /**
   * Finding 58 — the same question, asked again without thinking, in place of the turn that thinking spoiled. The
   * checkbox goes off too: leaving it on would spoil the next question the same way.
   */
  const askAgain = useCallback((turn: Turn) => { setThinking(false); void send(turn.prompt, { mode: turn.mode, thinking: false, replaceId: turn.id }); }, [send]);
  /** "Clear conversation" empties the whole transcript — every turn is in one list now, whatever was loaded for it. */
  const clear = useCallback(() => setTurns([]), []);
  const toggle = useCallback((id: string) => {
    setMissingId(null);
    userCleared.current = false;
    const cur = shownIds;
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_CHAT_PATCHES ? cur : [...cur, id];
    if (next.length === 0) userCleared.current = true;
    setPendingIds(next);
    go(next.length ? selectionPath(next) : '/chat');
  }, [shownIds, go]);
  /**
   * Finding 224 — the load order decides which knowledge wins on the entries they share, and it was not a control:
   * the only way to change it was to untick and re-tick, which renumbered everything else. Now it moves.
   */
  const reorder = useCallback((id: string, dir: -1 | 1) => {
    const cur = [...shownIds];
    const i = cur.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= cur.length) return;
    [cur[i], cur[j]] = [cur[j], cur[i]];
    setPendingIds(cur);
    go(selectionPath(cur));
  }, [shownIds, go]);
  const clearSelection = useCallback(() => { userCleared.current = true; setMissingId(null); setPendingIds([]); go('/chat'); }, [go]);
  /** Load a whole stack at once — how the "corrections saved under another selection" note takes you back to them. */
  const showStack = useCallback((ids: string[]) => {
    if (ids.length === 0) { clearSelection(); return; }
    setMissingId(null); userCleared.current = false; setPendingIds(ids); go(selectionPath(ids));
  }, [clearSelection, go]);
  /** Selected knowledge whose benchmark format has no chat form — the live test asks through the chat template. */
  const templateOnly = useMemo(() => selectedList.filter((e) => { const f = e.anchor.benchmark.format ?? []; return f.length > 0 && !f.includes('chat') && !f.includes('natural'); }), [selectedList]);
  /**
   * Sample questions of every selected knowledge (deduplicated by prompt), in load order. With more than one
   * knowledge loaded the rows are merged, so each chip also says which knowledge published it (finding 87 — the
   * `chat.samples.from` slot that had existed unused since the multi-selection shipped).
   */
  const samples = useMemo(() => {
    const seen = new Set<string>();
    const out: { prompt: string; expect: string; from?: string }[] = [];
    // dedupe on the exact prompt: two samples that differ only by the trained trailing space are different prompts
    for (const e of selectedList) {
      for (const s of e.anchor.benchmark.samples ?? []) {
        if (seen.has(s.prompt)) continue;
        seen.add(s.prompt);
        out.push(selectedList.length > 1 ? { ...s, from: e.anchor.name } : s);
      }
    }
    return out;
  }, [selectedList]);
  /**
   * Finding 87 — one sentence saying what these questions are, for the visitor who cannot read them. Everything in
   * it is measured from the anchor: whose benchmark they are, and one real expected answer as the shape to expect.
   */
  const samplesGloss = samples.length > 0 && selected
    ? (selectedList.length > 1
      ? t('chat.samples.gloss_stack', { n: selectedList.length, expect: samples[0].expect })
      : t('chat.samples.gloss', { name: selected.anchor.name, expect: samples[0].expect }))
    : undefined;

  // ---------------------------------------------------------------- teach-mode handlers
  const onTeach = useCallback((turn: Turn, answer: string) => { setDrawer({ question: turn.prompt, answer }); }, []);
  const addCorrection = useCallback((c: { prompt: string; answer: string; alt_prompt?: string; model_answer?: string }) => {
    const editId = drawer?.editId;
    updateBasket((b) => (editId
      // editing one the lesson already holds: it is replaced where it stands, so the lesson never grows past the cap
      // the stored question is kept verbatim when only its surrounding space differs: this node trains prompts whose
      // trailing space is part of what was trained, and an edit of the PHRASING must not quietly rewrite them
      ? { ...b, facts: b.facts.map((f) => (f.id === editId ? { ...f, ...c, prompt: f.prompt.trim() === c.prompt.trim() ? f.prompt : c.prompt, alt_prompt: c.alt_prompt, id: f.id, added_at: f.added_at } : f)) }
      : b.facts.length >= factsPerJob ? b : { ...b, facts: [...b.facts, { ...c, id: newCorrectionId(), added_at: Date.now() }] }));
    setDrawer(null); setBasketOpen(true); setBasketNudge((n) => n + 1);
  }, [updateBasket, factsPerJob, drawer?.editId]);
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
  /**
   * Finding 21 — "Improve & retry" used to REPLACE the whole basket with the failed lesson's facts, so a correction
   * being written on something else was destroyed with no prompt, and the improvement the card asks for ("add another
   * phrasing") could not be made afterwards: a basket item offered nothing but "Remove ×".
   *
   * It now MERGES: whatever is in the lesson stays, the failed job's corrections are added unless the same question
   * and answer are already there, and the drawer opens on the one that did not stick with "Ask it another way"
   * focused — which is exactly what the card told the visitor to do. Corrections that do not fit the node's
   * per-lesson cap are never dropped silently; the line above the basket says how many and why.
   */
  const onImprove = useCallback((job: TeachJob) => {
    const same = (a: { prompt: string; answer: string }, b: { prompt: string; answer: string }) => a.prompt.trim() === b.prompt.trim() && a.answer.trim() === b.answer.trim();
    const kept = basket.facts;
    const room = Math.max(0, factsPerJob - kept.length);
    // each correction of the failed lesson beside the copy of it the lesson already holds (pressing Improve twice,
    // or having taught the same fact by hand, must not put it in twice)
    const paired = job.facts.map((f) => ({ fact: f, held: kept.find((k) => same(k, f)) ?? null }));
    const missing = paired.filter((p) => !p.held);
    const added = new Map(missing.slice(0, room).map((p) => [p, {
      prompt: p.fact.prompt, answer: p.fact.answer,
      ...(p.fact.alt_prompt ? { alt_prompt: p.fact.alt_prompt } : {}),
      ...(p.fact.base_answer ? { model_answer: p.fact.base_answer } : {}),
      id: newCorrectionId(), added_at: Date.now(),
    }]));
    // what the lesson holds of that job afterwards, in the job's own order
    const back = paired.flatMap((p) => { const c = p.held ?? added.get(p); return c ? [{ fact: p.fact, c }] : []; });
    // the lesson is only the RETRY of that job while it actually carries its corrections: a lesson too full to take
    // any of them back is still the visitor's own, and must not be queued as a second attempt at someone else's
    if (added.size > 0) updateBasket((b) => ({ ...b, facts: [...b.facts, ...added.values()], builds_on: b.builds_on || job.builds_on_context, retry_of: job.id }));
    else if (back.length > 0) updateBasket((b) => ({ ...b, retry_of: job.id }));
    setImproveFull(missing.length > added.size ? { n: missing.length - added.size, max: factsPerJob } : null);
    setBasketOpen(true); setBasketNudge((n) => n + 1);
    // the phrasing is wanted for a correction the model got WRONG; failing that, for the first one that came back
    const target = back.find((x) => x.fact.hit === false) ?? back[0];
    if (target) {
      setDrawer({
        question: target.c.prompt, answer: target.fact.base_answer ?? '', editId: target.c.id, focusAlt: true,
        initial: { answer: target.c.answer, alt_prompt: target.c.alt_prompt },
      });
    }
  }, [basket.facts, updateBasket, factsPerJob]);
  const openSheet = useCallback((kind: SheetKind, job: TeachJob | null) => { setSheetJob(job); setSheet(kind); }, []);
  const hideCard = useCallback(() => { setCardHidden(true); setParam('lesson', null); }, [setParam]);
  const closeMine = useCallback(() => setParam('mine', null), [setParam]);

  /**
   * Finding 218 — the stack has no name, no save and no share; the only artifact is the address bar. This is the
   * smallest thing that makes it an object a person can pass on: one button that copies the link to this exact
   * set, in this exact order. (`ainize use a b c`, the CLI half, is item 216 on the node's side.)
   */
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  const copyLink = useCallback(() => {
    const url = `${window.location.origin}${selectionPath(selectedIds)}`;
    const done = () => {
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2500);
    };
    // clipboard access can be refused (an insecure origin, a denied permission): fall back to a selectable prompt
    navigator.clipboard?.writeText(url).then(done).catch(() => window.prompt(t('chat.head.copy'), url));
  }, [selectedIds, t]);
  const patchHref = (e: { anchor: { author: string; id: string } }) => `/${encodeURIComponent(e.anchor.author)}/${encodeURIComponent(e.anchor.id)}`;
  /** "25 AIN" / "Free" for one knowledge, in the reader's locale. */
  const priceOf = useCallback((e: typeof selectedList[number]) => {
    const n = Number(e.anchor.price);
    if (!n) return null;
    return { n, currency: e.anchor.currency === 'AIN' ? 'AIN' : e.anchor.currency === 'CREDIT' ? term('credit') : e.anchor.currency };
  }, [term]);
  const fmtPrice = useCallback((n: number, currency: string) => `${n.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', { maximumFractionDigits: 6 })} ${currency}`, [locale]);
  /**
   * Finding 228 — what the ticked set costs to OWN. The per-item prices sat in three separate cards and the head
   * had no total, so the visitor who liked the combination added 25 + 0.1 + 10 by hand. Currencies are summed
   * separately: this node may list some knowledge in AIN and some in node credit, and adding those is not a price.
   */
  /** Does any pair of the ticked knowledge share memory entries? Then their fact counts cannot be added (finding 63). */
  const stackOverlaps = useMemo(
    () => (data?.overlaps ?? []).some((o) => selectedIds.includes(o.a) && selectedIds.includes(o.b)),
    [data?.overlaps, selectedIds],
  );
  const factsKnown = selectedList.every((e) => typeof e.anchor.benchmark.queries === 'number');
  const stackPrice = useMemo(() => {
    const by = new Map<string, number>();
    for (const e of selectedList) { const p = priceOf(e); if (p) by.set(p.currency, (by.get(p.currency) ?? 0) + p.n); }
    return [...by.entries()].map(([currency, n]) => fmtPrice(n, currency));
  }, [selectedList, priceOf, fmtPrice]);

  /**
   * Finding 57 — the offer, made ONCE. "Buy the knowledge" used to render in the page alert, the transcript
   * bubble, the textarea placeholder AND the composer footer, four dead-end copies of one sentence at the highest
   * intent moment on the site. It now lives here, beside the box the visitor cannot type in, as a link to the
   * knowledge, its price and the measured instant the free hour ends; everywhere else says "no free tries left".
   */
  const outOfTries = exhausted && !isSignedIn;
  const quotaOffer = outOfTries && (
    <QuotaOffer data-testid="chat-quota-actions">
      <span>{quotaLimit ? t('chat.quota.spent_of', { limit: quotaLimit }) : t('chat.quota.spent')}</span>
      {selected && (
        <StyledLink to={patchHref(selected)}>
          {(() => { const p = priceOf(selected); return p ? t('chat.quota.buy_price', { name: selected.anchor.name, price: fmtPrice(p.n, p.currency) }) : t('chat.quota.buy_free', { name: selected.anchor.name }); })()} →
        </StyledLink>
      )}
      {quotaReset !== null && <em>{t('chat.quota.resets_at', { time: new Date(quotaReset).toLocaleTimeString(locale === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit' }) })}</em>}
      {quotaReset === null && <em>{t('chat.quota.resets_hour')}</em>}
    </QuotaOffer>
  );
  const quotaText = isSignedIn || quota === null
    ? t('chat.quota.operator')
    : quota === undefined ? t('chat.quota.visitor')
      : exhausted || quota <= 0 ? t('chat.quota.none_short')
        : quotaLimit ? t('chat.quota.left_of', { n: quota, limit: quotaLimit }) : t('chat.quota.left', { n: quota });

  const composerDisabled = (selectedIds.length === 0 && !teachOn) || runtimeOff || outOfTries;
  const disabledReason = selectedIds.length === 0 && !teachOn ? t('chat.input.pick_first') : runtimeOff ? t('chat.runtime.off') : outOfTries ? t('chat.quota.none_short') : undefined;
  const keyLabel = !teacherKey ? undefined
    : teacherKey.name ? t('teach.key.chip', { name: teacherKey.name, short: shortKey(teacherKey.address) })
      : t('teach.key.chip_anon', { short: shortKey(teacherKey.address) });

  /**
   * The basket column: the panel, plus — above it — every correction this browser has saved under a DIFFERENT
   * selection, named and one click away (finding 14). Rendered in two places because a node that does not accept
   * lessons shows it under the picker instead of above it.
   */
  const basketPanel = policy && (
    <div ref={basketRef}>
      {improveFull && (
        <StrandedNote $tone="warning" role="status" data-testid="improve-full" style={{ marginBottom: 10 }}>
          <span>{t('chat.improve.full', { n: improveFull.n, max: improveFull.max }, improveFull.n)}</span>
          <button type="button" onClick={() => setImproveFull(null)}>{t('chat.improve.dismiss')}</button>
        </StrandedNote>
      )}
      {stranded.map((sb) => (
        <StrandedNote key={stackKey(sb.ids) || 'base'} $tone="info" role="status" data-testid="basket-stranded" style={{ marginBottom: 10 }}>
          <span>{sb.ids.length
            ? t('chat.basket.stranded', { n: sb.facts, names: sb.ids.map(nameOf).join(', ') }, sb.facts)
            : t('chat.basket.stranded_none', { n: sb.facts }, sb.facts)}</span>
          <button type="button" onClick={() => showStack(sb.ids)}>{t('chat.basket.stranded_go')}</button>
        </StrandedNote>
      ))}
      <LessonBasket basket={basket} policy={policy} stackNames={selectedList.map((e) => e.anchor.name)} expanded={basketOpen} onToggle={() => setBasketOpen((v) => !v)}
        baseCandidates={baseCandidates} onBase={(id) => updateBasket((b) => ({ ...b, base: id }))}
        onRemove={(id) => updateBasket((b) => ({ ...b, facts: b.facts.filter((f) => f.id !== id) }))} onBuildsOn={(v) => updateBasket((b) => ({ ...b, builds_on: v }))}
        onTrain={onTrain} onOpenMine={() => setParam('mine', '1')} keyLabel={keyLabel} />
    </div>
  );

  return (
    <PageWrapper $wide>
      <TitleRow>
        <Title title={`${help('liveTest')} (${tech('liveTest')})`}>{t('chat.title')}</Title>
        {/* Finding 35 — this tooltip was literally the serving endpoint ("http://localhost:8002"), an internal
            infrastructure fact with no meaning to a visitor and an invitation on a node reachable from the
            internet. /network gated the same two facts on the operator session in b4d4df7; the operator still
            gets the endpoint here, everyone else gets a sentence about what the chip means. */}
        {data && (
          <ModelChip title={isSignedIn ? data.runtime.api ?? undefined : t('chat.model_help')}>
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
          <Grid>
            <Side>
              {/* The basket heads the column when this node teaches (§5.5: the visitor must see it without scrolling past every knowledge card); a node that does not accept lessons shows the "does not accept" line under the picker instead. */}
              {teachOn && basketPanel}
              {/* D3: "your test" is driven by THIS TAB's in-flight request, so it must read `queue`, not `qs`.
                  RTK Query keeps `data` from the last fetch after the query is skipped, so once a visitor had run
                  one live test `qs.state` stayed 'running' for ever and every later holder — another visitor, a
                  verifier, another node — was announced as "Your test has the shared model". `queue` is undefined
                  unless a turn of this tab is actually pending, which is exactly the condition wanted here. */}
              <KnowledgePicker items={items} lessons={lessons} runtime={data.runtime} lock={data.lock} clockSkewMs={lockSkew}
                lockIsMine={queue?.state === 'running'} selectedIds={shownIds} mineJobId={cardJobId}
                onToggle={toggle} onReorder={reorder} onClear={clearSelection} applied={data.applied ?? []} overlaps={data.overlaps ?? []}
                dirty={data.dirty ?? []} elsewhere={data.elsewhere ?? []} operator={!!data.operator} />
              {!teachOn && basketPanel}
            </Side>

            {/* Finding 82 — the live region is the TRANSCRIPT, not the whole panel. On `Main` it wrapped the head,
                the picker's neighbours, the chips, the mode buttons, the composer and the quota footer: 742
                characters that a screen reader re-read in full every time anything changed, instead of the answer
                that just arrived. */}
            <Main>
              {selected && selectedList.length === 1 && (
                <>
                  <MainHead>
                    <h2>{selected.anchor.name}</h2>
                    <StatusChip status={selected.status} />
                    <small title={`${help('facts')} (${tech('facts')})`}>{t('units.facts', { n: num(selected.anchor.benchmark.queries) }, selected.anchor.benchmark.queries)}</small>
                    {/* Finding 228 — a retired version is pickable here; say what replaces it before the visitor
                        spends a free try, or a purchase, on an epoch the newer one already covers. */}
                    {selected.superseded_by?.[0] && (
                      <Replaced title={t('chat.head.replaced_help')}>{t('chat.head.replaced', { id: selected.superseded_by[0] })}</Replaced>
                    )}
                    <small style={{ marginLeft: 'auto' }}>
                      <StyledLink to={patchHref(selected)}>{t('common.details')} →</StyledLink>
                    </small>
                  </MainHead>
                  {selected.anchor.description && (
                    <HeadDesc title={selected.anchor.description} data-testid="chat-head-desc">{selected.anchor.description}</HeadDesc>
                  )}
                </>
              )}
              {selectedList.length > 1 && (
                <>
                  <MainHead>
                    <h2 title={t('chat.head.multi_help')}>{t('chat.head.multi', { n: selectedList.length })}</h2>
                    {/* Finding 63 — the head used to SUM the fact counts across knowledge the picker had just
                        called 88% identical: three KRX versions of 2,761 facts sharing 241,992 of ~270,053 memory
                        entries were advertised as "8,283 facts", three times the truth, next to the alert saying
                        so. Where any two of them overlap the total is not a total; the biggest of them is what can
                        honestly be claimed. (A knowledge registered without a count still renders the dash rather
                        than a made-up number.) */}
                    <small title={`${help('facts')} (${tech('facts')})`}>
                      {factsKnown
                        ? (stackOverlaps ? t('chat.head.facts_each', { n: num(Math.max(...selectedList.map((e) => e.anchor.benchmark.queries))) }) : t('units.facts', { n: num(selectedList.reduce((a, e) => a + e.anchor.benchmark.queries, 0)) }))
                        : t('units.facts', { n: num(null) })}
                    </small>
                    <small style={{ marginLeft: 'auto' }}>{t('chat.head.multi_help')}</small>
                  </MainHead>
                  <HeadList aria-label={t('chat.head.multi', { n: selectedList.length })}>
                    {selectedList.map((e, i) => (
                      <li key={e.anchor.id}>
                        <b>{i + 1}</b>
                        <StyledLink to={patchHref(e)} title={t('common.details')}>{e.anchor.name}</StyledLink>
                        <StatusChip status={e.status} />
                        {/* Finding 228 — two of the three pickable items on this node are replaced versions. */}
                        {e.superseded_by?.[0] && <Replaced title={t('chat.head.replaced_help')}>{t('chat.head.replaced', { id: e.superseded_by[0] })}</Replaced>}
                      </li>
                    ))}
                  </HeadList>
                </>
              )}
              {/* Findings 218 + 228 — the set as an object: a link that reproduces it in this order, and what
                  owning all of it costs, instead of three prices in three cards and no total anywhere. */}
              {selectedList.length > 1 && (
                <HeadActions data-testid="chat-stack-actions">
                  <button type="button" onClick={copyLink} data-testid="chat-copy-link">{copied ? t('chat.head.copied') : t('chat.head.copy')}</button>
                  {stackPrice.length > 0 && (
                    <span title={t('chat.head.own_help')}>{t('chat.head.own', { n: selectedList.length, price: stackPrice.join(' + ') })}</span>
                  )}
                </HeadActions>
              )}
              {/* D2: a knowledge trained and verified only in the completion form answers a chat-format question
                  less well (measured 6/6 vs 4/6). Say so rather than silently switching the live test's form. */}
              {templateOnly.length > 0 && (
                <Alert $tone="info" role="status" style={{ marginBottom: 12 }} data-testid="chat-format-note">
                  {t('chat.samples.format_note')}
                </Alert>
              )}
              <Transcript aria-live="polite" aria-atomic="false">
                {policy && cardJobId && !cardHidden && (
                  <LessonCard key={cardJobId} jobId={cardJobId} policy={policy} nodeAddress={info?.node.address} teacherAddress={teacherKey?.address}
                    onTry={(j) => { void onTry(j); }} onPublish={(j) => openSheet('publish', j)} onKeep={(j) => openSheet('keep', j)} onImprove={onImprove} onHide={hideCard} />
                )}
                {turns.length === 0 ? (
                  /* Finding 78 — with the model server off, the biggest text on the screen used to tell the
                     visitor to click a sample question, pointing at greyed-out chips. Say what is actually
                     happening, in the middle of the panel where they are looking. */
                  <EmptyState>
                    {runtimeOff
                      ? <><b>{t('chat.runtime.off')}</b>{t('chat.runtime.off_detail')}</>
                      : <><b>{t('chat.empty.title')}</b>{t('chat.empty.body')}</>}
                  </EmptyState>
                ) : turns.map((turn, i) => {
                  // Finding 14: the questions stay, so each run of them says what was loaded when it was asked. A
                  // conversation that never changed selection carries no marks at all.
                  const marked = i === 0 ? mixedStacks : stackKey(turn.patchIds) !== stackKey(turns[i - 1].patchIds);
                  const names = turn.patchNames?.length ? turn.patchNames : (turn.patchIds ?? []).map(nameOf);
                  return (
                    <Fragment key={turn.id}>
                      {marked && (
                        <StackMark data-testid="chat-stack-mark" title={t('chat.turn.stack_help')}>
                          <b>{names.length ? t('chat.turn.stack', { names: names.join(', ') }) : t('chat.turn.stack_none')}</b>
                        </StackMark>
                      )}
                      <TurnView turn={turn.id === pending?.id ? { ...turn, queue } : turn} onRetry={retry} onAskAgain={askAgain} onTeach={teachOn ? onTeach : undefined} nameOf={nameOf}
                        innerRef={i === turns.length - 1 ? lastTurnRef : undefined} />
                    </Fragment>
                  );
                })}
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
                samples={samples} samplesGloss={samplesGloss}
                onSend={(text) => { void send(text); }} onClear={clear} canClear={turns.length > 0}
                footer={quotaOffer || quotaText} prefill={askParam} restore={restore}
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
        <TeachDrawer question={drawer.question} modelAnswer={drawer.answer} max={factsPerJob} limits={policy?.limits}
          // editing one the lesson already holds replaces it in place, so a full lesson is not a reason to refuse
          full={!drawer.editId && basket.facts.length >= factsPerJob}
          initial={drawer.initial} focusAlt={drawer.focusAlt}
          labels={drawer.editId ? { title: t('chat.improve.title'), sub: t('chat.improve.sub'), add: t('chat.improve.save') } : undefined}
          onAdd={addCorrection} onClose={() => setDrawer(null)} />
      )}
      {sheet === 'credit' && <CreditSheet onDone={(k) => { setTeacherKey(k); setSheet('preflight'); }} onClose={() => setSheet(null)} />}
      {sheet === 'preflight' && policy && (
        <PreflightSheet patchIds={selectedIds} basket={basket} policy={policy} baseCandidates={baseCandidates} onBasket={updateBasket} contributorName={teacherKey?.name} onQueued={onQueued} onClose={() => setSheet(null)} />
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

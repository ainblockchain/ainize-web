import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useChatMutation, useChatPatchesQuery } from '@/api/api';
import type { ChatMessage } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { KnowledgePicker } from '@/components/chat/KnowledgePicker';
import { TurnView, type Turn } from '@/components/chat/TurnView';
import { MAX_HISTORY, answerHits, matchSampleAny, parseSelection, selectionPath, MAX_CHAT_PATCHES, type ChatModeKind } from '@/components/chat/util';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, Description, PageWrapper, StatusChip, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { num } from '@/utils/format';

/* ---------------------------------------------------------------- layout */
const Grid = styled.div`
  display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 24px; align-items: start; margin-top: 24px;
  @media (max-width: ${(p) => p.theme.breakpoint.md}px) { grid-template-columns: 1fr; }
`;
const Main = styled.section`
  display: flex; flex-direction: column; min-width: 0; background: #fafafa; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  min-height: 560px; max-height: calc(100vh - 200px);
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
  flex: 1; overflow-y: auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 24px;
`;
const EmptyState = styled.div`
  margin: auto; max-width: 48ch; text-align: center; color: ${(p) => p.theme.color.GREY}; font-size: 14px; line-height: 1.6;
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
const CancelRow = styled.div`
  display: flex; align-items: center; justify-content: center; gap: 12px; padding: 8px 16px; background: #fff; border-top: 1px dashed ${(p) => p.theme.color.LIGHT_GREY};
  font-size: 12px; color: ${(p) => p.theme.color.GREY};
`;

/* ---------------------------------------------------------------- helpers */
type Tr = (key: string, vars?: Record<string, string | number>) => string;

/** Turn server / transport errors into one plain-language sentence. */
function mapChatError(err: unknown, t: Tr): string {
  const e = err as { status?: number | string; name?: string } | undefined;
  const raw = errorMessage(err);
  const m = raw.toLowerCase();
  if (e?.name === 'AbortError' || m.includes('aborted')) return t('chat.err.cancelled');
  if (e?.status === 'FETCH_ERROR') return t('chat.err.network');
  if (e?.status === 'TIMEOUT_ERROR' || m.includes('timeout') || m.includes('timed out')) return t('chat.err.timeout');
  if (m.includes('does not hold the patch body')) return t('chat.err.no_body');
  if (e?.status === 429 || m.includes('quota')) return t('chat.err.quota');
  if (m.includes('runtime busy')) return t('chat.err.busy');
  if (m.includes('runtime unavailable') || m.includes('unreachable') || m.includes('econnrefused') || m.includes('not available') || m.includes('not responding')) return t('chat.err.runtime');
  if (m.includes('patch targets')) return t('chat.err.model');
  if (m.includes('patch not found')) return t('chat.err.not_found');
  if (m.includes('at most') && m.includes('together')) return t('chat.picker.max');
  if (e?.status === 400) return t('chat.err.too_long');
  return t('chat.err.generic', { message: raw });
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Build the outgoing history: only completed turns with a NON-EMPTY answer, capped to the server limit. */
function buildHistory(prior: Turn[], text: string): ChatMessage[] {
  const history: ChatMessage[] = [];
  for (const tr of prior) {
    if (tr.status !== 'done' || !tr.response) continue;
    const a = tr.response.patched ?? tr.response.base;
    const answer = a?.content?.trim();
    if (!answer) continue;                 // empty answers stay visible in the UI but never go back to the model
    history.push({ role: 'user', content: tr.prompt });
    history.push({ role: 'assistant', content: answer });
  }
  const capped = history.slice(-MAX_HISTORY);
  capped.push({ role: 'user', content: text });
  return capped;
}

/* ---------------------------------------------------------------- page */
export default function ChatPage() {
  const { t, help, tech, audience } = useT();
  const { patchId } = useParams<{ patchId: string }>();
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const { data, isLoading, error } = useChatPatchesQuery(undefined, { pollingInterval: 20_000 });
  const [sendChat, { isLoading: busy }] = useChatMutation();
  const inflight = useRef<{ abort: () => void } | null>(null);

  const items = useMemo(() => data?.items ?? [], [data]);
  const lessons = useMemo(() => data?.lessons ?? [], [data]);
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

  const [mode, setMode] = useState<ChatModeKind>('compare');
  const [thinking, setThinking] = useState(false);
  const [transcripts, setTranscripts] = useState<Record<string, Turn[]>>({});
  /** undefined = not asked yet; null = unlimited (operator); number = remaining free tries */
  const [quota, setQuota] = useState<number | null | undefined>(undefined);
  const [quotaLimit, setQuotaLimit] = useState<number | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [missingId, setMissingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Preselect from the route; fall back to the first testable knowledge (and remember what the route asked for).
  // Ids the route names but this node cannot test are dropped from the address (and reported once).
  useEffect(() => {
    if (!data || items.length === 0) return;
    const missing = routeIds.filter((id) => !selectedIds.includes(id));
    if (missing.length > 0) {
      setMissingId(missing.join(', '));
      navigate(selectedIds.length ? selectionPath(selectedIds) : '/chat', { replace: true });
      return;
    }
    if (selectedIds.length === 0 && !userCleared.current) navigate(selectionPath([items[0].anchor.id]), { replace: true });
  }, [data, items, routeIds, selectedIds, navigate]);

  // Abort any in-flight request when leaving the page.
  useEffect(() => () => { inflight.current?.abort(); }, []);

  const turns = useMemo(() => (selectionKey ? transcripts[selectionKey] ?? [] : []), [transcripts, selectionKey]);
  const lastStatus = turns[turns.length - 1]?.status;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [turns.length, lastStatus]);

  const patchTurns = useCallback((pid: string, fn: (prev: Turn[]) => Turn[]) => {
    setTranscripts((prev) => ({ ...prev, [pid]: fn(prev[pid] ?? []) }));
  }, []);

  const send = useCallback(async (text: string, opts?: { mode?: ChatModeKind; thinking?: boolean; replaceId?: string }) => {
    if (selectedIds.length === 0 || busy || exhausted) return;
    const pid = selectionKey;
    const ids = selectedIds;
    const useMode = opts?.mode ?? mode;
    const useThinking = opts?.thinking ?? thinking;
    const sample = matchSampleAny(selectedList, text);
    const id = newId();
    const prior = (transcripts[pid] ?? []).filter((x) => x.id !== opts?.replaceId);
    const history = buildHistory(prior, text);

    const turn: Turn = { id, prompt: text, mode: useMode, thinking: useThinking, status: 'pending', expect: sample?.expect, patchIds: ids };
    patchTurns(pid, (prev) => [...prev.filter((x) => x.id !== opts?.replaceId), turn]);
    // one knowledge → patch_id (works on every node); several → patch_ids (teach-mode nodes)
    const target = ids.length === 1 ? { patch_id: ids[0] } : { patch_ids: ids };
    const request = sendChat({ ...target, mode: useMode, messages: history, thinking: useThinking });
    inflight.current = request;
    try {
      const res = await request.unwrap();
      setQuota(res.remaining_quota);
      if (res.quota_limit !== undefined) setQuotaLimit(res.quota_limit);
      if (res.remaining_quota !== null && res.remaining_quota <= 0) setExhausted(true);
      patchTurns(pid, (prev) => prev.map((x) => (x.id === id ? { ...x, status: 'done', response: res, baseHit: answerHits(res.base?.content, sample?.expect) } : x)));
    } catch (err) {
      const e = err as { status?: number | string } | undefined;
      if (e?.status === 429) { setQuota(0); setExhausted(true); }
      const msg = mapChatError(err, t);
      patchTurns(pid, (prev) => prev.map((x) => (x.id === id ? { ...x, status: 'error', error: msg } : x)));
    } finally {
      if (inflight.current === request) inflight.current = null;
    }
  }, [selectedIds, selectedList, selectionKey, busy, exhausted, mode, thinking, transcripts, patchTurns, sendChat, t]);

  const cancel = useCallback(() => { inflight.current?.abort(); }, []);
  const retry = useCallback((turn: Turn) => { void send(turn.prompt, { mode: turn.mode, thinking: turn.thinking, replaceId: turn.id }); }, [send]);
  const clear = useCallback(() => { if (selectionKey) patchTurns(selectionKey, () => []); }, [selectionKey, patchTurns]);
  const toggle = useCallback((id: string) => {
    setMissingId(null);
    userCleared.current = false;
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : selectedIds.length >= MAX_CHAT_PATCHES ? selectedIds : [...selectedIds, id];
    if (next.length === 0) userCleared.current = true;
    navigate(next.length ? selectionPath(next) : '/chat');
  }, [selectedIds, navigate]);
  const clearSelection = useCallback(() => { userCleared.current = true; setMissingId(null); navigate('/chat'); }, [navigate]);
  /** Sample questions of every selected knowledge (deduplicated by prompt), in load order. */
  const samples = useMemo(() => {
    const seen = new Set<string>();
    const out: { prompt: string; expect: string }[] = [];
    for (const e of selectedList) for (const s of e.anchor.benchmark.samples ?? []) { const k = s.prompt.trim(); if (!seen.has(k)) { seen.add(k); out.push(s); } }
    return out;
  }, [selectedList]);

  const quotaText = isSignedIn || quota === null
    ? t('chat.quota.operator')
    : quota === undefined ? t('chat.quota.visitor')
      : exhausted || quota <= 0 ? t('chat.quota.none')
        : quotaLimit ? t('chat.quota.left_of', { n: quota, limit: quotaLimit }) : t('chat.quota.left', { n: quota });

  const composerDisabled = selectedIds.length === 0 || runtimeOff || (exhausted && !isSignedIn);
  const disabledReason = selectedIds.length === 0 ? t('chat.input.pick_first') : runtimeOff ? t('chat.runtime.off') : exhausted && !isSignedIn ? t('chat.quota.none') : undefined;

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
          {missingId && <Alert $tone="warning" style={{ marginTop: 16 }}>{t('chat.picker.route_missing', { id: missingId })}</Alert>}
          {exhausted && !isSignedIn && <Alert $tone="warning" style={{ marginTop: 16 }} role="status">{t('chat.quota.none')}</Alert>}
          <Grid>
            <KnowledgePicker items={items} lessons={lessons} runtime={data.runtime} lock={data.lock} selectedIds={selectedIds}
              onToggle={toggle} onClear={clearSelection} applied={data.applied ?? []} overlaps={data.overlaps ?? []} />

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
              <Transcript ref={scrollRef}>
                {turns.length === 0 ? (
                  <EmptyState><b>{t('chat.empty.title')}</b>{t('chat.empty.body')}</EmptyState>
                ) : turns.map((turn) => <TurnView key={turn.id} turn={turn} onRetry={retry} />)}
              </Transcript>
              {busy && (
                <CancelRow role="status">
                  <span>{t('chat.input.in_flight')}</span>
                  <Button size="small" color="secondary" onClick={cancel}>{t('chat.input.cancel')}</Button>
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
    </PageWrapper>
  );
}

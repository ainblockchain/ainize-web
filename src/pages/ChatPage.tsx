import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useChatMutation, useChatPatchesQuery } from '@/api/api';
import type { ChatMessage } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { KnowledgePicker } from '@/components/chat/KnowledgePicker';
import { TurnView, type Turn } from '@/components/chat/TurnView';
import { MAX_HISTORY, answerHits, matchSample, type ChatModeKind } from '@/components/chat/util';
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
  if (e?.status === 503 || m.includes('runtime unavailable') || m.includes('model unavailable') || m.includes('unreachable') || m.includes('econnrefused') || m.includes('not available') || m.includes('not responding')) return t('chat.err.runtime');
  if (m.includes('patch targets')) return t('chat.err.model');
  if (m.includes('patch not found')) return t('chat.err.not_found');
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
  const { data, isLoading, error, refetch } = useChatPatchesQuery(undefined, { pollingInterval: 20_000 });
  const [sendChat, { isLoading: busy }] = useChatMutation();
  const inflight = useRef<{ abort: () => void } | null>(null);

  const items = useMemo(() => data?.items ?? [], [data]);
  const selected = useMemo(() => items.find((e) => e.anchor.id === patchId), [items, patchId]);
  const runtimeOff = !!data && !data.runtime.available;

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
  useEffect(() => {
    if (!data || selected || items.length === 0) return;
    if (patchId) setMissingId(patchId);
    navigate(`/chat/${encodeURIComponent(items[0].anchor.id)}`, { replace: true });
  }, [data, selected, items, patchId, navigate]);

  // Abort any in-flight request when leaving the page.
  useEffect(() => () => { inflight.current?.abort(); }, []);

  const turns = useMemo(() => (selected ? transcripts[selected.anchor.id] ?? [] : []), [transcripts, selected]);
  const lastStatus = turns[turns.length - 1]?.status;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [turns.length, lastStatus]);

  const patchTurns = useCallback((pid: string, fn: (prev: Turn[]) => Turn[]) => {
    setTranscripts((prev) => ({ ...prev, [pid]: fn(prev[pid] ?? []) }));
  }, []);

  const send = useCallback(async (text: string, opts?: { mode?: ChatModeKind; thinking?: boolean; replaceId?: string }) => {
    if (!selected || busy || exhausted) return;
    const pid = selected.anchor.id;
    const useMode = opts?.mode ?? mode;
    const useThinking = opts?.thinking ?? thinking;
    const sample = matchSample(selected, text);
    const id = newId();
    const prior = (transcripts[pid] ?? []).filter((x) => x.id !== opts?.replaceId);
    const history = buildHistory(prior, text);

    const turn: Turn = { id, prompt: text, mode: useMode, thinking: useThinking, status: 'pending', expect: sample?.expect };
    patchTurns(pid, (prev) => [...prev.filter((x) => x.id !== opts?.replaceId), turn]);
    const request = sendChat({ patch_id: pid, mode: useMode, messages: history, thinking: useThinking });
    inflight.current = request;
    // show the shared-model lock (held by this very request, or by someone ahead of it) right away instead of on the next 20 s poll
    const lockPeek = setTimeout(() => { void refetch(); }, 800);
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
      clearTimeout(lockPeek);
      if (inflight.current === request) inflight.current = null;
      void refetch();   // lock released (or still queued) — refresh the banner without waiting for the poll
    }
  }, [selected, busy, exhausted, mode, thinking, transcripts, patchTurns, sendChat, refetch, t]);

  const cancel = useCallback(() => { inflight.current?.abort(); }, []);
  const retry = useCallback((turn: Turn) => { void send(turn.prompt, { mode: turn.mode, thinking: turn.thinking, replaceId: turn.id }); }, [send]);
  const clear = useCallback(() => { if (selected) patchTurns(selected.anchor.id, () => []); }, [selected, patchTurns]);

  const quotaText = isSignedIn || quota === null
    ? t('chat.quota.operator')
    : quota === undefined ? t('chat.quota.visitor')
      : exhausted || quota <= 0 ? t('chat.quota.none')
        : quotaLimit ? t('chat.quota.left_of', { n: quota, limit: quotaLimit }) : t('chat.quota.left', { n: quota });

  const composerDisabled = !selected || runtimeOff || (exhausted && !isSignedIn);
  const disabledReason = !selected ? t('chat.input.pick_first') : runtimeOff ? t('chat.runtime.off') : exhausted && !isSignedIn ? t('chat.quota.none') : undefined;

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
            <KnowledgePicker items={items} runtime={data.runtime} lock={data.lock} selectedId={selected?.anchor.id ?? null}
              onSelect={(id) => { setMissingId(null); navigate(`/chat/${encodeURIComponent(id)}`); }} />

            <Main aria-live="polite">
              {selected && (
                <MainHead>
                  <h2>{selected.anchor.name}</h2>
                  <StatusChip status={selected.status} />
                  <small title={`${help('facts')} (${tech('facts')})`}>{t('units.facts', { n: num(selected.anchor.benchmark.queries) })}</small>
                  <small style={{ marginLeft: 'auto' }}>
                    <StyledLink to={`/${encodeURIComponent(selected.anchor.author)}/${encodeURIComponent(selected.anchor.id)}`}>{t('common.details')} →</StyledLink>
                  </small>
                </MainHead>
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
                samples={selected?.anchor.benchmark.samples ?? []}
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

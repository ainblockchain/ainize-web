import { useState } from 'react';
import { Link } from 'react-router';
import styled, { keyframes } from 'styled-components';
import type { ChatResponse, ChatResult } from '@/api/types';
import { useT } from '@/i18n';
import { MarkWrong } from './MarkWrong';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { fmtMs, type ChatModeKind, type ChatQueueView } from './util';

export interface Turn {
  id: string;
  prompt: string;
  mode: ChatModeKind;
  thinking: boolean;
  status: 'pending' | 'done' | 'error';
  response?: ChatResponse;
  error?: string;
  /** Benchmark sample matched to this prompt (client-side), used to label ✓/✗ and the base bubble. */
  expect?: string;
  baseHit?: boolean | null;
  /** Knowledge loaded for this turn, in load order (mirrors the request; the response repeats it as patch_ids). */
  patchIds?: string[];
  /** D3 — the id this turn was sent with, and where it is in the queue behind the shared model. */
  requestId?: string;
  queue?: ChatQueueView;
  /**
   * Can this failure be retried at all? False for the quota 429, where send() returns at the `exhausted` guard and
   * the click issues no request whatsoever. Undefined means "yes" — every transport, runtime and cancelled turn,
   * whose Retry does send.
   */
  retryable?: boolean;
  /** Quota exhausted (429): what CAN be done instead of retrying — buy the knowledge, or wait out the measured hour. */
  quota?: { resetAt: number | null; buyHref: string | null };
}

const Wrap = styled.article`display: flex; flex-direction: column; gap: 10px;`;
const UserRow = styled.div`display: flex; justify-content: flex-end;`;
const UserBubble = styled.div`
  max-width: 78%; padding: 10px 14px; border-radius: 14px 14px 2px 14px; background: ${(p) => p.theme.color.PRIMARY}; color: #fff;
  font-size: 14px; line-height: 1.55; white-space: pre-wrap; word-break: break-word;
  span { display: block; font-size: 11px; opacity: 0.8; margin-bottom: 2px; }
`;
const Pair = styled.div<{ $cols: number }>`
  display: grid; gap: 12px; grid-template-columns: repeat(${(p) => p.$cols}, minmax(0, 1fr));
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { grid-template-columns: 1fr; }
`;
const Bubble = styled.div<{ $kind: 'base' | 'patched' }>`
  display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; background: #fff; border-radius: 14px 14px 14px 2px;
  border: 1px solid ${(p) => (p.$kind === 'patched' ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)};
  ${(p) => p.$kind === 'patched' && `box-shadow: 0 0 0 3px ${p.theme.color.PALE_GREY};`}
`;
const BubbleHead = styled.div`display: flex; align-items: center; gap: 8px; flex-wrap: wrap;`;
const Label = styled.span<{ $kind: 'base' | 'patched' }>`
  font-size: 12px; font-weight: 700; letter-spacing: 0.02em; padding: 2px 8px; border-radius: 10px;
  color: ${(p) => (p.$kind === 'patched' ? '#fff' : p.theme.color.GREY)};
  background: ${(p) => (p.$kind === 'patched' ? p.theme.color.PRIMARY : '#f2f2f2')};
`;
const Meta = styled.span`font-size: 11px; color: ${(p) => p.theme.color.GREY}; font-variant-numeric: tabular-nums;`;
const Hit = styled.span<{ $ok: boolean }>`
  margin-left: auto; display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 10px;
  color: ${(p) => (p.$ok ? '#1e6b36' : '#a0102c')}; background: ${(p) => (p.$ok ? '#e6f4ea' : '#fde8ec')};
`;
const Unknown = styled.span`margin-left: auto; font-size: 11px; color: ${(p) => p.theme.color.GREY};`;
/**
 * The benchmark's expected answer, in text, under the verdict chip. The tick and the cross are a claim about an
 * answer nobody could read: the expectation used to live only in a `title` attribute, so on a phone or a tablet the
 * justification for "✗ Wrong" simply did not exist. The tooltip keeps the longer sentence.
 */
const Expected = styled.div`
  align-self: flex-end; margin-top: -2px; font-size: 11px; line-height: 1.4; color: ${(p) => p.theme.color.GREY};
  b { font-weight: 600; color: ${(p) => p.theme.color.DARK_GREY}; font-family: ${(p) => p.theme.font.mono}; }
`;
const Answer = styled.div`font-size: 14px; line-height: 1.6; color: ${(p) => p.theme.color.BLACK}; white-space: pre-wrap; word-break: break-word;`;
const EmptyAnswer = styled.span`color: ${(p) => p.theme.color.GREY}; font-style: italic;`;
const Reasoning = styled.details`
  font-size: 12px; color: ${(p) => p.theme.color.GREY};
  summary { cursor: pointer; color: ${(p) => p.theme.color.PRIMARY}; }
  pre { margin: 6px 0 0; white-space: pre-wrap; word-break: break-word; font-family: inherit; max-height: 240px; overflow: auto; padding: 8px 10px; background: #fafafa; border-radius: 4px; }
`;
const blink = keyframes`0%, 80%, 100% { opacity: 0.2; } 40% { opacity: 1; }`;
const Dots = styled.span`
  display: inline-flex; gap: 4px; align-items: center; height: 20px;
  i { width: 6px; height: 6px; border-radius: 50%; background: ${(p) => p.theme.color.PRIMARY}; animation: ${blink} 1.2s infinite ease-in-out; }
  i:nth-child(2) { animation-delay: 0.15s; } i:nth-child(3) { animation-delay: 0.3s; }
`;
const PendingNote = styled.span`font-size: 12px; color: ${(p) => p.theme.color.GREY};`;
/** D3 — the queue lines inside the pending bubble, where the visitor is actually looking. */
const QueueNote = styled.div`
  display: flex; flex-direction: column; gap: 2px; font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.DARK_GREY};
  b { font-weight: 600; }
  small { color: ${(p) => p.theme.color.GREY}; font-variant-numeric: tabular-nums; }
`;
/** D1 — one plain sentence about a cut answer, plus the raw text on demand. */
const TruncNote = styled.div`
  margin-top: 2px; padding: 8px 10px; border-radius: 4px; background: #fff8e6; border: 1px solid #f0d9a0;
  font-size: 12px; line-height: 1.5; color: #6b4f00;
  button { margin-top: 4px; padding: 0; border: 0; background: none; color: ${(p) => p.theme.color.PRIMARY}; font-size: 12px; font-weight: 600; cursor: pointer; text-decoration: underline; }
  small { display: block; margin-top: 2px; opacity: 0.8; font-variant-numeric: tabular-nums; }
  pre { margin: 6px 0 0; white-space: pre-wrap; word-break: break-word; font-family: inherit; max-height: 240px; overflow: auto; padding: 8px 10px; background: #fffdf7; border-radius: 4px; }
`;
const LoadList = styled.ol`
  margin: 0; padding: 0 0 0 18px; font-size: 11px; line-height: 1.5; color: ${(p) => p.theme.color.GREY}; font-variant-numeric: tabular-nums;
  code { font-family: ${(p) => p.theme.font.mono}; color: ${(p) => p.theme.color.DARK_GREY}; }
`;
const HitRow = styled.div`display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 11px; color: ${(p) => p.theme.color.GREY};`;
const MiniHit = styled.span<{ $ok: boolean }>`
  display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 8px;
  color: ${(p) => (p.$ok ? '#1e6b36' : '#a0102c')}; background: ${(p) => (p.$ok ? '#e6f4ea' : '#fde8ec')};
  code { font-family: inherit; font-weight: 500; }
`;
const ErrRow = styled.div`display: flex; flex-direction: column; gap: 8px; align-items: flex-start;`;
/** What replaces Retry on a quota error: the way out (buy) and the measured instant the free hour resets. */
const QuotaRow = styled.div`
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; font-size: 12px; color: ${(p) => p.theme.color.GREY};
  a { color: ${(p) => p.theme.color.PRIMARY}; font-weight: 600; text-decoration: none; &:hover { text-decoration: underline; } }
`;
const TeachBtn = styled.button`
  align-self: flex-start; margin-top: 2px; padding: 3px 10px; border-radius: 12px; border: 1px dashed ${(p) => p.theme.color.PRIMARY}; background: #fff; color: ${(p) => p.theme.color.PRIMARY}; font-size: 12px; font-weight: 600; cursor: pointer;
  &:hover { background: ${(p) => p.theme.color.PALE_GREY}; }
`;

/**
 * D1 — the answer was cut. One plain sentence about WHY, and the model's raw output one click away: the guard
 * has precision 1.000 on 293 real answers but no content-only rule can be perfect, so nothing is ever deleted.
 */
function Truncation({ result }: { result: ChatResult }) {
  const { t } = useT();
  const [raw, setRaw] = useState(false);
  if (!result.truncated) return null;
  const shown = result.shown_chars ?? result.content.length;
  const full = result.raw_chars ?? shown;
  const empty = !result.content.trim();
  return (
    <TruncNote role="note" data-testid="chat-truncated" data-truncated={result.truncated}>
      {result.truncated === 'repetition' ? t('chat.trunc.repetition') : empty ? t('chat.trunc.empty') : t('chat.trunc.length')}
      {result.truncated === 'repetition' && (
        <>
          <small>{t('chat.trunc.shown', { shown, raw: full })}</small>
          {result.raw_content && (
            <>
              <button type="button" onClick={() => setRaw((v) => !v)} aria-expanded={raw} data-testid="chat-raw-toggle">
                {raw ? t('chat.trunc.hide_raw') : t('chat.trunc.show_raw', { raw: full })}
              </button>
              {raw && <pre data-testid="chat-raw-answer">{result.raw_content}</pre>}
            </>
          )}
        </>
      )}
    </TruncNote>
  );
}

/**
 * D3 — what a pending turn says. A request waiting behind the shared model used to show only "this can take tens
 * of seconds" while the picker column claimed, in retry language, that the test had failed. Now the transcript
 * itself says it is queued, who holds the model, and for how long — with a ticking second counter.
 */
function QueuePending({ turn }: { turn: Turn }) {
  const { t } = useT();
  const q = turn.queue;
  const base = `${turn.mode === 'compare' ? t('chat.bubble.compare_pending') : t('chat.bubble.thinking_pending')}${turn.thinking ? ` · ${t('chat.thinking.slow')}` : ''}`;
  if (!q || q.state === 'running') {
    return <PendingNote>{q?.state === 'running' ? `${t('chat.queue.mine')} ${base}` : base}</PendingNote>;
  }
  const secs = Math.floor(q.waited_ms / 1000);
  const mins = Math.floor(secs / 60);
  return (
    <QueueNote data-testid="chat-queued">
      <b>{mins >= 1 ? t('chat.queue.long', { n: mins }) : t('chat.queue.waiting')}</b>
      {q.holder && <span>{t('chat.queue.holder', { label: q.holder.label, since: q.holder.since })}</span>}
      {q.position > 1 && <span>{t('chat.queue.position', { n: q.position })}</span>}
      {/* aria-hidden: the live region announces the state once, not once per second */}
      <small aria-hidden="true">{t('chat.queue.elapsed', { n: secs })}</small>
    </QueueNote>
  );
}

function AnswerBubble({ kind, result, turn, hit, onTeach, nameOf }: { kind: 'base' | 'patched'; result: ChatResult | null | undefined; turn: Turn; hit: boolean | null | undefined; onTeach?: (answer: string) => void; nameOf?: (id: string) => string }) {
  const { t, help, locale } = useT();
  const pending = turn.status === 'pending';
  const applied = kind === 'patched' && turn.response ? turn.response.applied_ms : null;
  const ids = turn.response?.patch_ids?.length ? turn.response.patch_ids : turn.patchIds ?? [];
  const multi = ids.length > 1;
  const perPatch = multi ? turn.response?.applied ?? [] : [];
  const hits = multi ? turn.response?.benchmark_hits ?? {} : {};
  const scored = Object.entries(hits).filter(([, h]) => h === true || h === false) as [string, boolean][];
  const patchedLabel = multi ? t('chat.bubble.patched_multi', { n: ids.length }) : t('chat.bubble.patched');
  return (
    <Bubble $kind={kind} aria-busy={pending}>
      <BubbleHead>
        <Label $kind={kind} title={kind === 'patched' ? t('chat.bubble.patched_help') : t('chat.bubble.base_help')}>{kind === 'patched' ? patchedLabel : t('chat.bubble.base')}</Label>
        {result && <Meta>{t('chat.bubble.latency', { ms: fmtMs(result.latency_ms, locale) })}</Meta>}
        {kind === 'patched' && turn.response && (applied !== null
          ? <Meta title={help('apply')}>· {t('chat.bubble.applied', { ms: fmtMs(applied, locale) })}</Meta>
          : turn.response.was_applied ? <Meta title={help('apply')}>· {t('chat.bubble.already_applied')}</Meta> : null)}
        {!pending && result && (hit === true || hit === false
          ? <Hit $ok={hit} title={t('chat.hit.help', { expect: turn.expect ?? '' })}>{hit ? '✓' : '✗'} {hit ? t('chat.hit.yes') : t('chat.hit.no')}</Hit>
          : <Unknown>{t('chat.hit.unknown')}</Unknown>)}
      </BubbleHead>
      {!pending && result && turn.expect && (hit === true || hit === false) && (
        <Expected data-testid={`chat-expected-${kind}`}>{t('chat.hit.expected')} <b>{turn.expect}</b></Expected>
      )}
      {kind === 'patched' && !pending && perPatch.length > 0 && (
        <LoadList title={t('chat.head.multi_help')}>
          {perPatch.map((x) => (
            <li key={x.patch_id}>
              <code>{x.patch_id}</code>: {x.applied_ms !== null ? t('chat.bubble.applied', { ms: fmtMs(x.applied_ms, locale) }) : x.was_applied ? t('chat.bubble.already_applied') : '—'}
            </li>
          ))}
        </LoadList>
      )}
      {kind === 'patched' && !pending && scored.length > 0 && (
        <HitRow>
          {scored.map(([id, ok]) => (
            <MiniHit key={id} $ok={ok} title={t('chat.hit.per_patch', { id })}><code>{id}</code> {ok ? '✓' : '✗'} {ok ? t('chat.hit.yes') : t('chat.hit.no')}</MiniHit>
          ))}
        </HitRow>
      )}
      {pending ? (
        <>
          <Dots aria-label={t('chat.bubble.thinking_pending')}><i /><i /><i /></Dots>
          <QueuePending turn={turn} />
        </>
      ) : (
        <>
          <Answer>{result?.content?.trim() ? result.content.trim() : <EmptyAnswer>{t('chat.bubble.empty_answer')}</EmptyAnswer>}</Answer>
          {result && <Truncation result={result} />}
          {result?.reasoning && (<Reasoning><summary>{t('chat.bubble.reasoning')}</summary><pre>{result.reasoning}</pre></Reasoning>)}
          {onTeach && result && <TeachBtn type="button" onClick={() => onTeach(result.content?.trim() ?? '')} data-testid={`teach-${kind}`}>{t('chat.turn.teach')}</TeachBtn>}
          {/* SC-13: only under the answer the loaded knowledge produced — the bare model's answer is not its creator's business. */}
          {kind === 'patched' && result && turn.response?.turn_id && ids.length > 0 && (
            <MarkWrong turnId={turn.response.turn_id} patchIds={ids} name={nameOf?.(ids[0]) ?? ids[0]} />
          )}
        </>
      )}
    </Bubble>
  );
}

export function TurnView({ turn, onRetry, onTeach, nameOf, innerRef }: { turn: Turn; onRetry?: (turn: Turn) => void; /** teach mode: "Teach the right answer" under each reply */ onTeach?: (turn: Turn, answer: string) => void; /** id → the knowledge's name, for the SC-13 consent line */ nameOf?: (id: string) => string;
  /**
   * Finding 19 — the page puts THIS element on screen when it is the newest turn. Scrolling the transcript box to its
   * own bottom does nothing below md, where the panel is un-clamped and the page is the scroller.
   */
  innerRef?: React.Ref<HTMLElement> }) {
  const { t, locale } = useT();
  const showBase = turn.mode === 'compare' || turn.mode === 'base';
  const showPatched = turn.mode === 'compare' || turn.mode === 'patched';
  const r = turn.response;
  const patchedHit = r?.benchmark_hit ?? null;
  return (
    <Wrap ref={innerRef}>
      <UserRow><UserBubble><span>{t('chat.turn.you')}</span>{turn.prompt}</UserBubble></UserRow>
      {turn.status === 'error' ? (
        <ErrRow>
          <Alert $tone="error" role="alert">{turn.error}</Alert>
          {turn.quota ? (
            <QuotaRow data-testid="chat-quota-actions">
              {turn.quota.buyHref && <Link to={turn.quota.buyHref}>{t('chat.quota.buy')}</Link>}
              {turn.quota.resetAt !== null && <span>{t('chat.quota.resets_at', { time: new Date(turn.quota.resetAt).toLocaleTimeString(locale === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit' }) })}</span>}
            </QuotaRow>
          ) : onRetry && turn.retryable !== false && <Button size="small" onClick={() => onRetry(turn)}>{t('chat.turn.retry')}</Button>}
        </ErrRow>
      ) : (
        <Pair $cols={showBase && showPatched ? 2 : 1}>
          {showBase && <AnswerBubble kind="base" result={r?.base} turn={turn} hit={turn.expect ? turn.baseHit : null} onTeach={onTeach ? (a) => onTeach(turn, a) : undefined} />}
          {showPatched && <AnswerBubble kind="patched" result={r?.patched} turn={turn} hit={patchedHit} onTeach={onTeach ? (a) => onTeach(turn, a) : undefined} nameOf={nameOf} />}
        </Pair>
      )}
    </Wrap>
  );
}

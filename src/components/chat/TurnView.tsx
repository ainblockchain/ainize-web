import styled, { keyframes } from 'styled-components';
import type { ChatResponse, ChatResult } from '@/api/types';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { fmtMs, type ChatModeKind } from './util';

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
const TeachBtn = styled.button`
  align-self: flex-start; margin-top: 2px; padding: 3px 10px; border-radius: 12px; border: 1px dashed ${(p) => p.theme.color.PRIMARY}; background: #fff; color: ${(p) => p.theme.color.PRIMARY}; font-size: 12px; font-weight: 600; cursor: pointer;
  &:hover { background: ${(p) => p.theme.color.PALE_GREY}; }
`;

function AnswerBubble({ kind, result, turn, hit, onTeach }: { kind: 'base' | 'patched'; result: ChatResult | null | undefined; turn: Turn; hit: boolean | null | undefined; onTeach?: (answer: string) => void }) {
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
          <PendingNote>{turn.mode === 'compare' ? t('chat.bubble.compare_pending') : t('chat.bubble.thinking_pending')}{turn.thinking ? ` · ${t('chat.thinking.slow')}` : ''}</PendingNote>
        </>
      ) : (
        <>
          <Answer>{result?.content?.trim() ? result.content.trim() : <EmptyAnswer>{t('chat.bubble.empty_answer')}</EmptyAnswer>}</Answer>
          {result?.reasoning && (<Reasoning><summary>{t('chat.bubble.reasoning')}</summary><pre>{result.reasoning}</pre></Reasoning>)}
          {onTeach && result && <TeachBtn type="button" onClick={() => onTeach(result.content?.trim() ?? '')} data-testid={`teach-${kind}`}>{t('chat.turn.teach')}</TeachBtn>}
        </>
      )}
    </Bubble>
  );
}

export function TurnView({ turn, onRetry, onTeach }: { turn: Turn; onRetry?: (turn: Turn) => void; /** teach mode: "Teach the right answer" under each reply */ onTeach?: (turn: Turn, answer: string) => void }) {
  const { t } = useT();
  const showBase = turn.mode === 'compare' || turn.mode === 'base';
  const showPatched = turn.mode === 'compare' || turn.mode === 'patched';
  const r = turn.response;
  const patchedHit = r?.benchmark_hit ?? null;
  return (
    <Wrap>
      <UserRow><UserBubble><span>{t('chat.turn.you')}</span>{turn.prompt}</UserBubble></UserRow>
      {turn.status === 'error' ? (
        <ErrRow>
          <Alert $tone="error" role="alert">{turn.error}</Alert>
          {onRetry && <Button size="small" onClick={() => onRetry(turn)}>{t('chat.turn.retry')}</Button>}
        </ErrRow>
      ) : (
        <Pair $cols={showBase && showPatched ? 2 : 1}>
          {showBase && <AnswerBubble kind="base" result={r?.base} turn={turn} hit={turn.expect ? turn.baseHit : null} onTeach={onTeach ? (a) => onTeach(turn, a) : undefined} />}
          {showPatched && <AnswerBubble kind="patched" result={r?.patched} turn={turn} hit={patchedHit} onTeach={onTeach ? (a) => onTeach(turn, a) : undefined} />}
        </Pair>
      )}
    </Wrap>
  );
}

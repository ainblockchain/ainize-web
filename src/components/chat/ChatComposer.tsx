import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import styled from 'styled-components';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Form';
import { num } from '@/utils/format';
import { PROMPT_COUNT_FROM, PROMPT_MAX, type ChatModeKind } from './util';

/** `flex: none` — the composer is the one part of the panel that must never be squeezed or overflow it. */
const Wrap = styled.div`flex: none; display: flex; flex-direction: column; gap: 12px; padding: 16px; background: #fff; border-top: 1px solid ${(p) => p.theme.color.LIGHT_GREY};`;
const Controls = styled.div`display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px;`;
const Seg = styled.div`display: inline-flex; border: 1px solid ${(p) => p.theme.color.PRIMARY}80; border-radius: 4px; overflow: hidden;`;
const SegBtn = styled.button<{ $active: boolean }>`
  padding: 4px 12px; border: 0; cursor: pointer; font-size: 13px; font-weight: 500;
  color: ${(p) => (p.$active ? '#fff' : p.theme.color.PRIMARY)}; background: ${(p) => (p.$active ? p.theme.color.PRIMARY : '#fff')};
  &:not(:last-child) { border-right: 1px solid ${(p) => p.theme.color.PRIMARY}80; }
  &:hover:not(:disabled) { background: ${(p) => (p.$active ? p.theme.color.HOVER : p.theme.color.PALE_GREY)}; }
  &:disabled { cursor: not-allowed; opacity: 0.5; }
`;
const SegLabel = styled.span`font-size: 12px; color: ${(p) => p.theme.color.GREY}; margin-right: 6px;`;
const ThinkHelp = styled.span`font-size: 12px; color: ${(p) => p.theme.color.GREY};`;
const SamplesTitle = styled.div`font-size: 12px; font-weight: 600; color: ${(p) => p.theme.color.DARK_GREY}; span { font-weight: 400; color: ${(p) => p.theme.color.GREY}; margin-left: 6px; }`;
/** Finding 87 — what these Korean chips ARE, for the reader who cannot read them. */
const SamplesGloss = styled.p`margin: 4px 0 0; font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.GREY};`;
/** Which knowledge a chip came from, when several are loaded (the samples of all of them are merged into one row). */
const ChipFrom = styled.span`font-size: 10px; line-height: 1.3; color: ${(p) => p.theme.color.GREY}; opacity: 0.85; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const Chips = styled.div`display: flex; flex-wrap: wrap; gap: 6px;`;
const ChipBtn = styled.button`
  display: flex; flex-direction: column; align-items: flex-start; gap: 1px; text-align: left;
  padding: 4px 10px; border-radius: 14px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fafafa; font-size: 12px; color: ${(p) => p.theme.color.BLACK}; cursor: pointer;
  /* a chip is sized by its content, and with the source knowledge under it (finding 87) a 50-character title made
     one chip as wide as the row; the cap is what lets both lines ellipsize instead */
  max-width: min(100%, 260px); overflow: hidden;
  .q { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &:hover:not(:disabled) { border-color: ${(p) => p.theme.color.PRIMARY}; background: ${(p) => p.theme.color.PALE_GREY}; }
  &:disabled { cursor: not-allowed; opacity: 0.5; }
`;
/** The expected answer, in text, on the chip's second line — a tooltip is a fact only a mouse can reach. */
const ChipExpect = styled.span`
  font-size: 11px; line-height: 1.3; color: ${(p) => p.theme.color.GREY};
  b { font-weight: 600; color: ${(p) => p.theme.color.DARK_GREY}; font-family: ${(p) => p.theme.font.mono}; }
`;
const MoreBtn = styled(ChipBtn)`color: ${(p) => p.theme.color.PRIMARY}; border-style: dashed; background: #fff;`;
/** Visible marker for the trained trailing space — the chip's accessible name stays the plain prompt. */
const Space = styled.span`opacity: 0.55; font-family: ${(p) => p.theme.font.mono}; margin-left: 1px;`;
/* `flex-wrap` + a real basis on the box: while a request is in flight the Send button's label grows to
   "Waiting for the answer…", which at 360 px squeezed the question box down to one word per line. */
const InputRow = styled.div`display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end;`;
const Box = styled.textarea`
  flex: 1 1 200px; min-width: 0; min-height: 44px; max-height: 160px; resize: none; padding: 10px 12px; font-size: 14px; line-height: 1.5; border-radius: 4px;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fff; color: ${(p) => p.theme.color.BLACK};
  &:focus { outline: none; border-color: ${(p) => p.theme.color.PRIMARY}; box-shadow: 0 0 0 3px ${(p) => p.theme.color.PALE_GREY}; }
  &:disabled { background: #f7f7f7; color: ${(p) => p.theme.color.GREY}; cursor: not-allowed; }
  &::placeholder { color: rgba(51, 51, 51, 0.4); }
`;
const FootRow = styled.div`display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; justify-content: space-between; font-size: 12px; color: ${(p) => p.theme.color.GREY};`;
/** Finding 61 — how much of the node's 4,000-character limit is left, once it is close enough to matter. */
const Counter = styled.span<{ $full: boolean }>`
  align-self: flex-end; font-size: 11px; font-variant-numeric: tabular-nums;
  color: ${(p) => (p.$full ? '#a0102c' : p.theme.color.GREY)}; font-weight: ${(p) => (p.$full ? 600 : 400)};
`;

const INITIAL_CHIPS = 8;
/** Finding 66 — how long "Clear — are you sure?" stays armed before the button goes back to being harmless. */
const CONFIRM_MS = 4000;

export interface ChatComposerProps {
  disabled: boolean;
  busy: boolean;
  mode: ChatModeKind;
  onMode: (m: ChatModeKind) => void;
  thinking: boolean;
  onThinking: (v: boolean) => void;
  /** `from` names the knowledge a sample belongs to — shown only when several are loaded and the rows are merged. */
  samples: { prompt: string; expect: string; from?: string }[];
  /** One sentence saying what these questions ask and what shape the answer takes (finding 87). */
  samplesGloss?: string;
  onSend: (text: string) => void;
  onClear?: () => void;
  canClear: boolean;
  footer?: React.ReactNode;
  disabledReason?: string;
  /** A question the visitor arrived with (SC-12 *Teach this on top* → `/chat/<id>?teach=1&q=…`). Never sent on its own. */
  prefill?: string;
  /** Finding 61 — a question the send failed on comes BACK into the box (bumped nonce = a new failure). */
  restore?: { text: string; nonce: number };
}

export function ChatComposer({ disabled, busy, mode, onMode, thinking, onThinking, samples, samplesGloss, onSend, onClear, canClear, footer, disabledReason, prefill, restore }: ChatComposerProps) {
  const { t } = useT();
  const [text, setText] = useState(prefill ?? '');
  const [showAll, setShowAll] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Finding 82 — Send must not drop focus to <body>; the box is disabled during the request, so it is re-taken after. */
  const wantFocus = useRef(false);
  const locked = disabled || busy;
  const over = text.length >= PROMPT_MAX;

  useEffect(() => { setShowAll(false); }, [samples]);
  // SC-12 *Teach this on top* arrives as `?q=<question>`: the box opens with it, and the visitor still presses Send.
  useEffect(() => { if (prefill) { setText(prefill); ref.current?.focus(); } }, [prefill]);
  // Finding 61 — the send failed: put the question back rather than making the visitor retype it. Only into an
  // empty box: whatever they have started typing since is theirs and must not be overwritten.
  useEffect(() => {
    if (!restore?.text) return;
    setText((cur) => (cur.trim() ? cur : restore.text));
    wantFocus.current = true;
  }, [restore?.nonce, restore?.text]);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = 'auto'; el.style.height = `${Math.min(160, el.scrollHeight)}px`;
  }, [text]);
  // Finding 82 — the textarea is disabled while the request is in flight, which blurs it. Take focus back the
  // moment it is usable again, but only for the person who actually pressed Send in this composer.
  useEffect(() => {
    if (busy || disabled || !wantFocus.current) return;
    wantFocus.current = false;
    ref.current?.focus();
  }, [busy, disabled]);
  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); }, []);

  const submit = () => {
    // D2: send exactly what is in the box. This knowledge is trained on prompts that END WITH A SPACE
    // ("종목코드 픽셀플러스 "), and trimming here silently sent a prompt the knowledge was never trained on.
    if (!text.trim() || locked) return;
    onSend(text);
    setText('');
    wantFocus.current = true;
    ref.current?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
  };
  /**
   * Finding 66 — *Clear conversation* sits beside Send and used to destroy, with no dialog and no undo, a
   * transcript bought with a capped twenty tries an hour. The first click arms it and says so; the second clears.
   */
  const clearClick = () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    if (!confirmClear) {
      setConfirmClear(true);
      confirmTimer.current = setTimeout(() => setConfirmClear(false), CONFIRM_MS);
      return;
    }
    setConfirmClear(false);
    onClear?.();
  };
  /** The sample goes into the box verbatim (trailing space included) — the chip only *shows* it trimmed. */
  const insert = (p: string) => { setText(p); ref.current?.focus(); };
  const visible = showAll ? samples : samples.slice(0, INITIAL_CHIPS);
  const anyTrailing = samples.some((s) => /\s$/.test(s.prompt));
  const modes: { id: ChatModeKind; label: string; help: string }[] = [
    { id: 'compare', label: t('chat.mode.compare'), help: t('chat.mode.compare_help') },
    { id: 'patched', label: t('chat.mode.patched'), help: t('chat.mode.patched_help') },
    { id: 'base', label: t('chat.mode.base'), help: t('chat.mode.base_help') },
  ];
  /**
   * Finding 83 — a radiogroup that ignores arrow keys is not a radiogroup. ArrowLeft/Right (and Up/Down, Home,
   * End) move the selection the way every native one does, and only the selected option is a tab stop, so the
   * control costs one stop instead of three.
   */
  const onSegKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key) || busy) return;
    e.preventDefault();
    const i = modes.findIndex((m) => m.id === mode);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? modes.length - 1
      : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % modes.length
        : (i - 1 + modes.length) % modes.length;
    onMode(modes[next].id);
    const el = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next];
    el?.focus();
  };

  return (
    <Wrap>
      {samples.length > 0 && (
        <div>
          <SamplesTitle>{t('chat.samples.title')}<span>{t('chat.samples.help')}{anyTrailing ? ` ${t('chat.samples.verbatim')}` : ''}</span></SamplesTitle>
          {samplesGloss && <SamplesGloss data-testid="chat-samples-gloss">{samplesGloss}</SamplesGloss>}
          <Chips style={{ marginTop: 6 }}>
            {visible.map((s, i) => {
              const label = s.prompt.trim();
              const trailing = s.prompt !== s.prompt.replace(/\s+$/, '');
              return (
                // aria-label keeps the plain prompt: the ␣ marker is decoration, not part of the name.
                // `title` stays "Expected: …" (it is the chip's documented tooltip); the ␣ marker carries its own.
                <ChipBtn key={`${i}-${s.prompt}`} type="button" disabled={locked} onClick={() => insert(s.prompt)} aria-label={label}
                  title={t('chat.samples.expect', { expect: s.expect })}>
                  <span className="q">{label}{trailing && <Space aria-hidden="true" title={t('chat.samples.trailing_space')}>␣</Space>}</span>
                  <ChipExpect>{t('chat.hit.expected')} <b>{s.expect}</b></ChipExpect>
                  {s.from && <ChipFrom>{t('chat.samples.from', { id: s.from })}</ChipFrom>}
                </ChipBtn>
              );
            })}
            {samples.length > INITIAL_CHIPS && (
              <MoreBtn type="button" onClick={() => setShowAll((v) => !v)}>{showAll ? t('chat.samples.less') : t('chat.samples.more', { n: samples.length - INITIAL_CHIPS })}</MoreBtn>
            )}
          </Chips>
        </div>
      )}
      <Controls>
        <div>
          <SegLabel>{t('chat.mode.label')}</SegLabel>
          {/* Finding 78: `locked`, not `busy` — with the model server off every other control was correctly dead
              and these two answered crisply, so the page read as half-broken rather than unavailable. */}
          <Seg role="radiogroup" aria-label={t('chat.mode.label')} onKeyDown={onSegKey}>
            {modes.map((m) => (
              <SegBtn key={m.id} type="button" role="radio" aria-checked={mode === m.id} tabIndex={mode === m.id ? 0 : -1}
                $active={mode === m.id} disabled={locked} title={m.help} onClick={() => onMode(m.id)}>{m.label}</SegBtn>
            ))}
          </Seg>
        </div>
        <span title={t('chat.thinking.help')}>
          <Checkbox label={t('chat.thinking.label')} checked={thinking} disabled={locked} onChange={(e) => onThinking(e.target.checked)} />
        </span>
        <ThinkHelp>{thinking ? t('chat.thinking.slow') : t('chat.thinking.help')}</ThinkHelp>
      </Controls>
      <InputRow>
        <Box ref={ref} rows={1} value={text} disabled={locked} maxLength={PROMPT_MAX}
          placeholder={disabled ? (disabledReason ?? t('chat.input.placeholder_off')) : t('chat.input.placeholder')}
          onChange={(e) => setText(e.target.value)} onKeyDown={onKey} aria-label={t('chat.input.placeholder')} />
        {text.length >= PROMPT_COUNT_FROM && (
          <Counter $full={over} role="status" data-testid="chat-length" title={t('chat.input.limit_help', { max: num(PROMPT_MAX) })}>
            {over ? t('chat.input.limit_hit', { max: num(PROMPT_MAX) }) : t('chat.input.limit', { n: num(text.length), max: num(PROMPT_MAX) })}
          </Counter>
        )}
        <Button variant="contained" onClick={submit} disabled={locked || !text.trim()} loading={busy} loadingText={t('chat.input.sending')}>{t('chat.input.send')}</Button>
      </InputRow>
      <FootRow>
        <span>{footer}</span>
        {canClear && onClear && (
          <Button variant={confirmClear ? 'outlined' : 'text'} size="small" color={confirmClear ? 'secondary' : 'default'}
            onClick={clearClick} disabled={busy} data-testid="chat-clear" aria-live="polite">
            {confirmClear ? t('chat.input.clear_confirm') : t('chat.input.clear')}
          </Button>
        )}
      </FootRow>
    </Wrap>
  );
}

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import styled from 'styled-components';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Form';
import type { ChatModeKind } from './util';

const Wrap = styled.div`display: flex; flex-direction: column; gap: 12px; padding: 16px; background: #fff; border-top: 1px solid ${(p) => p.theme.color.LIGHT_GREY};`;
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
const Chips = styled.div`display: flex; flex-wrap: wrap; gap: 6px;`;
const ChipBtn = styled.button`
  padding: 4px 10px; border-radius: 14px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fafafa; font-size: 12px; color: ${(p) => p.theme.color.BLACK}; cursor: pointer;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  &:hover:not(:disabled) { border-color: ${(p) => p.theme.color.PRIMARY}; background: ${(p) => p.theme.color.PALE_GREY}; }
  &:disabled { cursor: not-allowed; opacity: 0.5; }
`;
const MoreBtn = styled(ChipBtn)`color: ${(p) => p.theme.color.PRIMARY}; border-style: dashed; background: #fff;`;
const InputRow = styled.div`display: flex; gap: 10px; align-items: flex-end;`;
const Box = styled.textarea`
  flex: 1; min-height: 44px; max-height: 160px; resize: none; padding: 10px 12px; font-size: 14px; line-height: 1.5; border-radius: 4px;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fff; color: ${(p) => p.theme.color.BLACK};
  &:focus { outline: none; border-color: ${(p) => p.theme.color.PRIMARY}; box-shadow: 0 0 0 3px ${(p) => p.theme.color.PALE_GREY}; }
  &:disabled { background: #f7f7f7; color: ${(p) => p.theme.color.GREY}; cursor: not-allowed; }
  &::placeholder { color: rgba(51, 51, 51, 0.4); }
`;
const FootRow = styled.div`display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; justify-content: space-between; font-size: 12px; color: ${(p) => p.theme.color.GREY};`;

const INITIAL_CHIPS = 8;

export interface ChatComposerProps {
  disabled: boolean;
  busy: boolean;
  mode: ChatModeKind;
  onMode: (m: ChatModeKind) => void;
  thinking: boolean;
  onThinking: (v: boolean) => void;
  samples: { prompt: string; expect: string }[];
  onSend: (text: string) => void;
  onClear?: () => void;
  canClear: boolean;
  footer?: React.ReactNode;
  disabledReason?: string;
}

export function ChatComposer({ disabled, busy, mode, onMode, thinking, onThinking, samples, onSend, onClear, canClear, footer, disabledReason }: ChatComposerProps) {
  const { t } = useT();
  const [text, setText] = useState('');
  const [showAll, setShowAll] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const locked = disabled || busy;

  useEffect(() => { setShowAll(false); }, [samples]);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = 'auto'; el.style.height = `${Math.min(160, el.scrollHeight)}px`;
  }, [text]);

  const submit = () => {
    const v = text.trim();
    if (!v || locked) return;
    onSend(v);
    setText('');
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
  };
  const insert = (p: string) => { setText(p.trim()); ref.current?.focus(); };
  const visible = showAll ? samples : samples.slice(0, INITIAL_CHIPS);
  const modes: { id: ChatModeKind; label: string; help: string }[] = [
    { id: 'compare', label: t('chat.mode.compare'), help: t('chat.mode.compare_help') },
    { id: 'patched', label: t('chat.mode.patched'), help: t('chat.mode.patched_help') },
    { id: 'base', label: t('chat.mode.base'), help: t('chat.mode.base_help') },
  ];

  return (
    <Wrap>
      {samples.length > 0 && (
        <div>
          <SamplesTitle>{t('chat.samples.title')}<span>{t('chat.samples.help')}</span></SamplesTitle>
          <Chips style={{ marginTop: 6 }}>
            {visible.map((s, i) => (
              <ChipBtn key={`${i}-${s.prompt}`} type="button" disabled={locked} onClick={() => insert(s.prompt)} title={t('chat.samples.expect', { expect: s.expect })}>{s.prompt.trim()}</ChipBtn>
            ))}
            {samples.length > INITIAL_CHIPS && (
              <MoreBtn type="button" onClick={() => setShowAll((v) => !v)}>{showAll ? t('chat.samples.less') : t('chat.samples.more', { n: samples.length - INITIAL_CHIPS })}</MoreBtn>
            )}
          </Chips>
        </div>
      )}
      <Controls>
        <div>
          <SegLabel>{t('chat.mode.label')}</SegLabel>
          <Seg role="radiogroup" aria-label={t('chat.mode.label')}>
            {modes.map((m) => (
              <SegBtn key={m.id} type="button" role="radio" aria-checked={mode === m.id} $active={mode === m.id} disabled={busy} title={m.help} onClick={() => onMode(m.id)}>{m.label}</SegBtn>
            ))}
          </Seg>
        </div>
        <span title={t('chat.thinking.help')}>
          <Checkbox label={t('chat.thinking.label')} checked={thinking} disabled={busy} onChange={(e) => onThinking(e.target.checked)} />
        </span>
        <ThinkHelp>{thinking ? t('chat.thinking.slow') : t('chat.thinking.help')}</ThinkHelp>
      </Controls>
      <InputRow>
        <Box ref={ref} rows={1} value={text} disabled={locked} placeholder={disabled ? (disabledReason ?? t('chat.input.placeholder_off')) : t('chat.input.placeholder')}
          onChange={(e) => setText(e.target.value)} onKeyDown={onKey} aria-label={t('chat.input.placeholder')} />
        <Button variant="contained" onClick={submit} disabled={locked || !text.trim()} loading={busy} loadingText={t('chat.input.sending')}>{t('chat.input.send')}</Button>
      </InputRow>
      <FootRow>
        <span>{footer}</span>
        {canClear && onClear && <Button variant="text" size="small" color="default" onClick={onClear} disabled={busy}>{t('chat.input.clear')}</Button>}
      </FootRow>
    </Wrap>
  );
}

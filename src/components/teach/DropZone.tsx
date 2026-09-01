import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import styled from 'styled-components';
import { useT } from '@/i18n';
import { ACCEPT_ATTR } from '@/lib/teachDataset';

/**
 * Step 1's file intake (design §5.3). Drag-and-drop is a convenience on top of a native file input that is ALWAYS
 * present — dropping is impossible on a phone — and the whole zone is a keyboard-activatable button.
 */
const Zone = styled.div<{ $over: boolean }>`
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  min-height: 160px; padding: 20px 16px; text-align: center; cursor: pointer;
  border: 2px dashed ${(p) => (p.$over ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)};
  border-radius: 8px; background: ${(p) => (p.$over ? p.theme.color.PALE_GREY : '#fff')};
  transition: background 0.15s ease, border-color 0.15s ease;
  &:hover { border-color: ${(p) => p.theme.color.PRIMARY}; }
  &:focus-visible { outline: 3px solid ${(p) => p.theme.color.PRIMARY}; outline-offset: 2px; }
  b { font-size: 15px; color: ${(p) => p.theme.color.BLACK}; }
  span { font-size: 12px; color: ${(p) => p.theme.color.GREY}; }
  input[type='file'] { font-size: 13px; max-width: 100%; }
`;

export interface DropZoneProps { onFile: (file: File) => void; maxMb: number; disabled?: boolean }

export function DropZone({ onFile, maxMb, disabled }: DropZoneProps) {
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const pick = () => { if (!disabled) input.current?.click(); };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && !disabled) onFile(f);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
  };
  return (
    <Zone
      role="button" tabIndex={0} aria-disabled={disabled} aria-label={t('teach.up.drop')} data-testid="drop-zone" $over={over}
      onClick={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT') pick(); }}
      onKeyDown={onKey}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <b>{t('teach.up.drop')}</b>
      <span>{t('teach.up.or')}</span>
      <input
        ref={input} type="file" accept={ACCEPT_ATTR} disabled={disabled} data-testid="file-input" aria-label={t('teach.up.browse')}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
      />
      <span>{t('teach.up.accept', { mb: maxMb })}</span>
    </Zone>
  );
}

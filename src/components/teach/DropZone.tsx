import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import styled from 'styled-components';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { ACCEPT_ATTR } from '@/lib/teachDataset';

/**
 * Step 1's file intake (design §5.3). Drag-and-drop is a convenience on top of a native file input that is ALWAYS
 * present — dropping is impossible on a phone — and the whole zone is a keyboard-activatable button.
 *
 * Finding 93 — on the device most people use, the instruction was "Drop a file here" (which cannot be followed) and
 * the real control was Chrome's own 238 x 21 px "Choose File" button, under half the 44 px target the rest of this
 * codebase applies, carrying browser chrome in the browser's language. The native input is visually hidden and
 * driven by a real 44 px button labelled with the app's own words; below sm that button's label leads and dropping
 * is demoted to the secondary line, because it is the half that cannot be done there.
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
  /* the native input stays in the DOM (it is what opens the picker) but is never what the visitor aims at */
  input[type='file'] { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
  button { min-height: 44px; }
  /* on a phone the heading is the thing you can actually do; "or drop a file here" becomes the secondary line */
  .drop-lead { font-size: 15px; color: ${(p) => p.theme.color.BLACK}; font-weight: 700; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) {
    .drop-lead { font-size: 12px; font-weight: 400; color: ${(p) => p.theme.color.GREY}; order: 3; }
    button { order: 1; width: 100%; }
    .accept { order: 4; }
  }
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
      role="button" tabIndex={0} aria-disabled={disabled} aria-label={t('teach.up.browse')} data-testid="drop-zone" $over={over}
      onClick={(e) => { if (!(e.target as HTMLElement).closest('button, input')) pick(); }}
      onKeyDown={onKey}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <b className="drop-lead">{t('teach.up.drop_or')}</b>
      <input
        ref={input} type="file" accept={ACCEPT_ATTR} disabled={disabled} data-testid="file-input" tabIndex={-1} aria-hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
      />
      <Button type="button" variant="contained" disabled={disabled} onClick={pick} data-testid="file-browse">{t('teach.up.browse')}</Button>
      <span className="accept">{t('teach.up.accept', { mb: maxMb })}</span>
    </Zone>
  );
}

import { useState } from 'react';
import styled from 'styled-components';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Form';

/**
 * "Paste a table instead" (design §5.3). Two columns from a spreadsheet, or `Q:` / `A:` lines: the text is uploaded
 * as a `.tsv` / `.txt` file so the SERVER parser decides what it means — the browser never becomes a second parser.
 * Open by default on narrow screens, where dragging a file is not a thing.
 */
const Wrap = styled.section`
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 6px; background: #fff;
  summary { cursor: pointer; padding: 12px 14px; font-size: 14px; font-weight: 600; color: ${(p) => p.theme.color.BLACK}; }
  &[open] summary { border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; }
`;
const Body = styled.div`display: flex; flex-direction: column; gap: 10px; padding: 12px 14px;`;
const Hint = styled.p`margin: 0; font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.GREY};`;

export function PasteTable({ open, onUse, busy }: { open: boolean; onUse: (text: string) => void; busy?: boolean }) {
  const { t } = useT();
  const [text, setText] = useState('');
  return (
    <Wrap as="details" open={open} data-testid="paste-table">
      <summary>{t('teach.up.paste_title')}</summary>
      <Body>
        <Hint>{t('teach.up.paste_hint')}</Hint>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder={t('teach.up.paste_ph')} aria-label={t('teach.up.paste_title')} data-testid="paste-box" />
        <div><Button type="button" onClick={() => onUse(text)} disabled={!text.trim() || busy} data-testid="paste-use">{t('teach.up.paste_use')}</Button></div>
      </Body>
    </Wrap>
  );
}

import { useState } from 'react';
import styled from 'styled-components';
import { useChatMutation } from '@/api/api';
import type { ChatResponse } from '@/api/types';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert, Input } from '@/components/ui/Form';
import { mapTeachError } from '@/components/chat/teachUtil';

/**
 * "Try it here" (design §5.7) — the Teachable-NLP demo-page moment, through the normal live-test path with the private
 * draft loaded, so the two answers come from the same model the rest of the site uses. It spends the ordinary
 * live-test quota and surfaces that error rather than failing silently.
 */
const Wrap = styled.div`display: flex; flex-direction: column; gap: 10px;`;
const Ask = styled.form`display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; > label, > div { flex: 1; min-width: 200px; }`;
const Pair = styled.div`
  display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;
`;
const Answer = styled.div<{ $with: boolean }>`
  border: 1px solid ${(p) => (p.$with ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)}; border-radius: 6px; padding: 10px 12px; background: ${(p) => (p.$with ? p.theme.color.PALE_GREY : '#fafafa')};
  b { display: block; font-size: 12px; color: ${(p) => (p.$with ? p.theme.color.PRIMARY : p.theme.color.GREY)}; margin-bottom: 4px; }
  p { margin: 0; font-size: 13px; line-height: 1.55; color: ${(p) => p.theme.color.BLACK}; white-space: pre-wrap; word-break: break-word; }
`;

export function LiveTestBox({ draftId }: { draftId: string }) {
  const { t } = useT();
  const [q, setQ] = useState('');
  const [ask, { isLoading }] = useChatMutation();
  const [out, setOut] = useState<ChatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const text = q.trim();
    if (!text) return;
    setError(null);
    try {
      setOut(await ask({ patch_ids: [draftId], mode: 'compare', messages: [{ role: 'user', content: text }] }).unwrap());
    } catch (e) { setOut(null); setError(mapTeachError(e, t)); }
  };

  return (
    <Wrap data-testid="live-test">
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>{t('teach.res.try_hint')}</p>
      <Ask onSubmit={(e) => { e.preventDefault(); void run(); }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('teach.res.try_ph')} aria-label={t('teach.res.try_title')} data-testid="live-test-q" />
        <Button type="submit" variant="contained" loading={isLoading} disabled={!q.trim()} data-testid="live-test-go">{t('teach.res.try_go')}</Button>
      </Ask>
      {error && <Alert $tone="error" role="alert">{error}</Alert>}
      {out && (
        <Pair>
          <Answer $with data-testid="answer-with"><b>{t('teach.res.try_with')}</b><p>{out.patched?.content?.trim() || '—'}</p></Answer>
          <Answer $with={false} data-testid="answer-without"><b>{t('teach.res.try_without')}</b><p>{out.base?.content?.trim() || '—'}</p></Answer>
        </Pair>
      )}
    </Wrap>
  );
}

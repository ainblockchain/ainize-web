import { useState } from 'react';
import styled from 'styled-components';
import { errorMessage, useChatFeedbackMutation } from '@/api/api';
import { useT } from '@/i18n';

/**
 * SC-13 — "this answer is wrong", with the consent asked ON THE TURN.
 *
 * Pressing *Mark wrong* asks one question before anything leaves the browser: may the creator see what you asked, or
 * only that someone asked something? Both answers are recorded — *Count only* is not a cancel — and the request
 * carries no prompt at all: the node already knows which question this turn was, so the text is sent by nobody and
 * stored only on *Share*.
 */
const Row = styled.div`
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-top: 8px; font-size: 12px; color: ${(p) => p.theme.color.GREY};
`;
const Plain = styled.button`
  font: inherit; font-size: 12px; padding: 0; border: 0; background: none; color: ${(p) => p.theme.color.GREY}; cursor: pointer; text-decoration: underline;
  &:hover:not(:disabled) { color: ${(p) => p.theme.color.PRIMARY}; }
  &:disabled { opacity: 0.5; cursor: default; }
`;
const Choice = styled.button`
  font: inherit; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 12px; cursor: pointer;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fff; color: ${(p) => p.theme.color.BLACK};
  &:hover:not(:disabled) { border-color: ${(p) => p.theme.color.PRIMARY}; color: ${(p) => p.theme.color.PRIMARY}; }
  &:disabled { opacity: 0.5; cursor: default; }
`;
const Done = styled.span`color: #1e6b36;`;
const Failed = styled.span`color: #a0102c;`;

export function MarkWrong({ turnId, patchIds, name }: { turnId: string; patchIds: string[]; name: string }) {
  const { t } = useT();
  const [asking, setAsking] = useState(false);
  const [send, { data, isLoading, error }] = useChatFeedbackMutation();
  if (data) {
    const count = data.items[0]?.count ?? 1;
    return <Row data-testid="mark-wrong-done"><Done>{t('chat.share_done', { c: count })}</Done></Row>;
  }
  if (!asking) {
    return (
      <Row>
        <Plain type="button" onClick={() => setAsking(true)} data-testid="mark-wrong">{t('chat.mark_wrong')}</Plain>
        {!!error && <Failed>{t('chat.share_failed', { message: errorMessage(error) })}</Failed>}
      </Row>
    );
  }
  const answer = (share: boolean) => { void send({ turn_id: turnId, patch_ids: patchIds, share }); };
  return (
    <Row data-testid="mark-wrong-consent">
      <span>{t('chat.share_q', { name })}</span>
      <Choice type="button" disabled={isLoading} onClick={() => answer(true)} data-testid="share-yes">{t('chat.share_yes')}</Choice>
      <Choice type="button" disabled={isLoading} onClick={() => answer(false)} data-testid="share-no">{t('chat.share_no')}</Choice>
      {!!error && <Failed>{t('chat.share_failed', { message: errorMessage(error) })}</Failed>}
    </Row>
  );
}

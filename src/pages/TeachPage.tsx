import { useNavigate } from 'react-router';
import styled from 'styled-components';
import { useTeachPolicyQuery } from '@/api/api';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { Description, PageWrapper, Title, TitleRow } from '@/components/ui/Misc';
import { policyLine } from '@/components/chat/teachUtil';
import { StepStrip } from '@/components/teach/Stepper';
import { rowsPerJob } from '@/components/teach/util';

/**
 * `/teach` — the entry choice (design §5.2, ux-critique-owner O-1). Two doors, one pipeline — and one of them leads.
 * The conversation door is primary: a newcomer needs no file, no preparation, and sees the value in one question
 * (ask, correct, the model learns it). The file door is for people who already have their questions and answers in
 * a file; it is one click away, styled as the clearly secondary alternative (smaller card, outlined button, an
 * "Already have a file?" eyebrow). When this node is not teaching, both CTAs are disabled and the node's own
 * sentence says why.
 */
const Doors = styled.div`
  display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 24px;
  @media (min-width: ${(p) => p.theme.breakpoint.sm}px) { grid-template-columns: 3fr 2fr; align-items: stretch; }
`;
const Door = styled.section<{ $primary?: boolean }>`
  display: flex; flex-direction: column; gap: 10px; border-radius: 10px;
  padding: ${(p) => (p.$primary ? '28px 28px 24px' : '20px')};
  background: ${(p) => (p.$primary ? p.theme.color.PALE_GREY : '#fff')};
  border: ${(p) => (p.$primary ? `2px solid ${p.theme.color.PRIMARY}` : `1px solid ${p.theme.color.LIGHT_GREY}`)};
  h2 { margin: 0; font-size: ${(p) => (p.$primary ? '22px' : '16px')}; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
  p { margin: 0; font-size: ${(p) => (p.$primary ? '15px' : '14px')}; line-height: 1.6; color: ${(p) => p.theme.color.DARK_GREY}; flex: 1; }
  small { font-size: 12px; color: ${(p) => p.theme.color.GREY}; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: ${(p) => (p.$primary ? '22px 20px 20px' : '18px 16px')}; }
`;
/** The secondary door's eyebrow: says who it is for before the visitor reads the card. */
const Eyebrow = styled.span`
  font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: ${(p) => p.theme.color.GREY};
`;
const Steps = styled.div`
  margin-top: 28px; padding: 16px; border-radius: 8px; background: ${(p) => p.theme.color.PALE_GREY};
  p { margin: 0 0 10px; font-size: 13px; color: ${(p) => p.theme.color.DARK_GREY}; }
`;

export default function TeachPage() {
  const { t } = useT();
  useTitle(t('teach.entry.title'));
  const navigate = useNavigate();
  const { data: policy, isLoading } = useTeachPolicyQuery(undefined, { pollingInterval: 60_000 });
  const pol = policyLine(policy, t);
  const open = !!policy?.enabled && policy.trainer !== 'paused';

  return (
    <PageWrapper data-testid="teach-entry">
      <TitleRow><Title>{t('teach.entry.title')}</Title></TitleRow>
      <Description>{t('teach.entry.sub')}</Description>
      <Description style={{ marginTop: 6 }}>{t('teach.entry.no_account')}</Description>

      <Doors>
        <Door $primary data-testid="door-chat-card">
          <h2>{t('teach.entry.chat.title')}</h2>
          <p>{t('teach.entry.chat.body')}</p>
          <Button variant="contained" size="large" onClick={() => navigate('/chat?teach=1')} disabled={!open} data-testid="door-chat">{t('teach.entry.chat.cta')}</Button>
        </Door>
        <Door data-testid="door-file-card">
          <Eyebrow>{t('teach.entry.file.eyebrow')}</Eyebrow>
          <h2>{t('teach.entry.file.title')}</h2>
          <p>{t('teach.entry.file.body')}</p>
          <Button onClick={() => navigate('/teach/upload')} disabled={!open} data-testid="door-file">{t('teach.entry.file.cta')}</Button>
          <small>{t('teach.entry.file.formats', { max: policy?.limits?.dataset_max_rows ?? rowsPerJob(policy) })}</small>
        </Door>
      </Doors>

      {!isLoading && pol.text && (
        <Alert $tone={pol.ok ? 'info' : 'warning'} role="status" data-testid="teach-policy" style={{ marginTop: 16 }}>{pol.text}</Alert>
      )}

      <Steps>
        <p>{t('teach.entry.steps')}</p>
        <StepStrip />
      </Steps>
    </PageWrapper>
  );
}

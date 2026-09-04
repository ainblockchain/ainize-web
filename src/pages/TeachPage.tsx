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
 * `/teach` — the entry choice (design §5.2). Two doors, one pipeline: the file card leads (it is the shape the owner
 * asked for), the conversation card sits beside it, and the five-step strip below says the two meet immediately.
 * When this node is not teaching, both CTAs are disabled and the node's own sentence says why.
 */
const Doors = styled.div`
  display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 24px;
`;
const Door = styled.section<{ $primary?: boolean }>`
  display: flex; flex-direction: column; gap: 10px; padding: 20px; border-radius: 8px; background: #fff;
  border: 1px solid ${(p) => (p.$primary ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)};
  h2 { margin: 0; font-size: 18px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
  p { margin: 0; font-size: 14px; line-height: 1.6; color: ${(p) => p.theme.color.DARK_GREY}; flex: 1; }
  small { font-size: 12px; color: ${(p) => p.theme.color.GREY}; }
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
        <Door>
          <h2>{t('teach.entry.chat.title')}</h2>
          <p>{t('teach.entry.chat.body')}</p>
          <Button onClick={() => navigate('/chat?teach=1')} disabled={!open} data-testid="door-chat">{t('teach.entry.chat.cta')}</Button>
        </Door>
        <Door $primary>
          <h2>{t('teach.entry.file.title')}</h2>
          <p>{t('teach.entry.file.body')}</p>
          <Button variant="contained" onClick={() => navigate('/teach/upload')} disabled={!open} data-testid="door-file">{t('teach.entry.file.cta')}</Button>
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

import { Link } from 'react-router';
import styled from 'styled-components';
import { useInfoQuery } from '@/api/api';
import { useT } from '@/i18n';
import { Description, PageWrapper, Title } from '@/components/ui/Misc';

/**
 * Public pre-screen for /new-patch when nobody is signed in (spec §5.2 / §11): "Add knowledge — two ways".
 * Card A sends visitors to Live test with the teach banner (no account); card B is the operator's route to the
 * sign-in wall and then the register form. Replaces the old silent redirect to /signing.
 */
const Grid = styled.div`margin-top: 32px; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; max-width: 900px;`;
const Card = styled.section<{ $primary?: boolean }>`
  display: flex; flex-direction: column; gap: 10px; padding: 24px; border-radius: 12px;
  border: 1px solid ${(p) => (p.$primary ? '#cdbfff' : p.theme.color.LIGHT_GREY)}; background: ${(p) => (p.$primary ? '#faf7ff' : '#fff')};
`;
const CardTitle = styled.h2`margin: 0; font-size: 20px; font-weight: 800; line-height: 1.3; color: ${(p) => p.theme.color.BLACK}; word-break: keep-all;`;
const CardBody = styled.p`margin: 0; font-size: 14px; line-height: 1.6; color: #5c5c5c; word-break: keep-all; flex: 1;`;
const Cta = styled(Link)<{ $primary?: boolean }>`
  align-self: flex-start; margin-top: 8px; padding: 10px 20px; border-radius: 24px; font-size: 14px; font-weight: 700; text-decoration: none;
  background: ${(p) => (p.$primary ? p.theme.color.PRIMARY : '#fff')}; color: ${(p) => (p.$primary ? '#fff' : p.theme.color.PRIMARY)};
  border: 1px solid ${(p) => (p.$primary ? p.theme.color.PRIMARY : '#cdbfff')};
  &:hover { opacity: 0.92; }
`;
const Off = styled.span`font-size: 13px; color: #8d8d8f;`;

export default function NewPatchPreScreen() {
  const { t } = useT();
  const { data: info } = useInfoQuery();
  const teachOff = !!info && !info.accepts_contributions;
  return (
    <PageWrapper data-testid="newpatch-prescreen">
      <Title>{t('op.new.prescreen.title')}</Title>
      <Description>{t('op.new.prescreen.sub')}</Description>
      <Grid>
        <Card $primary data-testid="prescreen-teach">
          <CardTitle>{t('op.new.prescreen.teach.title')}</CardTitle>
          <CardBody>{t('op.new.prescreen.teach.body')}</CardBody>
          {teachOff && <Off>{t('op.new.prescreen.teach.off')}</Off>}
          <Cta $primary to="/chat?teach=1">{t('op.new.prescreen.teach.cta')}</Cta>
        </Card>
        <Card data-testid="prescreen-file">
          <CardTitle>{t('op.new.prescreen.file.title')}</CardTitle>
          <CardBody>{t('op.new.prescreen.file.body')}</CardBody>
          <Cta to="/signing?next=%2Fnew-patch">{t('op.new.prescreen.file.cta')}</Cta>
        </Card>
      </Grid>
    </PageWrapper>
  );
}

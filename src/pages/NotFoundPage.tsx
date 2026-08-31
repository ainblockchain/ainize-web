import styled from 'styled-components';
import { PageWrapper, StyledLink, Title } from '@/components/ui/Misc';
import { useT } from '@/i18n';

/** Ported from ainize-web NotFoundPage.js */
const Desc = styled.p`
  margin: 37px 0 0; font-size: 14px; color: ${(p) => p.theme.color.BLACK}; word-break: keep-all;
`;
const Back = styled.p`
  margin: 12px 0 0; font-size: 14px;
`;
const Image = styled.img`
  margin-top: 32px; width: 100%; max-width: 516px; display: block;
`;

export default function NotFoundPage({ message }: { message?: string }) {
  const { t } = useT();
  return (
    <PageWrapper>
      <Title>{t('notfound.title')}</Title>
      <Desc>{message ?? t('notfound.desc')}</Desc>
      <Back><StyledLink to="/explore">{t('notfound.home')} →</StyledLink></Back>
      <Image src="/static/images/img-404-error.png" alt="" />
    </PageWrapper>
  );
}

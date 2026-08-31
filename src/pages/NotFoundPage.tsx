import styled from 'styled-components';
import { PageWrapper, Title } from '@/components/ui/Misc';

/** Ported from ainize-web NotFoundPage.js */
const Desc = styled.p`
  margin: 37px 0 0; font-size: 14px; color: ${(p) => p.theme.color.BLACK};
`;
const Image = styled.img`
  margin-top: 32px; width: 100%; max-width: 516px; display: block;
`;

export default function NotFoundPage({ message }: { message?: string }) {
  return (
    <PageWrapper>
      <Title>404. Page not found</Title>
      <Desc>{message ?? "Either something went wrong or the page doesn't exist anymore."}</Desc>
      <Image src="/static/images/img-404-error.png" alt="" />
    </PageWrapper>
  );
}

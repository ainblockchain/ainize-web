import { Link } from 'react-router';
import styled from 'styled-components';
import { useT } from '@/i18n';

/** Ported from ainize-web Footer.js — dark purple bar, 62px. */
const Wrapper = styled.footer`
  width: 100%; min-height: 62px; display: flex; align-items: center; justify-content: center; background-color: ${(p) => p.theme.color.FOOTER};
`;
const Content = styled.div`
  width: calc(100% - 32px); display: flex; flex-direction: row; align-items: center; gap: 24px; padding: 12px 0; flex-wrap: wrap;
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { width: 903px; }
`;
const Copyright = styled.div`flex: 1; font-size: 12px; color: #ffffff;`;
const FLink = styled(Link)`font-size: 12px; color: #ffffff; text-decoration: none; &:hover { text-decoration: underline; }`;
const ALink = styled.a`font-size: 12px; color: #ffffff; text-decoration: none; &:hover { text-decoration: underline; }`;

/**
 * `minimal` — the teach flow's footer (ux-critique-owner O-3): copyright, Terms and Contact only. The developer links
 * (ain-js, aindrive) belong to the marketplace pages, not to a page whose one task is teaching the model.
 */
export function Footer({ minimal }: { minimal?: boolean } = {}) {
  const year = new Date().getFullYear();
  const { t } = useT();
  return (
    <Wrapper data-testid={minimal ? 'focused-footer' : undefined}>
      <Content>
        <Copyright>{t('footer.copyright', { year })}</Copyright>
        <FLink to="/terms">{t('footer.terms')}</FLink>
        {!minimal && <ALink href="https://github.com/ainblockchain/ain-js" target="_blank" rel="noopener noreferrer">ain-js</ALink>}
        {!minimal && <ALink href="https://github.com/ainetwork-ai/aindrive" target="_blank" rel="noopener noreferrer">aindrive</ALink>}
        <ALink href="mailto:support@ainize.ai?subject=[Ainize] ">{t('footer.contact')}</ALink>
      </Content>
    </Wrapper>
  );
}

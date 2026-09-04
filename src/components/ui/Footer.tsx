import { Link } from 'react-router';
import styled from 'styled-components';
import { useT } from '@/i18n';

/**
 * ONE footer, one link list, two skins (finding 99). The landing used to carry a tall dark centred footer of its own
 * (Terms / Network / Public record / ain-js / Contact) while every other page got this purple bar (Terms and
 * Policies / ain-js / aindrive / Contact) — two chromes teaching two site structures, the same destination under two
 * names, and no link anywhere called Privacy even though the privacy policy is a real section of /terms with real
 * content about what a node stores. The list below is now the same everywhere; only the skin changes.
 *
 * `minimal` — the teach flow's footer (ux-critique-owner O-3): copyright, Terms, Privacy and Contact only. The
 * developer and marketplace links belong to the marketplace pages, not to a page whose one task is teaching.
 */
const Wrapper = styled.footer<{ $landing?: boolean }>`
  width: 100%; display: flex; align-items: center; justify-content: center;
  ${(p) => (p.$landing
    ? `padding: 56px 24px; background-color: #333333; flex-direction: column; gap: 28px;`
    : `min-height: 62px; background-color: ${p.theme.color.FOOTER};`)}
`;
const Content = styled.div`
  width: calc(100% - 32px); display: flex; flex-direction: row; align-items: center; gap: 24px; padding: 12px 0; flex-wrap: wrap;
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { width: 903px; }
`;
const Copyright = styled.div`flex: 1; font-size: 12px; color: #ffffff;`;
/**
 * Finding 90 — every footer link measured 23 px tall, below the 24 px WCAG 2.5.8 minimum and far below the 44 px
 * platform guideline. The vertical padding buys the height without changing the bar's look at 1280 px, where the
 * row already had the room.
 */
const linkCss = `font-size: 12px; color: #ffffff; text-decoration: none; display: inline-flex; align-items: center; min-height: 24px; padding: 10px 0;
  &:hover { text-decoration: underline; }`;
const FLink = styled(Link)`${linkCss}`;
const ALink = styled.a`${linkCss}`;

/* ---------------------------------------------------------------- landing skin: dark, centred, under the logo */
const LandingLogo = styled.img`height: 22px; width: auto; opacity: 0.9;`;
const LandingLinks = styled.div`
  display: flex; align-items: center; justify-content: center; gap: 8px 28px; flex-wrap: wrap;
  a { font-family: ${(p) => p.theme.font.display}; font-size: 15px; padding: 12px 6px; color: #f2f2f2; }
`;
const LandingCopyright = styled.div`font-family: ${(p) => p.theme.font.display}; font-size: 13px; color: #9b9b9b; text-align: center;`;

const LOGO = { src: '/static/images/logo-white.png', srcSet: '/static/images/logo-white@2x.png 2x, /static/images/logo-white@3x.png 3x' };
const CONTACT = 'mailto:support@ainize.ai?subject=[Ainize] ';

export function Footer({ minimal, variant = 'bar' }: { minimal?: boolean; variant?: 'bar' | 'landing' } = {}) {
  const year = new Date().getFullYear();
  const { t, help } = useT();
  /* The list, in one place. `wide` links are the marketplace/developer half the teach flow drops. */
  const links = (
    <>
      <FLink to="/terms">{t('footer.terms')}</FLink>
      {/* Finding 99: /terms §3 IS the privacy policy, and until now no link anywhere named it — in Korean
          "개인정보 처리방침" appeared in no link at all, so there was no word to search the page for. */}
      <FLink to="/terms#privacy" data-testid="footer-privacy">{t('footer.privacy')}</FLink>
      {!minimal && <FLink to="/network">{t('nav.network')}</FLink>}
      {!minimal && <FLink to="/ledger" title={help('ledger')}>{t('nav.ledger')}</FLink>}
      {/* Finding 69: /docs was reachable from every header except the landing's, and from no footer at all. */}
      {!minimal && <FLink to="/docs">{t('nav.docs')}</FLink>}
      {!minimal && <ALink href="https://github.com/ainblockchain/ain-js" target="_blank" rel="noopener noreferrer">ain-js</ALink>}
      {!minimal && <ALink href="https://github.com/ainetwork-ai/aindrive" target="_blank" rel="noopener noreferrer">aindrive</ALink>}
      <ALink href={CONTACT}>{t('footer.contact')}</ALink>
    </>
  );

  if (variant === 'landing') {
    return (
      <Wrapper $landing data-testid="landing-footer">
        <LandingLogo {...LOGO} alt="Ainize" />
        <LandingLinks>{links}</LandingLinks>
        <LandingCopyright>{t('footer.copyright', { year })}</LandingCopyright>
      </Wrapper>
    );
  }
  return (
    <Wrapper data-testid={minimal ? 'focused-footer' : undefined}>
      <Content>
        <Copyright>{t('footer.copyright', { year })}</Copyright>
        {links}
      </Content>
    </Wrapper>
  );
}

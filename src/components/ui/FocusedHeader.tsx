import { Link } from 'react-router';
import styled from 'styled-components';
import { useLocale, useT } from '@/i18n';

/**
 * The slim header of the teach flow (`/teach/*`, ux-critique-owner O-3 / O-6 / O-8). One task lives on these pages —
 * teaching the model — so the marketplace navigation and its ledger badge stay off them. What remains is what the
 * flow needs: the logo (home), a way out to the marketplace, and the language toggle in the same system-setting
 * corner it has on every other page.
 *
 * Same white bar, shadow and hover purple as the full header, so the two chromes read as one product.
 */
const Wrapper = styled.header`
  width: 100%; display: flex; flex-direction: column; align-items: center;
  box-shadow: 0 0 20px 0 rgba(0, 0, 0, 0.1); background-color: #ffffff; z-index: 5; position: relative;
`;
/**
 * One 56 px row: logo left, the controls right. On a phone the links wrap under the logo (order 2) while
 * the language toggle stays on the logo row (order 1), top-right — the DOM order is logo → links → language on every
 * width, so the Tab order never changes with the viewport.
 */
const Content = styled.div`
  width: calc(100% - 32px); min-height: 56px; display: flex; flex-direction: row; align-items: center; flex-wrap: wrap; gap: 0 4px;
  @media (min-width: ${(p) => p.theme.layout.maxWidth}) { width: ${(p) => p.theme.layout.maxWidth}; }
`;
const Home = styled(Link)`
  flex: 0 0 auto; order: 0; display: flex; align-items: center; text-decoration: none; padding: 10px 0;
`;
const Logo = styled.img`width: 104px; object-fit: contain; display: block;`;
const Links = styled.nav`
  order: 1; flex: 1 1 auto; min-width: 0; display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 0 4px;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { order: 2; flex: 1 0 100%; justify-content: flex-start; margin-left: -8px; padding-bottom: 6px; }
`;
const itemCss = `
  display: inline-flex; align-items: center; padding: 8px 10px; border-radius: 4px; font-size: 14px; font-weight: 500; text-decoration: none; white-space: nowrap;
  &:focus-visible { outline: 3px solid #8b3eeb; outline-offset: 1px; }
`;
const ExitLink = styled(Link)`
  ${itemCss} color: ${(p) => p.theme.color.BLACK};
  &:hover { color: ${(p) => p.theme.color.HOVER}; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: 6px 8px; font-size: 13px; }
`;
const LocaleButton = styled.button`
  order: 2; flex: 0 0 auto; margin-left: 8px; padding: 4px 8px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 12px; background: #fff;
  font-size: 12px; color: ${(p) => p.theme.color.GREY}; cursor: pointer;
  &:hover { color: ${(p) => p.theme.color.HOVER}; border-color: ${(p) => p.theme.color.HOVER}; }
  &:focus-visible { outline: 3px solid ${(p) => p.theme.color.PRIMARY}; outline-offset: 1px; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { order: 1; margin-left: auto; }
`;

export function FocusedHeader() {
  const { t, help } = useT();
  const { locale, setLocale } = useLocale();
  return (
    <Wrapper data-testid="focused-header">
      <Content>
        <Home to="/" aria-label="Ainize home" title={help('brand')}>
          <Logo src="/static/images/asset-logo.png" srcSet="/static/images/asset-logo@2x.png 2x, /static/images/asset-logo@3x.png 3x" alt="Ainize" />
        </Home>
        <Links aria-label={t('teach.chrome.nav')}>
          <ExitLink to="/explore" data-testid="teach-exit" title={t('teach.chrome.exit_help')}>{t('teach.chrome.exit')}</ExitLink>
        </Links>
        <LocaleButton onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')} aria-label="language">{t('common.locale')}</LocaleButton>
      </Content>
    </Wrapper>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import styled from 'styled-components';
import { useCatalogQuery, useInfoQuery } from '@/api/api';
import { executedAccuracy, usePriceLabel, useVerificationLabel } from '@/components/public/PatchListItem';
import { CopyButton, ScoreBar, Shimmer } from '@/components/ui/Misc';
import { useLocale, useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { num, shortAddr } from '@/utils/format';

/* ---------------------------------------------------------------- hero (dark, original Ainize white logo) */
const IntroSection = styled.section`
  width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #333333; overflow: hidden;
`;
const NavBar = styled.div<{ $solid: boolean }>`
  width: 100%; position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: center;
  background-color: rgba(51, 51, 51, ${(p) => (p.$solid ? 1 : 0.8)}); transition: background-color 0.2s ease-in-out;
`;
const NavContent = styled.div`
  width: calc(100% - 80px); padding: 24px 40px; max-width: ${(p) => p.theme.layout.maxWidthLanding};
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { width: calc(100% - 32px); padding: 16px; }
`;
const NavLogo = styled.img`height: 26px; width: auto; display: block;`;
const NavLinks = styled.nav`display: flex; align-items: center; gap: 20px; flex-wrap: wrap; justify-content: flex-end;`;
const NavLink = styled(Link)`
  font-family: ${(p) => p.theme.font.display}; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none;
  &:hover { text-decoration: underline; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { font-size: 13px; }
`;
const NavMuted = styled(NavLink)`color: #bdbdbd; font-weight: 500;`;
const LocaleButton = styled.button`
  padding: 4px 10px; border: 1px solid #6b6b6b; border-radius: 12px; background: transparent; font-size: 12px; color: #dddddd; cursor: pointer;
  &:hover { border-color: #ffffff; color: #ffffff; }
`;
const IntroContent = styled.div`
  width: calc(100% - 80px); max-width: ${(p) => p.theme.layout.maxWidthLanding}; padding: 96px 40px 110px; position: relative;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { width: calc(100% - 32px); padding: 56px 16px 72px; }
`;
const Hero = styled.div`display: flex; flex-direction: column; align-items: flex-start; justify-content: center;`;
const HeroLogo = styled.img`height: 44px; width: auto; margin-bottom: 28px; z-index: 2; @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { height: 32px; }`;
const IntroTitle = styled.h1`
  z-index: 2; margin: 0; font-family: ${(p) => p.theme.font.display}; font-weight: 800; line-height: 1.21; color: #ffffff; white-space: pre-wrap; max-width: 18ch; word-break: keep-all;
  font-size: 30px;
  @media (min-width: ${(p) => p.theme.breakpoint.sm}px) { font-size: 40px; }
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { font-size: 52px; }
`;
const IntroSub = styled.p`
  z-index: 2; margin: 20px 0 0; font-family: ${(p) => p.theme.font.display}; font-weight: 500; line-height: 1.6; color: #e6e6e6; white-space: pre-wrap; max-width: 52ch; word-break: keep-all;
  font-size: 15px;
  @media (min-width: ${(p) => p.theme.breakpoint.sm}px) { font-size: 17px; }
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { font-size: 20px; }
`;
const HeroImage = styled.img`
  position: absolute; right: -80px; top: 40px; width: 900px; max-width: 60vw; object-fit: contain; pointer-events: none; opacity: 0.9;
  @media (max-width: ${(p) => p.theme.breakpoint.md}px) { display: none; }
`;
const CountCard = styled.div`
  z-index: 2; margin-top: 56px; padding: 48px 64px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  border-radius: 24px; box-shadow: 0 4px 30px 0 rgba(0, 0, 0, 0.5); background-color: #ffffff;
  @media (max-width: ${(p) => p.theme.breakpoint.md}px) { margin-top: 40px; padding: 40px 24px; width: 100%; }
`;
const CountTitle = styled.div`
  font-family: ${(p) => p.theme.font.display}; font-weight: 800; line-height: 1.33; color: #8c6cff; text-align: center; cursor: help;
  font-size: 22px;
  @media (min-width: ${(p) => p.theme.breakpoint.sm}px) { font-size: 28px; }
`;
const CountSub = styled.div`font-family: ${(p) => p.theme.font.display}; font-size: 14px; color: #828282;`;
const PillRow = styled.div`margin-top: 24px; display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;`;
const PrimaryPill = styled(Link)`
  padding: 18px 34px; border-radius: 32px; background-color: #8c6cff; font-family: ${(p) => p.theme.font.display}; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none;
  transition: background-color 0.2s ease-in-out;
  &:hover { background-color: #7754f6; } &:active { background-color: #6b42ff; }
`;
const SecondaryPill = styled(Link)`
  padding: 17px 30px; border-radius: 32px; border: 1px solid #cdbfff; background-color: #ffffff; font-family: ${(p) => p.theme.font.display}; font-size: 16px; font-weight: 700; color: #8c6cff; text-decoration: none;
  transition: background-color 0.2s ease-in-out;
  &:hover { background-color: #e4ddff; } &:active { background-color: #d1c6ff; }
`;
const NoSignUp = styled.div`margin-top: 20px; font-family: ${(p) => p.theme.font.display}; font-size: 13px; color: #828282; text-align: center; max-width: 46ch; line-height: 1.5; word-break: keep-all;`;

/* ---------------------------------------------------------------- shared section bits */
const Section = styled.section<{ $bg?: string }>`
  width: 100%; padding: 96px 40px; background-color: ${(p) => p.$bg ?? '#ffffff'};
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: 64px 16px; }
`;
const Inner = styled.div`max-width: ${(p) => p.theme.layout.maxWidthLanding}; margin: 0 auto;`;
const SectionTitle = styled.h2`
  margin: 0; font-family: ${(p) => p.theme.font.display}; font-weight: 800; color: #333333; text-align: center; word-break: keep-all;
  font-size: 28px;
  @media (min-width: ${(p) => p.theme.breakpoint.sm}px) { font-size: 34px; }
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { font-size: 40px; }
`;
const SectionSub = styled.p`
  margin: 16px auto 0; font-family: ${(p) => p.theme.font.display}; color: #5c5c5c; text-align: center; white-space: pre-wrap; max-width: 60ch; line-height: 1.6; word-break: keep-all;
  font-size: 15px;
  @media (min-width: ${(p) => p.theme.breakpoint.sm}px) { font-size: 17px; }
`;

/* ---------------------------------------------------------------- audience */
const AudienceGrid = styled.div`
  margin-top: 56px; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;
`;
const AudienceCard = styled.div<{ $dev?: boolean }>`
  display: flex; flex-direction: column; padding: 32px; border-radius: 20px; background: ${(p) => (p.$dev ? '#2b2b2b' : '#ffffff')}; color: ${(p) => (p.$dev ? '#f2f2f2' : '#333333')};
  border: 1px solid ${(p) => (p.$dev ? '#444444' : '#e6e6e6')}; box-shadow: 0 2px 16px rgba(0, 0, 0, 0.04);
`;
const AudienceTitle = styled.h3`margin: 0; font-family: ${(p) => p.theme.font.display}; font-size: 22px; font-weight: 800; line-height: 1.3; word-break: keep-all;`;
const AudienceHelp = styled.p`margin: 10px 0 0; font-size: 14px; line-height: 1.6; opacity: 0.8; word-break: keep-all;`;
const Steps = styled.ol`
  margin: 20px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 12px; flex: 1;
  li { display: flex; gap: 12px; font-size: 14px; line-height: 1.55; word-break: keep-all; }
  li b { flex: none; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; background: #f5eefc; color: #5b1ca8; }
`;
const AudienceCta = styled(Link)<{ $dev?: boolean }>`
  margin-top: 24px; align-self: flex-start; padding: 12px 22px; border-radius: 28px; font-size: 14px; font-weight: 700; text-decoration: none;
  background: ${(p) => (p.$dev ? '#ffffff' : '#8c6cff')}; color: ${(p) => (p.$dev ? '#333333' : '#ffffff')};
  &:hover { opacity: 0.9; }
`;
/** Secondary route on the creator card: node operators who already have a knowledge file go to the (sign-in walled) register form. */
const AudienceAlt = styled(Link)`
  margin-top: 14px; font-size: 13px; line-height: 1.5; color: #5b1ca8; text-decoration: none; word-break: keep-all;
  &:hover { text-decoration: underline; }
`;
const AudienceOff = styled.p`margin: 14px 0 0; font-size: 13px; line-height: 1.5; color: #8d8d8f; word-break: keep-all;`;
const DevLabel = styled.div`
  margin-top: 24px; display: inline-flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #c9b8ff; cursor: help;
  &::before { content: '</>'; font-family: ${(p) => p.theme.font.mono}; font-size: 12px; padding: 2px 6px; border-radius: 4px; background: #3f3f3f; color: #ffffff; letter-spacing: 0; }
`;
const Cmd = styled.code`
  display: block; margin-top: 8px; padding: 12px 16px; border-radius: 8px; background: #1b1b1b; color: #d6c7ff; font-family: ${(p) => p.theme.font.mono}; font-size: 13px; line-height: 1.6; text-align: left; white-space: pre; overflow-x: auto;
`;

/* ---------------------------------------------------------------- one line (publish / use) */
const OneLineGrid = styled.div`
  display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 32px;
`;
const OneLineCard = styled.div`
  background: #ffffff; border: 1px solid #e6e6e6; border-radius: 16px; padding: 24px 24px 20px; display: flex; flex-direction: column; gap: 12px; text-align: left;
`;
const OneLineWho = styled.h3`margin: 0; font-family: ${(p) => p.theme.font.display}; font-size: 20px; font-weight: 800; color: #333333; word-break: keep-all;`;
const OneLineHelp = styled.p`margin: 0; font-size: 14px; line-height: 1.6; color: #5c5c5c; word-break: keep-all;`;
const OneLineCmdRow = styled.div`display: flex; gap: 10px; align-items: flex-start; ${Cmd} { flex: 1; margin-top: 0; white-space: pre-wrap; word-break: break-all; }`;
const OneLineCaption = styled.p`margin: 12px auto 0; font-family: ${(p) => p.theme.font.display}; font-size: 14px; color: #828282; text-align: center; max-width: 60ch; word-break: keep-all;`;
const OneLineMore = styled(Link)`display: inline-block; margin-top: 20px; font-family: ${(p) => p.theme.font.display}; font-size: 15px; font-weight: 700; color: #8c6cff; text-decoration: none; &:hover { text-decoration: underline; }`;

/* ---------------------------------------------------------------- how it works */
const HowGrid = styled.div`
  margin-top: 64px; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 40px;
`;
const HowStep = styled.div`display: flex; flex-direction: column; align-items: center; text-align: center;`;
const HowImg = styled.img`width: 200px; object-fit: contain;`;
const HowNum = styled.div`margin-top: 20px; font-family: ${(p) => p.theme.font.display}; font-size: 13px; font-weight: 800; letter-spacing: 0.1em; color: #8c6cff;`;
const HowTitle = styled.h3`margin: 6px 0 0; font-family: ${(p) => p.theme.font.display}; font-size: 24px; font-weight: 800; line-height: 1.33; color: #000000; cursor: help;`;
const HowDesc = styled.p`margin: 16px 0 0; font-family: ${(p) => p.theme.font.display}; font-size: 15px; line-height: 1.6; color: #333333; max-width: 38ch; word-break: keep-all;`;

/* ---------------------------------------------------------------- trending */
const CardGrid = styled.div`
  min-height: 200px; margin: 56px auto 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 400px)); gap: 32px; justify-content: center;
`;
const TrendCard = styled(Link)`
  display: flex; flex-direction: column; max-width: 400px; width: 100%; border-radius: 24px; background-color: #ffffff; text-decoration: none; color: inherit; overflow: hidden;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  &:hover { transform: translateY(-8px); box-shadow: 0 1px 20px 8px rgba(0, 0, 0, 0.1); }
`;
const TrendHead = styled.div`
  position: relative; min-height: 150px; padding: 24px; display: flex; flex-direction: column; justify-content: flex-end;
  background: linear-gradient(135deg, #452a67 0%, #8b3eeb 60%, #78d9e9 130%);
`;
const TrendName = styled.div`
  font-family: ${(p) => p.theme.font.display}; font-size: 22px; font-weight: 800; color: #ffffff; text-shadow: 0 2px 16px rgba(0, 0, 0, 0.5); line-height: 1.25; word-break: keep-all;
  overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
`;
const TrendMeta = styled.div`margin-top: 8px; font-size: 12px; color: rgba(255, 255, 255, 0.9);`;
const TrendBody = styled.div`padding: 20px 24px 24px; display: flex; flex-direction: column; gap: 10px;`;
const TrendLine = styled.div`
  display: flex; justify-content: space-between; align-items: center; gap: 12px; font-family: ${(p) => p.theme.font.display}; font-size: 14px; font-weight: 700; color: #5c5c5c;
  span.v { color: #333333; font-weight: 500; text-align: right; }
  span.ok { color: #44a45f; }
  span.muted { color: #9b9b9b; font-weight: 500; }
`;
const TrendPrice = styled.div`font-family: ${(p) => p.theme.font.display}; font-size: 18px; font-weight: 800; color: #8b3eeb; text-align: right;`;
const TrendNote = styled.div`font-size: 11px; color: #9b9b9b; text-align: right; line-height: 1.4;`;
const EmptyBox = styled.div`
  grid-column: 1 / -1; padding: 40px 24px; border-radius: 20px; border: 1px dashed #cfcfcf; background: #ffffff; text-align: center; font-size: 15px; line-height: 1.6; color: #5c5c5c; word-break: keep-all;
  b { display: block; margin-top: 8px; color: #8b3eeb; }
`;
const FindMore = styled.div`text-align: center; margin-top: 56px;`;
const OutlinePill = styled(Link)`
  display: inline-block; padding: 16px 56px; border-radius: 56px; border: 1px solid #cdbfff; background-color: #ffffff;
  font-family: ${(p) => p.theme.font.body}; font-size: 16px; font-weight: 700; color: #8c6cff; text-decoration: none; transition: background-color 0.2s ease-in-out;
  &:hover { background-color: #e4ddff; } &:active { background-color: #d1c6ff; }
`;

/* ---------------------------------------------------------------- why ainize */
const WhyWrap = styled.div`
  margin-top: 56px; display: grid; grid-template-columns: 1fr; gap: 24px; align-items: start;
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { grid-template-columns: 3fr 2fr; gap: 56px; }
`;
const Timeline = styled.ol`
  margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0;
`;
const TimelineItem = styled.li`
  position: relative; padding: 0 0 32px 32px; border-left: 2px solid #e4ddff;
  &:last-child { border-left-color: transparent; padding-bottom: 0; }
  &::before { content: ''; position: absolute; left: -7px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: #8c6cff; box-shadow: 0 0 0 4px #f5eefc; }
`;
const Year = styled.div`font-family: ${(p) => p.theme.font.display}; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; color: #8c6cff;`;
const WhyTitle = styled.h3`margin: 4px 0 0; font-family: ${(p) => p.theme.font.display}; font-size: 22px; font-weight: 800; color: #333333; word-break: keep-all;`;
const WhyDesc = styled.p`margin: 8px 0 0; font-size: 15px; line-height: 1.65; color: #4a4a4a; max-width: 56ch; word-break: keep-all;`;
const WhyAside = styled.div`
  display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 32px; border-radius: 24px; background: #333333; color: #ffffff; text-align: center;
`;
const AsideLogo = styled.img`height: 40px; width: auto;`;
const AsideBox = styled.img`width: 220px; object-fit: contain; @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { width: 160px; }`;
const AsideText = styled.p`margin: 0; font-family: ${(p) => p.theme.font.display}; font-size: 16px; line-height: 1.6; font-weight: 700; word-break: keep-all; max-width: 30ch;`;
const AsideSub = styled.p`margin: 0; font-size: 13px; line-height: 1.6; color: #bdbdbd; word-break: keep-all; max-width: 40ch;`;

/* ---------------------------------------------------------------- footer (landing variant) */
const FooterSection = styled.footer`
  width: 100%; padding: 56px 24px; background-color: #333333; display: flex; flex-direction: column; align-items: center; gap: 28px;
`;
const FooterLogo = styled.img`height: 22px; width: auto; opacity: 0.9;`;
const FooterLinks = styled.div`display: flex; align-items: center; justify-content: center; gap: 32px; flex-wrap: wrap;`;
const FooterLink = styled(Link)`font-family: ${(p) => p.theme.font.display}; font-size: 15px; color: #f2f2f2; text-decoration: none; &:hover { text-decoration: underline; }`;
const FooterA = styled.a`font-family: ${(p) => p.theme.font.display}; font-size: 15px; color: #f2f2f2; text-decoration: none; &:hover { text-decoration: underline; }`;
const Copyright = styled.div`font-family: ${(p) => p.theme.font.display}; font-size: 13px; color: #9b9b9b; text-align: center;`;

const LOGO = { src: '/static/images/logo-white.png', srcSet: '/static/images/logo-white@2x.png 2x, /static/images/logo-white@3x.png 3x' };
const ONE_LINE_PUBLISH = 'ainize publish ./my-knowledge.npz --name "한국 상장사 종목코드" --model Qwen3.8-Flash-Next --benchmark ./bench.json --price 25';
const ONE_LINE_USE = 'ainize use krx-all-2761';

export default function LandingPage() {
  const { t, term, help, tech, audience } = useT();
  useTitle(t('landing.hero.title'));
  const { locale, setLocale } = useLocale();
  const priceLabel = usePriceLabel();
  const verification = useVerificationLabel();
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const { data: info } = useInfoQuery();
  const { data: trending, isLoading } = useCatalogQuery({ status: 'LISTED', sort: 'popular', limit: 6 });
  const year = new Date().getFullYear();
  const listed = info?.counts.listed;
  const verifying = info ? (info.counts.verifying ?? Math.max(0, info.counts.patches - info.counts.listed - (info.counts.superseded ?? 0) - (info.counts.rejected ?? 0))) : undefined;

  const user = audience('user');
  const creator = audience('creator');
  const operator = audience('operator');

  return (
    <>
      <IntroSection>
        <NavBar $solid={solid}>
          <NavContent>
            <Link to="/" aria-label="Ainize"><NavLogo {...LOGO} alt="Ainize" /></Link>
            <NavLinks>
              <NavLink to="/explore">{t('landing.nav.explore')}</NavLink>
              <NavLink to="/chat">{t('landing.nav.chat')}</NavLink>
              {info?.accepts_contributions && <NavLink to="/chat?teach=1" data-testid="landing-nav-teach">{t('landing.nav.teach')}</NavLink>}
              <NavMuted to="/signing" title={t('landing.nav.signin_help')}>{t('landing.nav.signin')}</NavMuted>
              <LocaleButton onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')} aria-label="language">{t('common.locale')}</LocaleButton>
            </NavLinks>
          </NavContent>
        </NavBar>
        <IntroContent>
          <Hero>
            <HeroLogo {...LOGO} alt="Ainize" />
            <IntroTitle>{t('landing.hero.title')}</IntroTitle>
            <IntroSub title={help('brand')}>{t('landing.hero.sub')}</IntroSub>
            <CountCard>
              <CountTitle title={`${t('landing.hero.count_help')} (${tech('verified')})`}>
                {listed === undefined ? <Shimmer $w="220px" $h="28px" /> : t('landing.hero.count', { n: num(listed) })}
              </CountTitle>
              {verifying !== undefined && verifying > 0 && <CountSub title={help('verifying')}>{t('landing.hero.count_verifying', { n: num(verifying) })}</CountSub>}
              <PillRow>
                <PrimaryPill to="/explore">{t('landing.hero.primary')}</PrimaryPill>
                <SecondaryPill to="/chat" title={help('liveTest')}>{t('landing.hero.secondary')}</SecondaryPill>
              </PillRow>
              <NoSignUp title={`${help('autoPay')} (${tech('autoPay')})`}>{t('landing.hero.note')}</NoSignUp>
            </CountCard>
          </Hero>
          <HeroImage src="/static/images/intro-image.png" alt="" />
        </IntroContent>
      </IntroSection>

      {/* -------- audience switch */}
      <Section $bg="#f7f5fc">
        <Inner>
          <SectionTitle>{t('landing.audience.title')}</SectionTitle>
          <SectionSub>{t('landing.audience.sub')}</SectionSub>
          <AudienceGrid>
            <AudienceCard>
              <AudienceTitle>{user.title}</AudienceTitle>
              <AudienceHelp>{user.help}</AudienceHelp>
              <Steps>
                <li><b>1</b><span>{t('landing.audience.user.s1')}</span></li>
                <li><b>2</b><span>{t('landing.audience.user.s2')}</span></li>
                <li><b>3</b><span>{t('landing.audience.user.s3')}</span></li>
              </Steps>
              <AudienceCta to="/explore">{t('landing.audience.user.cta')}</AudienceCta>
            </AudienceCard>

            {/* creator card = teach mode (spec §5.1 / §11): CTA → Live test with the teach banner; the register form stays an operator route */}
            <AudienceCard data-testid="landing-creator-card">
              <AudienceTitle>{t('landing.audience.creator.title')}</AudienceTitle>
              <AudienceHelp>{creator.help}</AudienceHelp>
              <Steps>
                <li><b>1</b><span title={help('liveTest')}>{t('landing.audience.creator.s1')}</span></li>
                <li><b>2</b><span>{t('landing.audience.creator.s2')}</span></li>
                <li><b>3</b><span title={`${term('lineage')}: ${help('lineage')} (${tech('lineage')})`}>{t('landing.audience.creator.s3')}</span></li>
              </Steps>
              <AudienceCta to="/chat?teach=1" data-testid="landing-teach-cta">{t('landing.audience.creator.cta')}</AudienceCta>
              {info && !info.accepts_contributions && <AudienceOff>{t('landing.audience.creator.off')}</AudienceOff>}
              <AudienceAlt to="/signing?next=%2Fnew-patch" data-testid="landing-register-link">{t('landing.audience.creator.operator_link')}</AudienceAlt>
            </AudienceCard>

            <AudienceCard $dev>
              <AudienceTitle>{operator.title}</AudienceTitle>
              <AudienceHelp>{operator.help}</AudienceHelp>
              <Steps>
                <li><b>1</b><span title={help('node')}>{t('landing.audience.operator.s1')}</span></li>
                <li><b>2</b><span title={`${help('stake')} (${tech('stake')})`}>{t('landing.audience.operator.s2')}</span></li>
                <li><b>3</b><span title={`${help('autoPay')} (${tech('autoPay')})`}>{t('landing.audience.operator.s3')}</span></li>
              </Steps>
              <DevLabel title={t('landing.audience.operator.dev_help')}>{t('landing.audience.operator.dev_label')}</DevLabel>
              <Cmd>{'npm install -g ainize\nainize init\nainize start'}</Cmd>
              <AudienceCta $dev to="/signing">{t('landing.audience.operator.cta')}</AudienceCta>
            </AudienceCard>
          </AudienceGrid>
        </Inner>
      </Section>

      {/* -------- one line: publish / use */}
      <Section $bg="#f7f5fb">
        <Inner>
          <SectionTitle>{t('landing.oneline.title')}</SectionTitle>
          <SectionSub>{t('landing.oneline.sub')}</SectionSub>
          <OneLineGrid>
            <OneLineCard>
              <OneLineWho>{t('landing.oneline.publish.who')}</OneLineWho>
              <OneLineCmdRow><Cmd>{ONE_LINE_PUBLISH}</Cmd><CopyButton text={ONE_LINE_PUBLISH} label={t('common.copy')} /></OneLineCmdRow>
              <OneLineHelp>{t('landing.oneline.publish.help')}</OneLineHelp>
            </OneLineCard>
            <OneLineCard>
              <OneLineWho>{t('landing.oneline.use.who')}</OneLineWho>
              <OneLineCmdRow><Cmd>{ONE_LINE_USE}</Cmd><CopyButton text={ONE_LINE_USE} label={t('common.copy')} /></OneLineCmdRow>
              <OneLineHelp>{t('landing.oneline.use.help')}</OneLineHelp>
            </OneLineCard>
          </OneLineGrid>
          <OneLineCaption>{t('landing.oneline.caption')}</OneLineCaption>
          <div style={{ textAlign: 'center' }}><OneLineMore to="/docs">{t('landing.oneline.more')} →</OneLineMore></div>
        </Inner>
      </Section>

      {/* -------- how it works */}
      <Section>
        <Inner>
          <SectionTitle>{t('landing.how.title')}</SectionTitle>
          <SectionSub>{t('landing.how.sub')}</SectionSub>
          <HowGrid>
            <HowStep>
              <HowImg src="/static/images/feature-testing.png" srcSet="/static/images/feature-testing@2x.png 2x" alt="" />
              <HowNum>01</HowNum>
              <HowTitle title={`${help('verified')} (${tech('verified')})`}>{t('landing.how.step1.title')}</HowTitle>
              <HowDesc>{t('landing.how.step1.desc')}</HowDesc>
            </HowStep>
            <HowStep>
              <HowImg src="/static/images/feature-k8s.png" srcSet="/static/images/feature-k8s@2x.png 2x" alt="" />
              <HowNum>02</HowNum>
              <HowTitle title={`${help('liveTest')} (${tech('liveTest')})`}>{t('landing.how.step2.title')}</HowTitle>
              <HowDesc>{t('landing.how.step2.desc')}</HowDesc>
            </HowStep>
            <HowStep>
              <HowImg src="/static/images/feature-deploy.png" srcSet="/static/images/feature-deploy@2x.png 2x" alt="" />
              <HowNum>03</HowNum>
              <HowTitle title={`${help('apply')} (${tech('apply')}) · ${help('conflict')} (${tech('conflict')})`}>{t('landing.how.step3.title')}</HowTitle>
              <HowDesc>{t('landing.how.step3.desc')}</HowDesc>
            </HowStep>
          </HowGrid>
        </Inner>
      </Section>

      {/* -------- trending verified knowledge */}
      <Section $bg="#eeeeee">
        <Inner>
          <SectionTitle>{t('landing.trending.title')}</SectionTitle>
          <SectionSub>{t('landing.trending.sub')}</SectionSub>
          <CardGrid>
            {isLoading && Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} $w="100%" $h="320px" style={{ borderRadius: 24 }} />)}
            {trending?.items.map((e) => {
              const a = e.anchor;
              const acc = executedAccuracy(e);
              const p = priceLabel(a.price, a.currency ?? info?.currency);
              return (
                <TrendCard key={a.id} to={`/${encodeURIComponent(a.author)}/${encodeURIComponent(a.id)}`}>
                  <TrendHead>
                    <TrendName>{a.name || a.id}</TrendName>
                    <TrendMeta>{t('common.author')}: {a.author_name ?? shortAddr(a.author)} · {a.model.id_M}</TrendMeta>
                  </TrendHead>
                  <TrendBody>
                    <TrendLine title={help('facts')}>{term('facts')} <span className="v">{t('units.facts', { n: num(a.benchmark.queries) })}</span></TrendLine>
                    <TrendLine title={help('accuracy')}>
                      {term('accuracy')}
                      {acc ? <span className="v ok">{acc.pct}% <small>({acc.raw})</small></span> : <span className="muted">{t('landing.trending.accuracy_pending')}</span>}
                    </TrendLine>
                    {acc && <ScoreBar pct={acc.pct} />}
                    <TrendLine title={`${help('verified')} (${tech('verified')})`}>{term('verified')} <span className="v">{verification(e)}</span></TrendLine>
                    <TrendLine>
                      {t('common.price')}
                      <div><TrendPrice>{p.text}</TrendPrice>{p.note && <TrendNote>{p.note}</TrendNote>}</div>
                    </TrendLine>
                  </TrendBody>
                </TrendCard>
              );
            })}
            {!isLoading && trending && trending.items.length === 0 && (
              <EmptyBox>
                {t('landing.trending.empty')}
                {verifying !== undefined && verifying > 0 && <b>{t('landing.trending.empty_count', { n: num(verifying) })}</b>}
              </EmptyBox>
            )}
          </CardGrid>
          <FindMore><OutlinePill to="/explore">{t('landing.trending.more')}</OutlinePill></FindMore>
        </Inner>
      </Section>

      {/* -------- why ainize */}
      <Section>
        <Inner>
          <SectionTitle>{t('landing.why.title')}</SectionTitle>
          <WhyWrap>
            <Timeline>
              <TimelineItem>
                <Year>{t('landing.why.2019.year')}</Year>
                <WhyTitle>{t('landing.why.2019.title')}</WhyTitle>
                <WhyDesc>{t('landing.why.2019.desc')}</WhyDesc>
              </TimelineItem>
              <TimelineItem>
                <Year>{t('landing.why.2026.year')}</Year>
                <WhyTitle>{t('landing.why.2026.title')}</WhyTitle>
                <WhyDesc>{t('landing.why.2026.desc')}</WhyDesc>
              </TimelineItem>
              <TimelineItem>
                <Year>{t('landing.why.ain.year')}</Year>
                <WhyTitle title={`${help('ledger')} (${tech('ledger')})`}>{t('landing.why.ain.title')}</WhyTitle>
                <WhyDesc>{t('landing.why.ain.desc')}</WhyDesc>
              </TimelineItem>
            </Timeline>
            <WhyAside>
              <AsideLogo {...LOGO} alt="Ainize" />
              <AsideBox src="/static/images/github-ainize-box.png" srcSet="/static/images/github-ainize-box@2x.png 2x" alt="" />
              <AsideText>{t('landing.why.tagline')}</AsideText>
              <AsideSub title={tech('brand')}>{help('brand')}</AsideSub>
            </WhyAside>
          </WhyWrap>
        </Inner>
      </Section>

      <FooterSection>
        <FooterLogo {...LOGO} alt="Ainize" />
        <FooterLinks>
          <FooterLink to="/terms">{t('landing.footer.terms')}</FooterLink>
          <FooterLink to="/network">{t('landing.footer.network')}</FooterLink>
          <FooterLink to="/ledger" title={help('ledger')}>{t('landing.footer.ledger')}</FooterLink>
          <FooterA href="https://github.com/ainblockchain/ain-js" target="_blank" rel="noopener noreferrer">ain-js</FooterA>
          <FooterA href="mailto:support@ainize.ai?subject=[Ainize] ">{t('landing.footer.contact')}</FooterA>
        </FooterLinks>
        <Copyright>{t('landing.footer.copyright', { year })}</Copyright>
      </FooterSection>
    </>
  );
}

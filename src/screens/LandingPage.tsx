import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import styled from 'styled-components';
import { useInfoQuery } from '@/api/api';
import { Footer } from '@/components/ui/Footer';
import { useLocale, useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { useAuth } from '@/auth/AuthContext';
import { shortAddr } from '@/utils/format';

/**
 * The landing — four capabilities, then the two things only Ainize does.
 *
 * Owner review 2026-10: "the main page says nothing about model, agent, run, deploy". The page that was here
 * explained the knowledge marketplace (hero count, four audience doors, three how-it-works steps, trending
 * knowledge, a 2019→2026 timeline) and the four capabilities most visitors now come for were not on it at all. This
 * one is built around them, in the order the owner named them, each with one promise, one concrete example and one
 * primary link into the product; teaching and the shared AIN identity follow as the differentiators. The nav, the
 * sign-in affordance and the shared footer are unchanged — `test/nav-parity.test.ts` and
 * `test/account-reachability.test.ts` hold them, and `test/landing.test.ts` holds the sections and their links.
 *
 * Every code sample below is lifted from the how-to it links to (`docs/en/how-to/*.md`), so what a visitor copies off
 * this page is what the docs say runs. The terminal trace in the hero is one push of a real `script` project,
 * `comcom/clef-artwork-search` drawn in the deploy pipeline's own status words.
 */

/* ---------------------------------------------------------------- hero (dark, original Ainize white logo) */
const IntroSection = styled.section`
  width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #333333; overflow: hidden;
`;
/**
 * Finding 68 — this bar carries `position: sticky; top: 0`, but while it lived inside IntroSection (which sets
 * `overflow: hidden` to crop the bleeding hero image) its sticky containing block was that section, so it scrolled
 * away with the hero and 4,400 px of page had no navigation at all: measured viewport top −2,387 at scrollY 2,500.
 * It is now a sibling at the page root, so the document is what it sticks to. IntroSection keeps its `overflow:
 * hidden` and crops the hero image exactly as before.
 */
const NavBar = styled.div<{ $solid: boolean }>`
  width: 100%; position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: center;
  background-color: rgba(51, 51, 51, ${(p) => (p.$solid ? 1 : 0.8)}); transition: background-color 0.2s ease-in-out;
`;
const NavContent = styled.div`
  width: calc(100% - 80px); padding: 24px 40px; max-width: ${(p) => p.theme.layout.maxWidthLanding};
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { width: calc(100% - 32px); padding: 6px 16px 2px; gap: 8px; flex-wrap: wrap; }
`;
/** Logo row on a phone: the home link and the language pill share it, the nav takes the width below them. */
const NavHome = styled(Link)`flex: 0 0 auto; order: 0; display: flex; align-items: center;`;
const NavLogo = styled.img`height: 26px; width: auto; display: block;`;
/**
 * Finding 90 — at 360 px this was three right-ragged rows ("Explore knowledge" alone, then "Live test  Teach",
 * then "Node sign-in") of 20 px-tall targets that read as unfinished layout rather than a menu. Below the sm
 * breakpoint it takes a full-width row of its own under the logo, scrolls horizontally with a visible edge cue,
 * and every item clears the 44 px platform guideline.
 */
const NavLinks = styled.nav`
  display: flex; align-items: center; gap: 20px; flex-wrap: wrap; justify-content: flex-end;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) {
    order: 2; flex: 1 0 100%; min-width: 0; margin: 0 -6px; flex-wrap: nowrap; justify-content: flex-start; gap: 0;
    overflow-x: auto; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch;
    scrollbar-width: none; &::-webkit-scrollbar { display: none; }
    /* The row is wider than a 360 px phone, so it has to LOOK scrollable: two edge shadows that ride with the
       viewport plus two #333 covers that ride with the content, so each shadow disappears at its own end. */
    background:
      linear-gradient(to right, #333333, rgba(51, 51, 51, 0)) left center / 20px 100% no-repeat local,
      linear-gradient(to left, #333333, rgba(51, 51, 51, 0)) right center / 20px 100% no-repeat local,
      radial-gradient(farthest-side at 0 50%, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0)) left center / 12px 100% no-repeat scroll,
      radial-gradient(farthest-side at 100% 50%, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0)) right center / 12px 100% no-repeat scroll;
  }
`;
const NavLink = styled(Link)`
  font-family: ${(p) => p.theme.font.display}; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none;
  /* WCAG 2.5.8 asks for 24 px at every width; the 44 px platform guideline is met below the sm breakpoint, where taps happen. */
  display: inline-flex; align-items: center; min-height: 24px;
  &:hover { text-decoration: underline; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { font-size: 14px; padding: 12px 10px; white-space: nowrap; }
`;
const NavMuted = styled(NavLink)`color: #bdbdbd; font-weight: 500;`;
/** The language toggle is a system setting, not a nav item — same corner as Header.tsx, outside the scrolling row. */
const LocaleButton = styled.button`
  flex: 0 0 auto; padding: 8px 10px; border: 1px solid #6b6b6b; border-radius: 12px; background: transparent; font-size: 12px; color: #dddddd; cursor: pointer;
  &:hover { border-color: #ffffff; color: #ffffff; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { order: 1; margin-left: auto; }
`;
const IntroContent = styled.div`
  width: calc(100% - 80px); max-width: ${(p) => p.theme.layout.maxWidthLanding}; padding: 80px 40px 96px; position: relative;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { width: calc(100% - 32px); padding: 48px 16px 64px; }
`;
/** Copy on the left, the terminal on the right; one column below md, where the terminal follows the buttons. */
const HeroGrid = styled.div`
  display: grid; gap: 40px; grid-template-columns: minmax(0, 1fr); align-items: center;
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { grid-template-columns: minmax(0, 11fr) minmax(0, 10fr); gap: 56px; }
`;
const Hero = styled.div`display: flex; flex-direction: column; align-items: flex-start; justify-content: center;`;
const HeroLogo = styled.img`height: 44px; width: auto; margin-bottom: 28px; z-index: 2; @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { height: 32px; }`;
const IntroTitle = styled.h1`
  z-index: 2; margin: 0; font-family: ${(p) => p.theme.font.display}; font-weight: 800; line-height: 1.18; color: #ffffff; white-space: pre-wrap; max-width: 20ch; word-break: keep-all;
  font-size: 30px;
  @media (min-width: ${(p) => p.theme.breakpoint.sm}px) { font-size: 40px; }
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { font-size: 48px; }
`;
const IntroSub = styled.p`
  z-index: 2; margin: 20px 0 0; font-family: ${(p) => p.theme.font.display}; font-weight: 500; line-height: 1.65; color: #e6e6e6; max-width: 56ch; word-break: keep-all;
  font-size: 15px;
  @media (min-width: ${(p) => p.theme.breakpoint.sm}px) { font-size: 17px; }
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { font-size: 18px; }
`;
const PillRow = styled.div`margin-top: 32px; display: flex; gap: 12px; flex-wrap: wrap;`;
const PrimaryPill = styled(Link)`
  padding: 16px 30px; border-radius: 32px; background-color: ${(p) => p.theme.color.LANDING_ACCENT}; font-family: ${(p) => p.theme.font.display}; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none;
  transition: background-color 0.2s ease-in-out;
  &:hover { background-color: ${(p) => p.theme.color.LANDING_ACCENT_HOVER}; } &:active { background-color: ${(p) => p.theme.color.LANDING_ACCENT_ACTIVE}; }
`;
const SecondaryPill = styled(Link)`
  padding: 15px 26px; border-radius: 32px; border: 1px solid ${(p) => p.theme.color.LANDING_BORDER}; background-color: transparent; font-family: ${(p) => p.theme.font.display}; font-size: 16px; font-weight: 700; color: #e4ddff; text-decoration: none;
  transition: background-color 0.2s ease-in-out;
  &:hover { background-color: rgba(140, 108, 255, 0.18); }
`;
const HeroNote = styled.p`margin: 20px 0 0; font-family: ${(p) => p.theme.font.display}; font-size: 13px; line-height: 1.5; color: #b6b6c0; max-width: 56ch; word-break: keep-all;`;

/* ---------------------------------------------------------------- the terminal: push → deployed */
const Terminal = styled.figure`
  margin: 0; border-radius: 16px; background: #1d1d20; border: 1px solid #45454c; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45); overflow: hidden; min-width: 0;
`;
const TerminalBar = styled.div`
  display: flex; align-items: center; gap: 6px; padding: 10px 14px; background: #2a2a2f; border-bottom: 1px solid #3a3a40;
  span { width: 10px; height: 10px; border-radius: 50%; background: #5a5a62; }
  em { margin-left: 8px; font-family: ${(p) => p.theme.font.mono}; font-style: normal; font-size: 12px; color: #9b9ba3; }
`;
const TerminalBody = styled.pre`
  margin: 0; padding: 18px 20px 20px; font-family: ${(p) => p.theme.font.mono}; font-size: 13px; line-height: 1.6; color: #d9d9e0; overflow-x: auto; white-space: pre;
  .p { color: #8c6cff; } .c { color: #7f7f88; } .ok { color: #7ed89a; } .k { color: #78d9e9; } .d { color: #f6c177; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { font-size: 12px; padding: 14px 16px 16px; }
`;
const TerminalCaption = styled.figcaption`margin: 14px 0 0; font-family: ${(p) => p.theme.font.display}; font-size: 13px; line-height: 1.5; color: #b6b6c0; word-break: keep-all;`;

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
  margin: 16px auto 0; font-family: ${(p) => p.theme.font.display}; color: #5c5c5c; text-align: center; max-width: 64ch; line-height: 1.6; word-break: keep-all;
  font-size: 15px;
  @media (min-width: ${(p) => p.theme.breakpoint.sm}px) { font-size: 17px; }
`;
/** Inline `code` in copy. Dictionary strings carry backticks; `rich()` turns them into this. */
const Code = styled.code`font-family: ${(p) => p.theme.font.mono}; font-size: 0.92em; padding: 1px 5px; border-radius: 5px; background: rgba(139, 62, 235, 0.08); color: #5b1ca8;`;
/** A backtick span inside a dictionary sentence becomes <code>; everything else is left as text. */
function rich(s: string): ReactNode[] {
  return s.split(/(`[^`]+`)/g).map((part, i) => (part.startsWith('`') && part.endsWith('`') ? <Code key={i}>{part.slice(1, -1)}</Code> : part));
}

/* ---------------------------------------------------------------- capability grid */
const CapGrid = styled.div`
  margin-top: 56px; display: grid; grid-template-columns: 1fr; gap: 24px;
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
`;
const CapCard = styled.article`
  display: flex; flex-direction: column; min-width: 0; padding: 32px; border-radius: 20px; background: #ffffff; border: 1px solid #e6e6e6; box-shadow: 0 2px 16px rgba(0, 0, 0, 0.04);
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: 24px 20px; }
`;
const CapKicker = styled.div`
  display: flex; align-items: center; gap: 10px; font-family: ${(p) => p.theme.font.display}; font-size: 13px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: ${(p) => p.theme.color.PRIMARY};
  b { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: ${(p) => p.theme.color.PALE_GREY}; color: ${(p) => p.theme.color.HOVER}; font-size: 13px; letter-spacing: 0; }
`;
const CapTitle = styled.h3`margin: 14px 0 0; font-family: ${(p) => p.theme.font.display}; font-size: 22px; font-weight: 800; line-height: 1.3; color: #333333; word-break: keep-all;`;
const CapDesc = styled.p`margin: 12px 0 0; font-size: 15px; line-height: 1.65; color: #4a4a4a; word-break: keep-all;`;
const CapCode = styled.pre`
  margin: 20px 0 0; padding: 16px 18px; border-radius: 12px; background: #1d1d20; color: #d9d9e0; font-family: ${(p) => p.theme.font.mono}; font-size: 12.5px; line-height: 1.6; overflow-x: auto; white-space: pre; flex: 1;
  .c { color: #7f7f88; } .k { color: #78d9e9; } .s { color: #f6c177; } .p { color: #8c6cff; }
`;
const CapLinks = styled.div`margin-top: 22px; display: flex; align-items: center; gap: 10px 20px; flex-wrap: wrap;`;
const CapCta = styled(Link)`
  padding: 12px 22px; border-radius: 28px; font-size: 14px; font-weight: 700; text-decoration: none; background: ${(p) => p.theme.color.LANDING_ACCENT}; color: #ffffff;
  &:hover { background: ${(p) => p.theme.color.LANDING_ACCENT_HOVER}; }
`;
const CapCtaExt = styled.a`
  padding: 12px 22px; border-radius: 28px; font-size: 14px; font-weight: 700; text-decoration: none; background: ${(p) => p.theme.color.LANDING_ACCENT}; color: #ffffff;
  &:hover { background: ${(p) => p.theme.color.LANDING_ACCENT_HOVER}; }
`;
const docLinkCss = `font-size: 14px; font-weight: 600; line-height: 1.5; color: #5b1ca8; text-decoration: none; word-break: keep-all; display: inline-flex; align-items: center; min-height: 24px;
  &:hover { text-decoration: underline; }`;
const CapDoc = styled(Link)`${docLinkCss}`;
const CapDocExt = styled.a`${docLinkCss}`;

/* ---------------------------------------------------------------- example in 60 seconds */
const ExampleGrid = styled.ol`
  margin: 56px 0 0; padding: 0; list-style: none; display: grid; grid-template-columns: 1fr; gap: 24px; counter-reset: step;
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
`;
const ExampleStep = styled.li`
  position: relative; padding: 28px 28px 28px 28px; border-radius: 20px; background: #ffffff; border: 1px solid #e6e6e6; min-width: 0;
  counter-increment: step;
  &::before { content: counter(step, decimal-leading-zero); font-family: ${(p) => p.theme.font.display}; font-size: 13px; font-weight: 800; letter-spacing: 0.1em; color: ${(p) => p.theme.color.LANDING_ACCENT}; }
`;
const ExampleTitle = styled.h3`margin: 6px 0 0; font-family: ${(p) => p.theme.font.display}; font-size: 22px; font-weight: 800; color: #333333; word-break: keep-all;`;
const ExampleDesc = styled.p`margin: 10px 0 0; font-size: 15px; line-height: 1.65; color: #4a4a4a; word-break: keep-all;`;
const ExampleLog = styled.pre`
  margin: 16px 0 0; padding: 12px 14px; border-radius: 10px; background: #1d1d20; color: #d9d9e0; font-family: ${(p) => p.theme.font.mono}; font-size: 12px; line-height: 1.55; overflow-x: auto; white-space: pre;
  .ok { color: #7ed89a; } .c { color: #7f7f88; } .d { color: #f6c177; }
`;
const ExampleLinks = styled.div`margin-top: 40px; display: flex; justify-content: center; align-items: center; gap: 12px 28px; flex-wrap: wrap;`;
const OutlinePillExt = styled.a`
  display: inline-block; padding: 16px 44px; border-radius: 56px; border: 1px solid ${(p) => p.theme.color.LANDING_BORDER}; background-color: #ffffff;
  font-family: ${(p) => p.theme.font.body}; font-size: 16px; font-weight: 700; color: ${(p) => p.theme.color.LANDING_ACCENT}; text-decoration: none; transition: background-color 0.2s ease-in-out;
  &:hover { background-color: #e4ddff; } &:active { background-color: #d1c6ff; }
`;

/* ---------------------------------------------------------------- what only ainize does */
const OnlyGrid = styled.div`
  margin-top: 56px; display: grid; grid-template-columns: 1fr; gap: 24px; align-items: stretch;
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { grid-template-columns: 3fr 2fr; }
`;
const OnlyCard = styled.article<{ $dark?: boolean }>`
  display: flex; flex-direction: column; min-width: 0; padding: 36px; border-radius: 24px;
  background: ${(p) => (p.$dark ? '#333333' : '#ffffff')}; color: ${(p) => (p.$dark ? '#f2f2f2' : '#333333')};
  border: 1px solid ${(p) => (p.$dark ? '#444444' : '#e6e6e6')};
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: 24px 20px; }
`;
const OnlyKicker = styled.div<{ $dark?: boolean }>`font-family: ${(p) => p.theme.font.display}; font-size: 13px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: ${(p) => (p.$dark ? '#c9b8ff' : p.theme.color.PRIMARY)};`;
const OnlyTitle = styled.h3`margin: 12px 0 0; font-family: ${(p) => p.theme.font.display}; font-size: 26px; font-weight: 800; line-height: 1.3; word-break: keep-all;`;
const OnlyDesc = styled.p`margin: 12px 0 0; font-size: 15px; line-height: 1.7; opacity: 0.88; word-break: keep-all; flex: 1;`;
const OnlyLinks = styled.div`margin-top: 24px; display: flex; align-items: center; gap: 10px 20px; flex-wrap: wrap;`;
const OnlyCta = styled(Link)<{ $dark?: boolean }>`
  padding: 12px 22px; border-radius: 28px; font-size: 14px; font-weight: 700; text-decoration: none;
  background: ${(p) => (p.$dark ? '#ffffff' : p.theme.color.LANDING_ACCENT)}; color: ${(p) => (p.$dark ? '#333333' : '#ffffff')};
  &:hover { opacity: 0.9; }
`;
const OnlyDoc = styled(Link)<{ $dark?: boolean }>`
  font-size: 14px; font-weight: 600; line-height: 1.5; text-decoration: none; word-break: keep-all; display: inline-flex; align-items: center; min-height: 24px;
  color: ${(p) => (p.$dark ? '#c9b8ff' : '#5b1ca8')};
  &:hover { text-decoration: underline; }
`;
/** Product names in the identity card: static, so they are not dictionary strings. */
const Products = styled.div`
  margin-top: 20px; display: flex; gap: 8px; flex-wrap: wrap;
  span { padding: 6px 12px; border-radius: 14px; border: 1px solid #5a5a62; font-family: ${(p) => p.theme.font.mono}; font-size: 12px; color: #e6e6e6; }
`;

const LOGO = { src: '/static/images/logo-white.png', srcSet: '/static/images/logo-white@2x.png 2x, /static/images/logo-white@3x.png 3x' };
/** The example project — a real `script` repo; both URLs are the ones the deploy how-to names. */
const EXAMPLE_PROJECT = 'https://ainize.ai/comcom/clef-artwork-search';
const EXAMPLE_REPO = 'https://aindrive.ainetwork.ai/comcom/git/clef-artwork-search';
const AINDRIVE = 'https://aindrive.ainetwork.ai';

export default function LandingPage() {
  const { t, audience } = useT();
  useTitle(t('landing.hero.title').replace('\n', ' '));
  const { locale, setLocale } = useLocale();
  const [solid, setSolid] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  /**
   * The bar is translucent while it floats over the dark hero and opaque once the page under it is light. The old
   * threshold was a hard-coded 600 px that could never fire (finding 68: the bar was not sticky at all); it is now
   * the hero's own measured height, which is the point at which the bar stops being over #333.
   */
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > Math.max(0, (heroRef.current?.offsetHeight ?? 600) - 120));
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);
  /** Only for the nav: the Teach entry is gated on the node accepting contributions, as in Header.tsx. */
  const infoQ = useInfoQuery();
  const info = infoQ.data;
  /**
   * Who is signed in, for the nav. The landing drew "Sign in" whatever the session said — and "/" is where a
   * Google sign-in lands by default — so a person who had just signed in arrived on a page telling them to sign
   * in, and read it as the sign-in not having held.
   */
  const auth = useAuth();
  const signedInAs = auth.subject ? shortAddr(auth.subject, 6) : auth.sso ? (auth.sso.email ?? auth.sso.name ?? 'AIN') : auth.google?.email ?? null;
  /** The glossary's agent-builder entry — the one sentence on this site written for somebody who already has an agent. */
  const agentBuilder = audience('agent');

  return (
    <>
      {/* Finding 68: a sibling of the hero, not a child of it — an ancestor with `overflow: hidden` is what kept
          `position: sticky` from ever sticking. */}
      <NavBar $solid={solid} data-testid="landing-nav">
        <NavContent>
          <NavHome to="/" aria-label="Ainize"><NavLogo {...LOGO} alt="Ainize" /></NavHome>
          <NavLinks aria-label={t('landing.nav.aria')}>
            <NavLink to="/explore">{t('landing.nav.explore')}</NavLink>
            {/* The landing has its own chrome, and adding the entry to the shared header (Header.tsx) left this
                one without it — which is the nav a first-time visitor actually sees. */}
            <NavLink to="/explore?kind=agent" data-testid="landing-nav-agents">{t('nav.agents')}</NavLink>
            <NavLink to="/models" data-testid="landing-nav-models">{t('nav.models')}</NavLink>
            {info?.accepts_contributions && <NavLink to="/chat?teach=1" data-testid="landing-nav-teach">{t('landing.nav.teach')}</NavLink>}
            {/* The network and the public record were in every page's header and in neither of the landing's
                chromes — the third time an entry was added to Header.tsx and not to this one. The two are now
                held to the same list by test/nav-parity.test.ts, so a fourth is a failing test rather than a
                visitor who never finds the page. */}
            {/* Finding 69: /docs was in every other page's header and in neither of the landing's chromes. */}
            {auth.isSignedIn && <NavLink to="/org" data-testid="landing-nav-my-orgs">{t('orgs.mine')}</NavLink>}
            <NavLink to="/docs" data-testid="landing-nav-docs">{t('nav.docs')}</NavLink>
            {auth.isSignedIn && signedInAs
              ? <NavMuted to={auth.subject ? '/my-nodes' : '/models'} data-testid="landing-nav-account" title={auth.subject ?? auth.sso?.email ?? auth.google?.email ?? ''}>{signedInAs}</NavMuted>
              : <NavMuted to="/signing" title={t('landing.nav.signin_help')}>{t('landing.nav.signin')}</NavMuted>}
          </NavLinks>
          <LocaleButton onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')} aria-label="language">{t('common.locale')}</LocaleButton>
        </NavContent>
      </NavBar>

      {/* -------- hero: the four capabilities in one sentence, and the trace of a push that used all of them */}
      <IntroSection ref={heroRef}>
        <IntroContent>
          <HeroGrid>
            <Hero>
              <HeroLogo {...LOGO} alt="Ainize" />
              <IntroTitle data-testid="hero-title">{t('landing.hero.title')}</IntroTitle>
              <IntroSub>{t('landing.hero.sub')}</IntroSub>
              <PillRow>
                <PrimaryPill to="/models" data-testid="hero-primary">{t('landing.hero.primary')}</PrimaryPill>
                {/* The live test stays reachable from the hero: it left the menu because this button leads there
                    (test/account-reachability.test.ts). With `?teach=1` it opens with the teach banner up. */}
                <SecondaryPill to="/chat" data-testid="hero-secondary">{t('landing.hero.secondary')}</SecondaryPill>
              </PillRow>
              <HeroNote>{t('landing.hero.note')}</HeroNote>
            </Hero>
            {/* A sketch of one push in the deploy pipeline's own words: the statuses are its (`queued → building →
                ready`, docs/en/how-to/deploy-with-ainize-json.md), the file, the kind, the entry and the env names are
                the example project's, and the three ranked lines stand for what `art_search.py` prints. The titles
                are placeholders — the real ranking is in the project's deployment log, which the caption links. */}
            <Terminal aria-label={t('landing.hero.trace_aria')} data-testid="hero-trace">
              <TerminalBar aria-hidden="true"><span /><span /><span /><em>comcom/clef-artwork-search</em></TerminalBar>
              <TerminalBody>
                <span className="p">$</span> git push origin main{'\n'}
                <span className="c">remote: ainize: ainize.json found · kind=script · entry=art_search.py</span>{'\n'}
                <span className="c">remote: ainize: deployment d_8f21 </span><span className="d">queued</span>{'\n'}
                <span className="c">remote: ainize: deployment d_8f21 </span><span className="d">building</span>{'\n'}
                <span className="c">remote:   sandbox  python3.11 · AINIZE_URL · AINIZE_API_KEY (yours)</span>{'\n'}
                <span className="c">remote:   run      client.decide(</span><span className="k">"clef-flash"</span><span className="c">, state=…, questions=…)</span>{'\n'}
                <span className="c">remote:   #1 0.91  </span>Fishing Boats at Sunset{'\n'}
                <span className="c">remote:   #2 0.74  </span>Evening on the Bay{'\n'}
                <span className="c">remote:   #3 0.33  </span>Still Life with Pears{'\n'}
                <span className="c">remote: ainize: deployment d_8f21 </span><span className="ok">ready</span><span className="c"> · log at /comcom/clef-artwork-search</span>{'\n'}
              </TerminalBody>
            </Terminal>
          </HeroGrid>
          <TerminalCaption>{t('landing.hero.trace_caption')}</TerminalCaption>
        </IntroContent>
      </IntroSection>

      {/* -------- the four capabilities, in the order the owner named them */}
      <Section $bg="#f7f5fc" data-testid="landing-capabilities">
        <Inner>
          <SectionTitle>{t('landing.cap.title')}</SectionTitle>
          <SectionSub>{t('landing.cap.sub')}</SectionSub>
          <CapGrid>
            {/* 1 · Models — docs/en/how-to/call-the-model.md and decision-models-clef.md */}
            <CapCard data-testid="cap-models">
              <CapKicker><b>1</b>{t('landing.cap.models.kicker')}</CapKicker>
              <CapTitle>{t('landing.cap.models.title')}</CapTitle>
              <CapDesc>{rich(t('landing.cap.models.desc'))}</CapDesc>
              <CapCode aria-label="Python">
                <span className="c"># pip install ainize</span>{'\n'}
                <span className="k">import</span> os, ainize{'\n'}
                client = ainize.connect(<span className="s">"https://ainize.ai"</span>, api_key=os.environ[<span className="s">"AINIZE_API_KEY"</span>]){'\n'}
                {'\n'}
                <span className="c"># chat — the client you already use</span>{'\n'}
                client.chat.completions.create(model=<span className="s">"Qwen3.8-Flash-Next"</span>, messages=[…]){'\n'}
                {'\n'}
                <span className="c"># decision (Cloudflare Clef) — a probability, not prose</span>{'\n'}
                out = client.decide(<span className="s">"clef-flash"</span>, state=situation, questions={'{'}{'\n'}
                {'  '}<span className="s">"outage"</span>: {'{'}<span className="s">"type"</span>: <span className="s">"noul"</span>, <span className="s">"instructions"</span>: <span className="s">"Is a service down?"</span>{'}'},{'\n'}
                {'}'}){'\n'}
                out.answers[<span className="s">"outage"</span>][<span className="s">"noul"</span>]  <span className="c"># 0.93</span>
              </CapCode>
              <CapLinks>
                <CapCta to="/models" data-testid="cap-models-cta">{t('landing.cap.models.cta')}</CapCta>
                <CapDoc to="/docs/how-to/call-the-model">{t('landing.cap.models.docs')}</CapDoc>
                <CapDoc to="/docs/how-to/decision-models-clef">{t('landing.cap.models.docs2')}</CapDoc>
              </CapLinks>
            </CapCard>

            {/* 2 · Agents — docs/en/how-to/host-an-agent.md and create-an-agent-from-a-model.md */}
            <CapCard data-testid="cap-agents" title={agentBuilder.help}>
              <CapKicker><b>2</b>{t('landing.cap.agents.kicker')}</CapKicker>
              <CapTitle>{t('landing.cap.agents.title')}</CapTitle>
              <CapDesc>{rich(t('landing.cap.agents.desc'))}</CapDesc>
              <CapCode aria-label="Shell">
                <span className="c"># an agent you already run, on 127.0.0.1:9200</span>{'\n'}
                <span className="p">$</span> ainize agent add my-desk --upstream http://127.0.0.1:9200{'\n'}
                <span className="p">$</span> ainize agent ls{'\n'}
                my-desk   answering   5 skills   <span className="k">https://ainize.ai/agents/my-desk</span>{'\n'}
                {'\n'}
                <span className="c"># the card every A2A client fetches first — the url is the node's</span>{'\n'}
                <span className="p">$</span> curl -s https://ainize.ai/agents/my-desk/.well-known/agent-card.json{'\n'}
                {'\n'}
                <span className="c"># no agent yet? build one on a chat model: prompt, tools or handler</span>{'\n'}
                <span className="c">→ /agent/new</span>
              </CapCode>
              <CapLinks>
                {/* `landing-agent-cta` + the host-an-agent how-to: the way in for somebody holding an agent (test/backend.test.ts). */}
                <CapCta to="/explore?kind=agent" data-testid="landing-agent-cta">{t('landing.cap.agents.cta')}</CapCta>
                <CapDoc to="/docs/how-to/host-an-agent">{t('landing.cap.agents.docs')}</CapDoc>
                <CapDoc to="/docs/how-to/create-an-agent-from-a-model">{t('landing.cap.agents.docs2')}</CapDoc>
              </CapLinks>
            </CapCard>

            {/* 3 · Run — docs/en/how-to/deploy-with-ainize-json.md (`script`, Inputs) and decision-models-clef.md ("Inside an Ainize run") */}
            <CapCard data-testid="cap-run">
              <CapKicker><b>3</b>{t('landing.cap.run.kicker')}</CapKicker>
              <CapTitle>{t('landing.cap.run.title')}</CapTitle>
              <CapDesc>{rich(t('landing.cap.run.desc'))}</CapDesc>
              <CapCode aria-label="Python">
                <span className="c"># art_search.py — pressed ▶ Run in aindrive, or run from the project's Runs tab</span>{'\n'}
                <span className="k">import</span> os, ainize{'\n'}
                client = ainize.connect(os.environ[<span className="s">"AINIZE_URL"</span>], api_key=os.environ[<span className="s">"AINIZE_API_KEY"</span>]){'\n'}
                desc = os.environ.get(<span className="s">"INPUT_DESC"</span>)  <span className="c"># a field the Run panel showed, from ainize.json "inputs"</span>{'\n'}
                {'\n'}
                <span className="c"># read-only sandbox · 512 MB · one CPU · no network except this node</span>{'\n'}
                <span className="c"># stdout + exit code → the run's record</span>
              </CapCode>
              <CapLinks>
                <CapCta to="/docs/how-to/deploy-with-ainize-json" data-testid="cap-run-cta">{t('landing.cap.run.cta')}</CapCta>
                <CapDocExt href={AINDRIVE} target="_blank" rel="noopener noreferrer">{t('landing.cap.run.docs')}</CapDocExt>
              </CapLinks>
            </CapCard>

            {/* 4 · Deploy — docs/en/how-to/deploy-with-ainize-json.md; the file is the example project's own */}
            <CapCard data-testid="cap-deploy">
              <CapKicker><b>4</b>{t('landing.cap.deploy.kicker')}</CapKicker>
              <CapTitle>{rich(t('landing.cap.deploy.title'))}</CapTitle>
              <CapDesc>{rich(t('landing.cap.deploy.desc'))}</CapDesc>
              <CapCode aria-label="ainize.json">
                <span className="c">// ainize.json — at the repo root; kind: script | service | nextjs | agent</span>{'\n'}
                {'{'}{'\n'}
                {'  '}<span className="k">"name"</span>: <span className="s">"clef-artwork-search"</span>,{'\n'}
                {'  '}<span className="k">"kind"</span>: <span className="s">"script"</span>,{'\n'}
                {'  '}<span className="k">"runtime"</span>: <span className="s">"python3.11"</span>,{'\n'}
                {'  '}<span className="k">"entry"</span>: <span className="s">"art_search.py"</span>,{'\n'}
                {'  '}<span className="k">"inputs"</span>: {'{'} <span className="k">"DESC"</span>: {'{'} <span className="k">"type"</span>: <span className="s">"string"</span>, <span className="k">"required"</span>: true {'}'} {'}'},{'\n'}
                {'  '}<span className="k">"timeoutMs"</span>: 120000{'\n'}
                {'}'}{'\n'}
                {'\n'}
                <span className="c">// push → queued → building → ready · deployments, logs, previous kept</span>{'\n'}
                <span className="c">// https://ainize.ai/&lt;org&gt;/&lt;repo&gt;</span>
              </CapCode>
              <CapLinks>
                <CapCta to="/docs/how-to/deploy-with-ainize-json" data-testid="cap-deploy-cta">{t('landing.cap.deploy.cta')}</CapCta>
                <CapDocExt href={EXAMPLE_PROJECT} data-testid="cap-deploy-example">{t('landing.cap.deploy.docs')}</CapDocExt>
              </CapLinks>
            </CapCard>
          </CapGrid>
        </Inner>
      </Section>

      {/* -------- example in 60 seconds: one repo, all four capabilities */}
      <Section data-testid="landing-example">
        <Inner>
          <SectionTitle>{t('landing.example.title')}</SectionTitle>
          <SectionSub>{t('landing.example.sub')}</SectionSub>
          <ExampleGrid>
            <ExampleStep>
              <ExampleTitle>{t('landing.example.s1.title')}</ExampleTitle>
              <ExampleDesc>{rich(t('landing.example.s1.desc'))}</ExampleDesc>
              <ExampleLog><span className="c">$</span> git push origin main{'\n'}<span className="c">remote: ainize: deployment </span><span className="d">queued</span></ExampleLog>
            </ExampleStep>
            <ExampleStep>
              <ExampleTitle>{t('landing.example.s2.title')}</ExampleTitle>
              <ExampleDesc>{rich(t('landing.example.s2.desc'))}</ExampleDesc>
              <ExampleLog><span className="c">building</span>  python3.11 art_search.py{'\n'}<span className="c">decide  </span> clef-flash · 3 questions · 212 tokens</ExampleLog>
            </ExampleStep>
            <ExampleStep>
              <ExampleTitle>{t('landing.example.s3.title')}</ExampleTitle>
              <ExampleDesc>{rich(t('landing.example.s3.desc'))}</ExampleDesc>
              <ExampleLog><span className="ok">ready</span>    #1 0.91  Fishing Boats at Sunset{'\n'}         #2 0.74  Evening on the Bay</ExampleLog>
            </ExampleStep>
          </ExampleGrid>
          <ExampleLinks>
            <OutlinePillExt href={EXAMPLE_PROJECT} data-testid="example-project">{t('landing.example.cta')}</OutlinePillExt>
            <CapDocExt href={EXAMPLE_REPO} target="_blank" rel="noopener noreferrer">{t('landing.example.repo')}</CapDocExt>
          </ExampleLinks>
        </Inner>
      </Section>

      {/* -------- what only ainize does: teach, and one identity */}
      <Section $bg="#eeeeee" data-testid="landing-only">
        <Inner>
          <SectionTitle>{t('landing.only.title')}</SectionTitle>
          <OnlyGrid>
            <OnlyCard data-testid="only-teach">
              <OnlyKicker>{t('landing.only.teach.kicker')}</OnlyKicker>
              <OnlyTitle>{t('landing.only.teach.title')}</OnlyTitle>
              <OnlyDesc>{t('landing.only.teach.desc')}</OnlyDesc>
              <OnlyLinks>
                <OnlyCta to="/teach" data-testid="only-teach-cta">{t('landing.only.teach.cta')}</OnlyCta>
                <OnlyDoc to="/docs/concepts/knowledge-patch">{t('landing.only.teach.l1')}</OnlyDoc>
                <OnlyDoc to="/docs/concepts/lineage-and-royalties">{t('landing.only.teach.l2')}</OnlyDoc>
                <OnlyDoc to="/docs/how-to/run-a-verifier">{t('landing.only.teach.l3')}</OnlyDoc>
              </OnlyLinks>
            </OnlyCard>
            <OnlyCard $dark data-testid="only-identity">
              <OnlyKicker $dark>{t('landing.only.identity.kicker')}</OnlyKicker>
              <OnlyTitle>{t('landing.only.identity.title')}</OnlyTitle>
              <OnlyDesc>{rich(t('landing.only.identity.desc'))}</OnlyDesc>
              <Products aria-hidden="true"><span>ainize</span><span>aindrive</span><span>ainteams</span><span>ainmem</span></Products>
              <OnlyLinks>
                <OnlyCta $dark to="/signing" data-testid="only-identity-cta">{t('landing.only.identity.cta')}</OnlyCta>
                <OnlyDoc $dark to="/docs/how-to/organizations">{t('landing.only.identity.l1')}</OnlyDoc>
                <OnlyDoc $dark to="/docs/how-to/build-for-ainteams">{t('landing.only.identity.l2')}</OnlyDoc>
              </OnlyLinks>
            </OnlyCard>
          </OnlyGrid>
        </Inner>
      </Section>

      {/* Finding 99: one footer component, one link list — the landing's own list named the same destinations
          differently from every other page's and had no Privacy link at all. */}
      <Footer variant="landing" />
    </>
  );
}

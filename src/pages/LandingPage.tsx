import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import styled from 'styled-components';
import { useCatalogQuery, useInfoQuery } from '@/api/api';
import type { CatalogEntry } from '@/api/types';
import { Logo } from '@/components/ui/Logo';
import { ScoreBar, Shimmer } from '@/components/ui/Misc';
import { num, pct, price, scoreText, shortAddr } from '@/utils/format';

/* ---------------------------------------------------------------- intro (ainize LandingPage IntroSection) */
const IntroSection = styled.section`
  width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #333333; overflow: hidden;
`;
const NavBar = styled.div<{ $solid: boolean }>`
  width: 100%; position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: center;
  background-color: rgba(51, 51, 51, ${(p) => (p.$solid ? 1 : 0.8)}); transition: background-color 0.2s ease-in-out;
`;
const NavContent = styled.div`
  width: calc(100% - 80px); padding: 24px 40px; max-width: ${(p) => p.theme.layout.maxWidthLanding};
  display: flex; align-items: center; justify-content: space-between;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { width: calc(100% - 32px); padding: 16px; }
`;
const NavLink = styled(Link)`
  font-family: ${(p) => p.theme.font.display}; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none;
  &:hover { text-decoration: underline; }
`;
const IntroContent = styled.div`
  width: calc(100% - 80px); max-width: ${(p) => p.theme.layout.maxWidthLanding}; padding: 100px 40px; position: relative;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { width: calc(100% - 32px); padding: 64px 16px; }
`;
const Hero = styled.div`display: flex; flex-direction: column; align-items: flex-start; justify-content: center;`;
const IntroTitle = styled.h1`
  z-index: 2; margin: 0; font-family: ${(p) => p.theme.font.display}; font-weight: 800; line-height: 1.21; color: #ffffff; white-space: pre-wrap; max-width: 14ch;
  font-size: 28px;
  @media (min-width: ${(p) => p.theme.breakpoint.sm}px) { font-size: 36px; }
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { font-size: 44px; }
`;
const IntroSub = styled.p`
  z-index: 2; margin: 16px 0 0; font-family: ${(p) => p.theme.font.display}; font-weight: 700; line-height: 1.57; color: #ffffff; white-space: pre-wrap; max-width: 44ch;
  font-size: 14px;
  @media (min-width: ${(p) => p.theme.breakpoint.sm}px) { margin-top: 8px; font-size: 16px; }
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { font-size: 20px; }
`;
const HeroImage = styled.img`
  position: absolute; right: -80px; top: 40px; width: 900px; max-width: 70vw; object-fit: contain; pointer-events: none; opacity: 0.95;
  @media (max-width: ${(p) => p.theme.breakpoint.md}px) { display: none; }
`;
const CountCard = styled.div`
  z-index: 2; min-height: 200px; margin-top: 64px; padding: 64px 80px; display: flex; flex-direction: column; align-items: center; justify-content: center;
  border-radius: 24px; box-shadow: 0 4px 30px 0 rgba(0, 0, 0, 0.5); background-color: #ffffff;
  @media (max-width: ${(p) => p.theme.breakpoint.md}px) { margin-top: 48px; padding: 48px 40px; width: 100%; }
`;
const CountTitle = styled.div`
  font-family: ${(p) => p.theme.font.display}; font-weight: 800; line-height: 1.33; color: #8c6cff; text-align: center; white-space: pre-wrap;
  font-size: 18px;
  @media (min-width: ${(p) => p.theme.breakpoint.sm}px) { font-size: 24px; }
`;
const PrimaryPill = styled(Link)`
  margin-top: 32px; padding: 20px 35px; border-radius: 32px; background-color: #8c6cff; font-family: ${(p) => p.theme.font.display}; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none;
  transition: background-color 0.2s ease-in-out;
  &:hover { background-color: #7754f6; } &:active { background-color: #6b42ff; }
`;
const NoSignUp = styled.div`margin-top: 32px; font-family: ${(p) => p.theme.font.display}; font-size: 16px; color: #828282; text-align: center;`;

/* ---------------------------------------------------------------- features */
const FeatureSection = styled.section`
  width: 100%; padding: 112px 40px; background-color: #ffffff;
  @media (min-width: ${(p) => p.theme.breakpoint.lg}px) { padding: 112px 170px; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: 64px 16px; }
`;
const FeatureGrid = styled.div`
  max-width: ${(p) => p.theme.layout.maxWidthLanding}; margin: auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 32px;
`;
const Feature = styled.div`display: flex; flex-direction: column; align-items: center; justify-content: flex-start; text-align: center;`;
const FeatureImg = styled.img`width: 220px; object-fit: contain;`;
const FeatureTitle = styled.h3`margin: 16px 0 0; font-family: ${(p) => p.theme.font.display}; font-size: 24px; font-weight: 800; line-height: 1.33; color: #000000; white-space: pre-wrap;`;
const FeatureDesc = styled.p`margin: 32px 0 0; font-family: ${(p) => p.theme.font.display}; font-size: 16px; line-height: 1.4; color: #000000; max-width: 36ch;`;

/* ---------------------------------------------------------------- trending */
const ContentSection = styled.section`
  width: 100%; padding: 104px 40px 80px; background-color: #eeeeee;
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { padding: 104px 80px 80px; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: 64px 16px; }
`;
const ContentTitle = styled.h2`
  margin: 0; font-family: ${(p) => p.theme.font.display}; font-weight: 800; color: #333333; text-align: center;
  font-size: 28px;
  @media (min-width: ${(p) => p.theme.breakpoint.sm}px) { font-size: 36px; }
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { font-size: 44px; }
`;
const ContentSub = styled.p`
  margin: 32px 0 0; font-family: ${(p) => p.theme.font.display}; color: #333333; text-align: center; white-space: pre-wrap;
  font-size: 14px;
  @media (min-width: ${(p) => p.theme.breakpoint.sm}px) { font-size: 18px; }
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { font-size: 24px; }
`;
const CardGrid = styled.div`
  min-height: 320px; margin: 80px auto 0; max-width: ${(p) => p.theme.layout.maxWidthLanding};
  display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 400px)); gap: 32px; justify-content: center;
`;
const TrendCard = styled(Link)`
  display: flex; flex-direction: column; max-width: 400px; width: 100%; border-radius: 24px; background-color: #ffffff; text-decoration: none; color: inherit; overflow: hidden;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  &:hover { transform: translateY(-8px); box-shadow: 0 1px 20px 8px rgba(0, 0, 0, 0.1); }
`;
const TrendHead = styled.div`
  position: relative; height: 160px; padding: 24px; display: flex; flex-direction: column; justify-content: flex-end;
  background: linear-gradient(135deg, #452a67 0%, #8b3eeb 60%, #78d9e9 130%);
`;
const TrendName = styled.div`
  font-family: ${(p) => p.theme.font.display}; font-size: 24px; font-weight: 800; color: #ffffff; text-shadow: 0 2px 16px rgba(0, 0, 0, 0.5); line-height: 1.2;
  overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
`;
const TrendMeta = styled.div`margin-top: 6px; font-family: ${(p) => p.theme.font.mono}; font-size: 12px; color: rgba(255, 255, 255, 0.85);`;
const TrendBody = styled.div`padding: 20px 24px 24px; display: flex; flex-direction: column; gap: 10px;`;
const TrendLine = styled.div`
  display: flex; justify-content: space-between; align-items: center; gap: 12px; font-family: ${(p) => p.theme.font.display}; font-size: 14px; font-weight: 700; color: #5c5c5c;
  span.v { color: #333333; font-family: ${(p) => p.theme.font.mono}; font-weight: 500; }
`;
const TrendPrice = styled.div`font-family: ${(p) => p.theme.font.display}; font-size: 18px; font-weight: 800; color: #8b3eeb;`;
const FindMore = styled.div`text-align: center; margin-top: 64px;`;
const OutlinePill = styled(Link)`
  display: inline-block; padding: 16px 56px; border-radius: 56px; border: 1px solid #cdbfff; background-color: #ffffff;
  font-family: ${(p) => p.theme.font.body}; font-size: 16px; font-weight: 700; color: #8c6cff; text-decoration: none; transition: background-color 0.2s ease-in-out;
  &:hover { background-color: #e4ddff; } &:active { background-color: #d1c6ff; }
`;

/* ---------------------------------------------------------------- join */
const JoinSection = styled.section`
  width: 100%; padding: 70px 24px; background-color: #ffffff; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 48px;
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { padding: 140px 24px; }
`;
const JoinCol = styled.div`display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;`;
const JoinTitle = styled.h2`
  margin: 0; font-family: ${(p) => p.theme.font.display}; font-size: 40px; font-weight: 400; color: #3d3d3d; white-space: pre-wrap;
  @media (max-width: ${(p) => p.theme.breakpoint.md}px) { font-size: 28px; font-weight: 700; color: #333333; }
`;
const JoinPill = styled(Link)`
  margin-top: 32px; padding: 16px 26px; display: inline-flex; align-items: center; gap: 8px; border-radius: 56px; border: 1px solid #cdbfff; background-color: #ffffff;
  font-family: ${(p) => p.theme.font.display}; font-size: 16px; color: #333333; text-decoration: none; transition: background-color 0.2s ease-in-out;
  &:hover { background-color: #e4ddff; } &:active { background-color: #d1c6ff; }
`;
const BoxImg = styled.img`width: 255px; object-fit: contain; @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { width: 180px; }`;
const Cmd = styled.code`
  display: block; margin-top: 24px; padding: 12px 18px; border-radius: 8px; background: #f5eefc; color: #5b1ca8; font-family: ${(p) => p.theme.font.mono}; font-size: 13px; text-align: left; white-space: pre;
`;

/* ---------------------------------------------------------------- footer (landing variant) */
const FooterSection = styled.footer`
  width: 100%; padding: 56px 24px; background-color: #333333; display: flex; flex-direction: column; align-items: center; gap: 32px;
`;
const FooterLinks = styled.div`display: flex; align-items: center; justify-content: center; gap: 32px; flex-wrap: wrap;`;
const FooterLink = styled(Link)`font-family: ${(p) => p.theme.font.display}; font-size: 16px; color: #f2f2f2; text-decoration: none; &:hover { text-decoration: underline; }`;
const FooterA = styled.a`font-family: ${(p) => p.theme.font.display}; font-size: 16px; color: #f2f2f2; text-decoration: none; &:hover { text-decoration: underline; }`;
const Copyright = styled.div`font-family: ${(p) => p.theme.font.display}; font-size: 14px; color: #9b9b9b; text-align: center;`;

function bestScore(e: CatalogEntry): { text: string; pct: number | null } {
  const passing = e.attestations.filter((a) => a.passed && a.verified_on !== 'hash-only');
  const src = passing.length ? passing : e.attestations.filter((a) => a.passed);
  if (!src.length) return { text: '—', pct: null };
  const s = src[src.length - 1].score;
  const t = scoreText(s);
  return { text: t, pct: pct(s.free_generation ?? s.free_generation_vllm ?? s.chat_60) };
}

export default function LandingPage() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 700);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const { data: info } = useInfoQuery();
  const { data: trending, isLoading } = useCatalogQuery({ status: 'LISTED', sort: 'popular', limit: 6 });
  const year = new Date().getFullYear();
  const listed = info?.counts.listed;

  return (
    <>
      <IntroSection>
        <NavBar $solid={solid}>
          <NavContent>
            <Logo size={20} light />
            <NavLink to="/signing">Sign in to your node</NavLink>
          </NavContent>
        </NavBar>
        <IntroContent>
          <Hero>
            <IntroTitle>{'Launchpad for verified\nknowledge patches'}</IntroTitle>
            <IntroSub>{'Compile, verify, trade and revert knowledge\nas rows of an n-gram memory table.'}</IntroSub>
            <CountCard>
              <CountTitle>
                {listed === undefined ? <Shimmer $w="220px" $h="28px" /> : `${num(listed)} knowledge patch${listed === 1 ? '' : 'es'}`}
                {'\nalready listed'}
              </CountTitle>
              <PrimaryPill to="/explore">Explore patches</PrimaryPill>
              <NoSignUp>No sign up required · peer-to-peer · agents pay with HTTP 402</NoSignUp>
            </CountCard>
          </Hero>
          <HeroImage src="/static/images/intro-image.png" alt="" />
        </IntroContent>
      </IntroSection>

      <FeatureSection>
        <FeatureGrid>
          <Feature>
            <FeatureImg src="/static/images/feature-testing.png" srcSet="/static/images/feature-testing@2x.png 2x" alt="" />
            <FeatureTitle>{'Verified\nby benchmark'}</FeatureTitle>
            <FeatureDesc>Every patch ships with a benchmark. Independent verifier nodes apply it to a serving instance, score free generation, check the collateral bound on unrelated text and stake a bond on their attestation.</FeatureDesc>
          </Feature>
          <Feature>
            <FeatureImg src="/static/images/feature-k8s.png" srcSet="/static/images/feature-k8s@2x.png 2x" alt="" />
            <FeatureTitle>{'Composable\n& revertible'}</FeatureTitle>
            <FeatureDesc>Rows have fixed hash addresses, so conflicts are decided by address-set intersection before you buy. Apply or remove a patch in seconds; keep contradictory knowledge on parallel branches.</FeatureDesc>
          </Feature>
          <Feature>
            <FeatureImg src="/static/images/feature-deploy.png" srcSet="/static/images/feature-deploy@2x.png 2x" alt="" />
            <FeatureTitle>{'Agent-native\ntrading'}</FeatureTitle>
            <FeatureDesc>A patch is an HTTP resource that answers 402 Payment Required. Agents pay with x402 on the AI Network ledger, download the body by content hash, and royalties flow along the lineage automatically.</FeatureDesc>
          </Feature>
        </FeatureGrid>
      </FeatureSection>

      <ContentSection>
        <ContentTitle>Explore what's trending</ContentTitle>
        <ContentSub>{'Listed patches with verifier quorum, ready to apply on the identified model.'}</ContentSub>
        <CardGrid>
          {isLoading && Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} $w="100%" $h="320px" style={{ borderRadius: 24 }} />)}
          {trending?.items.map((e) => {
            const s = bestScore(e);
            return (
              <TrendCard key={e.anchor.id} to={`/${encodeURIComponent(e.anchor.author)}/${encodeURIComponent(e.anchor.id)}`}>
                <TrendHead>
                  <TrendName>{e.anchor.name}</TrendName>
                  <TrendMeta>{e.anchor.author_name ?? shortAddr(e.anchor.author)} · {e.anchor.model.id_M}</TrendMeta>
                </TrendHead>
                <TrendBody>
                  <TrendLine>Benchmark score <span className="v">{s.text}</span></TrendLine>
                  {s.pct !== null && <ScoreBar pct={s.pct} />}
                  <TrendLine>Rows <span className="v">{num(e.anchor.rows)}</span></TrendLine>
                  <TrendLine>Attestations <span className="v">{e.passed}/{e.quorum}</span></TrendLine>
                  <TrendLine>Price <TrendPrice>{price(e.anchor.price, e.anchor.currency)}</TrendPrice></TrendLine>
                </TrendBody>
              </TrendCard>
            );
          })}
          {!isLoading && trending && trending.items.length === 0 && (
            <ContentSub style={{ gridColumn: '1 / -1', fontSize: 16 }}>No listed patches yet — this node is waiting for verifier quorum. Check back in a moment.</ContentSub>
          )}
        </CardGrid>
        <FindMore><OutlinePill to="/explore">Find more</OutlinePill></FindMore>
      </ContentSection>

      <JoinSection>
        <JoinCol>
          <JoinTitle>{'Run a node and\nstart selling knowledge'}</JoinTitle>
          <Cmd>{'npm install && npm run dev\nngram patch publish ./rows.npz --benchmark bench.json'}</Cmd>
          <JoinPill to="/signing">Open the operator console →</JoinPill>
        </JoinCol>
        <JoinCol>
          <BoxImg src="/static/images/github-ainize-box.png" srcSet="/static/images/github-ainize-box@2x.png 2x" alt="" />
        </JoinCol>
      </JoinSection>

      <FooterSection>
        <FooterLinks>
          <FooterLink to="/terms">Terms</FooterLink>
          <FooterLink to="/network">Network</FooterLink>
          <FooterLink to="/ledger">Ledger</FooterLink>
          <FooterA href="https://github.com/ainblockchain/ain-js" target="_blank" rel="noopener noreferrer">ain-js</FooterA>
          <FooterA href="mailto:support@ainize.ai?subject=[Knowledge Market] ">Contact Us</FooterA>
        </FooterLinks>
        <Copyright>ⓒ {year} Common Computer Inc.</Copyright>
      </FooterSection>
    </>
  );
}

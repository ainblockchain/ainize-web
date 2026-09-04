import { Link } from 'react-router';
import styled, { css } from 'styled-components';
import { CopyButton } from '@/components/ui/Misc';
import { useT } from '@/i18n';

/**
 * The ecosystem lifecycle as ONE time-ordered diagram — it replaces the role-grouped "one line is enough" menu the
 * landing used to show (owner review, 2026-09: "시간 순이 아닌것 같애"). Eight numbered steps along a path that
 * visibly loops back from the last to the third, each carrying its own one-line command and its own UI route, with
 * the actor (you → your node → the network → someone else) shown rather than explained.
 *
 * The steps, their commands and their routes are `./lifecycleSteps.ts`, shared with README.md through
 * `test/lifecycle.test.ts` so the page and the README cannot drift. The prose is `i18n/pages/public.ts`.
 */
import { LIFECYCLE, LOOP_TARGET, type Actor } from './lifecycleSteps';

export { LIFECYCLE, LOOP_TARGET };
export type { Actor, LifecycleStep } from './lifecycleSteps';

/* ------------------------------------------------------------------ palette
   The app ships one light theme (theme/theme.ts), so these tokens carry the light values and a dark set behind
   `prefers-color-scheme`, which is the only dark this page can ever be rendered in. Every colour used below comes
   from a variable, so neither mode can leave a string invisible. */
const Wrap = styled.section`
  --flow-bg: #efeafb;
  --flow-card: #ffffff;
  --flow-border: #e6e0f5;
  --flow-title: #333333;
  --flow-text: #5c5c5c;
  --flow-muted: #7a7a7f;
  --flow-rail: #b9a5f5;
  --flow-num-bg: #f0eafd;
  --flow-num-fg: #5b1ca8;
  --flow-code-bg: #1b1b1b;
  --flow-code-fg: #d6c7ff;
  --flow-link: #6b42ff;
  --flow-you-bg: #f0eafd;    --flow-you-fg: #5b1ca8;    --flow-you-edge: #8c6cff;
  --flow-node-bg: #ececef;   --flow-node-fg: #3f3f45;   --flow-node-edge: #9a9aa2;
  --flow-network-bg: #e2f4f8; --flow-network-fg: #0f6070; --flow-network-edge: #3ea6bd;
  --flow-other-bg: #fff1de;  --flow-other-fg: #8a4b00;  --flow-other-edge: #e0913a;

  @media (prefers-color-scheme: dark) {
    --flow-bg: #212126;
    --flow-card: #2b2b31;
    --flow-border: #43434c;
    --flow-title: #f2f2f4;
    --flow-text: #c6c6ce;
    --flow-muted: #9a9aa4;
    --flow-rail: #7d68cf;
    --flow-num-bg: #3a2e5c;
    --flow-num-fg: #d6c7ff;
    --flow-code-bg: #131317;
    --flow-code-fg: #d6c7ff;
    --flow-link: #c1acff;
    --flow-you-bg: #372a58;    --flow-you-fg: #d6c7ff;    --flow-you-edge: #8c6cff;
    --flow-node-bg: #3a3a41;   --flow-node-fg: #dcdce2;   --flow-node-edge: #9a9aa2;
    --flow-network-bg: #123c46; --flow-network-fg: #9fe2f0; --flow-network-edge: #3ea6bd;
    --flow-other-bg: #4a3213;  --flow-other-fg: #ffcf94;  --flow-other-edge: #e0913a;
  }

  width: 100%; padding: 96px 40px; background-color: var(--flow-bg);
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: 56px 16px; }
`;
const Inner = styled.div`max-width: ${(p) => p.theme.layout.maxWidthLanding}; margin: 0 auto;`;
const Title = styled.h2`
  margin: 0; font-family: ${(p) => p.theme.font.display}; font-weight: 800; color: var(--flow-title); text-align: center; word-break: keep-all;
  font-size: 28px;
  @media (min-width: ${(p) => p.theme.breakpoint.sm}px) { font-size: 34px; }
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { font-size: 40px; }
`;
const Sub = styled.p`
  margin: 16px auto 0; font-family: ${(p) => p.theme.font.display}; color: var(--flow-text); text-align: center; max-width: 68ch; line-height: 1.6; word-break: keep-all;
  font-size: 15px;
  @media (min-width: ${(p) => p.theme.breakpoint.sm}px) { font-size: 17px; }
`;

/* ------------------------------------------------------------------ actor legend: who is acting, in the order they act */
const actorTone = (a: Actor) => css`
  background: var(--flow-${a}-bg); color: var(--flow-${a}-fg);
`;
const Legend = styled.p`
  margin: 28px auto 0; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px;
  font-size: 13px; color: var(--flow-muted); text-align: center; word-break: keep-all;
`;
const Chip = styled.span<{ $actor: Actor }>`
  display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; line-height: 1.5; white-space: nowrap;
  ${(p) => actorTone(p.$actor)}
`;
const Sep = styled.span`color: var(--flow-rail); font-weight: 700;`;

/* ------------------------------------------------------------------ the track: a grid of steps wrapped by a return rail

   The rail is drawn with borders on the wrapper (bottom + left, rounded at the corner) so it is one continuous
   path at any width: out of the last card, right-to-left along the bottom, up the left side and back into step 1.
   Two arrowheads give it a direction. All of it is decoration — `aria-hidden`, and the steps themselves are an <ol>. */
const Track = styled.div`
  position: relative; margin-top: 36px; padding: 0 0 56px 34px;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: 0 0 72px 24px; }
`;
const Rail = styled.div`
  position: absolute; inset: 8px 0 14px 0; pointer-events: none;
  border-left: 2px dashed var(--flow-rail); border-bottom: 2px dashed var(--flow-rail); border-radius: 0 0 0 20px;
  /* arrowhead at the top of the left rail — the flow re-enters the sequence here */
  &::before {
    content: ''; position: absolute; left: -7px; top: -9px;
    border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 9px solid var(--flow-rail);
  }
  /* arrowhead on the bottom rail, pointing left — the direction of travel back to the start */
  &::after {
    content: ''; position: absolute; right: 9%; bottom: -6px;
    border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-right: 9px solid var(--flow-rail);
  }
`;
const LoopLabel = styled.p`
  position: absolute; left: 34px; right: 0; bottom: -1px; margin: 0; display: flex; justify-content: center; pointer-events: none;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { left: 24px; }
  span {
    pointer-events: auto; background: var(--flow-bg); padding: 0 12px; max-width: 62ch; text-align: center;
    font-size: 13px; line-height: 1.5; font-weight: 700; color: var(--flow-num-fg); word-break: keep-all;
  }
`;

const List = styled.ol`
  margin: 0; padding: 0; list-style: none; display: grid; gap: 20px; grid-template-columns: 1fr;
  @media (min-width: ${(p) => p.theme.breakpoint.sm}px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
`;
/** One step. The `::after` chevron is the connector to the next step: `content: ''` and pure borders, so it is a
 *  shape and never a character a screen reader can read out. It is dropped at the end of every row and at the end. */
const Item = styled.li<{ $actor: Actor }>`
  position: relative; display: flex; flex-direction: column; gap: 9px; list-style: none;
  padding: 15px 16px 14px; border-radius: 16px; background: var(--flow-card);
  border: 1px solid var(--flow-border); border-top: 3px solid var(--flow-${(p) => p.$actor}-edge);

  &::after {
    content: ''; position: absolute; width: 9px; height: 9px; border-right: 2px solid var(--flow-rail); border-bottom: 2px solid var(--flow-rail);
    left: 50%; bottom: -15px; transform: translateX(-50%) rotate(45deg);
  }
  &:last-child::after { display: none; }

  @media (min-width: ${(p) => p.theme.breakpoint.sm}px) {
    &::after { left: auto; right: -15px; top: 50%; bottom: auto; transform: translateY(-50%) rotate(-45deg); }
    &:nth-child(2n)::after { display: none; }
  }
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) {
    &:nth-child(2n)::after { display: block; }
    &:nth-child(4n)::after { display: none; }
  }
`;
const Head = styled.div`display: flex; align-items: center; gap: 8px;
  /* the card holds exactly one command, so its copy control sits on the header line rather than costing a row */
  > *:last-child { margin-left: auto; }
`;
const Num = styled.span`
  flex: none; width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
  font-family: ${(p) => p.theme.font.display}; font-size: 13px; font-weight: 800; background: var(--flow-num-bg); color: var(--flow-num-fg);
`;
const StepTitle = styled.h3`
  margin: 0; font-family: ${(p) => p.theme.font.display}; font-size: 16px; font-weight: 800; line-height: 1.35; color: var(--flow-title); word-break: keep-all;
`;
const Cmd = styled.code`
  display: block; width: 100%; padding: 10px 12px; border-radius: 8px; background: var(--flow-code-bg); color: var(--flow-code-fg);
  font-family: ${(p) => p.theme.font.mono}; font-size: 12px; line-height: 1.6; text-align: left;
  white-space: pre-wrap; overflow-wrap: anywhere;
`;
const Note = styled.p`margin: 0; font-size: 12px; line-height: 1.58; color: var(--flow-text); word-break: keep-all;`;
const Ui = styled.div`margin-top: auto; padding-top: 9px; border-top: 1px dashed var(--flow-border); display: flex; flex-direction: column; gap: 3px;`;
const UiLabel = styled.span`font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--flow-muted);`;
const UiLink = styled(Link)`
  font-size: 13px; font-weight: 700; line-height: 1.45; color: var(--flow-link); text-decoration: none; word-break: keep-all;
  &:hover { text-decoration: underline; }
`;
const UiUrl = styled.span`font-family: ${(p) => p.theme.font.mono}; font-size: 11px; color: var(--flow-muted); overflow-wrap: anywhere;`;

const Foot = styled.p`margin: 28px 0 0; text-align: center; font-size: 14px; line-height: 1.6; color: var(--flow-muted); word-break: keep-all;`;
const More = styled(Link)`
  display: inline-block; margin-top: 12px; font-family: ${(p) => p.theme.font.display}; font-size: 15px; font-weight: 700; color: var(--flow-link); text-decoration: none;
  &:hover { text-decoration: underline; }
`;

/** The node serves this page, so its own origin is the honest base for every route printed below. */
function origin(): string {
  return typeof window === 'undefined' ? 'http://localhost:3402' : window.location.origin;
}

export default function Lifecycle() {
  const { t } = useT();
  const base = origin();
  const order: Actor[] = ['you', 'node', 'network', 'other'];

  return (
    <Wrap aria-labelledby="lifecycle-title">
      <Inner>
        <Title id="lifecycle-title">{t('landing.flow.title')}</Title>
        <Sub>{t('landing.flow.sub')}</Sub>
        <Legend>
          {t('landing.flow.legend')}
          {order.map((a, i) => (
            <span key={a}>
              {i > 0 && <Sep aria-hidden="true">→ </Sep>}
              <Chip $actor={a}>{t(`landing.flow.actor.${a}`)}</Chip>
            </span>
          ))}
        </Legend>

        <Track>
          <Rail aria-hidden="true" />
          <List role="list" data-testid="lifecycle-steps">
            {LIFECYCLE.map((s) => (
              <Item key={s.n} $actor={s.actor} data-testid={`lifecycle-step-${s.n}`}>
                <Head>
                  <Num>{s.n}</Num>
                  <Chip $actor={s.actor}>{t(`landing.flow.actor.${s.actor}`)}</Chip>
                  <CopyButton text={s.cmd} label={t('common.copy')} />
                </Head>
                <StepTitle>{t(`landing.flow.s${s.n}.title`)}</StepTitle>
                <Cmd>{s.cmd}</Cmd>
                <Note>{t(`landing.flow.s${s.n}.note`)}</Note>
                <Ui>
                  <UiLabel>{t('landing.flow.ui_label')}</UiLabel>
                  <UiLink to={s.route}>{t(`landing.flow.s${s.n}.path`)}</UiLink>
                  <UiUrl>{base}{s.route}</UiUrl>
                </Ui>
              </Item>
            ))}
          </List>
          <LoopLabel><span>{t('landing.flow.loop', { n: LOOP_TARGET })}</span></LoopLabel>
        </Track>

        <Foot>
          {t('landing.flow.readme')}
          <br />
          <More to="/docs">{t('landing.flow.more')} →</More>
        </Foot>
      </Inner>
    </Wrap>
  );
}

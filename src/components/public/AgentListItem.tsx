/**
 * One agent, as a row in the marketplace.
 *
 * An agent is listed beside knowledge because a visitor is choosing between them with the same question —
 * "can this node do the thing I need?" — and the answer is sometimes a memory patch and sometimes a process
 * that will do the work. Splitting them onto two pages made the agents invisible: nothing on /explore said
 * they existed.
 *
 * What the row promises is deliberately narrower than a knowledge card's:
 *
 *  - **It says whether the agent is answering**, checked by the node, not claimed by the card. An address
 *    that 404s is worse than no address, because the reader blames their own client for it.
 *  - **The skills are the agent's own words.** They come off `/.well-known/agent-card.json`, which the
 *    operator of the agent writes — so they are rendered as text, never as markup, and capped by the node.
 *  - **The URL is public and the row says so.** These endpoints take no authentication because A2A sends
 *    none; anyone who copies the address can call it.
 */
import { Link } from 'react-router';
import styled from 'styled-components';
import type { AgentSummary } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { useT } from '@/i18n';

/** The A2UI extension, by URI prefix — the version moves (v0.8 → v0.9) and the badge should not. */
const A2UI = 'a2ui.org';

const Wrapper = styled.div`
  position: relative;
  padding: 16px 32px;
  display: flex; flex-direction: row; align-items: flex-start; gap: 16px;
  background-color: ${(p) => p.theme.color.WHITE};
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  transition: box-shadow 0.4s ease;
  &:not(:last-child) { margin-bottom: 16px; }
  &:hover, &:focus-within {
    box-shadow: 0 2px 6px 0 #e0e4e7, inset -1px 0 0 0 rgba(224, 227, 231, 0.3), inset 0 -1px 0 0 #e0e4e7, inset 1px 0 0 0 rgba(224, 227, 231, 0.2);
  }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: 16px; }
`;
const Glyph = styled.div<{ $state: 'up' | 'down' | 'unknown' }>`
  width: 56px; height: 56px; flex: none; border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 800; letter-spacing: -0.04em;
  background: ${(p) => (p.$state === 'down' ? '#f4f5f6' : p.theme.color.PALE_GREY)};
  color: ${(p) => (p.$state === 'down' ? p.theme.color.GREY : p.theme.color.PRIMARY)};
  opacity: ${(p) => (p.$state === 'down' ? 0.6 : 1)};
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { width: 40px; height: 40px; font-size: 16px; }
`;
const Info = styled.div`display: flex; flex-direction: column; align-items: flex-start; min-width: 0; flex: 1;`;
const NameRow = styled.div`display: flex; flex-direction: row; align-items: center; flex-wrap: wrap; gap: 8px;`;
const Name = styled.h3`margin: 0; font-size: 16px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; word-break: keep-all;`;
const NameLink = styled(Link)`
  color: inherit; text-decoration: none;
  &::after { content: ''; position: absolute; inset: 0; }
  &:hover { text-decoration: underline; }
  &:focus-visible { outline: 2px solid ${(p) => p.theme.color.PRIMARY}; outline-offset: 3px; }
`;
const chipCss = `display: inline-flex; align-items: center; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; line-height: 1.7;`;
const State = styled.span<{ $state: 'up' | 'down' | 'unknown' }>`
  ${chipCss}
  background: ${(p) => (p.$state === 'up' ? '#e3f4e8' : p.$state === 'down' ? '#fdeaea' : '#eef1f4')};
  color: ${(p) => (p.$state === 'up' ? '#1c6b34' : p.$state === 'down' ? '#9b2226' : '#4a5560')};
`;
const Tag = styled.span<{ $tone: 'skill' | 'proto' | 'ui' | 'peer' }>`
  ${chipCss}
  position: relative; z-index: 1;
  background: ${(p) => ({ skill: '#eef1f4', proto: '#fff1de', ui: '#f0eafd', peer: '#e1eef3' }[p.$tone])};
  color: ${(p) => ({ skill: '#4a5560', proto: '#8a4b00', ui: '#5b1ca8', peer: '#0b5468' }[p.$tone])};
`;
const Chips = styled.div`margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px;`;
const Desc = styled.div`
  margin-top: 12px; font-size: 14px; line-height: 1.5; color: ${(p) => p.theme.color.BLACK};
  overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
`;
const Meta = styled.div`
  margin-top: 8px; font-size: 12px; line-height: 1.6; color: ${(p) => p.theme.color.BLACK};
  b { font-weight: 500; color: ${(p) => p.theme.color.GREY}; }
`;
const UrlRow = styled.div`
  position: relative; z-index: 1;
  margin-top: 10px; display: flex; gap: 8px; align-items: center; width: 100%;
  code {
    flex: 1; min-width: 0; font-family: ${(p) => p.theme.font.mono}; font-size: 12px; color: ${(p) => p.theme.color.DARK_GREY};
    background: ${(p) => p.theme.color.PALE_GREY}; border-radius: 4px; padding: 6px 10px; overflow-wrap: anywhere;
  }
`;
const TestCol = styled.div`
  flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; max-width: 200px; text-align: right;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { display: none; }
`;
const Free = styled.div`font-size: 16px; font-weight: 700; color: ${(p) => p.theme.color.PRIMARY}; white-space: nowrap;`;
const Note = styled.div`font-size: 11px; line-height: 1.4; color: ${(p) => p.theme.color.GREY};`;

const initials = (name: string) => name.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'A';
const stateOf = (a: AgentSummary) => (a.reachable === true ? 'up' : a.reachable === false ? 'down' : 'unknown');

export function AgentListItem({ agent }: { agent: AgentSummary }) {
  const { t } = useT();
  const state = stateOf(agent);
  // A card lists skills for machines; a browse row shows the few that fit and says how many it did not show.
  const skills = agent.skills.slice(0, 3);
  const moreSkills = agent.skills.length - skills.length;
  const drawsUi = agent.extensions.some((u) => u.includes(A2UI));

  return (
    <Wrapper data-testid="agent-row">
      <Glyph $state={state} aria-hidden="true">{initials(agent.name)}</Glyph>
      <Info>
        <NameRow>
          <Name><NameLink to={`/agents?agent=${encodeURIComponent(agent.id)}`}>{agent.name}</NameLink></Name>
          <State $state={state}>
            {state === 'up' ? t('agent.state.up') : state === 'down' ? t('agent.state.down') : t('agent.state.unknown')}
          </State>
        </NameRow>
        {agent.description && <Desc>{agent.description}</Desc>}
        <Chips>
          {/* Which node runs it, first: on a marketplace that lists the whole network, "whose agent is this"
              decides who the reader is trusting and where their request actually goes. */}
          {agent.node && <Tag $tone="peer" title={agent.node.endpoint}>{t('agent.on_node', { name: agent.node.name })}</Tag>}
          {skills.map((s) => <Tag key={s.id} $tone="skill" title={s.description}>{s.name}</Tag>)}
          {moreSkills > 0 && <Tag $tone="skill">{t('agent.skill_more', { n: moreSkills })}</Tag>}
          {!!agent.protocols.length && <Tag $tone="proto">{t('agent.protocol', { v: agent.protocols.join(' / ') })}</Tag>}
          {drawsUi && <Tag $tone="ui" title={t('agent.a2ui_help')}>{t('agent.a2ui')}</Tag>}
        </Chips>
        <Meta>
          {/* A peer's calls are not this node's to count, and a 0 would read as "nobody uses it". */}
          {agent.calls !== null
            ? <><b>{t('agent.calls_label')}</b> {t('agent.calls', { n: agent.calls }, agent.calls)}</>
            : <b>{t('agent.remote_note')}</b>}
          {agent.provider ? <> · <b>{t('agent.provider')}</b> {agent.provider}</> : null}
          {state === 'down' && agent.error ? <> · {agent.error}</> : null}
        </Meta>
        <UrlRow>
          <code>{agent.a2a_url}</code>
          <Button size="small" variant="outlined" onClick={() => { void navigator.clipboard?.writeText(agent.a2a_url); }}>
            {t('agent.copy')}
          </Button>
        </UrlRow>
      </Info>
      <TestCol>
        <Free>{t('agent.free')}</Free>
        <Note>{t('agent.public_note')}</Note>
      </TestCol>
    </Wrapper>
  );
}

export default AgentListItem;

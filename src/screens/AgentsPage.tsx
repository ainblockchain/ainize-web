/**
 * A2A agents this node operates, and a place to try one (NEWS-AGENT-REQUIREMENTS §6.1, §6.2).
 *
 * The list and the live test share one page because they answer one question — "is my agent working?" — and
 * splitting them would make an operator hold a URL in their head while navigating. The test posts the same
 * JSON-RPC a workspace would, to the same public URL, so what is exercised here is what a stranger gets.
 *
 * Three things this page refuses to blur:
 *
 *  - **Silence is not failure.** An empty `parts` array means the agent heard and chose not to reply, which
 *    is how it stays quiet in a busy channel. Rendering that as "no response" would send an operator
 *    debugging something that is working.
 *  - **The URL is public.** These endpoints take no authentication, because the protocol sends none. Anyone
 *    with the link can call them, and the page says so next to the copy button rather than in a doc.
 *  - **It takes as long as it takes.** An agent may do real work before answering — fetch a search index,
 *    read several pages, run a model — so the elapsed time is shown while it runs; a spinner with no number
 *    reads as a hang at about eight seconds. What the work IS belongs to the agent, not to this page: the
 *    examples and the skills come off its card.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useAgentsQuery } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, Description, Empty, ExternalLink, Mono, PageWrapper, Title, TitleRow } from '@/components/ui/Misc';
import type { AgentSummary } from '@/api/types';
import { A2UISurface, readSurface, type A2UISurfaceData } from '@/components/a2ui/A2UISurface';
import { useTitle } from '@/utils/useTitle';

const Cards = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;`;
const Card = styled.div<{ $selected?: boolean }>`
  background: #fff; padding: 20px 24px; cursor: pointer;
  border: 1px solid ${(p) => (p.$selected ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)};
  outline: ${(p) => (p.$selected ? `1px solid ${p.theme.color.PRIMARY}` : 'none')};
  h3 { margin: 0 0 4px; font-size: 15px; font-weight: 700; }
`;
const Dot = styled.span<{ $state: 'up' | 'down' | 'unknown' }>`
  display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px;
  background: ${(p) => (p.$state === 'up' ? p.theme.color.SUCCESS : p.$state === 'down' ? p.theme.color.ERROR : p.theme.color.LIGHT_GREY)};
`;
const UrlRow = styled.div`
  display: flex; gap: 8px; align-items: center; margin-top: 12px;
  code { flex: 1; font-size: 12px; overflow-wrap: anywhere; background: #f6f6f7; padding: 6px 8px; border-radius: 4px; }
`;
const Small = styled.div`font-size: 12px; color: ${(p) => p.theme.color.GREY}; margin-top: 6px;`;
const Panel = styled.div`margin-top: 24px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; padding: 20px 24px;`;
const Area = styled.textarea`
  width: 100%; min-height: 220px; padding: 12px; font-family: ${(p) => p.theme.font.mono}; font-size: 12px; line-height: 1.6;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; resize: vertical;
`;
const Out = styled.pre`
  margin: 16px 0 0; padding: 16px; border-radius: 4px; background: #303133; color: #f2f2f2;
  font-size: 12px; line-height: 1.6; overflow-x: auto; white-space: pre-wrap;
`;
const Row = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 12px;`;
const Rendered = styled.div`
  margin-top: 16px; padding: 20px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; background: #fafafb;
`;
const RenderedLabel = styled.div`
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: ${(p) => p.theme.color.GREY}; margin-bottom: 12px;
`;

/**
 * What to send an agent is the AGENT's answer, not this page's.
 *
 * These buttons used to be three news articles, because the first agent on this node scored news articles.
 * Every other agent then got a form that asked for an article and a note about fetching publisher pages —
 * a page describing one agent's job while addressed to another. The protocol already carries the answer:
 * `skills[].examples` on the agent card is exactly "things you can say to me", written by whoever built it.
 *
 * So the examples come from the card, and when a card offers none there are no buttons — an empty box a
 * reader fills in is honest, and a wrong suggestion is not.
 */
interface CardSkill { id?: string; name?: string; description?: string; examples?: string[] }

/** One button: the example itself is the label, because it is also the text that gets sent. */
function examplesOf(skills: CardSkill[]): { label: string; text: string; skill: string }[] {
  const out: { label: string; text: string; skill: string }[] = [];
  for (const s of skills) {
    for (const e of s.examples ?? []) {
      if (typeof e === 'string' && e.trim()) out.push({ label: e, text: e, skill: s.name ?? s.id ?? '' });
    }
  }
  return out.slice(0, 8);
}

const state = (a: AgentSummary) => (a.reachable === true ? 'up' : a.reachable === false ? 'down' : 'unknown');

/**
 * The path part of an address this app serves, so the call goes to the origin the reader is already on.
 *
 * Anything that is not one of this app's own prefixes is left alone: an agent list can carry an address on
 * another host, and rewriting that to a local path would post somebody else's request to ourselves.
 */
export function samePath(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    return /^\/(api|agents)\//.test(u.pathname) ? u.pathname + u.search : url;
  } catch {
    return url;
  }
}
const ago = (t: number | null) => (t ? `${Math.max(0, Math.round((Date.now() - t) / 1000))}s ago` : 'never');

export function AgentsPage() {
  useTitle('Agents');
  const { isSignedIn } = useAuth();
  // polled: "is it answering" goes stale the moment it is rendered
  const { data, isLoading, error, refetch } = useAgentsQuery(undefined, { pollingInterval: 30_000 });
  const agents = data?.agents ?? [];

  // /explore?kind=agent links each row here with its id, so the page opens on the agent the reader clicked
  // rather than on whichever one the node happens to list first.
  const [params] = useSearchParams();
  const [selected, setSelected] = useState<string | null>(params.get('agent'));
  const [article, setArticle] = useState('');
  // The card, fetched from this app's own address for it (`card_url`), so the panel describes THIS agent.
  const [skills, setSkills] = useState<CardSkill[]>([]);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [surface, setSurface] = useState<A2UISurfaceData | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // an id in the URL that this node does not operate falls back to the first, rather than showing no panel
    if (agents.length && !agents.some((a) => a.id === selected)) setSelected(agents[0].id);
  }, [agents, selected]);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const agent = agents.find((a) => a.id === selected) ?? null;

  // The list carries skill names; the card carries what each one accepts. For an agent on a peer the node
  // only gossips the names, so the examples exist nowhere but the card — which is one fetch away, on this
  // origin, through the same front door a stranger's client would use.
  useEffect(() => {
    if (!agent) { setSkills([]); return; }
    let live = true;
    setSkills([]);
    fetch(samePath(agent.card_url), { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((card: { skills?: CardSkill[] } | null) => { if (live && Array.isArray(card?.skills)) setSkills(card.skills); })
      .catch(() => {/* no examples is a fine outcome; the box still works */});
    return () => { live = false; };
  }, [agent]);

  const samples = examplesOf(skills);

  const run = async () => {
    if (!agent) return;
    setBusy(true); setResult(null); setSurface(null); setFailed(null); setElapsed(0);
    const started = Date.now();
    timer.current = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    try {
      // Exactly what a workspace sends — same method, same shape. `call_url` is this node's mesh path when the
      // agent belongs to a peer: a browser cannot reach another operator's node, and this one can.
      //
      // Called as a PATH, not as the absolute URL the node reports. The node knows itself by one address
      // (`https://ainize.ai`) and a visitor may be on another name for the same site (`www.`) — posting to the
      // node's spelling from that page is a cross-origin request, and the browser blocks it before anything
      // here runs. Every address on this list is this app's own, so the path is the part that matters.
      const res = await fetch(samePath(agent.call_url ?? agent.a2a_url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: crypto.randomUUID(),
          method: 'message/send',
          params: {
            message: { kind: 'message', messageId: crypto.randomUUID(), role: 'user', parts: [{ kind: 'text', text: article }] },
            configuration: { blocking: true, acceptedOutputModes: ['text/plain'] },
          },
        }),
      });
      const body = await res.json().catch(() => null);
      if (body?.error) { setFailed(`${body.error.message} (code ${body.error.code})`); return; }
      const parts = body?.result?.parts ?? [];
      // A2UI first: an agent that describes its answer as a surface gets drawn rather than printed. The
      // text part is always kept — it is the same answer, and it is what a reader copies out.
      setSurface(readSurface(parts));
      const text = parts.map((p: { text?: string }) => p.text ?? '').join('\n').trim();
      // §2 — an empty parts array is a deliberate answer, not a missing one
      setResult(text || '(silence — the agent heard this and chose not to reply, which is how it stays quiet in a busy channel)');
    } catch (e) {
      setFailed(errorMessage(e));
    } finally {
      if (timer.current) clearInterval(timer.current);
      setBusy(false);
      refetch();
    }
  };

  if (isLoading) return <CenterProgress />;

  return (
    <PageWrapper>
      <TitleRow><Title>Agents</Title></TitleRow>
      <Description>
        A2A agents this node gives a public address to. Each serves an agent card and one <Mono>message/send</Mono>{' '}
        endpoint, which is all the protocol requires. An agent is a process you run — the node does not run it, it
        addresses it: <Mono>ainize agent add &lt;id&gt; --upstream &lt;where it listens&gt;</Mono>.{' '}
        <ExternalLink href="/docs/how-to/host-an-agent">Put an agent on a node →</ExternalLink>
      </Description>

      {error && <Alert $tone="error">{errorMessage(error)}</Alert>}
      {!isSignedIn && <Alert $tone="info">You are signed out. The list is readable; the URLs below are public either way.</Alert>}

      {!agents.length ? (
        <Empty>
          This node operates no agents. Declare one in <Mono>config.json</Mono> under <Mono>agents</Mono> with an{' '}
          <Mono>id</Mono> and the <Mono>upstream</Mono> address of the process, then restart the node.
        </Empty>
      ) : (
        <Cards>
          {agents.map((a) => (
            <Card key={a.id} $selected={a.id === selected} onClick={() => setSelected(a.id)}>
              <h3><Dot $state={state(a)} />{a.name}</h3>
              {a.description && <Small>{a.description}</Small>}
              <UrlRow>
                <code>{a.a2a_url}</code>
                <Button size="small" onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(a.a2a_url); }}>Copy</Button>
              </UrlRow>
              <Small>
                {a.reachable === true && <>answering · checked {ago(a.last_checked)}</>}
                {a.reachable === false && <>not answering — {a.error} · checked {ago(a.last_checked)}</>}
                {a.reachable === null && <>not checked yet</>}
              </Small>
              <Small>
                {a.node ? `runs on ${a.node.name}` : `${a.calls ?? 0} call${a.calls === 1 ? '' : 's'} through this node`}
                {!a.node && a.last_call_at ? `, last ${ago(a.last_call_at)}` : ''} ·{' '}
                <ExternalLink href={a.card_url} onClick={(e) => e.stopPropagation()}>agent card</ExternalLink>
              </Small>
            </Card>
          ))}
        </Cards>
      )}

      {agent && (
        <Panel>
          <h3 style={{ margin: 0 }}>Live test — {agent.name}</h3>
          {agent.description && <Description style={{ marginBottom: 4 }}>{agent.description}</Description>}
          {skills.length > 0 && (
            <Description as="ul" style={{ margin: '4px 0 12px', paddingLeft: 18 }}>
              {skills.slice(0, 6).map((sk) => (
                <li key={sk.id ?? sk.name}>
                  <b>{sk.name ?? sk.id}</b>{sk.description ? ` — ${sk.description}` : ''}
                </li>
              ))}
            </Description>
          )}
          <Description>
            Posts the same JSON-RPC a workspace would, to <Mono>{agent.a2a_url}</Mono>. That URL takes no
            authentication, because A2A sends none: anyone who can reach it can call it.
            {agent.node && (
              <>
                {' '}This agent runs on <b>{agent.node.name}</b>, so the request goes through this node
                (<Mono>{agent.call_url}</Mono>) rather than from your browser — a page on this origin cannot
                open a connection to another operator&rsquo;s network, and should not ask you to.
              </>
            )}
          </Description>
          {/* The agent's own examples, from its card. No card examples, no buttons — see examplesOf. */}
          {samples.length > 0 && (
            <Row>
              {samples.map((s) => (
                <Button key={s.label} size="small" variant="outlined" disabled={busy}
                  title={s.skill ? `${s.skill}` : undefined} onClick={() => setArticle(s.text)}>
                  {s.label}
                </Button>
              ))}
            </Row>
          )}
          <Row style={{ display: 'block' }}>
            <Area value={article} onChange={(e) => setArticle(e.target.value)} disabled={busy}
              placeholder={samples[0] ? `e.g. ${samples[0].text}` : 'Send this agent a message.'} />
          </Row>
          <Row>
            <Button onClick={run} disabled={busy || !article.trim() || agent.reachable === false}>
              {busy ? `Sending… ${elapsed}s` : 'Send'}
            </Button>
            {/* What it does with the message is its business; how long that takes is not this page's to claim. */}
            {busy && <Small>the agent decides how long this takes — some do real work before answering</Small>}
            {agent.reachable === false && <Small>the agent is not answering, so there is nothing to send to</Small>}
          </Row>
          {failed && <Alert $tone="error">{failed}</Alert>}
          {result && <Out>{result}</Out>}
        </Panel>
      )}
    </PageWrapper>
  );
}

export default AgentsPage;

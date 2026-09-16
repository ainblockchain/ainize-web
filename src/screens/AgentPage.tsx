/**
 * One agent: what it is, what it takes, and a place to send it something.
 *
 * This page used to be the LIST as well, and clicking a row on the marketplace landed you back on a grid of
 * every agent the node knows — two lists for one thing, and the item you clicked was one card among them. The
 * marketplace (`/explore?kind=agent`) is the list; this is the item, at `/agent/<id>`.
 *
 * `/agent/<id>`, singular, and not `/agents/<id>`: that path is the agent's own A2A address, served by the
 * route handler in `app/agents/`. A detail page there would either shadow the endpoint or be shadowed by it.
 *
 * Three things this page refuses to blur:
 *
 *  - **Silence is not failure.** An empty `parts` array means the agent heard and chose not to reply, which
 *    is how it stays quiet in a busy channel. Rendering that as "no response" would send a reader debugging
 *    something that is working.
 *  - **The URL is public.** These endpoints take no authentication, because the protocol sends none. Anyone
 *    with the link can call them, and the page says so next to the copy button rather than in a doc.
 *  - **It takes as long as it takes.** An agent may do real work before answering, so the elapsed time is
 *    shown while it runs; a spinner with no number reads as a hang at about eight seconds. What the work IS
 *    belongs to the agent: the examples and the skills come off its card, never off this page.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useAgentsQuery } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, Description, Empty, ExternalLink, Mono, PageWrapper, Title, TitleRow } from '@/components/ui/Misc';
import type { AgentSummary } from '@/api/types';
import { A2UISurface, isInteractive, readSurface, type A2UISurfaceData } from '@/components/a2ui/A2UISurface';
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
const Back = styled(Link)`
  display: inline-block; margin: -8px 0 16px; font-size: 13px; color: ${(p) => p.theme.color.GREY};
  text-decoration: none; &:hover { color: ${(p) => p.theme.color.PRIMARY}; text-decoration: underline; }
`;
/** The four facts a reader checks before sending anything: is it up, whose is it, what does it speak, is it used. */
const Facts = styled.dl`
  display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px 24px; margin: 16px 0;
  div { min-width: 0; }
  dt { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: ${(p) => p.theme.color.GREY}; }
  dd { margin: 2px 0 0; font-size: 13px; color: ${(p) => p.theme.color.BLACK}; overflow-wrap: anywhere; }
`;
const SectionLabel = styled.div`
  margin-top: 20px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: ${(p) => p.theme.color.GREY};
`;
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

export function AgentPage() {
  const { id = '' } = useParams();
  // polled: "is it answering" goes stale the moment it is rendered
  const { data, isLoading, error, refetch } = useAgentsQuery(undefined, { pollingInterval: 30_000 });
  const agents = useMemo(() => data?.agents ?? [], [data]);
  const agent = agents.find((a) => a.id === id) ?? null;
  useTitle(agent ? agent.name : 'Agent');
  const [article, setArticle] = useState('');
  // The card, fetched from this app's own address for it (`card_url`), so the panel describes THIS agent.
  const [skills, setSkills] = useState<CardSkill[]>([]);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [surface, setSurface] = useState<A2UISurfaceData | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);


  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);


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

  /**
   * Ask the agent what it takes, and let it answer with a form.
   *
   * An empty message means "I have nothing for you yet" — this agent replies to that with its own input
   * surface, so the box the reader types into is the one the AGENT described rather than the one this page
   * would have guessed. An agent that does not answer with a surface simply leaves `form` null and the
   * fallback box below is used, which is what every A2A agent that knows nothing about A2UI will do.
   */
  const [form, setForm] = useState<A2UISurfaceData | null>(null);
  useEffect(() => {
    if (!agent) { setForm(null); return; }
    let live = true;
    setForm(null);
    fetch(samePath(agent.call_url ?? agent.a2a_url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: crypto.randomUUID(), method: 'message/send',
        params: {
          message: { kind: 'message', messageId: crypto.randomUUID(), role: 'user', parts: [{ kind: 'text', text: '' }] },
          configuration: { blocking: true, acceptedOutputModes: ['text/plain'] },
        },
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        const asked = readSurface(b?.result?.parts ?? []);
        if (live && asked && isInteractive(asked)) setForm(asked);
      })
      .catch(() => {/* no form is a fine outcome; the fallback box works */});
    return () => { live = false; };
  }, [agent]);

  const run = async (message = article) => {
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
            message: { kind: 'message', messageId: crypto.randomUUID(), role: 'user', parts: [{ kind: 'text', text: message }] },
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

  if (isLoading) return <CenterProgress />;

  if (!agent) {
    return (
      <PageWrapper>
        <TitleRow><Title>Agent</Title></TitleRow>
        {error && <Alert $tone="error">{errorMessage(error)}</Alert>}
        <Empty>
          {/* An id that resolves nowhere is not the same as a node with no agents, and used to silently
              become "whichever one is listed first" — a page about an agent the reader never asked for. */}
          No agent called <Mono>{id}</Mono> is listed here. It may have been taken down, or it may be on a node
          this one is not connected to. <Link to="/explore?kind=agent">See the agents →</Link>
        </Empty>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <TitleRow>
        <Title><Dot $state={state(agent)} />{agent.name}</Title>
      </TitleRow>
      <Back to="/explore?kind=agent">← {'All agents'}</Back>

      {error && <Alert $tone="error">{errorMessage(error)}</Alert>}

      {agent.description && <Description>{agent.description}</Description>}

      <Facts>
        <div>
          <dt>Status</dt>
          <dd>
            {agent.reachable === true && <>answering · checked {ago(agent.last_checked)}</>}
            {agent.reachable === false && <>not answering — {agent.error} · checked {ago(agent.last_checked)}</>}
            {agent.reachable === null && <>not checked yet</>}
          </dd>
        </div>
        <div>
          <dt>Runs on</dt>
          <dd>{agent.node ? agent.node.name : 'this node'}</dd>
        </div>
        <div>
          <dt>Protocol</dt>
          <dd>{agent.protocols.length ? `A2A ${agent.protocols.join(' / ')}` : '—'}</dd>
        </div>
        <div>
          <dt>Calls</dt>
          {/* A peer's calls are not this node's to count, and a 0 would read as "nobody uses it". */}
          <dd>{agent.calls === null ? 'counted by the node that runs it' : `${agent.calls} through this node`}</dd>
        </div>
      </Facts>

      {/*
        * The card address is the one to copy. A2A's endpoint is POST-only and answers a browser with 404,
        * so offering it as the headline URL handed people a link that looks broken; the card is what a
        * workspace reads when someone invites the agent, and it opens in a tab. The endpoint is still named
        * below, where the live test says what it posts to.
        */}
      <UrlRow>
        <code>{agent.card_url}</code>
        <Button size="small" onClick={() => navigator.clipboard?.writeText(agent.card_url)}>Copy</Button>
      </UrlRow>
      <Small>
        Give this to a workspace to invite the agent ·{' '}
        <ExternalLink href={samePath(agent.card_url)}>open the card</ExternalLink> · A2A sends no
        authentication, so whoever can reach the endpoint can call it
      </Small>

      {skills.length > 0 && (
        <>
          <SectionLabel>What it does</SectionLabel>
          <Description as="ul" style={{ margin: '4px 0 12px', paddingLeft: 18 }}>
            {skills.slice(0, 8).map((sk) => (
              <li key={sk.id ?? sk.name}>
                <b>{sk.name ?? sk.id}</b>{sk.description ? ` — ${sk.description}` : ''}
              </li>
            ))}
          </Description>
        </>
      )}

      <Panel>
        <h3 style={{ margin: 0 }}>Live test</h3>
        <Description>
          Posts the same JSON-RPC a workspace would, to <Mono>{agent.a2a_url}</Mono>.
          {agent.node && (
            <>
              {' '}This agent runs on <b>{agent.node.name}</b>, so the request goes through this node
              rather than from your browser — a page on this origin cannot open a connection to another
              operator&rsquo;s network, and should not ask you to.
            </>
          )}
        </Description>
        {/**
          * The agent's own form, when it sent one.
          *
          * Its Button carries the values back through `onAction`; what the reader typed is inside the surface,
          * so nothing on this page had to know that this agent wants an article rather than a question. The
          * box below is the fallback for every agent that does not describe its input — which is most of them.
          */}
        {form && (
          <Rendered>
            <RenderedLabel>the agent&rsquo;s own form (A2UI)</RenderedLabel>
            <A2UISurface
              surface={form}
              busy={busy}
              onAction={(_name, context) => {
                const sent = Object.values(context).find((v) => typeof v === 'string' && v.trim());
                if (typeof sent === 'string') { setArticle(sent); void run(sent); }
              }}
            />
          </Rendered>
        )}
        {/* The agent's own examples, from its card. No card examples, no buttons — see examplesOf. */}
        {!form && samples.length > 0 && (
          <Row>
            {samples.map((s) => (
              <Button key={s.label} size="small" variant="outlined" disabled={busy}
                title={s.skill ? `${s.skill}` : undefined} onClick={() => setArticle(s.text)}>
                {s.label}
              </Button>
            ))}
          </Row>
        )}
        {!form && (
          <Row style={{ display: 'block' }}>
            <Area value={article} onChange={(e) => setArticle(e.target.value)} disabled={busy}
              placeholder={samples[0] ? `e.g. ${samples[0].text}` : 'Send this agent a message.'} />
          </Row>
        )}
        <Row>
          {!form && (
            <Button onClick={() => run()} disabled={busy || !article.trim() || agent.reachable === false}>
              {busy ? `Sending… ${elapsed}s` : 'Send'}
            </Button>
          )}
          {form && busy && <Small>보내는 중… {elapsed}s</Small>}
          {busy && <Small>the agent decides how long this takes — some do real work before answering</Small>}
          {agent.reachable === false && <Small>the agent is not answering, so there is nothing to send to</Small>}
        </Row>
        {failed && <Alert $tone="error">{failed}</Alert>}
        {result && <Out>{result}</Out>}
        {surface && (
          <Rendered>
            <RenderedLabel>drawn from the agent&rsquo;s own description of the answer (A2UI)</RenderedLabel>
            <A2UISurface surface={surface} />
          </Rendered>
        )}
      </Panel>
    </PageWrapper>
  );
}

export default AgentPage;

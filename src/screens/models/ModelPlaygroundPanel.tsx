/**
 * The part of a model page you can press: a free-tier playground, an API key, and the code for the same call.
 *
 * It lived on `/models` while that page was one model at a time. `/models` is now the list and every model has its
 * own page (`ModelDetailPage`), so the panel moved there whole — the same state, the same free-tier routes, the
 * same `data-testid`s — rather than being rewritten beside the list. The rule it was built on still holds: the
 * snippet is built from the state the playground just used, so the code copied is the call made.
 */
import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { errorMessage, useApiKeysQuery, useCreateApiKeyMutation, useMeQuery, useThroughputQuoteQuery } from '@/api/api';
import { parseBillingThroughputResponse } from '@/api/billingThroughput';
import { useAuth } from '@/auth/AuthContext';
import type { ModelModality, PublicModelCard } from '@/api/models';
import { Button } from '@/components/ui/Button';
import { Alert, Input, Textarea } from '@/components/ui/Form';
import { Description, Mono, StyledLink, SubTitle } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { DECISION_EXAMPLE, modelsPageCodeSnippet, SNIPPET_LANGUAGES, type SnippetLanguage } from './modelsPageCodeSnippet';
import { forgetIssuedKey, recallIssuedKey, rememberIssuedKey } from './issuedKeyMemory';
import { MODEL_SPEED_QUOTE_SAIN, modelSpeedBillingHref, modelSpeedFactOf, modelSpeedPriorityOfferOf } from './modelSpeedHints';

const Panel = styled.div`border: 1px solid #e2e4ea; border-radius: 10px; padding: 18px; margin-bottom: 28px;`;
const Row = styled.div`display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap; margin-top: 12px;`;
const Answer = styled.pre`
  margin-top: 14px; padding: 14px; border-radius: 8px; background: #f7f8fa; white-space: pre-wrap;
  word-break: break-word; font-size: 13px; max-height: 320px; overflow: auto;
`;
const AnswerImage = styled.img`margin-top: 14px; max-width: 100%; border-radius: 8px; border: 1px solid #e2e4ea;`;

// A decision answer is one small block per question — the pick, how sure, and the spread it came out of.
const Decisions = styled.div`margin-top: 14px; display: flex; flex-direction: column; gap: 12px;`;
const DecisionCard = styled.div`padding: 12px 14px; border-radius: 8px; background: #f7f8fa;`;
const DecisionQid = styled.div`font: inherit; font-size: 12px; font-weight: 600; color: #5b3df5;`;
const DecisionPick = styled.div`font-size: 14px; margin-top: 4px;`;
const DecisionConf = styled.div`font-size: 12px; color: #6b7280; margin-top: 2px;`;
const Bar = styled.div`display: grid; grid-template-columns: minmax(80px, 140px) 1fr 40px; gap: 8px; align-items: center; font-size: 12px; margin-top: 4px;`;
const BarLabel = styled.span`overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const BarTrack = styled.div`height: 8px; border-radius: 4px; background: #e2e4ea; overflow: hidden;`;
const BarFill = styled.div<{ $pct: number }>`height: 100%; width: ${(p) => Math.max(0, Math.min(100, p.$pct))}%; background: #5b3df5;`;
const BarPct = styled.span`text-align: right; color: #6b7280;`;

/**
 * A worked example that already runs: a state, and one question of each kind. The playground prefills the box with
 * it so the first press proves the route, the model and the answer shapes at once — an empty box would post nothing.
 */

/** The decision box is JSON the visitor types; a bad body is a message, not a thrown stack. This marks that case. */
const DECISION_BAD_JSON = 'decision:bad-json';

const Tabs = styled.div`display: flex; gap: 6px; margin-bottom: 10px;`;
const Tab = styled.button<{ $on: boolean }>`
  cursor: pointer; font: inherit; font-size: 13px; padding: 5px 12px; border-radius: 999px;
  border: 1px solid ${(p) => (p.$on ? '#5b3df5' : '#e2e4ea')};
  background: ${(p) => (p.$on ? '#f4f1ff' : '#fff')};
`;
const CodeBlock = styled.pre`
  padding: 16px; border-radius: 8px; background: #11131a; color: #e6e8ee; overflow: auto;
  font-size: 12.5px; line-height: 1.6;
`;
const CodeHead = styled.div`display: flex; justify-content: space-between; align-items: center; gap: 12px;`;

/** What the browser is talking to. Read at render so a node behind a different origin still copies correctly. */
const nodeUrlFromBrowser = (): string =>
  (typeof window === 'undefined' ? '' : window.location.origin);

type RunState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'text'; text: string; remaining: number | null }
  | { kind: 'image'; dataUrl: string; remaining: number | null }
  | { kind: 'decision'; answers: Record<string, unknown>; remaining: number | null }
  | { kind: 'failed'; why: string };

/**
 * `signInNext` is where the sign-in link returns to — the page this panel sits on, so signing in for a key does
 * not drop the reader back on a different model.
 */
/**
 * `callModel` is what the calls and the snippet name: the bare id for this node's own model, `id@0x<node>` for a
 * peer's (api/networkModels.ts). `peer` turns off what is this node's alone — its speed and its deposits.
 */
export function ModelPlaygroundPanel({ model, signInNext, callModel, peer = false }: { model: PublicModelCard; signInNext: string; callModel?: string; peer?: boolean }) {
  const modelRef = callModel ?? model.id;
  const { t } = useT();
  // Decision's box holds JSON, not a sentence, so it starts from a worked example rather than empty.
  const [prompt, setPrompt] = useState(() => (model.modality === 'decision' ? DECISION_EXAMPLE : ''));
  const [audio, setAudio] = useState<File | null>(null);
  const [run, setRun] = useState<RunState>({ kind: 'idle' });
  const [language, setLanguage] = useState<SnippetLanguage>('python');
  const [copied, setCopied] = useState(false);

  // Signed in? Then the snippet should be paste-and-run rather than paste-and-go-find-a-key.
  const { data: me } = useMeQuery();
  // The node's own session, i.e. a wallet. A Google sign-in sets `google` on the auth context but not this,
  // and /api/keys answers 401 to it, so it is told apart below instead of being shown the sign-in prompt
  // again by a page it is already signed in to.
  const signedIn = !!me?.signedIn;
  // A Google account holds keys too: this app vouches for it to the node on /api/keys (lib/siteAssertion.ts).
  const { google, sso } = useAuth();
  // …and so does an AIN account (AIN SSO): the node keeps its session and issues it keys for its organization.
  const canHoldKeys = signedIn || !!google || !!sso;
  const { data: keyList } = useApiKeysQuery(undefined, { skip: !canHoldKeys });
  const [createKey, createState] = useCreateApiKeyMutation();
  const [issuedKey, setIssuedKey] = useState<string | null>(() => recallIssuedKey());
  const [keyError, setKeyError] = useState<string | null>(null);

  // The model's speed and whether it is busy — read faster while a request of ours is waiting, since that is when
  // "paid work is ahead of you" is worth saying. Chat only: a deposit buys the language model's queue.
  // A peer's speed and deposits are its own, not this node's: nothing here can quote them.
  const isChat = model.modality === 'chat' && !peer;
  const throughputQuery = useThroughputQuoteQuery(
    { model: model.id, token: 'sAIN', amount: MODEL_SPEED_QUOTE_SAIN },
    { skip: !isChat, pollingInterval: run.kind === 'running' ? 2_000 : 15_000 },
  );
  const throughput = parseBillingThroughputResponse(throughputQuery.data);
  const speed = modelSpeedFactOf(throughput);
  const offer = modelSpeedPriorityOfferOf(throughput);

  const snippet = useMemo(() => modelsPageCodeSnippet({
    language, modality: model.modality, model: modelRef, nodeUrl: nodeUrlFromBrowser(), prompt,
    apiKey: issuedKey ?? undefined,
  }), [language, model, prompt, issuedKey]);

  async function press() {
    setRun({ kind: 'running' });
    try {
      const res = await callFreeTier(model, modelRef, peer, prompt, audio);
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: { message?: string; code?: string } } | null;
        setRun({ kind: 'failed', why: body?.error?.code === 'backend_unavailable' ? t('models.try.unavailable') : (body?.error?.message ?? String(res.status)) });
        return;
      }
      const body = await res.json() as Record<string, unknown>;
      const remaining = typeof body.remaining_free_tries === 'number' ? body.remaining_free_tries : null;
      if (model.modality === 'image') {
        const b64 = (body.data as { b64_json?: string }[] | undefined)?.[0]?.b64_json;
        setRun(b64 ? { kind: 'image', dataUrl: `data:image/png;base64,${b64}`, remaining } : { kind: 'failed', why: 'no image' });
        return;
      }
      if (model.modality === 'decision') {
        const answers = (body.answers && typeof body.answers === 'object' ? body.answers : {}) as Record<string, unknown>;
        setRun({ kind: 'decision', answers, remaining });
        return;
      }
      setRun({ kind: 'text', text: answerText(model.modality, body), remaining });
    } catch (error) {
      // A JSON the visitor mistyped is the one error with a plain-language cause worth naming; the rest keep their text.
      const why = error instanceof Error && error.message === DECISION_BAD_JSON
        ? t('models.try.decisionInvalid')
        : (error instanceof Error ? error.message : String(error));
      setRun({ kind: 'failed', why });
    }
  }

  return (
    <>
      {model.available && (
        <>
          <SubTitle>{t('models.try.title')}</SubTitle>
          <Panel>
            {model.modality === 'transcription' ? (
              <input type="file" accept="audio/*" data-testid="models-audio" onChange={(e) => setAudio(e.target.files?.[0] ?? null)} />
            ) : model.modality === 'decision' ? (
              <Textarea
                value={prompt}
                data-testid="models-prompt"
                rows={14}
                spellCheck={false}
                style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
                aria-label={t('models.try.decisionPrompt')}
                onChange={(e) => setPrompt(e.target.value)}
              />
            ) : (
              <Input
                value={prompt}
                data-testid="models-prompt"
                placeholder={t('models.try.prompt')}
                onChange={(e) => setPrompt(e.target.value)}
              />
            )}
            <Row>
              <Button
                type="button"
                data-testid="models-run"
                disabled={run.kind === 'running' || (model.modality === 'transcription' ? !audio : !prompt.trim())}
                onClick={() => { void press(); }}
              >
                {run.kind === 'running' ? t('models.try.running') : t('models.try.run')}
              </Button>
            </Row>

            {/* Waiting behind paid work: the one moment the free tier is slow, and the moment a deposit is felt. */}
            {isChat && run.kind === 'running' && speed?.busy && (
              <Alert $tone="info" data-testid="models-waiting">
                {t('billing.try.waiting')}
                {offer && (
                  <> {t('billing.try.offer', { amount: offer.amount, after: offer.afterBusyTokS, now: offer.nowBusyTokS })}{' '}
                    <StyledLink to={modelSpeedBillingHref(model.id, offer.amount)} data-testid="models-waiting-billing">{t('billing.cta.deposit')}</StyledLink></>
                )}
              </Alert>
            )}
            {run.kind === 'text' && <Answer data-testid="models-answer">{run.text}</Answer>}
            {/* What the answer ran at, so the reader has a number to compare with when the node is busy. */}
            {isChat && run.kind === 'text' && speed && (
              <Description data-testid="models-answer-speed">{t(speed.busy ? 'billing.try.after_busy' : 'billing.try.after_idle', { tokS: speed.tokS })}</Description>
            )}
            {run.kind === 'image' && <AnswerImage data-testid="models-answer-image" src={run.dataUrl} alt={prompt} />}
            {run.kind === 'decision' && (
              <Decisions data-testid="models-answer-decision">
                {Object.entries(run.answers).map(([qid, answer]) => (
                  <DecisionAnswer key={qid} qid={qid} answer={answer} t={t} />
                ))}
              </Decisions>
            )}
            {run.kind === 'failed' && <Alert>{t('models.try.failed', { why: run.why })}</Alert>}
            {(run.kind === 'text' || run.kind === 'image' || run.kind === 'decision') && run.remaining !== null && (
              <Description>{t('models.try.free', { n: String(run.remaining) })}</Description>
            )}
          </Panel>
        </>
      )}

      <SubTitle>{t('models.key.title')}</SubTitle>
      <Panel>
        {!canHoldKeys && (
          <>
            <Description>{t('models.key.none')}</Description>
            <StyledLink to={`/signing?next=${encodeURIComponent(signInNext)}`}>{t('models.key.signin')}</StyledLink>
          </>
        )}
        {!signedIn && sso && !issuedKey && (
          <Description data-testid="models-key-sso">{t('models.key.sso', { who: sso.email ?? sso.name ?? sso.sub })}</Description>
        )}
        {!signedIn && !sso && google && !issuedKey && (
          <Description data-testid="models-key-google">{t('models.key.google', { email: google.email })}</Description>
        )}
        {canHoldKeys && !issuedKey && (
          <Row>
            <Button
              type="button"
              data-testid="models-create-key"
              disabled={createState.isLoading}
              onClick={() => {
                setKeyError(null);
                void createKey({ label: 'ainize.ai' }).unwrap()
                  .then((r) => { rememberIssuedKey(r.api_key); setIssuedKey(r.api_key); })
                  .catch((e: unknown) => setKeyError(errorMessage(e)));
              }}
            >
              {createState.isLoading ? t('models.key.creating') : t('models.key.create')}
            </Button>
            {signedIn && (keyList?.keys.length ?? 0) > 0 && <StyledLink to="/account">{t('models.key.manage')}</StyledLink>}
          </Row>
        )}
        {issuedKey && (
          <>
            <Mono data-testid="models-issued-key">{issuedKey}</Mono>
            {/* Said out loud: a secret nobody knows is held is a secret held badly. */}
            <Description>{t('models.key.held')}</Description>
            <Row>
              <Button type="button" variant="text" onClick={() => { forgetIssuedKey(); setIssuedKey(null); }}>
                {t('models.key.forget')}
              </Button>
              {signedIn && <StyledLink to="/account">{t('models.key.manage')}</StyledLink>}
            </Row>
          </>
        )}
        {keyError && <Alert>{t('models.key.failed', { why: keyError })}</Alert>}
        {/* A deposit applies to exactly the calls a key makes, so this is where it is said — with this visitor's
            own busy-time number, not a general "faster". */}
        {isChat && offer && (
          <Description data-testid="models-key-speed">
            {t('billing.key.offer', { now: offer.nowBusyTokS, after: offer.afterBusyTokS, amount: offer.amount })}{' '}
            <StyledLink to={modelSpeedBillingHref(model.id, offer.amount)} data-testid="models-key-billing">{t('billing.cta.deposit')}</StyledLink>
          </Description>
        )}
      </Panel>

      <SubTitle>{t('models.code.title')}</SubTitle>
      <Description>{t('models.code.lede')}</Description>
      <Panel>
        <CodeHead>
          <Tabs>
            {SNIPPET_LANGUAGES.map((lang) => (
              <Tab key={lang} type="button" $on={language === lang} onClick={() => setLanguage(lang)}>{lang}</Tab>
            ))}
          </Tabs>
          <Button
            type="button"
            data-testid="models-copy"
            onClick={() => {
              void navigator.clipboard?.writeText(snippet).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {t(copied ? 'models.code.copied' : 'models.code.copy')}
          </Button>
        </CodeHead>
        <CodeBlock data-testid="models-snippet">{snippet}</CodeBlock>
        <Description>
          <StyledLink to="/docs/how-to/call-the-model">{t('models.code.docs')}</StyledLink>
        </Description>
      </Panel>
    </>
  );
}

/** The free-tier route for this modality. Not `/v1`: that needs a key, and this page has no visitor to sign in. */
function callFreeTier(model: PublicModelCard, modelRef: string, peer: boolean, prompt: string, audio: File | null): Promise<Response> {
  if (model.modality === 'transcription') {
    const form = new FormData();
    form.set('model', modelRef);
    if (audio) form.set('file', audio);
    return fetch('/api/transcribe', { method: 'POST', body: form, credentials: 'include' });
  }
  if (model.modality === 'image') {
    return fetch('/api/image', {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: modelRef, prompt, size: '512x512' }),
    });
  }
  // A decision model takes a situation and a set of questions, not a prompt — the box holds the JSON for it, so it
  // is parsed here and the model id is written in. A mistyped body is surfaced as a failed run, not thrown raw.
  if (model.modality === 'decision') {
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(prompt) as Record<string, unknown>; }
    catch { throw new Error(DECISION_BAD_JSON); }
    return fetch('/api/decide', {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...parsed, model: modelRef }),
    });
  }
  // Another node's chat model has no runtime here — only its completion, through the node's peer door.
  if (peer) {
    return fetch('/api/peer-chat', {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: modelRef, messages: [{ role: 'user', content: prompt }] }),
    });
  }
  return fetch('/api/chat', {
    method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ patch_ids: [], mode: 'base', messages: [{ role: 'user', content: prompt }] }),
  });
}

type TFn = (key: string, vars?: Record<string, string | number>) => string;

/** A decimal that may be 0–1 or already a percent, shown as a percent either way. */
const asPercent = (v: number): number => Math.round((v <= 1 ? v * 100 : v));

/**
 * One question's answer, read defensively — the shapes come off the node and an older or newer backend may send
 * a field this build has not seen. A choice shows its pick and the spread it beat; a score shows the legend label
 * for the rounded value; a noul shows the probability it is true. The confidence line is shown when it is given.
 */
function DecisionAnswer({ qid, answer, t }: { qid: string; answer: unknown; t: TFn }) {
  const a = (answer && typeof answer === 'object' ? answer : {}) as Record<string, unknown>;
  const type = a.type;
  const probs = (a.probabilities && typeof a.probabilities === 'object' ? a.probabilities : {}) as Record<string, number>;
  const legend = (a.legend && typeof a.legend === 'object' ? a.legend : null) as Record<string, string> | null;
  const confidence = typeof a.confidence === 'number' ? a.confidence : null;

  let pick: string;
  if (type === 'choice') {
    pick = String(a.choice ?? '');
  } else if (type === 'score') {
    const score = Number(a.score);
    const label = legend?.[String(Math.round(score))];
    pick = Number.isFinite(score) ? (label ? `${Math.round(score)} — ${label}` : String(score)) : '—';
  } else if (type === 'noul') {
    const p = typeof a.noul === 'number' ? a.noul : null;
    pick = p === null ? '—' : t('models.try.decisionNoul', { p: p.toFixed(2) });
  } else {
    pick = JSON.stringify(answer);
  }

  const bars = Object.entries(probs);
  return (
    <DecisionCard>
      <DecisionQid>{qid}</DecisionQid>
      <DecisionPick>{pick}</DecisionPick>
      {confidence !== null && <DecisionConf>{t('models.try.decisionConfidence', { pct: asPercent(confidence) })}</DecisionConf>}
      {bars.map(([key, value]) => {
        const pct = asPercent(typeof value === 'number' ? value : 0);
        const label = type === 'score' && legend?.[key] !== undefined ? legend[key] : key;
        return (
          <Bar key={key}>
            <BarLabel>{label}</BarLabel>
            <BarTrack><BarFill $pct={pct} /></BarTrack>
            <BarPct>{pct}%</BarPct>
          </Bar>
        );
      })}
    </DecisionCard>
  );
}

/** Each modality buries its answer somewhere different; this is the only place that knows where. */
function answerText(modality: ModelModality, body: Record<string, unknown>): string {
  if (modality === 'transcription') return String(body.text ?? '');
  const base = (body.base ?? null) as { content?: string } | null;
  if (base?.content) return base.content;
  const choices = body.choices as { message?: { content?: string } }[] | undefined;
  // Another node's model arrives raw — Qwen3 leaves blank lines ahead of the answer, which read as a gap.
  const content = choices?.[0]?.message?.content;
  return typeof content === 'string' ? content.trim() : JSON.stringify(body, null, 2);
}

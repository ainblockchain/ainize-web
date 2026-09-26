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
import { Alert, Input } from '@/components/ui/Form';
import { Description, Mono, StyledLink, SubTitle } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { modelsPageCodeSnippet, SNIPPET_LANGUAGES, type SnippetLanguage } from './modelsPageCodeSnippet';
import { forgetIssuedKey, recallIssuedKey, rememberIssuedKey } from './issuedKeyMemory';
import { MODEL_SPEED_QUOTE_SAIN, modelSpeedBillingHref, modelSpeedFactOf, modelSpeedPriorityOfferOf } from './modelSpeedHints';

const Panel = styled.div`border: 1px solid #e2e4ea; border-radius: 10px; padding: 18px; margin-bottom: 28px;`;
const Row = styled.div`display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap; margin-top: 12px;`;
const Answer = styled.pre`
  margin-top: 14px; padding: 14px; border-radius: 8px; background: #f7f8fa; white-space: pre-wrap;
  word-break: break-word; font-size: 13px; max-height: 320px; overflow: auto;
`;
const AnswerImage = styled.img`margin-top: 14px; max-width: 100%; border-radius: 8px; border: 1px solid #e2e4ea;`;

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
  const [prompt, setPrompt] = useState('');
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
  const { google } = useAuth();
  const canHoldKeys = signedIn || !!google;
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
      setRun({ kind: 'text', text: answerText(model.modality, body), remaining });
    } catch (error) {
      setRun({ kind: 'failed', why: error instanceof Error ? error.message : String(error) });
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
            {run.kind === 'failed' && <Alert>{t('models.try.failed', { why: run.why })}</Alert>}
            {(run.kind === 'text' || run.kind === 'image') && run.remaining !== null && (
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
        {!signedIn && google && !issuedKey && (
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

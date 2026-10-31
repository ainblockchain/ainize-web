/**
 * The part of a model page you can press: a free-tier playground, an API key, and the code for the same call.
 *
 * It lived on `/models` while that page was one model at a time. `/models` is now the list and every model has its
 * own page (`ModelDetailPage`), so the panel moved there whole — the same state, the same free-tier routes, the
 * same `data-testid`s — rather than being rewritten beside the list. The rule it was built on still holds: the
 * snippet is built from the state the playground just used, so the code copied is the call made.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { errorMessage, useApiKeysQuery, useCreateApiKeyMutation, useThroughputQuoteQuery } from '@/api/api';
import { billingView } from '@/lib/billingView';
import { useAuth } from '@/auth/AuthContext';
import type { PublicModelCard } from '@/api/models';
import { Button } from '@/components/ui/Button';
import { Alert, Input, Textarea, TextField } from '@/components/ui/Form';
import { Description, Mono, StyledLink, SubTitle } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { modelsPageCodeSnippet, SNIPPET_LANGUAGES, type SnippetLanguage } from './modelsPageCodeSnippet';
import { useActiveView } from '@/hooks/useActiveView';
import { callPlayground, createPlaygroundTask, playgroundJson } from './playgroundCall';
import { decisionInput, playgroundBody, playgroundInitialPrompt, playgroundNeedsKey, PlaygroundInputError } from './modelPlaygroundInput';
import { readChatStream } from './playgroundStream';
import { apiKeyContext, apiKeyExpected, apiKeyId, apiKeySnapshot, confirmApiKeyForCall, createdApiKey } from '@/api/apiKeyEvidence';
import { issuedKeyScope, recallIssuedKey } from './issuedKeyMemory';
import { useIssuedKey } from './useIssuedKey';
import { useClipboardCopy } from '@/hooks/useClipboardCopy';
import { MODEL_SPEED_QUOTE_SAIN, modelSpeedBillingHref, modelSpeedPriorityOfferOf } from './modelSpeedHints';

const Panel = styled.div`border: 1px solid #e2e4ea; border-radius: 10px; padding: 18px; margin-bottom: 28px;`;
const Row = styled.div`display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap; margin-top: 12px;`;
const Answer = styled.pre`
  margin-top: 14px; padding: 14px; border-radius: 8px; background: #f7f8fa; white-space: pre-wrap;
  word-break: break-word; font-size: 13px; max-height: 320px; overflow: auto;
`;
// What a thinking model writes before its answer: shown as it comes, quieter than the answer it leads to.
const Reasoning = styled.pre`
  margin-top: 14px; padding: 10px 14px; border-left: 3px solid #e2e4ea; color: #6b7280; white-space: pre-wrap;
  word-break: break-word; font-size: 12px; max-height: 160px; overflow: auto;
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


const Tabs = styled.div`display: flex; flex-wrap: wrap; min-width: 0; gap: 6px; margin-bottom: 10px;`;
const Tab = styled.button<{ $on: boolean }>`
  cursor: pointer; font: inherit; font-size: 13px; padding: 5px 12px; border-radius: 999px;
  border: 1px solid ${(p) => (p.$on ? '#5b3df5' : '#e2e4ea')};
  background: ${(p) => (p.$on ? '#f4f1ff' : '#fff')};
`;
const CodeBlock = styled.pre`
  padding: 16px; border-radius: 8px; background: #11131a; color: #e6e8ee; overflow: auto;
  font-size: 12.5px; line-height: 1.6;
`;
const CodeHead = styled.div`display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px;`;

/** What the browser is talking to. Read at render so a node behind a different origin still copies correctly. */
const nodeUrlFromBrowser = (): string =>
  (typeof window === 'undefined' ? '' : window.location.origin);

type RunState =
  | { kind: 'idle' }
  | { kind: 'running' }
  /** `streaming` while the answer is still arriving; `reasoning` is what a thinking model wrote first, if anything. */
  | { kind: 'text'; text: string; remaining: number | null; reasoning?: string; streaming?: boolean; partial?: boolean }
  | { kind: 'image'; dataUrl: string; remaining: number | null }
  | { kind: 'decision'; answers: Record<string, unknown>; remaining: number | null }
  | { kind: 'audio'; url: string }
  | { kind: 'failed'; why: string; text?: string; reasoning?: string };

/**
 * `signInNext` is where the sign-in link returns to — the page this panel sits on, so signing in for a key does
 * not drop the reader back on a different model.
 */
/**
 * `callModel` is what the calls and the snippet name: the bare id for this node's own model, `id@0x<node>` for a
 * peer's (api/networkModels.ts). `peer` turns off what is this node's alone — its speed and its deposits.
 */
export function ModelPlaygroundPanel({ model, signInNext, callModel, peer = false }: { model: PublicModelCard; signInNext: string; callModel?: string; peer?: boolean }) {
  const { cacheIdentity, address } = useAuth();
  return <AccountModelPlayground key={JSON.stringify([cacheIdentity, address, model.id, model.modality, callModel, peer])} model={model} signInNext={signInNext} callModel={callModel} peer={peer} />;
}

function AccountModelPlayground({ model, signInNext, callModel, peer = false }: { model: PublicModelCard; signInNext: string; callModel?: string; peer?: boolean }) {
  const modelRef = callModel ?? model.id;
  const { t } = useT();
  // Show the same initial sample that the code uses; clearing it is invalid rather than a silent fallback.
  const [prompt, setPrompt] = useState(() => playgroundInitialPrompt(model.modality));
  const [audio, setAudio] = useState<File | null>(null);
  const [run, setRun] = useState<RunState>({ kind: 'idle' });
  useEffect(() => {
    if (run.kind === 'audio') return () => URL.revokeObjectURL(run.url);
  }, [run]);
  const [language, setLanguage] = useState<SnippetLanguage>('python');

  // AuthContext includes optimistic sign-out; raw cached /me can still name the old wallet while logout runs.
  const auth = useAuth(), active = useActiveView();
  const { google, sso, subject, isSignedIn: canHoldKeys, cacheIdentity } = auth;
  const [task] = useState(createPlaygroundTask);
  useEffect(() => () => task.cancel(), [task]);
  const current = () => active() && !auth.loading && !auth.signingOut && (!canHoldKeys || auth.isCurrentAccount());
  const signedIn = !!subject;
  const keyBusy = useRef(false);
  const keyActor = apiKeyContext(auth.address, auth.principal);
  const keyContext = issuedKeyScope(cacheIdentity, auth.address);
  const keyQuery = useApiKeysQuery(keyContext, { skip: !canHoldKeys || !keyContext, refetchOnMountOrArgChange: true, pollingInterval: 60_000 });
  const keyList = apiKeySnapshot(keyQuery.currentData, keyActor);
  const invalidKeys = keyQuery.currentData !== undefined && !keyList;
  const keysReady = !!keyList && !keyQuery.isFetching && !keyQuery.isError && !!keyContext;
  const [createKey, createState] = useCreateApiKeyMutation();
  const { key: issuedKey, usableKey, state: heldState, remember, forget } = useIssuedKey(cacheIdentity, auth.address, keyActor, keysReady ? keyQuery.currentData : undefined, keyQuery.startedTimeStamp);
  const [keyName, setKeyName] = useState('');
  const keyLabel = keyName.trim();
  const duplicateKeyName = !!keyLabel && !!keyList?.keys.some((key) => key.label?.trim().toLocaleLowerCase() === keyLabel.toLocaleLowerCase());
  const [keyError, setKeyError] = useState<string | null>(null);

  const refreshKeys = async () => { await auth.refresh(); if (current()) await keyQuery.refetch(); };

  // The model's speed and whether it is busy — read faster while a request of ours is waiting, since that is when
  // "paid work is ahead of you" is worth saying. Chat only: a deposit buys the language model's queue.
  // A peer's speed and deposits are its own, not this node's: nothing here can quote them.
  const isChat = model.modality === 'chat' && !peer;
  const throughputQuery = useThroughputQuoteQuery(
    { model: model.id, identity: cacheIdentity, token: 'sAIN', amount: MODEL_SPEED_QUOTE_SAIN },
    { skip: !isChat, pollingInterval: run.kind === 'running' ? 2_000 : 15_000 },
  );
  const throughput = throughputQuery.isError || !isChat ? null : billingView(throughputQuery.currentData, model.id, subject);
  const offer = modelSpeedPriorityOfferOf(throughput);

  let inputError: string | null = null;
  try { if (model.modality !== 'transcription') playgroundBody(model.modality, modelRef, prompt); }
  catch (e) { inputError = t(`models.try.input.${e instanceof PlaygroundInputError ? e.code : 'prompt'}`); }
  const needsKey = playgroundNeedsKey(model.modality);
  const fileValid = !!audio && audio.size > 0 && audio.size <= 10 * 1024 * 1024;
  const snippet = useMemo(() => {
    try { return modelsPageCodeSnippet({ language, modality: model.modality, model: modelRef, nodeUrl: nodeUrlFromBrowser(), prompt,
      apiKey: usableKey ?? undefined, audioFileName: audio?.name }); }
    catch { return ''; }
  }, [language, model.modality, modelRef, prompt, usableKey, audio]);
  const copy = useClipboardCopy(snippet);
  const busy = run.kind === 'running' || (run.kind === 'text' && !!run.streaming);
  const changePrompt = (value: string) => { if (!task.busy()) { setPrompt(value); setRun({ kind: 'idle' }); } };

  async function press() {
    if (!current() || task.busy() || !model.available || inputError || (needsKey && !usableKey) || (model.modality === 'transcription' && !fileValid)) return;
    setRun({ kind: 'running' });
    try {
      await task.run(current, async (signal, live) => {
        if (needsKey && usableKey) {
          await confirmApiKeyForCall(usableKey, keyActor, () => keyQuery.refetch().unwrap(), () => live() && recallIssuedKey(keyContext) === usableKey);
        }
        if (!live()) return;
        const res = await callPlayground({ model, modelRef, peer, prompt, audio, apiKey: usableKey }, signal);
        if (!live()) { await res.body?.cancel(); return; }
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error?.code === 'backend_unavailable' ? 'model_unavailable' : 'request_failed');
        }
        const expectedModel = model.id;
        if (model.modality === 'chat' && /text\/event-stream/i.test(res.headers.get('content-type') ?? '')) {
          const done = await readChatStream(res, ({ text, reasoning }) => { if (live()) setRun({ kind: 'text', text, reasoning, remaining: null, streaming: true }); }, expectedModel);
          if (live()) setRun({ kind: 'text', ...done, remaining: null });
          return;
        }
        if (model.modality === 'speech' || model.modality === 'music') {
          if (!/^(audio\/|application\/octet-stream)/i.test(res.headers.get('content-type') ?? '')) throw new Error('response');
          const blob = await res.blob(); if (!live()) return;
          if (!blob.size) throw new Error('response');
          setRun({ kind: 'audio', url: URL.createObjectURL(blob) }); return;
        }
        const body = await res.json(); if (!live()) return;
        const result = playgroundJson(model.modality, body, expectedModel, model.modality === 'decision' ? decisionInput(prompt).questions : {});
        setRun({ ...result, remaining: null });
      });
    } catch (error) {
      if (current()) {
        const code = error instanceof Error ? error.name === 'AbortError' ? 'cancelled' : error.message : 'response';
        const known = ['stream_incomplete', 'stream_invalid', 'stream_model', 'request_failed', 'model_unavailable', 'key_unavailable', 'cancelled', 'response'].includes(code) ? code : 'response';
        setRun(previous => ({ kind: 'failed', why: t(`models.try.error.${known}`), ...(previous.kind === 'text' ? { text: previous.text, reasoning: previous.reasoning } : {}) }));
      }
    }
  }

  return (
    <>
      {model.available && (
        <>
          <SubTitle>{t('models.try.title')}</SubTitle>
          <Panel>
            {model.modality === 'transcription' ? (
              <input type="file" accept="audio/*" aria-label={t('models.try.audio')} disabled={busy} data-testid="models-audio" onChange={(e) => { setAudio(e.target.files?.[0] ?? null); setRun({ kind: 'idle' }); }} />
            ) : model.modality === 'decision' ? (
              <Textarea
                value={prompt} disabled={busy}
                data-testid="models-prompt"
                rows={14}
                spellCheck={false}
                style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
                aria-label={t('models.try.decisionPrompt')}
                onChange={(e) => changePrompt(e.target.value)}
              />
            ) : (
              <Input
                value={prompt} disabled={busy}
                data-testid="models-prompt"
                aria-label={t('models.try.prompt')} placeholder={t('models.try.prompt')}
                onChange={(e) => changePrompt(e.target.value)}
              />
            )}
            {inputError && <Alert role="alert">{inputError}</Alert>}
            {model.modality === 'transcription' && audio && !fileValid && <Alert role="alert">{t('models.try.input.file')}</Alert>}
            {needsKey && !usableKey && <Description data-testid="models-key-required">{t('models.try.input.key')}</Description>}
            <Row>
              <Button
                type="button"
                data-testid="models-run"
                disabled={auth.loading || busy || !!inputError || (needsKey && !usableKey) || (model.modality === 'transcription' && !fileValid)}
                onClick={() => { void press(); }}
              >
                {busy ? t('models.try.running') : t('models.try.run')}
              </Button>
              {busy && <Button type="button" onClick={() => { task.cancel(); setRun(previous => ({ kind: 'failed', why: t('models.try.error.cancelled'), ...(previous.kind === 'text' ? { text: previous.text, reasoning: previous.reasoning } : {}) })); }}>{t('models.try.cancel')}</Button>}
            </Row>

            {run.kind === 'text' && !!run.reasoning && (
              <Reasoning data-testid="models-answer-reasoning" aria-label={t('models.try.reasoning')}>{run.reasoning}</Reasoning>
            )}
            {run.kind === 'text' && (run.text || !run.streaming) && <Answer data-testid="models-answer" aria-busy={!!run.streaming}>{run.text}</Answer>}
            {run.kind === 'text' && !run.streaming && run.partial && <Alert $tone="warning">{t('models.try.partial')}</Alert>}
            {run.kind === 'image' && <AnswerImage data-testid="models-answer-image" src={run.dataUrl} alt={prompt} onError={() => setRun(current => current.kind === 'image' && current.dataUrl === run.dataUrl ? { kind: 'failed', why: t('models.try.error.response') } : current)} />}
            {run.kind === 'decision' && (
              <Decisions data-testid="models-answer-decision">
                {Object.entries(run.answers).map(([qid, answer]) => (
                  <DecisionAnswer key={qid} qid={qid} answer={answer} t={t} />
                ))}
              </Decisions>
            )}
            {run.kind === 'audio' && <audio controls src={run.url} onError={() => setRun(current => current.kind === 'audio' && current.url === run.url ? { kind: 'failed', why: t('models.try.error.response') } : current)} aria-label={model.modality === 'music' ? 'Generated music' : 'Generated speech'} />}
            {run.kind === 'failed' && <>
              {(run.text || run.reasoning) && <><Description>{t('models.try.partial')}</Description><Answer>{run.text || run.reasoning}</Answer></>}
              <Alert role="alert">{t('models.try.failed', { why: run.why })}</Alert>
            </>}
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
        {/* Keys the account already holds. The node keeps only hashes, so the secret itself can't be shown again —
            but the page must not pretend there is nothing: list what exists and point at the account page, and
            make "create" the secondary action ("another"), not a reset to square one. */}
        {canHoldKeys && keyQuery.isLoading && <Description role="status">{t('me.keys.loading')}</Description>}
        {canHoldKeys && invalidKeys && <Alert role="alert" $tone="error">{t('me.keys.invalid')} <Button size="small" disabled={keyQuery.isFetching} onClick={() => void refreshKeys()}>{t('orgs.retry')}</Button></Alert>}
        {canHoldKeys && keyQuery.error && <Alert role="alert" $tone="error">{t('common.error', { message: errorMessage(keyQuery.error) })} <Button size="small" disabled={keyQuery.isFetching} onClick={() => void refreshKeys()}>{t('orgs.retry')}</Button></Alert>}
        {canHoldKeys && !issuedKey && (keyList?.keys.length ?? 0) > 0 && (
          <Description data-testid="models-existing-keys">
            {t('models.key.existing', { n: String(keyList!.keys.filter((k) => !k.disabled).length) })}{' '}
            {keyList!.keys.filter((k) => !k.disabled).slice(0, 3).map((k) => (
              <Mono key={apiKeyId(k)} as="span" style={{ marginRight: 8 }}>{k.prefix}…{k.label ? ` (${k.label})` : ''}</Mono>
            ))}
            <StyledLink to="/me">{t('models.key.manage')}</StyledLink>
          </Description>
        )}
        {canHoldKeys && !issuedKey && (
          <form onSubmit={(event) => {
            event.preventDefault();
            if (!current() || keyBusy.current || !keysReady || !keyActor || !keyLabel || duplicateKeyName) return;
            keyBusy.current = true;
            setKeyError(null);
            void createKey({ label: keyLabel, org_id: null, ...apiKeyExpected(keyActor) }).unwrap()
              .then((r) => {
                if (!auth.isCurrentAccount()) return;
                const secret = createdApiKey(r, keyLabel, null, keyActor);
                if (!secret) throw new Error(t('me.keys.receipt'));
                if (remember(secret) && current()) setKeyName('');
              })
              .catch((e: unknown) => { if (current()) setKeyError(t('me.keys.create_unknown', { why: errorMessage(e) })); })
              .finally(() => { keyBusy.current = false; });
          }}>
            <TextField label={t('me.keys.name')} placeholder={t('me.keys.name_placeholder')}
              helper={duplicateKeyName ? t('me.keys.name_duplicate') : t('me.keys.name_hint')} error={duplicateKeyName}
              data-testid="models-key-name" value={keyName} onChange={(event) => setKeyName(event.target.value)}
              maxLength={60} required disabled={createState.isLoading} />
            <Row>
              <Button type="submit" data-testid="models-create-key" disabled={!keysReady || createState.isLoading || !keyLabel || duplicateKeyName}>
                {createState.isLoading ? t('models.key.creating') : (keyList?.keys.length ?? 0) > 0 ? t('models.key.createAnother') : t('models.key.create')}
              </Button>
              <StyledLink to="/me">{t('models.key.manage')}</StyledLink>
            </Row>
          </form>
        )}
        {heldState === 'revoked' && <Description role="status">{t('me.keys.held.revoked')}</Description>}
        {issuedKey && (
          <>
            {heldState && heldState !== 'ready' && <Description role="status">{t(`me.keys.held.${heldState}`)} <Button size="small" disabled={keyQuery.isFetching} onClick={() => void refreshKeys()}>{t('orgs.retry')}</Button></Description>}
            <Mono data-testid="models-issued-key" style={{ display: 'block', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{issuedKey}</Mono>
            {/* Said out loud: a secret nobody knows is held is a secret held badly. */}
            <Description>{t('models.key.held')}</Description>
            <Row>
              <Button type="button" variant="text" onClick={forget}>
                {t('models.key.forget')}
              </Button>
              {canHoldKeys && <StyledLink to="/me">{t('models.key.manage')}</StyledLink>}
            </Row>
          </>
        )}
        {keyError && <Alert role="alert" $tone="error">{keyError} <Button size="small" disabled={keyQuery.isFetching} onClick={() => void refreshKeys()}>{t('orgs.retry')}</Button></Alert>}
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
            disabled={copy.disabled || !snippet} aria-busy={copy.phase === 'copying'}
            onClick={() => void copy.copy()}
          >
            {t(copy.phase === 'copied' ? 'models.code.copied' : copy.phase === 'copying' ? 'common.copying' : 'models.code.copy')}
          </Button>
        </CodeHead>
        {copy.phase === 'failed' && <Alert role="alert" $tone="error">{t('models.code.copy_failed')}</Alert>}
        <CodeBlock data-testid="models-snippet">{snippet || inputError}</CodeBlock>
        <Description>
          <StyledLink to="/docs/how-to/call-the-model">{t('models.code.docs')}</StyledLink>
        </Description>
      </Panel>
    </>
  );
}

type TFn = (key: string, vars?: Record<string, string | number>) => string;

/** Validated probabilities use the documented 0–1 scale. */
const asPercent = (v: number): number => Math.round(v * 100);

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
  const confidence = typeof a.confidence === 'number' && Number.isFinite(a.confidence) && a.confidence >= 0 && a.confidence <= 1 ? a.confidence : null;

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

  const bars = Object.entries(probs).filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1);
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

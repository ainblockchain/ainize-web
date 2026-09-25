/**
 * What this node serves, a place to press it, and the code to take away.
 *
 * The third part is the point. The playground demonstrates that it works; the snippet is what somebody leaves
 * with, and it is built from the same state the playground just used — so the code copied is the call made.
 *
 * Everything here has to survive a node that is unreachable or serves nothing, because that is what production
 * looks like when its node is down, and a page whose failure states were never looked at has not been built.
 */
import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useModelsQuery } from '@/api/api';
import { modelsByModality, parseModelsResponse, type ModelModality, type PublicModelCard } from '@/api/models';
import { Button } from '@/components/ui/Button';
import { Alert, Input } from '@/components/ui/Form';
import { CenterProgress, Description, Empty, Mono, PageWrapper, StyledLink, SubTitle, Title } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { modelsPageCodeSnippet, SNIPPET_LANGUAGES, type SnippetLanguage } from './models/modelsPageCodeSnippet';

const Cards = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin: 12px 0 28px;`;

const Card = styled.button<{ $selected: boolean; $available: boolean }>`
  text-align: left; cursor: ${(p) => (p.$available ? 'pointer' : 'not-allowed')};
  padding: 14px 16px; border-radius: 10px; font: inherit;
  border: 1px solid ${(p) => (p.$selected ? '#5b3df5' : '#e2e4ea')};
  background: ${(p) => (p.$selected ? '#f4f1ff' : '#fff')};
  opacity: ${(p) => (p.$available ? 1 : 0.55)};
  &:hover { border-color: ${(p) => (p.$available ? '#5b3df5' : '#e2e4ea')}; }
`;

const CardId = styled.div`font-weight: 600; font-size: 14px; word-break: break-all;`;
const CardMeta = styled.div`margin-top: 6px; font-size: 12px; color: #6b7280;`;
const Dot = styled.span<{ $up: boolean }>`
  display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px;
  background: ${(p) => (p.$up ? '#1ea672' : '#c2c6cf')};
`;

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
  | { kind: 'spent'; resetAt: number }
  | { kind: 'failed'; why: string };

export default function ModelsPage() {
  const { t } = useT();
  useTitle(t('models.title'));
  const { data, isLoading, isError } = useModelsQuery();
  const cards = useMemo(() => parseModelsResponse(data), [data]);
  const groups = useMemo(() => modelsByModality(cards), [cards]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected: PublicModelCard | null = useMemo(
    () => cards.find((c) => c.id === selectedId) ?? cards.find((c) => c.available) ?? cards[0] ?? null,
    [cards, selectedId],
  );

  const [prompt, setPrompt] = useState('');
  const [audio, setAudio] = useState<File | null>(null);
  const [run, setRun] = useState<RunState>({ kind: 'idle' });
  const [language, setLanguage] = useState<SnippetLanguage>('python');
  const [copied, setCopied] = useState(false);

  const snippet = useMemo(() => (selected ? modelsPageCodeSnippet({
    language, modality: selected.modality, model: selected.id, nodeUrl: nodeUrlFromBrowser(), prompt,
  }) : ''), [language, selected, prompt]);

  async function press() {
    if (!selected) return;
    setRun({ kind: 'running' });
    try {
      const res = await callFreeTier(selected, prompt, audio);
      if (res.status === 429) {
        const body = await res.json() as { quota_reset?: number };
        setRun({ kind: 'spent', resetAt: body.quota_reset ?? Date.now() + 3600_000 });
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: { message?: string; code?: string } } | null;
        setRun({ kind: 'failed', why: body?.error?.code === 'backend_unavailable' ? t('models.try.unavailable') : (body?.error?.message ?? String(res.status)) });
        return;
      }
      const body = await res.json() as Record<string, unknown>;
      const remaining = typeof body.remaining_free_tries === 'number' ? body.remaining_free_tries : null;
      if (selected.modality === 'image') {
        const b64 = (body.data as { b64_json?: string }[] | undefined)?.[0]?.b64_json;
        setRun(b64 ? { kind: 'image', dataUrl: `data:image/png;base64,${b64}`, remaining } : { kind: 'failed', why: 'no image' });
        return;
      }
      setRun({ kind: 'text', text: answerText(selected.modality, body), remaining });
    } catch (error) {
      setRun({ kind: 'failed', why: error instanceof Error ? error.message : String(error) });
    }
  }

  if (isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;

  return (
    <PageWrapper>
      <Title>{t('models.title')}</Title>
      <Description>{t('models.lede')}</Description>

      {/* The two states production is in when its node is down. Neither pretends to be a model list. */}
      {isError && (
        <Empty>
          <SubTitle>{t('models.offline.title')}</SubTitle>
          <Description>{t('models.offline.body')}</Description>
        </Empty>
      )}
      {!isError && cards.length === 0 && (
        <Empty>
          <SubTitle>{t('models.empty.title')}</SubTitle>
          <Description>{t('models.empty.body')}</Description>
          <Mono>{'"backends": [{ "id": "llm", "modality": "chat", "upstream": "http://127.0.0.1:8000", "models": ["…"] }]'}</Mono>
        </Empty>
      )}

      {groups.map((group) => (
        <div key={group.modality}>
          <SubTitle>{t(`models.modality.${group.modality}`)}</SubTitle>
          <Cards>
            {group.models.map((model) => (
              <Card
                key={model.id}
                type="button"
                data-testid={`model-card-${model.id}`}
                $selected={selected?.id === model.id}
                $available={model.available}
                disabled={!model.available}
                onClick={() => { setSelectedId(model.id); setRun({ kind: 'idle' }); }}
              >
                <CardId>{model.id}</CardId>
                <CardMeta><Dot $up={model.available} />{t(model.available ? 'models.available' : 'models.unavailable')}</CardMeta>
              </Card>
            ))}
          </Cards>
        </div>
      ))}

      {selected && selected.available && (
        <>
          <SubTitle>{t('models.try.title')}</SubTitle>
          <Panel>
            {selected.modality === 'transcription' ? (
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
                disabled={run.kind === 'running' || (selected.modality === 'transcription' ? !audio : !prompt.trim())}
                onClick={() => { void press(); }}
              >
                {run.kind === 'running' ? t('models.try.running') : t('models.try.run')}
              </Button>
            </Row>

            {run.kind === 'text' && <Answer data-testid="models-answer">{run.text}</Answer>}
            {run.kind === 'image' && <AnswerImage data-testid="models-answer-image" src={run.dataUrl} alt={prompt} />}
            {run.kind === 'spent' && <Alert>{t('models.try.spent', { at: new Date(run.resetAt).toLocaleTimeString() })}</Alert>}
            {run.kind === 'failed' && <Alert>{t('models.try.failed', { why: run.why })}</Alert>}
            {(run.kind === 'text' || run.kind === 'image') && run.remaining !== null && (
              <Description>{t('models.try.free', { n: String(run.remaining) })}</Description>
            )}
          </Panel>
        </>
      )}

      {selected && (
        <>
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
      )}
    </PageWrapper>
  );
}

/** The free-tier route for this modality. Not `/v1`: that needs a key, and this page has no visitor to sign in. */
function callFreeTier(model: PublicModelCard, prompt: string, audio: File | null): Promise<Response> {
  if (model.modality === 'transcription') {
    const form = new FormData();
    form.set('model', model.id);
    if (audio) form.set('file', audio);
    return fetch('/api/transcribe', { method: 'POST', body: form, credentials: 'include' });
  }
  if (model.modality === 'image') {
    return fetch('/api/image', {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: model.id, prompt, size: '512x512' }),
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
  return choices?.[0]?.message?.content ?? JSON.stringify(body, null, 2);
}

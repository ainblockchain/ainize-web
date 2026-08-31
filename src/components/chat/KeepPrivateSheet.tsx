import { useState } from 'react';
import styled from 'styled-components';
import { useCancelTeachJobMutation, useSaveTeachJobMutation } from '@/api/api';
import type { TeachJob, TeachPolicy, TeachSaveResponse } from '@/api/types';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox } from '@/components/ui/Form';
import { CopyButton, Mono } from '@/components/ui/Misc';
import { dateTime } from '@/utils/format';
import { Sheet, SheetFooter, SheetNote } from './Sheet';
import { mapTeachError, mb } from './teachUtil';

const Options = styled.div`display: flex; flex-direction: column; gap: 10px;`;
const Option = styled.label<{ $active: boolean }>`
  display: grid; grid-template-columns: 20px 1fr; gap: 12px; padding: 12px 14px; border-radius: 6px; cursor: pointer;
  border: 1px solid ${(p) => (p.$active ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)}; background: ${(p) => (p.$active ? p.theme.color.PALE_GREY : '#fff')};
  input { margin-top: 3px; accent-color: #8b3eeb; }
  b { display: block; font-size: 14px; color: ${(p) => p.theme.color.BLACK}; }
  span.body { display: block; margin-top: 2px; font-size: 13px; line-height: 1.5; color: ${(p) => p.theme.color.DARK_GREY}; }
`;
const Inner = styled.div`grid-column: 2; display: flex; flex-direction: column; gap: 10px; margin-top: 4px; font-size: 13px;`;
const Links = styled.ul`margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; a { color: ${(p) => p.theme.color.PRIMARY}; font-weight: 600; }`;
const Pre = styled.pre`margin: 0; padding: 12px 14px; border-radius: 4px; background: #303133; color: #f2f2f2; font-size: 12px; line-height: 1.55; overflow-x: auto; white-space: pre;`;

export interface KeepPrivateSheetProps {
  job: TeachJob;
  policy: TeachPolicy;
  onClose: () => void;
  onPublishLater: () => void;
  onDeleted: () => void;
}

function commands(job: TeachJob, saved: TeachSaveResponse, model: string): string {
  const origin = window.location.origin;
  const slug = saved.filename.replace(/^lesson-/, '').replace(/\.npz$/, '');
  const q = (job.facts[0]?.prompt ?? '').replace(/"/g, '\\"');
  return [
    '# 1) download the lesson and check its fingerprint',
    `curl -L -o ${saved.filename} "${origin}${saved.download.npz_url}"`,
    `sha256sum ${saved.filename}   # expect ${saved.sha256}`,
    `curl -L -o recipe.json "${origin}${saved.download.recipe_url}"`,
    '',
    `# 2) live switch on your own ${model} server with the memory hook (see RUN-LOCALLY.md, Option A)`,
    'git clone https://github.com/comcom-ai/qwen3.8 qwen3.8 && cd qwen3.8',
    `python3 scripts/patch.py apply  ../${saved.filename}   # about 2 s`,
    `python3 scripts/patch.py status ../${saved.filename}   # must print "applied: yes"`,
    '',
    '# 3) ask it',
    `curl -s localhost:8000/v1/chat/completions -H 'content-type: application/json' -d '{"model":"<id from /v1/models>","messages":[{"role":"user","content":"${q}"}],"max_tokens":64,"temperature":0,"chat_template_kwargs":{"enable_thinking":false}}'`,
    '',
    '# 4) undo (or run it through your own node instead)',
    `python3 scripts/patch.py remove ../${saved.filename}`,
    `ainize patch import ./${saved.filename} --recipe ./recipe.json && ainize patch apply taught-${slug}`,
  ].join('\n');
}

/** §5.10 — three honest options, default "keep it on this node"; download links are 7-day tokens made on demand. */
export function KeepPrivateSheet({ job, policy, onClose, onPublishLater, onDeleted }: KeepPrivateSheetProps) {
  const { t } = useT();
  const [choice, setChoice] = useState<'node' | 'download' | 'run'>('node');
  const [save, { data: saved, isLoading: saving }] = useSaveTeachJobMutation();
  const [cancel, { isLoading: deleting }] = useCancelTeachJobMutation();
  const [showCmds, setShowCmds] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kept, setKept] = useState(false);
  const model = policy.model.id_M ?? 'Qwen3.8-Flash-Next-W4A16';
  const size = job.result ? mb(job.result.size_bytes) : '—';
  const rows = job.result?.rows ?? 0;

  const makeLinks = async () => { setError(null); try { await save(job.id).unwrap(); } catch (e) { setError(mapTeachError(e, t)); } };
  const pick = (c: 'node' | 'download' | 'run') => { setChoice(c); if (c !== 'node' && !saved && !saving) void makeLinks(); };
  const del = async () => {
    if (!window.confirm(t('teach.keep.delete_confirm'))) return;
    setError(null);
    try { await cancel(job.id).unwrap(); onDeleted(); } catch (e) { setError(mapTeachError(e, t)); }
  };
  const done = () => { if (choice === 'node') setKept(true); else onClose(); };

  return (
    <Sheet title={t('teach.keep.title')} sub={t('teach.keep.sub')} onClose={onClose} width={640} testId="keep-sheet">
      {kept && <Alert $tone="success" role="status" data-testid="keep-kept">{t('teach.keep.kept')}</Alert>}
      <Options role="radiogroup">
        <Option $active={choice === 'node'}>
          <input type="radio" name="keep" checked={choice === 'node'} onChange={() => pick('node')} />
          <div><b>{t('teach.keep.node_title')}</b><span className="body">{t('teach.keep.node_body')}</span></div>
        </Option>
        <Option $active={choice === 'download'}>
          <input type="radio" name="keep" checked={choice === 'download'} onChange={() => pick('download')} data-testid="keep-download" />
          <div><b>{t('teach.keep.dl_title')}</b><span className="body">{t('teach.keep.dl_body', { size, rows: rows.toLocaleString('en-US') })}</span></div>
          {choice === 'download' && (
            <Inner>
              {saving && <SheetNote>{t('common.loading')}</SheetNote>}
              {!saved && !saving && <div><Button size="small" onClick={() => { void makeLinks(); }}>{t('teach.keep.dl_make')}</Button></div>}
              {saved && (
                <>
                  <Links>
                    <li><a href={saved.download.npz_url} download={saved.filename} data-testid="dl-npz">{t('teach.keep.dl_file', { filename: saved.filename })}</a></li>
                    <li><a href={saved.download.recipe_url} download="recipe.json" data-testid="dl-recipe">{t('teach.keep.dl_recipe')}</a></li>
                    <li><a href={saved.download.readme_url} download="RUN-LOCALLY.md" data-testid="dl-readme">{t('teach.keep.readme')}</a></li>
                  </Links>
                  <div>{t('teach.keep.dl_sha')}: <Mono data-testid="dl-sha">{saved.sha256}</Mono> <CopyButton text={saved.sha256} label={t('common.copy')} /></div>
                  <SheetNote>{t('teach.keep.dl_expires', { when: dateTime(saved.download.expires_at) })}</SheetNote>
                </>
              )}
            </Inner>
          )}
        </Option>
        <Option $active={choice === 'run'}>
          <input type="radio" name="keep" checked={choice === 'run'} onChange={() => pick('run')} data-testid="keep-run" />
          <div><b>{t('teach.keep.run_title')}</b><span className="body">{t('teach.keep.run_hw', { model })}</span></div>
          {choice === 'run' && (
            <Inner>
              <Checkbox checked={showCmds} onChange={(e) => setShowCmds(e.target.checked)} label={<span style={{ fontSize: 13 }}>{t('teach.keep.run_toggle')}</span>} data-testid="run-toggle" />
              {showCmds && (saved ? (
                <>
                  <Pre data-testid="run-commands">{commands(job, saved, model)}</Pre>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <CopyButton text={commands(job, saved, model)} label={t('teach.keep.copy')} />
                    <a href={saved.download.readme_url} download="RUN-LOCALLY.md" data-testid="run-readme" style={{ fontWeight: 600 }}>{t('teach.keep.readme')}</a>
                  </div>
                  <SheetNote>{t('teach.keep.run_note')}</SheetNote>
                </>
              ) : <SheetNote>{saving ? t('common.loading') : <Button size="small" onClick={() => { void makeLinks(); }}>{t('teach.keep.dl_make')}</Button>}</SheetNote>)}
            </Inner>
          )}
        </Option>
      </Options>
      {error && <Alert $tone="error" role="alert">{error}</Alert>}
      <SheetFooter>
        <Button color="secondary" onClick={() => { void del(); }} loading={deleting} style={{ marginRight: 'auto' }} data-testid="keep-delete">{t('teach.keep.delete')}</Button>
        <Button onClick={onPublishLater} data-testid="keep-later">{t('teach.keep.later')}</Button>
        <Button variant="contained" onClick={done} data-testid="keep-done">{t('teach.keep.done')}</Button>
      </SheetFooter>
    </Sheet>
  );
}

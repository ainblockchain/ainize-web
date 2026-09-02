import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useCancelTeachJobMutation, useSaveTeachJobMutation } from '@/api/api';
import type { TeachJob, TeachPolicy } from '@/api/types';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox } from '@/components/ui/Form';
import { CopyButton, Mono } from '@/components/ui/Misc';
import { useDateTime, useNumber } from '@/utils/useFormat';
import { Sheet, SheetFooter, SheetNote } from './Sheet';
import { mapTeachError, mb } from './teachUtil';

const Options = styled.div`display: flex; flex-direction: column; gap: 10px; min-width: 0;`;
/** `minmax(0, 1fr)` so a long command line can never widen the option (the review saw a 1,614 px grid at 360 px). */
const Option = styled.label<{ $active: boolean }>`
  display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 12px; padding: 12px 14px; border-radius: 6px; cursor: pointer; min-width: 0;
  border: 1px solid ${(p) => (p.$active ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)}; background: ${(p) => (p.$active ? p.theme.color.PALE_GREY : '#fff')};
  input { margin-top: 3px; accent-color: #8b3eeb; }
  b { display: block; font-size: 14px; color: ${(p) => p.theme.color.BLACK}; }
  span.body { display: block; margin-top: 2px; font-size: 13px; line-height: 1.5; color: ${(p) => p.theme.color.DARK_GREY}; }
`;
const Inner = styled.div`grid-column: 2; display: flex; flex-direction: column; gap: 10px; margin-top: 4px; font-size: 13px; min-width: 0; max-width: 100%;`;
const Links = styled.ul`margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; a { color: ${(p) => p.theme.color.PRIMARY}; font-weight: 600; }`;
/** The node's RUN-LOCALLY.md, rendered as-is: only this box scrolls (both ways), never the sheet. */
const Doc = styled.div`
  max-width: 100%; max-height: 340px; overflow: auto; border-radius: 4px; background: #303133; color: #f2f2f2; padding: 12px 14px; font-size: 12px; line-height: 1.55;
  pre { margin: 0; white-space: pre; font-family: ${(p) => p.theme.font.mono}; }
`;

export interface KeepPrivateSheetProps {
  job: TeachJob;
  policy: TeachPolicy;
  /** the serving model (runtime.model, else the node's configured model from /api/info) — fallback when the policy has no model id */
  runtimeModel?: string | null;
  onClose: () => void;
  onPublishLater: () => void;
  onDeleted: () => void;
}

/** Fenced ```bash``` blocks of the markdown, joined — what "Copy commands" puts on the clipboard. */
function commandsOf(md: string): string {
  const out: string[] = [];
  const re = /```[a-z]*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) out.push(m[1].trimEnd());
  return out.join('\n\n');
}

/**
 * §5.10 — three honest options, default "keep it on this node". Download links are 7-day tokens minted on demand: nothing
 * is POSTed to /save until the visitor picks the download option (that is the request for links) or ticks the hardware box. The local-run commands are the node's
 * own RUN-LOCALLY.md (fetched through the same tokened link the visitor can download), not a second copy kept in the web app.
 */
export function KeepPrivateSheet({ job, policy, runtimeModel, onClose, onPublishLater, onDeleted }: KeepPrivateSheetProps) {
  const { t } = useT();
  const dateTime = useDateTime();
  const [choice, setChoice] = useState<'node' | 'download' | 'run'>('node');
  const [save, { data: saved, isLoading: saving }] = useSaveTeachJobMutation();
  const [cancel, { isLoading: deleting }] = useCancelTeachJobMutation();
  const [showCmds, setShowCmds] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kept, setKept] = useState(false);
  const [readme, setReadme] = useState<{ url: string; text: string } | null>(null);
  const [readmeError, setReadmeError] = useState<string | null>(null);
  const num = useNumber();
  const model = policy.model.id_M ?? runtimeModel ?? '—';
  const size = job.result ? mb(job.result.size_bytes) : '—';
  const rows = job.result?.rows ?? 0;

  const makeLinks = async () => { setError(null); try { await save(job.id).unwrap(); } catch (e) { setError(mapTeachError(e, t)); } };
  /** "Download the knowledge file" is itself the request for links; "Run it on my own machine" only mints them after the hardware box is ticked. */
  const pick = (c: 'node' | 'download' | 'run') => { setChoice(c); if (c === 'download' && !saved && !saving) void makeLinks(); };
  const toggleCmds = (on: boolean) => { setShowCmds(on); if (on && !saved && !saving) void makeLinks(); };
  const del = async () => {
    if (!window.confirm(t('teach.keep.delete_confirm'))) return;
    setError(null);
    try { await cancel(job.id).unwrap(); onDeleted(); } catch (e) { setError(mapTeachError(e, t)); }
  };
  const done = () => { if (choice === 'node') setKept(true); else onClose(); };

  // Fetch RUN-LOCALLY.md once the links exist and the visitor asked for the commands.
  const readmeUrl = saved?.download.readme_url;
  useEffect(() => {
    if (!showCmds || !readmeUrl || readme?.url === readmeUrl) return;
    let alive = true;
    setReadmeError(null);
    fetch(readmeUrl, { credentials: 'same-origin' })
      .then(async (r) => { if (!r.ok) throw new Error(`${r.status}`); return r.text(); })
      .then((text) => { if (alive) setReadme({ url: readmeUrl, text }); })
      .catch((e: unknown) => { if (alive) setReadmeError(mapTeachError(e, t)); });
    return () => { alive = false; };
  }, [showCmds, readmeUrl, readme?.url, t]);
  const commands = useMemo(() => (readme ? commandsOf(readme.text) : ''), [readme]);

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
          <div><b>{t('teach.keep.dl_title')}</b><span className="body">{t('teach.keep.dl_body', { size, rows: num(rows) }, rows)}</span></div>
          {choice === 'download' && (
            <Inner>
              {saving && <SheetNote>{t('common.loading')}</SheetNote>}
              {!saved && !saving && <div><Button size="small" onClick={() => { void makeLinks(); }} data-testid="dl-make">{t('teach.keep.dl_make')}</Button></div>}
              {saved && (
                <>
                  <Links>
                    <li><a href={saved.download.npz_url} download={saved.filename} data-testid="dl-npz">{t('teach.keep.dl_file', { filename: saved.filename })}</a></li>
                    <li><a href={saved.download.recipe_url} download="recipe.json" data-testid="dl-recipe">{t('teach.keep.dl_recipe')}</a></li>
                    <li><a href={saved.download.readme_url} download="RUN-LOCALLY.md" data-testid="dl-readme">{t('teach.keep.readme')}</a></li>
                  </Links>
                  <div style={{ wordBreak: 'break-all' }}>{t('teach.keep.dl_sha')}: <Mono data-testid="dl-sha">{saved.sha256}</Mono> <CopyButton text={saved.sha256} label={t('common.copy')} /></div>
                  <SheetNote>{t('teach.keep.dl_expires', { when: dateTime(saved.download.expires_at) })}</SheetNote>
                </>
              )}
            </Inner>
          )}
        </Option>
        <Option $active={choice === 'run'}>
          <input type="radio" name="keep" checked={choice === 'run'} onChange={() => pick('run')} data-testid="keep-run" />
          {/* hardware notice first — the commands only appear after the visitor confirms they have this hardware */}
          <div><b>{t('teach.keep.run_title')}</b><span className="body" data-testid="run-hw">{t('teach.keep.run_hw', { model })}</span></div>
          {choice === 'run' && (
            <Inner>
              <Checkbox checked={showCmds} onChange={(e) => toggleCmds(e.target.checked)} label={<span style={{ fontSize: 13 }}>{t('teach.keep.run_toggle')}</span>} data-testid="run-toggle" />
              {!showCmds && !saved && <SheetNote>{t('teach.keep.run_confirm')}</SheetNote>}
              {showCmds && (saving || (saved && !readme && !readmeError)) && <SheetNote>{t('teach.keep.run_loading')}</SheetNote>}
              {showCmds && error && <Alert $tone="error" role="alert">{error} <Button size="small" onClick={() => { void makeLinks(); }} style={{ marginLeft: 8 }}>{t('teach.pre.retry')}</Button></Alert>}
              {showCmds && readmeError && <Alert $tone="error" role="alert">{readmeError}</Alert>}
              {showCmds && saved && readme && (
                <>
                  <SheetNote>{t('teach.keep.run_from_node')}</SheetNote>
                  <Doc data-testid="run-commands"><pre>{readme.text}</pre></Doc>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <CopyButton text={commands || readme.text} label={t('teach.keep.copy')} />
                    <a href={saved.download.readme_url} download="RUN-LOCALLY.md" data-testid="run-readme" style={{ fontWeight: 600 }}>{t('teach.keep.readme')}</a>
                  </div>
                  <SheetNote>{t('teach.keep.run_note')}</SheetNote>
                </>
              )}
            </Inner>
          )}
        </Option>
      </Options>
      {error && choice !== 'run' && <Alert $tone="error" role="alert">{error}</Alert>}
      <SheetFooter>
        <Button color="secondary" onClick={() => { void del(); }} loading={deleting} style={{ marginRight: 'auto' }} data-testid="keep-delete">{t('teach.keep.delete')}</Button>
        <Button onClick={onPublishLater} data-testid="keep-later">{t('teach.keep.later')}</Button>
        <Button variant="contained" onClick={done} data-testid="keep-done">{t('teach.keep.done')}</Button>
      </SheetFooter>
    </Sheet>
  );
}

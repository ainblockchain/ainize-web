import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useDriveActionMutation, useDriveChangesQuery, useDriveQuery } from '@/api/api';
import type { DriveChange } from '@/api/types';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Description, ExternalLink, KeyValue, Mono, PageWrapper, SubTitle, Title, TitleRow } from '@/components/ui/Misc';
import { DevBox, MonoBox, Muted, Pre, Row, useElapsed } from '@/components/operator/common';
import { bytes, dateTime, shortHash } from '@/utils/format';

const Status = styled.div<{ $ok: boolean }>`
  display: inline-flex; align-items: center; gap: 8px; font-weight: 600; color: ${(p) => (p.$ok ? p.theme.color.SUCCESS : p.theme.color.GREY)};
  &::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: ${(p) => (p.$ok ? p.theme.color.SUCCESS : p.theme.color.LIGHT_GREY)}; }
`;
const Split = styled.div`display: grid; grid-template-columns: minmax(240px, 1fr) minmax(0, 2fr); gap: 24px; margin-top: 16px; @media (max-width: 900px) { grid-template-columns: 1fr; }`;
const Tree = styled.div`border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fff; max-height: 640px; overflow: auto;`;
const Folder = styled.div`padding: 8px 12px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: ${(p) => p.theme.color.GREY}; background: #fafafa; border-bottom: 1px solid #f0f0f0; position: sticky; top: 0;`;
const FileRow = styled.button<{ $active: boolean; $text: boolean }>`
  display: grid; grid-template-columns: 1fr auto auto; gap: 12px; width: 100%; padding: 8px 12px; border: 0; border-bottom: 1px solid #f4f4f4; text-align: left; cursor: ${(p) => (p.$text ? 'pointer' : 'default')};
  background: ${(p) => (p.$active ? '#f5eefc' : '#fff')}; font-size: 13px; color: ${(p) => (p.$text ? p.theme.color.BLACK : p.theme.color.GREY)};
  &:hover { background: ${(p) => (p.$text ? '#faf7ff' : '#fff')}; }
  span:first-child { font-family: ${(p) => p.theme.font.mono}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  span:not(:first-child) { color: ${(p) => p.theme.color.GREY}; font-size: 12px; white-space: nowrap; }
`;
const Detail = styled.div`min-width: 0;`;
const History = styled.ol`list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px;`;
const Change = styled.li<{ $open: boolean }>`
  border: 1px solid ${(p) => (p.$open ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)}; background: #fff;
`;
const ChangeHead = styled.button`
  display: grid; grid-template-columns: 56px 80px 1fr auto auto; gap: 12px; width: 100%; padding: 8px 12px; border: 0; background: transparent; text-align: left; font-size: 12px; cursor: pointer; align-items: center;
  font-family: ${(p) => p.theme.font.mono}; color: ${(p) => p.theme.color.BLACK};
  &:hover { background: #faf7ff; }
`;
const Kind = styled.span<{ $snap: boolean }>`
  display: inline-block; padding: 1px 6px; border-radius: 8px; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
  color: ${(p) => (p.$snap ? '#0b5468' : '#5b1ca8')}; background: ${(p) => (p.$snap ? '#e1eef3' : '#f5eefc')};
`;
const DiffPre = styled.pre`
  margin: 0; padding: 12px; border-top: 1px solid #f0f0f0; font-size: 12px; line-height: 1.5; overflow-x: auto; max-height: 360px; background: #fafafa;
  .add { display: block; background: #e6f4ea; color: #1e6b36; } .del { display: block; background: #fde8ec; color: #a0102c; } .ctx { display: block; color: #8d8d8f; }
`;

const TEXT_EXT = /\.(json|jsonl|md|txt|yaml|yml|csv|log)$/i;

/** Tiny LCS line diff: returns tagged lines (' ' context, '+' added, '-' removed). */
function lineDiff(a: string, b: string): { tag: ' ' | '+' | '-'; line: string }[] {
  const A = a.split('\n'); const B = b.split('\n');
  const n = A.length, m = B.length;
  if (n * m > 4_000_000) return [{ tag: ' ', line: '(diff too large)' }];
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { tag: ' ' | '+' | '-'; line: string }[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ tag: ' ', line: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ tag: '-', line: A[i] }); i++; }
    else { out.push({ tag: '+', line: B[j] }); j++; }
  }
  while (i < n) { out.push({ tag: '-', line: A[i++] }); }
  while (j < m) { out.push({ tag: '+', line: B[j++] }); }
  return out;
}

function Diff({ prev, next }: { prev: string; next: string }) {
  const { t } = useT();
  const rows = useMemo(() => lineDiff(prev, next), [prev, next]);
  const changed = rows.filter((r) => r.tag !== ' ').length;
  // collapse long unchanged runs
  const shown: (typeof rows[number] | { tag: '…'; line: string })[] = [];
  let run = 0;
  for (let k = 0; k < rows.length; k++) {
    const r = rows[k];
    const nearChange = rows.slice(Math.max(0, k - 2), k + 3).some((x) => x.tag !== ' ');
    if (r.tag === ' ' && !nearChange) { run++; continue; }
    if (run > 0) { shown.push({ tag: '…', line: t('op.drive.diff.unchanged', { n: run }) }); run = 0; }
    shown.push(r);
  }
  if (run > 0) shown.push({ tag: '…', line: t('op.drive.diff.unchanged', { n: run }) });
  return (
    <DiffPre>
      <span className="ctx">{t('op.drive.diff.changed', { n: changed })}</span>
      {shown.map((r, k) => <span key={k} className={r.tag === '+' ? 'add' : r.tag === '-' ? 'del' : 'ctx'}>{r.tag === '…' ? '  ' : r.tag + ' '}{r.line}</span>)}
    </DiffPre>
  );
}

export default function DrivePage() {
  const { t } = useT();
  useTitle(t('op.drive.title'));
  const elapsed = useElapsed();
  const params = useParams();
  const selected = params['*'] ? decodeURIComponent(params['*']) : '';
  const navigate = useNavigate();
  const drive = useDriveQuery(undefined, { pollingInterval: 15_000 });
  const [act, actState] = useDriveActionMutation();
  const changes = useDriveChangesQuery(selected, { skip: !selected });
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (action: 'up' | 'stop' | 'sync' | 'login') => {
    setError(null); setNotice(null);
    try {
      const r = (await act({ action }).unwrap()) as { message?: string; written?: number };
      setNotice(r?.message ?? (r?.written !== undefined ? t('op.drive.synced', { n: r.written }) : t('op.done')));
    } catch (err) { setError(errorMessage(err)); }
  };

  const groups = useMemo(() => {
    const g = new Map<string, { path: string; size: number; mtime: number }[]>();
    for (const f of drive.data?.files ?? []) {
      const top = f.path.includes('/') ? f.path.split('/')[0] : '(root)';
      if (!g.has(top)) g.set(top, []);
      g.get(top)!.push(f);
    }
    return [...g.entries()].sort(([a], [b]) => (a === '(root)' ? -1 : b === '(root)' ? 1 : a.localeCompare(b)));
  }, [drive.data]);

  const d = drive.data;
  const textVersions = useMemo(() => (changes.data?.changes ?? []).filter((c): c is DriveChange & { text: string } => typeof c.text === 'string'), [changes.data]);
  const [descBefore, descAfter] = t('op.drive.desc', { aindrive: '|' }).split('|');

  return (
    <PageWrapper $wide>
      <TitleRow>
        <Title>{t('op.drive.title')}</Title>
        {d && (
          <Row $gap={8}>
            <Button size="small" onClick={() => run('sync')} loading={actState.isLoading && actState.originalArgs?.action === 'sync'}>{t('op.drive.sync')}</Button>
            {d.running
              ? <Button size="small" color="secondary" onClick={() => run('stop')} loading={actState.isLoading && actState.originalArgs?.action === 'stop'}>{t('op.drive.stop')}</Button>
              : <Button size="small" variant="contained" disabled={!d.configured} onClick={() => run('up')} loading={actState.isLoading && actState.originalArgs?.action === 'up'}>{t('op.drive.start')}</Button>}
            {d.url && <ExternalLink href={d.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 500 }}>{t('op.drive.open')}</ExternalLink>}
          </Row>
        )}
      </TitleRow>
      <Description>
        {descBefore}<ExternalLink href="https://github.com/ainetwork-ai/aindrive" target="_blank" rel="noopener noreferrer">aindrive</ExternalLink>{descAfter}
      </Description>
      {error && <Alert $tone="error" style={{ marginTop: 16 }}>{error}</Alert>}
      {notice && <Alert $tone="success" style={{ marginTop: 16 }}>{notice}</Alert>}

      {drive.isLoading ? <CenterProgress /> : drive.isError ? (
        <Alert $tone="warning" style={{ marginTop: 16 }}>{t('op.drive.unavailable', { message: errorMessage(drive.error) })}</Alert>
      ) : d && (
        <>
          <KeyValue>
            <dt>{t('op.drive.agent')}</dt><dd><Status $ok={d.running}>{d.running ? t('op.drive.running', { pid: d.pid ?? '?' }) : t('op.drive.stopped')}</Status></dd>
            <dt>{t('op.drive.paired')}</dt><dd>{d.configured ? <>{t('op.drive.paired.yes', { id: '' })}<Mono>{d.drive_id}</Mono></> : t('op.drive.paired.no')}</dd>
            <dt>{t('op.drive.server')}</dt><dd><Mono>{d.server ?? '—'}</Mono></dd>
            <dt>{t('op.drive.folder')}</dt><dd><Mono>{d.folder}</Mono></dd>
            <dt>{t('op.drive.files')}</dt><dd>{d.files.length}</dd>
          </KeyValue>
          {!d.configured && (
            <div style={{ marginTop: 16, maxWidth: 760 }}>
              <strong style={{ fontSize: 14 }}>{t('op.drive.pair.title')}</strong>
              <Description style={{ marginTop: 6 }}>{t('op.drive.pair.desc')}</Description>
              <DevBox style={{ marginTop: 12 }}>
                <Muted style={{ display: 'block', marginBottom: 6 }}>{t('op.drive.dev.pair')}</Muted>
                <Row $gap={12} $align="flex-start">
                  <MonoBox style={{ flex: 1 }}>{d.login_hint}</MonoBox>
                  <CopyButton text={d.login_hint} label={t('common.copy')} />
                </Row>
                <Muted style={{ display: 'block', marginTop: 8 }}>{t('op.drive.pair.note')}</Muted>
              </DevBox>
            </div>
          )}

          <SubTitle $mt={40}>{t('op.drive.contents')}</SubTitle>
          <Split>
            <Tree>
              {groups.map(([folder, files]) => (
                <div key={folder}>
                  <Folder>{folder === '(root)' ? t('op.drive.root') : folder}</Folder>
                  {files.map((f) => {
                    const isText = TEXT_EXT.test(f.path);
                    return (
                      <FileRow key={f.path} $active={f.path === selected} $text={isText} disabled={!isText} title={f.path}
                        onClick={() => isText && navigate(`/drive/${f.path.split('/').map(encodeURIComponent).join('/')}`)}>
                        <span>{f.path.includes('/') ? f.path.slice(folder.length + 1) : f.path}</span>
                        <span>{bytes(f.size)}</span>
                        <span title={dateTime(f.mtime)}>{elapsed(f.mtime)}</span>
                      </FileRow>
                    );
                  })}
                </div>
              ))}
              {groups.length === 0 && <div style={{ padding: 24, color: '#8d8d8f', fontSize: 14 }}>{t('op.drive.empty')}</div>}
            </Tree>

            <Detail>
              {!selected && <Muted>{t('op.drive.pick')}</Muted>}
              {selected && changes.isLoading && <CenterProgress />}
              {selected && changes.data && (
                <>
                  <Row $gap={12} $justify="space-between">
                    <strong style={{ fontSize: 14, wordBreak: 'break-all' }}><Mono>{changes.data.path}</Mono></strong>
                    {changes.data.current !== null && <CopyButton text={changes.data.current} label={t('op.drive.copy_content')} />}
                  </Row>
                  <Muted style={{ display: 'block', marginTop: 4 }}>{t('op.drive.docid')} {changes.data.doc_id ? <Mono>{changes.data.doc_id}</Mono> : t('op.drive.docid.none')} · {t('op.drive.versions', { n: changes.data.changes.length })}</Muted>
                  <Pre style={{ marginTop: 12 }}>{changes.data.current ?? t('op.drive.binary')}</Pre>

                  <SubTitle $mt={32}>{t('op.drive.history')}</SubTitle>
                  <Description>{t('op.drive.history.desc')}</Description>
                  <History>
                    {changes.data.changes.map((c, idx) => {
                      const prevText = textVersions.slice(0, textVersions.findIndex((v) => v.seq === c.seq)).slice(-1)[0]?.text ?? '';
                      const isOpen = open === c.seq;
                      return (
                        <Change key={c.seq} $open={isOpen}>
                          <ChangeHead onClick={() => setOpen(isOpen ? null : c.seq)} aria-expanded={isOpen}>
                            <span>#{c.seq}</span>
                            <Kind $snap={c.kind === 'snapshot'} title={c.kind}>{c.kind === 'snapshot' ? t('op.drive.kind.snapshot') : t('op.drive.kind.update')}</Kind>
                            <span title={c.digest}>{t('op.drive.digest', { d: shortHash(c.digest, 14) })}</span>
                            <span>{bytes(c.bytes)}</span>
                            <span title={dateTime(c.created_at)}>{elapsed(c.created_at)}</span>
                          </ChangeHead>
                          {isOpen && (typeof c.text === 'string'
                            ? <Diff prev={idx === 0 ? '' : prevText} next={c.text} />
                            : <DiffPre><span className="ctx">{t('op.drive.undecodable', { size: bytes(c.bytes) })}</span></DiffPre>)}
                        </Change>
                      );
                    })}
                    {changes.data.changes.length === 0 && <li><Muted>{t('op.drive.history.empty')}</Muted></li>}
                  </History>
                </>
              )}
              {selected && changes.isError && <Alert $tone="error">{errorMessage(changes.error)}</Alert>}
            </Detail>
          </Split>

          <DevBox><Muted>{t('op.drive.dev.note')}</Muted></DevBox>
        </>
      )}
    </PageWrapper>
  );
}

import { useState } from 'react';
import styled from 'styled-components';
import { usePatchDatasetQuery } from '@/api/api';
import type { PatchDetail } from '@/api/types';
import { useT } from '@/i18n';
import { Mono, StyledLink } from '@/components/ui/Misc';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableWrapper } from '@/components/ui/Table';
import { num } from '@/utils/format';

/**
 * SC-10 — the training set block. It answers the question a creator actually has in front of someone else's
 * knowledge: can I start from these questions? The line states the count, who may read them and under which licence;
 * `private` says so and names the only thing that IS public (the verification questions on the record).
 *
 * The preview is fetched only when asked for, and the refusals are printed as they come back — "no node here holds
 * the bytes" is a different fact from "the creator keeps them private", and a creator needs to tell them apart.
 */
const Row = styled.div`display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; font-size: 14px; color: ${(p) => p.theme.color.DARK_GREY};`;
const Note = styled.p`margin: 8px 0 0; font-size: 12px; line-height: 1.6; color: ${(p) => p.theme.color.GREY};`;
const Buttons = styled.div`
  display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px;
  a, button { font: inherit; font-size: 13px; font-weight: 600; padding: 7px 14px; border-radius: 4px; cursor: pointer; text-decoration: none;
    border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fff; color: ${(p) => p.theme.color.BLACK}; }
  a:hover, button:hover:not(:disabled) { border-color: ${(p) => p.theme.color.PRIMARY}; color: ${(p) => p.theme.color.PRIMARY}; }
  button:disabled { opacity: 0.5; cursor: default; }
`;

export function TrainingSetBlock({ d, canBuildOn }: { d: PatchDetail; canBuildOn: boolean }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const a = d.anchor;
  const access = a.dataset?.access ?? 'private';
  const { data: ds, error } = usePatchDatasetQuery(a.id, { skip: !open || access === 'private' });
  if (!a.dataset) return null;
  const accessText = t(access === 'public' ? 'detail.ds.access_public' : access === 'derivative' ? 'detail.ds.access_derivative' : 'detail.ds.access_private');
  const refused = (error as { data?: { error?: string } } | undefined)?.data?.error ?? '';
  return (
    <div data-testid="training-set">
      <Row>
        <span>{t('detail.ds.line', { n: num(a.dataset.rows), access: accessText, license: a.dataset.license ?? '—' })}</span>
      </Row>
      {access === 'private' && <Note data-testid="ds-private">{t('detail.ds.private_note', { n: num(a.benchmark.samples?.length ?? 0) })}</Note>}
      {!d.dataset_held && access !== 'private' && <Note data-testid="ds-unavailable">{t('detail.ds.unavailable')}</Note>}
      <Buttons>
        <button type="button" onClick={() => setOpen((x) => !x)} disabled={access === 'private'} data-testid="ds-preview">{t('detail.ds.btn_preview')}</button>
        <a href={canBuildOn && access !== 'private' ? `/teach/upload?on=${encodeURIComponent(a.id)}&copy=1` : undefined}
          aria-disabled={!canBuildOn || access === 'private'} data-testid="ds-copy"
          style={!canBuildOn || access === 'private' ? { pointerEvents: 'none', opacity: 0.5 } : undefined}>{t('detail.ds.btn_copy')}</a>
        {access === 'public' && d.dataset_held && (
          <a href={`/api/patches/${encodeURIComponent(a.id)}/dataset/rows`} data-testid="ds-download">{t('detail.ds.btn_download')}</a>
        )}
      </Buttons>
      {open && refused.startsWith('dataset_derivative_only') && <Note data-testid="ds-derivative-only">{t('detail.ds.derivative_only')}</Note>}
      {open && refused.startsWith('dataset_unavailable') && <Note>{t('detail.ds.unavailable')}</Note>}
      {open && !!ds?.preview?.length && (
        <TableWrapper style={{ marginTop: 12 }}>
          <Table>
            <TableHeader><TableRow><TableHead $align="left">{t('detail.ds.h_question')}</TableHead><TableHead $align="left">{t('detail.ds.h_answer')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {ds.preview.map((r, i) => (
                <TableRow key={i}><TableData $align="left">{r.prompt}</TableData><TableData $align="left"><Mono>{r.answer}</Mono></TableData></TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}
      {!!ds?.parents?.length && (
        <Note>{ds.parents.map((p) => <StyledLink key={p.patch_id} to={`/${encodeURIComponent(d.anchor.author)}/${encodeURIComponent(p.patch_id)}`}>{p.patch_id}</StyledLink>)}</Note>
      )}
    </div>
  );
}

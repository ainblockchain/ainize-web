import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import styled from 'styled-components';
import { useCatalogQuery, useDeleteTeachDatasetMutation, useMyTeachJobsQuery, usePatchTeachDatasetMutation, useTeachDatasetsQuery, useTeachPolicyQuery } from '@/api/api';
import type { TeachJob } from '@/api/types';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { Description, PageWrapper, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { mapTeachError, mineStatusKey } from '@/components/chat/teachUtil';
import { DatasetCard } from '@/components/teach/DatasetCard';
import { signedDownload } from '@/lib/teachDataset';
import { currentTeacherKey } from '@/lib/teacherKey';

/**
 * `/teach/mine` — my datasets and lessons (design §5.8), organised dataset-first: the dataset is the durable object
 * and a lesson is one attempt at it. Lessons a v1 chat basket produced (no dataset of their own) keep their own list
 * at the bottom rather than being hidden — G5: no v1 lesson may disappear from the visitor's view.
 */
const List = styled.div`display: flex; flex-direction: column; gap: 14px; margin-top: 20px;`;
const Legacy = styled.ul`
  margin: 8px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px;
  li { display: flex; flex-wrap: wrap; gap: 10px; align-items: baseline; font-size: 13px; padding: 8px 0; border-top: 1px solid #f0f0f0; }
  b { font-weight: 600; color: ${(p) => p.theme.color.BLACK}; }
  span { font-size: 12px; color: ${(p) => p.theme.color.GREY}; }
  a { margin-left: auto; }
`;
const Head = styled.div`display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; margin-top: 8px;`;

export default function TeachMinePage() {
  const { t } = useT();
  useTitle(t('teach.data.title'));
  const navigate = useNavigate();
  const hasKey = !!currentTeacherKey();
  const { data: policy } = useTeachPolicyQuery();
  const { data: dsData, isFetching } = useTeachDatasetsQuery(undefined, { skip: !hasKey });
  const { data: jobData } = useMyTeachJobsQuery(undefined, { skip: !hasKey });
  const [remove, { isLoading: deleting }] = useDeleteTeachDatasetMutation();
  const [patchDataset, { isLoading: patching }] = usePatchTeachDatasetMutation();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const datasets = dsData?.items ?? [];
  // SC-16 names the knowledge a set was copied from; the catalog is only fetched when one of them has a parent
  const { data: catalog } = useCatalogQuery({ limit: 200 }, { skip: !datasets.some((d) => d.parent_patch) });
  const jobs = useMemo(() => jobData?.items ?? [], [jobData]);
  const byDataset = useMemo(() => {
    const map = new Map<string, TeachJob[]>();
    for (const j of jobs) {
      const id = j.dataset?.id;
      if (!id) continue;
      const list = map.get(id) ?? [];
      list.push(j);
      map.set(id, list);
    }
    return map;
  }, [jobs]);
  const legacy = jobs.filter((j) => !j.dataset?.id);

  /** Finding 45 — the retention choice, changed after the upload that fixed it. */
  const setRetention = (id: string, retention: 'keep' | 'delete_after_training') => {
    setError(null); setNote(null);
    void (async () => {
      try { await patchDataset({ id, retention }).unwrap(); setNote(t(retention === 'delete_after_training' ? 'teach.data.retention_now_delete' : 'teach.data.retention_now_keep')); }
      catch (e) { setError(mapTeachError(e, t)); }
    })();
  };

  const drop = (id: string, name: string) => {
    if (!window.confirm(t('teach.data.delete_confirm', { name }))) return;
    setError(null);
    void (async () => {
      try { await remove(id).unwrap(); setNote(t('teach.data.deleted')); } catch (e) { setError(mapTeachError(e, t)); }
    })();
  };

  return (
    <PageWrapper $wide data-testid="teach-mine">
      <TitleRow><Title>{t('teach.data.title')}</Title></TitleRow>
      <Description>{t('teach.data.sub')}</Description>
      <Head>
        <span>{policy?.limits?.dataset_ttl_days ? t('teach.data.expires', { days: policy.limits.dataset_ttl_days }) : ''}</span>
        <Button variant="contained" onClick={() => navigate('/teach/upload')} data-testid="mine-upload">{t('teach.data.upload_cta')}</Button>
      </Head>

      {error && <Alert $tone="error" role="alert" style={{ marginTop: 12 }}>{error}</Alert>}
      {note && <Alert $tone="success" role="status" style={{ marginTop: 12 }}>{note}</Alert>}

      {!hasKey || (!isFetching && datasets.length === 0 && legacy.length === 0) ? (
        <Alert $tone="info" style={{ marginTop: 16 }} data-testid="mine-empty">{t('teach.data.empty')}</Alert>
      ) : (
        <List>
          {datasets.map((d) => (
            <DatasetCard
              key={d.id} dataset={d} lessons={byDataset.get(d.id) ?? []} ttlDays={policy?.limits?.dataset_ttl_days} busy={deleting || patching}
              onRetention={(r) => setRetention(d.id, r)}
              baseName={catalog?.items.find((e) => e.anchor.id === d.parent_patch)?.anchor.name}
              onRetrain={() => navigate(`/teach/dataset/${d.id}/settings`)}
              onContinue={() => navigate(`/teach/dataset/${d.id}`)}
              onDownload={() => void signedDownload(`/api/teach/datasets/${d.id}/download`, `${d.name}.jsonl`).catch((e: Error) => setError(e.message))}
              onDelete={() => drop(d.id, d.name)}
            />
          ))}
          {!!legacy.length && (
            <section data-testid="legacy-lessons">
              <h2 style={{ fontSize: 15, margin: '8px 0 0' }}>{t('teach.data.other_lessons')}</h2>
              <Legacy>
                {legacy.map((j) => (
                  <li key={j.id}>
                    <b>{(j.name ?? '').replace(/^Lesson:\s*/, '') || j.id.slice(0, 8)}</b>
                    <span>{t(mineStatusKey(j))}</span>
                    <span>{t('teach.data.count', { n: j.facts.length })}</span>
                    <StyledLink to={`/teach/lesson/${j.id}`}>{t('teach.data.open')}</StyledLink>
                  </li>
                ))}
              </Legacy>
            </section>
          )}
        </List>
      )}
    </PageWrapper>
  );
}

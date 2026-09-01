import styled from 'styled-components';
import { Link } from 'react-router';
import type { TeachDataset, TeachJob } from '@/api/types';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { useDateTime } from '@/utils/useFormat';
import { mineStatusKey } from '@/components/chat/teachUtil';
import { shortSha } from '@/lib/teachDataset';
import { sourceKind } from './util';

/**
 * One dataset and the lessons trained from it (design §5.8). Dataset-first, because the dataset is the durable object
 * and a lesson is one attempt at it — that is what makes "train it again" and "add questions" honest offers.
 */
const Card = styled.article`
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 8px; background: #fff; padding: 14px 16px;
  display: flex; flex-direction: column; gap: 10px; min-width: 0;
`;
const Head = styled.div`
  display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
  h3 { margin: 0; font-size: 15px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; word-break: break-word; }
  span { font-size: 12px; color: ${(p) => p.theme.color.GREY}; }
`;
const Meta = styled.dl`
  display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 6px 16px; margin: 0; font-size: 12px;
  dt { color: ${(p) => p.theme.color.GREY}; }
  dd { margin: 0 0 4px; color: ${(p) => p.theme.color.DARK_GREY}; word-break: break-all; }
`;
const Lessons = styled.ul`
  margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px;
  li { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; font-size: 13px; padding: 6px 0; border-top: 1px solid #f0f0f0; }
  b { font-weight: 600; color: ${(p) => p.theme.color.BLACK}; word-break: break-word; }
  span.st { font-size: 11px; font-weight: 700; color: ${(p) => p.theme.color.PRIMARY}; }
  span.hit { font-size: 12px; color: ${(p) => p.theme.color.GREY}; }
  a { margin-left: auto; color: ${(p) => p.theme.color.PRIMARY}; font-size: 12px; }
`;
const Actions = styled.div`display: flex; flex-wrap: wrap; gap: 8px;`;
const Gone = styled.p`margin: 0; font-size: 12px; color: ${(p) => p.theme.color.GREY};`;

export interface DatasetCardProps {
  dataset: TeachDataset;
  lessons: TeachJob[];
  ttlDays?: number;
  onRetrain: () => void;
  onContinue: () => void;
  onDownload: () => void;
  onDelete: () => void;
  busy?: boolean;
}

export function DatasetCard({ dataset, lessons, ttlDays, onRetrain, onContinue, onDownload, onDelete, busy }: DatasetCardProps) {
  const { t } = useT();
  const dateTime = useDateTime();
  const deleted = !!dataset.deleted_at;
  // `delete_after_training` really removed the questions: the row survives (name, fingerprint, lessons) but every
  // action that needs the file would now answer 404, so the card says so instead of offering them (design §11).
  const fileGone = !deleted && dataset.size_bytes === 0 && dataset.rows > 0;
  return (
    <Card data-testid="dataset-card" data-id={dataset.id}>
      <Head>
        <h3>{dataset.name}</h3>
        <span>{t('teach.data.count', { n: dataset.rows })}</span>
        <span>{t('teach.data.fingerprint', { short: shortSha(dataset.sha256) })}</span>
      </Head>
      <Meta>
        <div><dt>{t('teach.data.h.source')}</dt><dd data-testid="ds-source">{sourceKind(dataset.source, t)}</dd></div>
        <div><dt>{t('teach.data.h.created')}</dt><dd>{dateTime(dataset.created_at)}</dd></div>
        <div>
          <dt>{t('teach.data.h.retention')}</dt>
          <dd>{dataset.retention === 'delete_after_training' ? t('teach.data.retention_delete') : dataset.expires_at ? t('teach.data.retention', { date: dateTime(dataset.expires_at) }) : ttlDays ? t('teach.data.expires', { days: ttlDays }) : '—'}</dd>
        </div>
      </Meta>
      {deleted ? <Gone data-testid="dataset-gone">{t('teach.data.gone')}</Gone> : fileGone ? (
        <>
          <Gone data-testid="dataset-file-gone">{t('teach.data.file_gone')}</Gone>
          <Actions>
            <Button size="small" color="secondary" onClick={onDelete} disabled={busy} data-testid="ds-delete">{t('teach.data.delete')}</Button>
          </Actions>
        </>
      ) : (
        <Actions>
          <Button size="small" onClick={onRetrain} disabled={busy} data-testid="ds-retrain">{t('teach.data.retrain')}</Button>
          <Button size="small" onClick={onContinue} disabled={busy} data-testid="ds-continue">{t('teach.data.continue')}</Button>
          <Button size="small" onClick={onDownload} disabled={busy} data-testid="ds-download">{t('teach.data.download')}</Button>
          <Button size="small" color="secondary" onClick={onDelete} disabled={busy} data-testid="ds-delete">{t('teach.data.delete')}</Button>
        </Actions>
      )}
      {lessons.length === 0 ? <Gone>{t('teach.data.no_lessons')}</Gone> : (
        <>
          <Head><span>{t('teach.data.lessons', { n: lessons.length })}</span></Head>
          <Lessons>
            {lessons.map((j) => (
              <li key={j.id} data-testid="dataset-lesson">
                <b>{(j.name ?? '').replace(/^Lesson:\s*/, '') || j.id.slice(0, 8)}</b>
                <span className="st">{t(mineStatusKey(j))}</span>
                {/* questions learned, from the index-aligned facts — `checks.taught` counts probes, not questions */}
                {j.facts.some((f) => f.hit !== undefined) && (
                  <span className="hit">{t('teach.data.learned', { hits: j.facts.filter((f) => f.hit === true).length, total: j.facts.length })}</span>
                )}
                <Link to={`/teach/lesson/${j.id}`}>{t('teach.data.open')}</Link>
              </li>
            ))}
          </Lessons>
        </>
      )}
    </Card>
  );
}

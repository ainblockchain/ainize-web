import { useState } from 'react';
import styled from 'styled-components';
import { useMyTeachJobsQuery, useTeacherQuery } from '@/api/api';
import type { CatalogEntry, TeachJob } from '@/api/types';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { Mono, StyledLink } from '@/components/ui/Misc';
import { forgetTeacherKey, shortKey, teacherKeyBackup, teacherKeyBackupName, type TeacherKey } from '@/lib/teacherKey';
import { useElapsed } from '@/utils/useFormat';
import { KeyImport } from './CreditSheet';
import { Sheet, SheetNote } from './Sheet';
import { downloadText, mapTeachError, mineStatusKey } from './teachUtil';

const Identity = styled.div`
  display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; padding: 10px 12px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; background: #fafafa; font-size: 13px;
  .who { font-weight: 600; color: ${(p) => p.theme.color.BLACK}; }
  .actions { margin-left: auto; display: flex; gap: 6px; flex-wrap: wrap; }
`;
const List = styled.ul`margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px;`;
const Row = styled.li`
  display: grid; grid-template-columns: 1fr auto auto; gap: 8px 12px; align-items: center; padding: 10px 12px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; background: #fff; font-size: 13px;
  .n { font-weight: 600; color: ${(p) => p.theme.color.BLACK}; word-break: break-word; }
  .m { grid-column: 1; font-size: 11px; color: ${(p) => p.theme.color.GREY}; }
  @media (max-width: 600px) { grid-template-columns: 1fr auto; }
`;
const Status = styled.span<{ $kind: string }>`
  justify-self: end; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; white-space: nowrap;
  color: ${(p) => (/on_sale|ready/.test(p.$kind) ? '#1e6b36' : /review|verifying|needs_more/.test(p.$kind) ? '#8a4b00' : /declined|failed/.test(p.$kind) ? '#a0102c' : /expired|cancelled/.test(p.$kind) ? '#555' : '#5b1ca8')};
  background: ${(p) => (/on_sale|ready/.test(p.$kind) ? '#e6f4ea' : /review|verifying|needs_more/.test(p.$kind) ? '#fff3e0' : /declined|failed/.test(p.$kind) ? '#fde8ec' : /expired|cancelled/.test(p.$kind) ? '#f2f2f2' : '#f5eefc')};
`;
const Earn = styled.div`padding: 12px 14px; border-radius: 4px; background: ${(p) => p.theme.color.PALE_GREY}; font-size: 13px; b { color: ${(p) => p.theme.color.BLACK}; }`;
const H = styled.h3`margin: 4px 0 0; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: ${(p) => p.theme.color.DARK_GREY};`;

export interface MyKnowledgePanelProps {
  teacherKey: TeacherKey | null;
  /** the visitor's lessons as catalog entries (GET /api/chat/patches.lessons) — tells "Being verified" from "On sale" */
  lessonEntries: CatalogEntry[];
  onOpenLesson: (job: TeachJob) => void;
  onKeyChanged: () => void;
  onClose: () => void;
}

/** §5.11 — lessons with state, earnings, key backup / restore / forget (/chat?mine=1). */
export function MyKnowledgePanel({ teacherKey, lessonEntries, onOpenLesson, onKeyChanged, onClose }: MyKnowledgePanelProps) {
  const { t } = useT();
  const elapsed = useElapsed();
  const [restoring, setRestoring] = useState(false);
  const { data, error, isLoading } = useMyTeachJobsQuery(undefined, { skip: !teacherKey, pollingInterval: 10_000 });
  const { data: profile } = useTeacherQuery(teacherKey?.address ?? '', { skip: !teacherKey, pollingInterval: 30_000 });
  const items = data?.items ?? [];
  const entryOf = (j: TeachJob) => lessonEntries.find((e) => e.anchor.id === (j.patch_id ?? j.draft_id));
  const forget = () => { if (!window.confirm(t('teach.mine.forget_confirm'))) return; forgetTeacherKey(); onKeyChanged(); };

  return (
    <Sheet title={t('teach.mine.title')} onClose={onClose} width={680} testId="mine-panel">
      {!teacherKey && <Alert $tone="info">{t('teach.mine.no_key')}</Alert>}
      {teacherKey && (
        <Identity>
          <span className="who">{teacherKey.name ?? t('teach.key.anon')}</span>
          <Mono title={teacherKey.address}>{t('teach.mine.identity', { short: shortKey(teacherKey.address) })}</Mono>
          <span className="actions">
            <Button size="small" onClick={() => downloadText(teacherKeyBackupName(teacherKey), teacherKeyBackup(teacherKey))}>{t('teach.mine.backup')}</Button>
            <Button size="small" onClick={() => setRestoring((v) => !v)}>{t('teach.mine.restore')}</Button>
            <Button size="small" color="secondary" onClick={forget} data-testid="forget-key">{t('teach.mine.forget')}</Button>
          </span>
        </Identity>
      )}
      {(restoring || !teacherKey) && <KeyImport onImported={() => { setRestoring(false); onKeyChanged(); }} />}
      {teacherKey && (
        <>
          <H>{t('teach.mine.lessons')}</H>
          {isLoading && <SheetNote>{t('common.loading')}</SheetNote>}
          {!!error && <Alert $tone="error" role="alert">{mapTeachError(error, t)}</Alert>}
          {data && items.length === 0 && <SheetNote>{t('teach.mine.empty')}</SheetNote>}
          {items.length > 0 && (
            <List data-testid="mine-list">
              {items.map((j) => {
                const key = mineStatusKey(j, entryOf(j));
                return (
                  <Row key={j.id} data-testid="mine-item" data-status={j.status}>
                    <span className="n">{(j.name ?? '').replace(/^Lesson:\s*/, '') || j.facts[0]?.prompt || j.id.slice(0, 8)}</span>
                    <Status $kind={key}>{t(key)}</Status>
                    <Button size="small" onClick={() => onOpenLesson(j)}>{t('teach.mine.open')}</Button>
                    <span className="m">{t('teach.mine.created', { ago: elapsed(j.created_at) })} · {t('teach.card.facts', { n: j.facts.length })}</span>
                  </Row>
                );
              })}
            </List>
          )}
          {profile && (
            <Earn data-testid="mine-earnings">
              <b>{t('teach.mine.earnings', { earned: `${profile.earnings.owed} ${profile.earnings.currency}`, paid: profile.earnings.paid, pending: profile.earnings.pending })}</b>
              <SheetNote style={{ marginTop: 4 }}>{t('teach.mine.pending_hint')}</SheetNote>
              <div style={{ marginTop: 6 }}><StyledLink to={`/teacher/${teacherKey.address}`}>{t('teach.mine.earnings_page')} →</StyledLink></div>
            </Earn>
          )}
        </>
      )}
    </Sheet>
  );
}

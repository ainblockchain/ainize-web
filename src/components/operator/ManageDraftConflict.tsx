import type { PatchAnchor } from '@/api/types';
import { useT } from '@/i18n';
import { draftConflicts, manageDraftValues, type DraftGroup, type DraftKey, type ManageDraftEditor } from '@/lib/manageDraft';
import { Alert } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Row } from './common';

export const draftFieldLabel: Record<DraftKey, string> = {
  description: 'op.manage.fields.desc', price: 'op.manage.draft.price_label', branch: 'op.manage.fields.branch', license: 'op.manage.fields.license', billing: 'op.manage.fields.billing', benchmark: 'op.manage.bench.title',
};
export function ManageDraftConflict({ editor, anchor, group, onResolve }: { editor: ManageDraftEditor; anchor: PatchAnchor; group: DraftGroup; onResolve: (keep: boolean) => void }) {
  const { t } = useT(), conflicts = draftConflicts(editor, anchor, group), latest = manageDraftValues(anchor);
  if (!conflicts.length) return null;
  return <Alert role="alert" $tone="warning" data-testid={`manage-draft-conflict-${group}`}>
    {t('op.manage.draft.conflict')}
    <dl style={{ margin: '10px 0', minWidth: 0 }}>
      {conflicts.map(key => <div key={key} style={{ marginBottom: 8 }}><dt>{t(draftFieldLabel[key])}</dt><dd style={{ margin: '4px 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 160, overflow: 'auto' }}>{latest[key] || t('op.manage.draft.empty_value')}</dd></div>)}
    </dl>
    <Row $gap={12} $wrap>
      <Button type="button" size="small" onClick={() => onResolve(false)}>{t('op.manage.draft.use_server')}</Button>
      <Button type="button" size="small" onClick={() => onResolve(true)}>{t('op.manage.draft.keep_edits')}</Button>
    </Row>
  </Alert>;
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { api, errorMessage, useApplyMutation, useRemoveMutation } from '@/api/api';
import type { PatchAnchor } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
import { createNodeActionTask } from '@/lib/accountNodeActions';
import { changeRuntimeKnowledge, LoadKnowledgeError, runtimeRefusal, runtimeBaseMismatch } from '@/lib/loadKnowledge';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Sheet, SheetFooter } from '@/components/chat/Sheet';

export interface LoadChain {
  load: (target: PatchAnchor) => Promise<void>;
  unload: (target: PatchAnchor) => Promise<void>;
  busy: boolean;
  busyId: string | null;
  notice: string | null;
  error: string | null;
  reset: () => void;
  dialog: ReactNode;
}
type Pending = { target: PatchAnchor; missing: string[] };
type View = { scope: string; busyId: string | null; notice: string | null; error: string | null; pending: Pending | null };

/** Confirm the selected artifact and its recorded runtime state; leaving does not cancel a server operation. */
export function useLoadChain(
  nameOf: (id: string) => string = id => id,
  opts: { onLoaded?: (order: string[]) => void; onUnloaded?: (id: string) => void } = {},
): LoadChain {
  const { t } = useT(), auth = useAuth(), location = useLocation(), active = useActiveView();
  const scope = JSON.stringify([auth.cacheIdentity, location.pathname, location.search]);
  const scopeRef = useRef(scope), allowed = useRef(false);
  scopeRef.current = scope; allowed.current = auth.isOwner && !auth.loading;
  const task = useMemo(createNodeActionTask, [scope]);
  useEffect(() => () => task.abandon(), [task]);
  const current = () => active() && scopeRef.current === scope && allowed.current && auth.isCurrentAccount();
  const [view, setView] = useState<View>({ scope, busyId: null, notice: null, error: null, pending: null });
  const shown = view.scope === scope ? view : { scope, busyId: null, notice: null, error: null, pending: null };
  const [apply] = useApplyMutation(), [remove] = useRemoveMutation();
  const [readPatch] = api.useLazyManagedPatchQuery(), [readRuntime] = api.useLazyRuntimeQuery(), [readAccess] = api.useLazyMeQuery();
  const names = (ids: string[]) => ids.map(nameOf).join(', ');
  const update = (values: Partial<View>) => { if (current()) setView(previous => ({ ...(previous.scope === scope ? previous : shown), ...values, scope })); };
  const reset = () => update({ notice: null, error: null, pending: null });

  const run = async (target: PatchAnchor, kind: 'load' | 'unload', withBase = false) => {
    if (!current() || task.pending()) return;
    update({ busyId: target.id, error: null, notice: null, pending: null });
    try {
      const result = await task.run(current, stillCurrent => changeRuntimeKnowledge(target, kind, withBase, {
        current: stillCurrent, node: auth.address, subject: auth.subject,
        readAccess: () => readAccess(undefined, false).unwrap(),
        read: () => readPatch({ id: target.id, identity: auth.cacheIdentity }, false).unwrap(),
        runtime: () => readRuntime({ identity: auth.cacheIdentity }, false).unwrap(),
        write: () => kind === 'load' ? apply({ id: target.id, with_base: withBase }).unwrap() : remove(target.id).unwrap(),
      }));
      if (!result || !current()) return;
      if (kind === 'unload') {
        update({ notice: t('detail.apply.removed_record', { id: nameOf(target.id) }) });
        opts.onUnloaded?.(target.id);
      } else if (result.alias) {
        update({ notice: t('detail.apply.alias', { id: nameOf(target.id), alias: nameOf(result.alias) }) });
      } else {
        update({ notice: result.already ? t('detail.apply.already_recorded', { id: nameOf(target.id) })
          : result.order.length > 1 ? t('detail.apply.order', { parent: names(result.order.slice(0, -1)), child: nameOf(target.id) })
          : t('detail.apply.loaded_record', { id: nameOf(target.id) }) });
        if (!result.already) opts.onLoaded?.(result.order);
      }
    } catch (error) {
      if (!current()) return;
      const missing = kind === 'load' ? runtimeRefusal(error, 'needs_base') : null;
      if (missing && !missing.includes(target.id)) { update({ pending: { target, missing } }); return; }
      const dependents = kind === 'unload' ? runtimeRefusal(error, 'has_dependents') : null;
      if (dependents) { update({ error: t('detail.apply.has_dependents', { children: names(dependents), parent: nameOf(target.id) }) }); return; }
      if (runtimeBaseMismatch(error)) { update({ error: t('detail.apply.error.mismatch') }); return; }
      update({ error: error instanceof LoadKnowledgeError ? t(`detail.apply.error.${error.code}`) : errorMessage(error) });
    } finally { update({ busyId: null }); }
  };
  const pending = shown.pending;
  const dialog = pending ? <Sheet
    title={t('detail.apply.needs_base', { child: nameOf(pending.target.id), parent: names(pending.missing) })}
    onClose={() => update({ pending: null })} width={480} testId="apply-needs-base">
    <SheetFooter>
      <Button variant="outlined" onClick={() => update({ pending: null })}>{t('common.cancel')}</Button>
      <Button variant="contained" disabled={shown.busyId !== null} loading={shown.busyId !== null} data-testid="apply-load-both"
        onClick={() => void run(pending.target, 'load', true)}>{t('detail.apply.load_both')}</Button>
    </SheetFooter>
  </Sheet> : null;
  return { load: target => run(target, 'load'), unload: target => run(target, 'unload'), busy: shown.busyId !== null,
    busyId: shown.busyId, notice: shown.notice, error: shown.error, reset, dialog };
}

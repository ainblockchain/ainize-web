import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation } from 'react-router';
import { api, errorMessage } from '@/api/api';
import type { PatchAnchor, StackLayer } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
import { accountRuntime, createNodeActionTask } from '@/lib/accountNodeActions';
import { changeRuntimeKnowledge, confirmRuntimeKnowledge, requireRuntimeOperator, reviewRuntimeKnowledge, LoadKnowledgeError, runtimeRefusal, runtimeBaseMismatch, runtimeGuardFailure, type RuntimeTarget } from '@/lib/loadKnowledge';
import type { RuntimeApplyReview as ApplyReview } from '@/lib/runtimeApplyReview';
import { claimRuntimeOperation, clearRuntimeOperation, followRuntimeOperation, parseRuntimeJob, prepareRuntimeOperation, readRuntimeOperation,
  runtimeOperationKey, runtimeOperationRequest, saveRuntimeJob, RuntimeOperationError, type RuntimeOperation, type RuntimePhase } from '@/lib/runtimeOperation';
import { useT } from '@/i18n';
import { RuntimeApplyReview } from './RuntimeApplyReview';
import { RuntimeOperationStatus } from './RuntimeOperationStatus';

export interface LoadChain {
  load: (target: PatchAnchor) => Promise<void>; unload: (target: PatchAnchor) => Promise<void>;
  busy: boolean; busyId: string | null; notice: string | null; error: string | null;
  reset: () => void; dialog: ReactNode;
}
type Pending = { target: RuntimeTarget; review: ApplyReview };
type View = { scope: string; busyId: string | null; notice: string | null; error: string | null; pending: Pending | null;
  operation: RuntimeOperation | null; phase: RuntimePhase | null; review: StackLayer[] | null };
const blank = (scope: string): View => ({ scope, busyId: null, notice: null, error: null, pending: null, operation: null, phase: null, review: null });
const storage = () => { try { return window.localStorage; } catch { throw new RuntimeOperationError('storage'); } };

/** Persist before sending. Leaving stops this observer, never the server operation. */
export function useLoadChain(nameOf: (id: string) => string = id => id,
  opts: { onLoaded?: (order: string[]) => void; onUnloaded?: (id: string) => void } = {}): LoadChain {
  const { t } = useT(), auth = useAuth(), location = useLocation(), active = useActiveView(), dispatch = useDispatch();
  const scope = JSON.stringify([auth.cacheIdentity, auth.address, location.pathname, location.search]);
  const owner = runtimeOperationKey(auth.cacheIdentity, auth.address);
  const scopeRef = useRef(scope), allowed = useRef(false);
  scopeRef.current = scope; allowed.current = auth.isOwner && !auth.loading;
  const task = useMemo(createNodeActionTask, [scope]);
  useEffect(() => () => task.abandon(), [task]);
  const current = () => active() && scopeRef.current === scope && allowed.current && auth.isCurrentAccount();
  const [view, setView] = useState<View>(() => blank(scope));
  const shown = view.scope === scope ? view : blank(scope);
  const [startJob] = api.useStartRuntimeOperationMutation();
  const [capabilities] = api.useLazyRuntimeOperationCapabilitiesQuery(), [readJob] = api.useLazyRuntimeOperationQuery();
  const [readPreview] = api.useLazyRuntimeApplyPreviewQuery();
  const [readPatch] = api.useLazyManagedPatchQuery(), [readRuntime] = api.useLazyRuntimeQuery(), [readAccess] = api.useLazyMeQuery();
  const names = (ids: string[]) => ids.map(nameOf).join(', ');
  const update = (values: Partial<View>) => { if (current()) setView(previous => ({ ...(previous.scope === scope ? previous : blank(scope)), ...values, scope })); };
  const reset = () => update({ notice: null, error: null, pending: null });
  const reads = (target: RuntimeTarget, stillCurrent: () => boolean) => ({ current: stillCurrent, node: auth.address, subject: auth.subject,
    readAccess: () => readAccess(undefined, false).unwrap(),
    read: () => readPatch({ id: target.id, identity: auth.cacheIdentity }, false).unwrap(),
    runtime: () => readRuntime({ identity: auth.cacheIdentity }, false).unwrap(),
  });
  const invalidate = () => dispatch(api.util.invalidateTags(['Patch', 'Runtime', 'Events', 'Me']));
  const clear = (op: RuntimeOperation) => {
    clearRuntimeOperation(storage(), op);
    const remaining = readRuntimeOperation(storage(), owner);
    update({ operation: remaining, phase: remaining ? 'interrupted' : null, review: null });
  };
  const message = (error: unknown) => error instanceof RuntimeOperationError ? t(`detail.operation.error.${error.code}`)
    : error instanceof LoadKnowledgeError ? t(`detail.apply.error.${error.code}`) : errorMessage(error);
  const follow = (op: RuntimeOperation, stillCurrent: () => boolean, submit = false) => followRuntimeOperation(op, {
    current: stillCurrent, submit: submit ? () => startJob(runtimeOperationRequest(op)).unwrap() : undefined,
    read: () => readJob({ identity: auth.cacheIdentity, id: op.request.request_id }, false).unwrap(),
    save: job => { const next = saveRuntimeJob(storage(), op, job); update({ operation: next }); },
    phase: phase => update({ phase }), wait: () => new Promise(resolve => setTimeout(resolve, 1500)),
  });
  const notify = (target: RuntimeTarget, kind: 'load' | 'unload', result: NonNullable<Awaited<ReturnType<typeof changeRuntimeKnowledge>>>) => {
    invalidate();
    if (kind === 'unload') { update({ notice: t('detail.apply.removed_record', { id: nameOf(target.id) }) }); opts.onUnloaded?.(target.id); }
    else if (result.alias) update({ notice: t('detail.apply.alias', { id: nameOf(target.id), alias: nameOf(result.alias) }) });
    else {
      update({ notice: result.already ? t('detail.apply.already_recorded', { id: nameOf(target.id) })
        : 'reviewed' in result && result.reviewed ? t('detail.apply.review.confirmed')
        : result.order.length > 1 ? t('detail.apply.order', { parent: names(result.order.slice(0, -1)), child: nameOf(target.id) })
        : t('detail.apply.loaded_record', { id: nameOf(target.id) }) });
      if (!result.already) opts.onLoaded?.(result.order);
    }
  };
  const failed = (error: unknown, target: RuntimeTarget, kind: 'load' | 'unload') => {
    if (!current()) return;
    try {
      const op = readRuntimeOperation(storage(), owner);
      if (op?.job?.state === 'failed') { clear(op); invalidate(); }
      else if (op) { update({ operation: op, phase: 'interrupted', error: message(error) }); return; }
    } catch (e) { update({ error: message(e) }); return; }
    const missing = kind === 'load' ? runtimeRefusal(error, 'needs_base') : null;
    if (missing) { update({ error: t('detail.apply.error.changed') }); return; }
    const dependents = kind === 'unload' ? runtimeRefusal(error, 'has_dependents') : null;
    const guard = runtimeGuardFailure(error);
    update({ error: dependents ? t('detail.apply.has_dependents', { children: names(dependents), parent: nameOf(target.id) })
      : runtimeBaseMismatch(error) ? t('detail.apply.error.mismatch') : guard ? t(`detail.apply.error.${guard}`) : message(error) });
  };
  const resume = async (op: RuntimeOperation) => {
    if (!current() || task.pending()) return;
    update({ operation: op, busyId: op.target.id, phase: 'checking', review: null, error: null, notice: null });
    let taskCurrent = current;
    try {
      const result = await task.run(current, async stillCurrent => {
        taskCurrent = stillCurrent;
        const deps = { ...reads(op.target, stillCurrent), review: op.review };
        if (!await requireRuntimeOperator(deps)) return null;
        const outcome = await follow(op, stillCurrent);
        if (!stillCurrent()) return null;
        return confirmRuntimeKnowledge(op.target, op.kind, op.withBase, op.before, outcome, deps);
      });
      if (!result || !taskCurrent()) return;
      clear(op); notify(op.target, op.kind, result);
    } catch (error) { if (taskCurrent()) failed(error, op.target, op.kind); }
    finally { if (taskCurrent()) update({ busyId: null }); }
  };
  useEffect(() => {
    if (!current()) return;
    const recover = () => {
      if (!current() || task.pending()) return;
      try {
        const op = readRuntimeOperation(storage(), owner);
        if (op) void resume(op); else update({ operation: null, phase: null, review: null });
      } catch (e) { update({ error: message(e) }); }
    };
    recover();
    const changed = (event: StorageEvent) => { if (event.key === owner) recover(); };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
    // Route/account changes start a new observer; renders must not restart a poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, auth.isOwner, auth.loading]);

  const run = async (target: RuntimeTarget, kind: 'load' | 'unload', withBase = false, review?: ApplyReview) => {
    if (!current() || task.pending()) return;
    update({ busyId: target.id, error: null, notice: null, pending: null, review: null });
    let sent: RuntimeOperation | null = null;
    let taskCurrent = current;
    try {
      const saved = readRuntimeOperation(storage(), owner);
      if (saved) { update({ busyId: null }); await resume(saved); return; }
      const result = await task.run(current, stillCurrent => {
        taskCurrent = stillCurrent;
        return changeRuntimeKnowledge(target, kind, withBase, {
          ...reads(target, stillCurrent), review, write: async before => {
            let cap: unknown;
            try { cap = await capabilities({ identity: auth.cacheIdentity }, false).unwrap(); }
            catch { throw new RuntimeOperationError('unsupported'); }
            if (!stillCurrent()) return null;
            const bytes = crypto.getRandomValues(new Uint8Array(16));
            const op = prepareRuntimeOperation(owner, target, kind, withBase, before, cap, [...bytes].map(b => b.toString(16).padStart(2, '0')).join(''), review);
            if (!navigator.locks) throw new RuntimeOperationError('storage');
            await navigator.locks.request(owner, () => {
              if (!stillCurrent()) return;
              claimRuntimeOperation(storage(), op); sent = op; update({ operation: op, phase: 'submitting' });
            });
            if (!stillCurrent()) return null;
            return follow(op, stillCurrent, true);
          },
        });
      });
      if (!result || !taskCurrent()) return;
      if (sent) clear(sent);
      notify(target, kind, result);
    } catch (error) { if (taskCurrent()) failed(error, target, kind); }
    finally { if (taskCurrent()) update({ busyId: null }); }
  };

  const beginLoad = async (target: RuntimeTarget) => {
    if (!current() || task.pending()) return;
    update({ busyId: target.id, error: null, notice: null, pending: null });
    let taskCurrent = current;
    try {
      const saved = readRuntimeOperation(storage(), owner);
      if (saved) { update({ busyId: null }); await resume(saved); return; }
      const review = await task.run(current, stillCurrent => {
        taskCurrent = stillCurrent;
        return reviewRuntimeKnowledge(target, { ...reads(target, stillCurrent),
          preview: () => readPreview({ identity: auth.cacheIdentity, id: target.id }, false).unwrap() });
      });
      if (review && taskCurrent()) update({ pending: { target: structuredClone(target), review } });
    } catch (error) { if (taskCurrent()) failed(error, target, 'load'); }
    finally { if (taskCurrent()) update({ busyId: null }); }
  };

  const review = async (op: RuntimeOperation) => {
    if (!current() || task.pending()) return;
    update({ busyId: op.target.id, error: null, review: null });
    let taskCurrent = current;
    try {
      const rows = await task.run(current, async stillCurrent => {
        taskCurrent = stillCurrent;
        if (!await requireRuntimeOperator(reads(op.target, stillCurrent))) return null;
        try {
          const raw = await readJob({ identity: auth.cacheIdentity, id: op.request.request_id }, false).unwrap();
          if (!stillCurrent()) return null;
          const job = parseRuntimeJob(raw, op);
          if (!job) throw new RuntimeOperationError('receipt');
          saveRuntimeJob(storage(), op, job);
          if (job.state === 'queued' || job.state === 'running') throw new RuntimeOperationError('pending');
        } catch (e) { if (!(e && typeof e === 'object' && 'status' in e && e.status === 404)) throw e; }
        if (!stillCurrent()) return null;
        const runtime = accountRuntime(await readRuntime({ identity: auth.cacheIdentity }, false).unwrap());
        if (!runtime?.available || !runtime.stack) throw new LoadKnowledgeError('unavailable');
        return runtime.stack;
      });
      if (rows && taskCurrent()) update({ review: rows });
    } catch (e) { if (taskCurrent()) update({ error: message(e) }); }
    finally { if (taskCurrent()) update({ busyId: null }); }
  };
  const pending = shown.pending;
  const dialog = <>
    {shown.operation && <RuntimeOperationStatus operation={shown.operation} phase={shown.phase ?? 'interrupted'} checking={shown.busyId !== null} error={shown.error}
      review={shown.review} onRetry={() => void resume(shown.operation!)} onReview={() => void review(shown.operation!)}
      onCloseReview={() => update({ review: null })} onDismiss={() => {
        if (!current() || task.pending() || shown.review === null) return;
        try { clear(shown.operation!); update({ error: null, notice: t('detail.operation.closed') }); } catch (e) { update({ error: message(e) }); }
      }} />}
    {pending && <RuntimeApplyReview review={pending.review} busy={shown.busyId !== null}
      onClose={() => update({ pending: null })} onConfirm={() => void run(pending.target, 'load', pending.review.with_base, pending.review)} />}
  </>;
  return { load: target => beginLoad(target), unload: target => run(target, 'unload'), busy: shown.busyId !== null || !!shown.operation,
    busyId: shown.operation?.target.id ?? shown.busyId, notice: shown.notice, error: shown.operation ? null : shown.error, reset, dialog };
}

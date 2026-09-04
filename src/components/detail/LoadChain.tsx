import { useCallback, useState, type ReactNode } from 'react';
import { errorMessage, useApplyMutation, useRemoveMutation } from '@/api/api';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Sheet, SheetFooter } from '@/components/chat/Sheet';

/**
 * SC-15, the operator half — loading and unloading a knowledge that has other knowledge under it (design §8, §12.4).
 *
 * Every screen that loads a patch used to send a bare `POST /apply` and print whatever came back. On an add-on that
 * is `409 needs_base`, and the operator was shown a raw error code with no way to act on it: the flag that fixes it
 * exists only in the CLI. Here the refusal is turned back into the question the design asks — *{child} is built on
 * {parent}. Load {parent} first?* — with one button that does it.
 *
 * Three more answers come from the same endpoints and are all told apart, because they need different actions:
 *   · `needs_base`     the base is held but not loaded → offer to load both (this dialog)
 *   · `base_mismatch`  something else changed the rows the child was trained against → reload the base
 *   · `has_dependents` something is loaded ON TOP of what is being unloaded → unload that first
 * A success says the ORDER (`apply.order`), from the `order` the node returns — never re-derived here.
 */
export interface LoadChain {
  /** Load one knowledge; an add-on asks about its base instead of failing. */
  load: (id: string) => Promise<void>;
  /** Unload one knowledge; refuses (with the reason) while something sits on top of it. */
  unload: (id: string) => Promise<void>;
  busy: boolean;
  /** Which knowledge the in-flight load or unload is for — a table of rows needs the spinner on its own row. */
  busyId: string | null;
  /** "Loaded in order: a → b" after a load that put more than one layer on the table. */
  notice: string | null;
  error: string | null;
  reset: () => void;
  /** The *Load {parent} first?* dialog — render it once, wherever the buttons are. */
  dialog: ReactNode;
}

/** `nameOf` turns an id into what the operator calls it; without one the id is shown, which is never wrong. */
export function useLoadChain(nameOf: (id: string) => string = (id) => id): LoadChain {
  const { t } = useT();
  const [apply, applyState] = useApplyMutation();
  const [remove, removeState] = useRemoveMutation();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; missing: string[] } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reset = useCallback(() => { setNotice(null); setError(null); setPending(null); }, []);
  const names = (ids: string[]) => ids.map(nameOf).join(', ');

  const run = useCallback(async (id: string, withBase: boolean) => {
    const res = await apply(withBase ? { id, with_base: true } : id).unwrap();
    // The chain it now sits on, ancestors first. One layer is an ordinary load and says nothing extra.
    const order = res.order ?? [];
    setNotice(order.length > 1
      ? t('detail.apply.order', { parent: names(order.slice(0, -1)), child: nameOf(order[order.length - 1]) })
      : null);
  }, [apply, nameOf, t]);

  const load = useCallback(async (id: string) => {
    setNotice(null); setError(null); setBusyId(id);
    try {
      await run(id, false);
    } catch (err) {
      const data = (err as { data?: { error?: string; missing?: string[]; patch_id?: string } }).data ?? {};
      const msg = data.error ?? errorMessage(err);
      if (/^needs_base/.test(msg) && data.missing?.length) { setPending({ id, missing: data.missing }); return; }
      if (/^base_mismatch/.test(msg)) {
        // The node names the layer whose `before` did not match; that is the base to reload, not the child.
        setError(t('detail.apply.mismatch', { parent: nameOf(data.patch_id ?? id), child: nameOf(id) }));
        return;
      }
      setError(errorMessage(err));
    }
  }, [run, nameOf, t]);

  const unload = useCallback(async (id: string) => {
    setNotice(null); setError(null); setBusyId(id);
    try {
      await remove(id).unwrap();
    } catch (err) {
      const data = (err as { data?: { error?: string; ids?: string[] } }).data ?? {};
      const msg = data.error ?? errorMessage(err);
      if (/^has_dependents/.test(msg) && data.ids?.length) {
        setError(t('detail.apply.has_dependents', { children: names(data.ids), parent: nameOf(id) }));
        return;
      }
      setError(errorMessage(err));
    }
  }, [remove, nameOf, t]);

  const dialog = pending ? (
    <Sheet
      title={t('detail.apply.needs_base', { child: nameOf(pending.id), parent: names(pending.missing) })}
      onClose={() => setPending(null)} width={480} testId="apply-needs-base"
    >
      <SheetFooter>
        <Button variant="outlined" onClick={() => setPending(null)}>{t('common.cancel')}</Button>
        <Button
          variant="contained" loading={applyState.isLoading} data-testid="apply-load-both"
          onClick={async () => {
            const { id } = pending;
            setPending(null); setBusyId(id);
            try { await run(id, true); } catch (err) { setError(errorMessage(err)); }
          }}
        >{t('detail.apply.load_both')}</Button>
      </SheetFooter>
    </Sheet>
  ) : null;

  return { load, unload, busy: applyState.isLoading || removeState.isLoading, busyId, notice, error, reset, dialog };
}

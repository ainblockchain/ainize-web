import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useInspectKeyCreationMutation, useSubmitKeyCreationMutation } from '@/api/api';
import { apiKeySnapshot, type ApiKeyContext } from '@/api/apiKeyEvidence';
import { acknowledgeKeyCreation, inspectKeyCreation, keyCreationStorageKey, readKeyCreation, submitKeyCreation,
  type KeyCreation, type KeyCreationIO, type KeyCreationResult } from '@/lib/apiKeyCreation';
import { confirmKeyCandidate, discardKeyCandidate, forgetIssuedKeyById, recallIssuedKey, retainKeyCandidate } from '@/screens/models/issuedKeyMemory';

export function useApiKeyCreation(options: {
  context: ApiKeyContext | null;
  scope: string;
  current: () => boolean;
  accountCurrent: () => boolean;
  busy: MutableRefObject<boolean>;
  otherBusy?: boolean;
  loadKeys: () => Promise<unknown>;
}) {
  const { context, scope, current, accountCurrent, busy, otherBusy, loadKeys } = options;
  const [inspectRequest] = useInspectKeyCreationMutation(), [submitRequest] = useSubmitKeyCreationMutation();
  const [operation, setOperation] = useState<KeyCreation | null>(null);
  const [status, setStatus] = useState<KeyCreationResult['status']>('unknown');
  const [secretHeld, setSecretHeld] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false), [running, setRunning] = useState(false);
  const observed = useRef<string | null>(null);
  const enabled = !!context && current();
  const sync = () => {
    if (!context || !current()) return;
    try {
      setOperation(readKeyCreation(localStorage, context)); setStatus('unknown'); setSecretHeld(false);
      setReady(!!navigator.locks); setError(navigator.locks ? null : 'storage');
    } catch { setReady(false); setError('storage'); }
  };
  useEffect(() => {
    sync();
    const listener = (event: StorageEvent) => {
      if (context && (event.key === null || event.key === keyCreationStorageKey(context))) { observed.current = null; sync(); }
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }, [context?.node, context?.owner, enabled]);

  const withLock = async (action: (io: KeyCreationIO) => Promise<KeyCreationResult | null>) => {
    if (!context || !current() || busy.current || otherBusy) return;
    busy.current = true; setRunning(true); setError(null);
    try {
      if (!navigator.locks) throw new Error('storage');
      await navigator.locks.request(keyCreationStorageKey(context), { ifAvailable: true }, async lock => {
        if (!lock) throw new Error('locked');
        if (!current()) throw new Error('departed');
        const result = await action({
          storage: localStorage, current,
          load: async intent => { const task = inspectRequest(intent); try { return await task.unwrap(); } finally { task.reset(); } },
          submit: async intent => { const task = submitRequest(intent); try { return await task.unwrap(); } finally { task.reset(); } },
          retained: intent => { if (current()) { setOperation(intent); setStatus('unknown'); } },
          candidate: (intent, value) => { if (accountCurrent()) retainKeyCandidate(scope, intent.id, value); },
          confirmed: (intent, receipt) => {
            if (!accountCurrent()) return;
            let held = false;
            if (receipt.status === 'issued' || receipt.status === 'disabled') held = confirmKeyCandidate(scope, intent.id, receipt.key.key_id);
            else {
              discardKeyCandidate(scope, intent.id);
              if (receipt.key) forgetIssuedKeyById(scope, receipt.key.key_id);
            }
            if (current()) setSecretHeld(held);
          },
        });
        if (current()) { setOperation(result?.operation ?? null); setStatus(result?.status ?? 'unknown'); setReady(true); }
      });
    } catch (e) {
      if (current()) {
        sync();
        const code = e instanceof Error ? e.message : 'unknown';
        setError(['storage', 'pending', 'locked', 'existing', 'changed', 'unconfirmed'].includes(code) ? code : 'unknown');
      }
    } finally { busy.current = false; if (current()) setRunning(false); }
  };
  const inspect = () => operation ? withLock(io => inspectKeyCreation(io, operation)) : Promise.resolve();
  useEffect(() => {
    if (ready && !otherBusy && operation && observed.current !== operation.id) {
      observed.current = operation.id;
      void inspect();
    }
  }, [ready, operation?.id, otherBusy]);
  return {
    operation, status, secretHeld, error, ready, running, blocked: running || !!otherBusy,
    inspect, reload: sync,
    start: (label: string, orgId: string | null) => withLock(async io => {
      if (!context || recallIssuedKey(scope)) throw new Error('existing');
      // Refresh the owned list under the lock instead of submitting from a stale cached form.
      const listing = apiKeySnapshot(await loadKeys(), context);
      if (!current()) throw new Error('departed');
      if (!listing || listing.keys.some(key => key.label?.trim().toLocaleLowerCase() === label.toLocaleLowerCase())) throw new Error('changed');
      const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
      return submitKeyCreation(io, { version: 1, id, context, label, orgId, requestedAt: Date.now(), action: 'create', receipt: null }, 'start');
    }),
    retry: () => operation ? withLock(io => submitKeyCreation(io, operation, 'retry')) : Promise.resolve(),
    cancel: () => operation ? withLock(io => submitKeyCreation(io, operation, 'cancel')) : Promise.resolve(),
    acknowledge: () => operation ? withLock(async io => { acknowledgeKeyCreation(io.storage, operation); return null; }) : Promise.resolve(),
  };
}

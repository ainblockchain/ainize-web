import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useRevokeApiKeyMutation } from '@/api/api';
import type { ApiKeyContext } from '@/api/apiKeyEvidence';
import type { ApiKeySummary } from '@/api/types';
import { acknowledgeKeyRevocation, inspectKeyRevocation, keyRevocationStorageKey, readKeyRevocation, submitKeyRevocation,
  type KeyRevocation, type KeyRevocationResult, type KeyRevocationIO } from '@/lib/apiKeyRevocation';

export function useApiKeyRevocation(options: {
  context: ApiKeyContext | null;
  current: () => boolean;
  busy: MutableRefObject<boolean>;
  otherBusy?: boolean;
  load: () => Promise<unknown>;
  confirmed: (id: string) => void;
}) {
  const { context, current, busy, otherBusy, load, confirmed } = options;
  const enabled = !!context && current();
  const [revoke] = useRevokeApiKeyMutation();
  const [operation, setOperation] = useState<KeyRevocation | null>(null);
  const [status, setStatus] = useState<KeyRevocationResult['status']>('unknown');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const observed = useRef<string | null>(null);
  const sync = () => {
    if (!context || !current()) return;
    try {
      const saved = readKeyRevocation(localStorage, context);
      setOperation(saved);
      setStatus(saved?.state === 'confirmed' ? 'confirmed' : 'unknown');
      setReady(!!navigator.locks); setError(navigator.locks ? null : 'storage');
    } catch { setReady(false); setError('storage'); }
  };
  useEffect(() => {
    sync();
    const listener = (event: StorageEvent) => { if (context && (event.key === null || event.key === keyRevocationStorageKey(context))) sync(); };
    window.addEventListener('storage', listener);
    return () => { window.removeEventListener('storage', listener); };
  }, [context?.node, context?.owner, enabled]);

  const withLock = async (action: (io: KeyRevocationIO) => Promise<KeyRevocationResult | null>) => {
    if (!context || !current() || busy.current) return;
    busy.current = true; setRunning(true); setError(null);
    try {
      if (!navigator.locks) throw new Error('storage');
      await navigator.locks.request(keyRevocationStorageKey(context), { ifAvailable: true }, async lock => {
        if (!lock) throw new Error('locked');
        if (!current()) throw new Error('departed');
        const result = await action({ storage: localStorage, current, load, retained: (saved) => { if (current()) { setOperation(saved); setStatus('unknown'); } }, revoke: (id, context) => revoke({ id, context }).unwrap() });
        // A verified receipt can arrive after navigation; held-key cleanup remains scoped by its owner/node.
        if (result?.status === 'confirmed') confirmed(result.operation.key.key_id);
        if (current()) {
          setOperation(result?.operation ?? null); setStatus(result?.status ?? 'unknown'); setReady(true);
        }
      });
    } catch (e) {
      if (current()) {
        sync();
        const code = e instanceof Error ? e.message : 'unknown';
        setError(['storage', 'pending', 'unknown', 'changed', 'locked', 'unconfirmed'].includes(code) ? code : 'unknown');
      }
    } finally { busy.current = false; if (current()) setRunning(false); }
  };
  const inspect = () => operation ? withLock(io => inspectKeyRevocation(io, operation)) : Promise.resolve();
  // Resume observation after reload; never repeat DELETE on mount or in response to a storage event.
  useEffect(() => {
    if (ready && operation?.state === 'confirmed') confirmed(operation.key.key_id);
    if (ready && !otherBusy && operation?.state === 'pending' && observed.current !== operation.id) {
      observed.current = operation.id;
      void inspect();
    }
  }, [ready, operation?.id, operation?.state, otherBusy]);
  return {
    operation, status, error, ready, running, blocked: running || !!otherBusy,
    inspect,
    reload: sync,
    start: (key: ApiKeySummary) => withLock(async io => {
      if (!context || !key.key_id || key.org_id === undefined || key.disabled === undefined) throw new Error('changed');
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      const intent: KeyRevocation = { version: 1, id: Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''),
        context, key: { key_id: key.key_id, prefix: key.prefix, label: key.label, org_id: key.org_id, issuedAt: key.issuedAt, disabled: key.disabled }, requestedAt: Date.now(), state: 'pending' };
      return submitKeyRevocation(io, intent);
    }),
    retry: () => operation ? withLock(io => submitKeyRevocation(io, operation, true)) : Promise.resolve(),
    acknowledge: () => operation ? withLock(async io => { acknowledgeKeyRevocation(io.storage, operation); return null; }) : Promise.resolve(),
  };
}

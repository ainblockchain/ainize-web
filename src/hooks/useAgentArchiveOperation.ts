import { useEffect, useRef, useState } from 'react';
import type { AgentArchiveSummary } from '@/api/agentArchiveEvidence';
import { acknowledgeArchiveOperation, archiveOperationKey, archiveOperationBody, archiveOperationUrl,
  cancelUnadmittedArchiveOperation, inspectArchiveOperation, readArchiveOperation, submitArchiveOperation,
  type ArchiveContext, type ArchiveOperation, type ArchiveOperationIO } from '@/lib/agentArchiveOperation';
export function useAgentArchiveOperation(context: ArchiveContext | null, current: () => boolean, refresh: () => Promise<unknown>) {
  const [operation, setOperation] = useState<ArchiveOperation | null>(null);
  const [ready, setReady] = useState(false), [running, setRunning] = useState(false), [error, setError] = useState<string | null>(null);
  const busy = useRef(false), observed = useRef<string | null>(null);
  const sync = () => {
    if (!context || !current()) return;
    try { setOperation(readArchiveOperation(localStorage, context)); setReady(!!navigator.locks); setError(navigator.locks ? null : 'storage'); }
    catch { setReady(false); setError('storage'); }
  };
  useEffect(() => {
    sync();
    const listener = (event: StorageEvent) => { if (context && (event.key === null || event.key === archiveOperationKey(context))) sync(); };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }, [context?.node, context?.owner]);
  const act = async (action: (io: ArchiveOperationIO) => Promise<ArchiveOperation | null>) => {
    if (!context || !current() || busy.current) return;
    busy.current = true; setRunning(true); setError(null);
    try {
      if (!navigator.locks) throw new Error('storage');
      await navigator.locks.request(archiveOperationKey(context), { ifAvailable: true }, async lock => {
        if (!lock) throw new Error('locked');
        if (!current()) throw new Error('departed');
        const next = await action({ storage: localStorage, current,
          retained: saved => { if (current()) setOperation(saved); },
          readArchive: async record => {
            const response = await fetch(`/api/agent-archives/${encodeURIComponent(record.id)}`, { credentials: 'include', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000) });
            if (!response.ok) throw new Error('unreachable');
            return response.json();
          },
          request: async (op, method) => {
            const response = await fetch(archiveOperationUrl(op, method === 'read') + (method === 'cancel' ? '/cancel' : ''), {
              method: method === 'read' ? 'GET' : 'POST', credentials: 'include', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000),
              ...(method === 'read' ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(archiveOperationBody(op)) }),
            });
            if (!response.ok) throw new Error('unreachable');
            return response.json();
          },
        });
        if (current()) { setOperation(next); setReady(true); await refresh().catch(() => undefined); }
      });
    } catch (failure) {
      if (current()) { sync(); setError(failure instanceof Error ? failure.message : 'unconfirmed'); }
    } finally { busy.current = false; if (current()) setRunning(false); }
  };
  const inspect = () => operation ? act(io => inspectArchiveOperation(io, operation)) : Promise.resolve();
  // Recover by GET after remount/storage changes. No effect or timer resubmits POST/DELETE.
  useEffect(() => {
    if (ready && operation && observed.current !== operation.id) { observed.current = operation.id; void inspect(); }
  }, [ready, operation?.id]);
  useEffect(() => {
    if (!operation || operation.job?.state !== 'running' || running) return;
    const timer = setTimeout(() => { void inspect(); }, 5000);
    return () => clearTimeout(timer);
  }, [operation, running]);
  return { operation, ready, running, error, sync, inspect,
    start: (record: AgentArchiveSummary, action: ArchiveOperation['action']) => act(io => {
      const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
      return submitArchiveOperation(io, context!, id, record, action);
    }),
    cancel: () => operation ? act(io => cancelUnadmittedArchiveOperation(io, operation)) : Promise.resolve(),
    acknowledge: () => operation ? act(async io => { await acknowledgeArchiveOperation(io, operation); return null; }) : Promise.resolve(),
  };
}

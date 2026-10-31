import { useEffect, useState, useSyncExternalStore } from 'react';
import { apiKeySnapshot, heldApiKeyState, type ApiKeyContext } from '@/api/apiKeyEvidence';
import { adoptLegacyIssuedKey, forgetIssuedKey, forgetIssuedKeyById, issuedKeyScope, recallIssuedKeyRecord, rememberIssuedKey, subscribeIssuedKey } from './issuedKeyMemory';

export function useIssuedKey(account: string, node: string | null, context: ApiKeyContext | null, freshListing?: unknown, readStartedAt?: number) {
  const [notice, setNotice] = useState<'revoked' | null>(null);
  const owner = issuedKeyScope(account, node);
  const held = useSyncExternalStore(subscribeIssuedKey, () => recallIssuedKeyRecord(owner), () => null);
  const state = held ? heldApiKeyState(held.key, held.receivedAt, freshListing, context, readStartedAt) : null;
  useEffect(() => {
    const adopt = () => {
      // Legacy migration also requires a complete response from this node for the expected principal.
      const snapshot = apiKeySnapshot(freshListing, context);
      if (snapshot) adoptLegacyIssuedKey(owner, snapshot);
    };
    const unsubscribe = subscribeIssuedKey(adopt);
    adopt();
    return unsubscribe;
  }, [owner, freshListing, context?.node, context?.owner]);
  useEffect(() => {
    if (held && state !== 'revoked') setNotice(null);
    if (held && state === 'revoked' && recallIssuedKeyRecord(owner) === held) {
      setNotice('revoked');
      forgetIssuedKey(owner);
    }
  }, [owner, held, state]);
  return {
    key: state === 'revoked' ? null : held?.key ?? null,
    usableKey: state === 'ready' ? held?.key ?? null : null,
    state: state ?? notice,
    remember: (value: string) => rememberIssuedKey(owner, value),
    forget: () => { setNotice(null); forgetIssuedKey(owner); },
    forgetById: (id: string) => forgetIssuedKeyById(owner, id),
  };
}

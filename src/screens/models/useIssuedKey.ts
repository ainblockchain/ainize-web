import { useEffect, useSyncExternalStore } from 'react';
import { adoptLegacyIssuedKey, forgetIssuedKey, forgetIssuedKeyByPrefix, issuedKeyScope, recallIssuedKey, rememberIssuedKey, subscribeIssuedKey } from './issuedKeyMemory';

export function useIssuedKey(account: string, node: string | null, freshListing?: unknown) {
  const owner = issuedKeyScope(account, node);
  const key = useSyncExternalStore(subscribeIssuedKey, () => recallIssuedKey(owner), () => null);
  useEffect(() => {
    const adopt = () => { adoptLegacyIssuedKey(owner, freshListing); };
    const unsubscribe = subscribeIssuedKey(adopt);
    adopt();
    return unsubscribe;
  }, [owner, freshListing]);
  return {
    key,
    remember: (value: string) => rememberIssuedKey(owner, value),
    forget: () => forgetIssuedKey(owner),
    forgetByPrefix: (prefix: string) => forgetIssuedKeyByPrefix(owner, prefix),
  };
}

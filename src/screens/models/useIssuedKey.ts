import { useSyncExternalStore } from 'react';
import { forgetIssuedKey, recallIssuedKey, rememberIssuedKey, subscribeIssuedKey } from './issuedKeyMemory';

export function useIssuedKey(owner: string) {
  const key = useSyncExternalStore(subscribeIssuedKey, () => recallIssuedKey(owner), () => null);
  return {
    key,
    remember: (value: string) => rememberIssuedKey(owner, value),
    forget: () => forgetIssuedKey(owner),
  };
}

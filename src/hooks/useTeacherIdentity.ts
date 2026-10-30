import { useSyncExternalStore } from 'react';
import { currentTeacherKey, onTeacherKeyChange } from '@/lib/teacherKey';

const snapshot = () => currentTeacherKey()?.address.toLowerCase() ?? '';
/** A public address scopes private caches; no key material enters Redux or query arguments. */
export function useTeacherIdentity(): string {
  return useSyncExternalStore(onTeacherKeyChange, snapshot, snapshot);
}

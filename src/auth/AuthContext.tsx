import { createContext, useContext, useState, type ReactNode } from 'react';
import { useLogoutMutation, useMeQuery } from '@/api/api';

/**
 * Who is here, and what that lets them do — two questions, kept apart.
 *
 * They used to be one. Only an owner of the node could hold a session at all, so `isSignedIn` was permission, and
 * every guard in the app could read it as such. Sign-in is open now: a person connects their wallet to be known
 * and to be paid, and most of them will never own the node they are looking at. A guard that still read
 * `isSignedIn` as permission would be wrong about nearly every visitor, so the field that grants nothing kept the
 * old name and `isOwner` — the thing every privileged route on the node actually checks — is new and has to be
 * asked for by name.
 *
 * `address` is the NODE's address and always was. `subject` is yours. Those being one field would have been the
 * same mistake in a different place.
 */
export interface AuthState {
  loading: boolean;
  /** somebody is signed in — a name, not a permission */
  isSignedIn: boolean;
  /** the address signed in, or null */
  subject: string | null;
  /** how it proved itself: `eip191` is a person at a browser wallet, `ain` is a key acting on its own */
  scheme: 'ain' | 'eip191' | null;
  /** does the signed-in address own this node — what the operator screens require */
  isOwner: boolean;
  scope: string[];
  /** true between clicking Log out and the fresh /api/auth/me result — route guards send you home instead of to /signing */
  signingOut: boolean;
  canEnroll: boolean;
  /** the node's own address — not the visitor's */
  address: string | null;
  name: string | null;
  roles: string[];
  /** Re-read /api/auth/me; resolves once the fresh state is in the store. */
  refresh: () => Promise<void>;
  /** Sign out: reports isSignedIn=false immediately (so route guards do not bounce through /dashboard), then clears the cookie and re-reads /api/auth/me. */
  signOut: () => Promise<void>;
}

const EMPTY: AuthState = {
  loading: true, isSignedIn: false, subject: null, scheme: null, isOwner: false, scope: [], signingOut: false,
  canEnroll: false, address: null, name: null, roles: [], refresh: async () => undefined, signOut: async () => undefined,
};
const AuthContext = createContext<AuthState>(EMPTY);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, refetch } = useMeQuery(undefined, { pollingInterval: 60_000 });
  const [logout] = useLogoutMutation();
  const [signingOut, setSigningOut] = useState(false);
  const refresh = async () => { try { await refetch().unwrap(); } catch { /* the query state carries the error */ } };
  const live = !!data?.signedIn && !signingOut;
  const value: AuthState = {
    loading: isLoading,
    isSignedIn: live,
    subject: live ? data?.subject ?? null : null,
    scheme: live ? data?.scheme ?? null : null,
    // Ownership is the node's answer, never inferred here from having a session. It is also re-read on every
    // /api/auth/me, so a grant or a revocation lands within the poll rather than at the end of a 30-day cookie.
    isOwner: live && !!data?.isOwner,
    scope: live ? data?.scope ?? [] : [],
    signingOut,
    canEnroll: !!data?.canEnroll,
    address: data?.address ?? null,
    name: data?.name ?? null,
    roles: data?.roles ?? [],
    refresh,
    signOut: async () => {
      setSigningOut(true);   // optimistic: the very next render is already signed-out
      try { await logout().unwrap(); } catch { /* cookie may already be gone */ }
      await refresh();
      setSigningOut(false);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

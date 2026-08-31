import { createContext, useContext, useState, type ReactNode } from 'react';
import { useLogoutMutation, useMeQuery } from '@/api/api';

export interface AuthState {
  loading: boolean;
  isSignedIn: boolean;
  /** true between clicking Log out and the fresh /api/auth/me result — route guards send the operator home instead of to /signing */
  signingOut: boolean;
  needsSetup: boolean;
  address: string | null;
  name: string | null;
  roles: string[];
  /** Re-read /api/auth/me; resolves once the fresh state is in the store. */
  refresh: () => Promise<void>;
  /** Sign out: reports isSignedIn=false immediately (so route guards do not bounce through /dashboard), then clears the cookie and re-reads /api/auth/me. */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({ loading: true, isSignedIn: false, signingOut: false, needsSetup: false, address: null, name: null, roles: [], refresh: async () => undefined, signOut: async () => undefined });

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, refetch } = useMeQuery(undefined, { pollingInterval: 60_000 });
  const [logout] = useLogoutMutation();
  const [signingOut, setSigningOut] = useState(false);
  const refresh = async () => { try { await refetch().unwrap(); } catch { /* the query state carries the error */ } };
  const value: AuthState = {
    loading: isLoading,
    isSignedIn: !!data?.signedIn && !signingOut,
    signingOut,
    needsSetup: !!data?.needsSetup,
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

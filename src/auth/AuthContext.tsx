import { createContext, useContext, type ReactNode } from 'react';
import { useMeQuery } from '@/api/api';

export interface AuthState {
  loading: boolean;
  isSignedIn: boolean;
  needsSetup: boolean;
  address: string | null;
  name: string | null;
  roles: string[];
  /** Re-read /api/auth/me; resolves once the fresh state is in the store. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({ loading: true, isSignedIn: false, needsSetup: false, address: null, name: null, roles: [], refresh: async () => undefined });

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, refetch } = useMeQuery(undefined, { pollingInterval: 60_000 });
  const value: AuthState = {
    loading: isLoading,
    isSignedIn: !!data?.signedIn,
    needsSetup: !!data?.needsSetup,
    address: data?.address ?? null,
    name: data?.name ?? null,
    roles: data?.roles ?? [],
    refresh: async () => { try { await refetch().unwrap(); } catch { /* the query state carries the error */ } },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

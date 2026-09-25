import { createContext, useContext, useState, type ReactNode } from 'react';
import { useGoogleLogoutMutation, useGoogleSessionQuery, useLogoutMutation, useMeQuery } from '@/api/api';
import type { GoogleIdentityView } from '@/api/types';

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
 *
 * A Google account is a third way to be here, and a weaker one: this app checked it, the node has never heard of it.
 * So it signs you in — `isSignedIn`, a name in the header — and grants nothing else. `subject` stays null for it,
 * because `subject` is an address and a Google account is not one; read `google` for who it is.
 */
export interface AuthState {
  loading: boolean;
  /** somebody is signed in — a name, not a permission */
  isSignedIn: boolean;
  /** the address signed in, or null — also null for a Google-only session, which has no address */
  subject: string | null;
  /** how it proved itself: `eip191` is a person at a browser wallet, `ain` is a key acting on its own, `google` is a Google account this app checked */
  scheme: 'ain' | 'eip191' | 'google' | null;
  /** the Google account signed in to this app, whether or not a wallet is too */
  google: GoogleIdentityView | null;
  /** this server can do Google sign-in at all */
  googleConfigured: boolean;
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
  /** Sign out: reports isSignedIn=false immediately (so route guards do not bounce through /dashboard), then clears both cookies — the node's and Google's — and re-reads both. */
  signOut: () => Promise<void>;
}

const EMPTY: AuthState = {
  loading: true, isSignedIn: false, subject: null, scheme: null, google: null, googleConfigured: false, isOwner: false, scope: [], signingOut: false,
  canEnroll: false, address: null, name: null, roles: [], refresh: async () => undefined, signOut: async () => undefined,
};
const AuthContext = createContext<AuthState>(EMPTY);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, refetch } = useMeQuery(undefined, { pollingInterval: 60_000 });
  const { data: googleData, isLoading: googleLoading, refetch: refetchGoogle } = useGoogleSessionQuery(undefined, { pollingInterval: 60_000 });
  const [logout] = useLogoutMutation();
  const [googleLogout] = useGoogleLogoutMutation();
  const [signingOut, setSigningOut] = useState(false);
  const refresh = async () => {
    // One failing must not keep the other from being re-read: the node can be down while this app is up.
    await Promise.all([refetch().unwrap(), refetchGoogle().unwrap()].map((p) => p.catch(() => undefined)));
  };
  const live = !!data?.signedIn && !signingOut;
  const google = !signingOut ? googleData?.identity ?? null : null;
  const value: AuthState = {
    loading: isLoading || googleLoading,
    isSignedIn: live || !!google,
    subject: live ? data?.subject ?? null : null,
    // The wallet wins when both are present: it is the one the node can act on.
    scheme: live ? data?.scheme ?? null : google ? 'google' : null,
    google,
    googleConfigured: !!googleData?.configured,
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
      await Promise.all([logout().unwrap(), googleLogout().unwrap()].map((p) => p.catch(() => undefined)));   // either cookie may already be gone
      await refresh();
      setSigningOut(false);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

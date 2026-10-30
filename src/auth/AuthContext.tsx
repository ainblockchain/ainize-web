import { useDispatch } from 'react-redux';
import { api } from '@/api/api';
import { signOutSessions } from './signOutSessions';
import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { useGoogleLogoutMutation, useGoogleSessionQuery, useLogoutMutation, useMeQuery, useSsoStatusQuery } from '@/api/api';
import { activateIssuedKeyOwner } from '@/screens/models/issuedKeyMemory';
import type { GoogleIdentityView, SsoSessionView } from '@/api/types';

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
 *
 * An AIN account (AIN SSO) is the fourth, and stands for what a Google session stood for: a name and API keys. The
 * node keeps its session and reports it apart (`sso`), so `subject` stays null for it too.
 */
export interface AuthState {
  loading: boolean;
  /** Browser cache identity only; never sent as authorization to the server. */
  cacheIdentity: string;
  /** somebody is signed in — a name, not a permission */
  isSignedIn: boolean;
  /** the address signed in, or null — also null for a Google-only session, which has no address */
  subject: string | null;
  /** how it proved itself: `eip191` is a person at a browser wallet, `ain` is a key acting on its own, `google` is a Google account this app checked, `sso` an AIN account */
  scheme: 'ain' | 'eip191' | 'google' | 'sso' | null;
  /** the AIN account signed in (AIN SSO), or null */
  sso: SsoSessionView | null;
  /** the Google account the node accepted from this site (`google:<sub>`), or null — it owns what a Google-only person makes */
  sitePrincipal: string | null;
  /**
   * Who the node would record as the OWNER of something this person makes: the wallet address when there is one,
   * else the AIN account's principal (`sso:<sub>`), else the vouched Google account (`google:<sub>`), else null. A hosted or linked agent's `owner` is this string —
   * so this, not `subject`, is what an ownership check compares against (`isHostedAgentOwnedBy`, `viewerPrincipals`).
   */
  principal: string | null;
  /** this server offers "Continue with AIN" */
  ssoConfigured: boolean;
  /** the Google account signed in to this app, whether or not a wallet is too */
  google: GoogleIdentityView | null;
  /** this server can do Google sign-in at all */
  googleConfigured: boolean;
  /** does the signed-in address own this node — what the operator screens require */
  isOwner: boolean;
  scope: string[];
  /** true between clicking Log out and the fresh /api/auth/me result — route guards send you home instead of to /signing */
  signingOut: boolean;
  signOutFailed: boolean;
  canEnroll: boolean;
  /** the node's own address — not the visitor's */
  address: string | null;
  name: string | null;
  roles: string[];
  /** Re-read /api/auth/me; resolves once the fresh state is in the store. */
  refresh: () => Promise<void>;
  /** Hide private views while ending active sessions. Failure is retryable; only success clears caches and proceeds to AIN SSO sign-out. */
  signOut: () => Promise<void>;
}

const EMPTY: AuthState = {
  cacheIdentity: '', loading: true, isSignedIn: false, subject: null, scheme: null, sso: null, sitePrincipal: null, principal: null, ssoConfigured: false, google: null, googleConfigured: false, isOwner: false, scope: [], signingOut: false, signOutFailed: false,
  canEnroll: false, address: null, name: null, roles: [], refresh: async () => undefined, signOut: async () => undefined,
};
const AuthContext = createContext<AuthState>(EMPTY);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, refetch } = useMeQuery(undefined, { pollingInterval: 60_000 });
  const { data: googleData, isLoading: googleLoading, refetch: refetchGoogle } = useGoogleSessionQuery(undefined, { pollingInterval: 60_000 });
  const { data: ssoStatus } = useSsoStatusQuery();
  const [logout] = useLogoutMutation();
  const [googleLogout] = useGoogleLogoutMutation();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const signOutPending = useRef(false);
  const dispatch = useDispatch();
  const refresh = async () => {
    // One failing must not keep the other from being re-read: the node can be down while this app is up.
    await Promise.all([refetch().unwrap(), refetchGoogle().unwrap()].map((p) => p.catch(() => undefined)));
  };
  const live = !!data?.signedIn && !signingOut;
  const google = !signingOut ? googleData?.identity ?? null : null;
  const sso = !signingOut ? data?.sso ?? null : null;
  const sitePrincipal = !signingOut ? data?.site?.principal ?? null : null;
  // Include every accepted identity: connecting a wallet must not reuse an SSO-only key list.
  const cacheIdentity = live || sso || google
    ? JSON.stringify([live ? data?.subject ?? null : null, sso?.principal ?? null, sitePrincipal, google?.sub ?? null]) : '';
  useEffect(() => {
    if (!isLoading && !googleLoading) activateIssuedKeyOwner(cacheIdentity || null);
  }, [cacheIdentity, isLoading, googleLoading]);
  const value: AuthState = {
    cacheIdentity,
    loading: isLoading || googleLoading,
    isSignedIn: live || !!google || !!sso,
    subject: live ? data?.subject ?? null : null,
    // The wallet wins when both are present: it is the one the node can act on.
    scheme: live ? data?.scheme ?? null : sso ? 'sso' : google ? 'google' : null,
    sso,
    sitePrincipal,
    principal: live ? data?.subject ?? sso?.principal ?? sitePrincipal : sso?.principal ?? sitePrincipal,
    ssoConfigured: !!ssoStatus?.configured,
    google,
    googleConfigured: !!googleData?.configured,
    // Ownership is the node's answer, never inferred here from having a session. It is also re-read on every
    // /api/auth/me, so a grant or a revocation lands within the poll rather than at the end of a 30-day cookie.
    isOwner: live && !!data?.isOwner,
    scope: live ? data?.scope ?? [] : [],
    signingOut, signOutFailed,
    canEnroll: !!data?.canEnroll,
    address: data?.address ?? null,
    name: data?.name ?? null,
    roles: data?.roles ?? [],
    refresh,
    signOut: async () => {
      if (signOutPending.current) return;
      signOutPending.current = true;
      const wasSso = !!sso;
      activateIssuedKeyOwner(null);
      setSignOutFailed(false); setSigningOut(true);
      try {
        const ended = await signOutSessions({
          nodeActive: live || wasSso, googleActive: !!google,
          node: () => logout().unwrap(), google: () => googleLogout().unwrap(),
        });
        if (!ended) {
          await refresh();
          setSignOutFailed(true);
          return;
        }
        // Clear private views and old /me results together. Hooks fetch the new signed-out state after reset.
        dispatch(api.util.resetApiState());
        if (wasSso && typeof window !== 'undefined') {
          window.location.assign('/api/auth/sso/logout');
          return;
        }
      } catch {
        setSignOutFailed(true);
      } finally {
        signOutPending.current = false;
        setSigningOut(false);
      }
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

import { safeReturnPath } from './uiNavigation';

export interface SignInFlow {
  loading: boolean;
  signedIn: boolean;
  ssoConfigured: boolean;
  googleConfigured: boolean;
  optionsFailed: boolean;
  params: URLSearchParams;
}

/** A normal login goes straight to the account provider, or back to the requested page.
 * Wallet proof, enrollment and account linking are explicit operations, not ordinary login.
 * Error returns must remain visible rather than triggering an authorization loop.
 */
export function directSignIn(flow: SignInFlow): { kind: 'return' | 'provider'; href: string } | null {
  const { params } = flow;
  if (flow.loading || params.has('sso_error') || params.has('google_error') ||
      params.get('sso') === 'connect' || params.has('token') || params.get('wallet') === '1' || params.get('options') === '1') return null;
  const next = safeReturnPath(params.get('next'));
  if (flow.signedIn) return { kind: 'return', href: next };
  if (flow.optionsFailed) return null;
  const provider = flow.ssoConfigured ? 'sso' : flow.googleConfigured ? 'google' : null;
  return provider ? { kind: 'provider', href: `/api/auth/${provider}/start?next=${encodeURIComponent(next)}` } : null;
}

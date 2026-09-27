/** What a person is told when the node refuses an AIN sign-in or a connect (codes from ainize-node src/sso.ts). */
import type { NodeCallError } from './nodeCall';

export function ssoRefusalMessage(e: NodeCallError): string {
  switch (e.code) {
    case 'account_suspended': return 'this account is suspended by its organization';
    case 'legacy_conflict': return 'that ainize.ai account is already connected to another AIN account';
    case 'already_linked': return 'this AIN account already has its own ainize.ai account';
    case 'wrong_issuer': case 'sso_disabled': return 'AIN sign-in is not set up on this node';
    case 'unreachable': return 'the node is not answering — try again';
    default: return 'AIN sign-in failed';
  }
}

/** Why a legacy Google sign-in is refused (legacyLogin.ts). */
export function legacyRefusalMessage(reason: 'legacy_login_off' | 'linked_use_ain' | 'suspended' | 'signed_out' | 'node_unavailable'): string {
  switch (reason) {
    case 'legacy_login_off': return 'Google sign-in has been replaced by AIN sign-in on this site';
    case 'linked_use_ain': return 'this Google account is connected to an AIN account — continue with AIN instead';
    case 'suspended': return 'this account is suspended by its organization';
    case 'signed_out': return 'you were signed out everywhere — sign in again';
    case 'node_unavailable': return 'the node is not answering — try again';
  }
}

# AIN sign-in configuration and diagnosis

The web server holds `AIN_SSO_ISSUER`, `AIN_SSO_CLIENT_ID`, and
`AIN_SSO_CLIENT_SECRET`. The issuer registration and deployed web configuration
must agree. Never put the client secret in browser code, a screenshot, a ticket,
or an error log.

The authorization-code callback distinguishes these failures:

- An issuer rejection of the application's credentials (`invalid_client`,
  `unauthorized_client`, or an HTTP 401 authentication challenge) asks the visitor
  to contact the service administrator. Check the issuer's application registration
  and the secret loaded by the running web release before changing application code.
- `invalid_grant` means the code is expired, consumed, or otherwise invalid. Start a
  new sign-in flow. It does not prove that the application secret is wrong.
- An issuer HTTP 5xx or temporary/server error asks the visitor to try later.
- Signature, issuer, audience, nonce and state failures remain rejected. A diagnostic
  message never permits a session or relaxes identity verification.

## Rotation procedure

1. Identify every consumer of this issuer application and its configuration source.
   Check the exact application ID and redirect URI for each environment.
2. If supported by the issuer, introduce the new secret while the old secret remains
   valid, update each consumer through its secret store, and restart/reload it. If
   overlap is unavailable, schedule the issuer change and consumer reload together.
3. Start a fresh browser sign-in after reload. The web client invalidates cached
   discovery when its secret changes. Pending cookies are encrypted with the client
   secret, so a flow started before rotation may need to be started again.
4. Verify the complete browser callback, node session creation, return to the
   requested page, and an authenticated API read. A running process or a successful
   discovery response alone does not verify the secret or the login flow.
5. Record the application ID, consumer/release, rotation time and verification
   result, without the secret or session token. Retire the old secret only after all
   consumers pass. A rollback also requires an issuer-valid secret; rolling back
   only the web release cannot restore a credential already revoked by the issuer.

`test/ain-sso.test.ts` exercises rejected credentials followed by a fresh successful
flow after correcting the consumer secret. It also verifies that error responses
create no node session and that provider error descriptions are not logged or
returned to the visitor. Production login must still be checked after each rotation.

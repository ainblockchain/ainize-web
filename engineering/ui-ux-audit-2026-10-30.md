# Ainize UI/UX audit — 2026-10-30

## Scope and completion criteria

User request: audit all inconsistent UI/UX, mismatched labels and destinations, and buttons that show unexpected content; fix and verify them. This is not complete when a sample of public pages passes.

- Every route below must reach the intended screen from its visible entry points and directly from a bookmark.
- Button/link labels must describe the action and destination. Preserve selected resources, query state and return destinations.
- Public, signed-out, member and operator views must respect the actual API contract. Never invent membership or mistake a denied request for an empty list.
- Loading, failure, empty and partial-result states must be distinguishable. Failed actions must offer a meaningful recovery.
- Use one top search. Apps lists apps; Agents lists agents; Knowledge and Teach live under Train.
- Mobile controls must remain readable, reachable and within the viewport. Verify 320px and 390px as well as desktop.
- Test mutations with controlled data/server fixtures when a live click would change user data, deploy workloads, incur payment or delete resources.
- Build/test through the standard ainize server pipeline; no local containers. Verify the public release SHA and rendered behavior after deployment.

## Confirmed findings and evidence

| ID | Finding | Current work / evidence | State |
|---|---|---|---|
| U01 | Apps contained instructional/examples content instead of the viewer’s app list | PR #140; public signed-out Apps has generic sign-in; accessible app aggregation and app-kind filtering | Deployed; signed-in browser flow still requires controlled verification |
| U02 | Signed-out organization listing presented denied/hidden resources as an authoritative empty organization | PR #139; login/member guidance | Deployed; member flow pending |
| U03 | Knowledge/Teach duplicated top-level navigation, and Agents highlighted the shared knowledge route | PR #141; Train subsections, old-link redirects; desktop, Korean/English 320/390px checked | Deployed |
| U04 | An inaccessible project fell into PatchPage with an empty ID, requesting HTML and showing a knowledge JSON error | Reproduced publicly at /comcom/nextjs-hello-world; ProjectByNamePage fallback + mismatched route parameter names | Deployed; signed-out browser verified, authenticated actions pending |
| U05 | Legacy /patch/:author/:patchId redirected to home | Legacy and canonical URLs verified at e73c892 | Deployed |
| U06 | Unified search Enter opened knowledge only; dropdown and full results had different app scope | GlobalSearch.tsx and api.ts inspected | Deployed; Enter/arrow selection and query changes verified |
| U07 | App search lost monorepo sourcePath and included non-app project kinds | globalSearch.ts docsFromProjects; regression assertions cover exact paths and kinds | Deployed; regression coverage, authenticated rendering pending |
| U08 | Model list repeated the top search and retained a stale query after same-page navigation | One shared search; URL query and matching result verified | Deployed |
| U09 | Knowledge search showed unrelated recommendation shelves and pagination stopped after 200 fetched rows | ExplorePage.tsx fetch limit=200 followed by client slicing | Deployed; no-match browser verified; >200-row fixture pending |
| U10 | Generic missing-page recovery always sent visitors to knowledge | NotFoundPage.tsx | Deployed; malformed URL reaches 404 and Home |
| U11 | Production Train cannot start while serving API is unreachable | Public /train policy warning observed after #141 | Runtime issue unresolved; do not present training as verified |

## Newly identified follow-up findings

- U12: Landing signed-in identity links to `/my-nodes` for wallet sessions and `/models` for SSO/Google, rather than the account/profile destination the label implies. Fixed/deployed in #146; controlled signed-in rendering still pending.
- U13: SignedInLayout and SigningCheckLayout preserve only pathname in the login return link, dropping query/anchor selections. Fixed/deployed in #146; public return URL and SSO link verified with tab and anchor.
- U14: Landing demo console links point at a specific ComCom repository; verify its public accessibility before presenting it as a public working example. Source: LandingPage.tsx EXAMPLE_PROJECT. Not verified yet.

## Route coverage inventory

A row remains pending until the applicable flows and rendered behavior are checked. A passing typecheck or source-only assertion is not full route coverage.

| Route | Verification | Required coverage |
|---|---|---|
| `/` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/explore` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/search` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/apps` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/models` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/aincode` | Partial: deployed list/title checked; revised account/error/empty rendering fixtures pass | New account-scoped release, session destination gateway behavior and long-name 320/390px verification pending |
| `/models/:id` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/billing` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/network` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/agent/new` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/agent/:id/edit` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/agent/link` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/agent/:id/link` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/agent/:id` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/agents` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/tracks/*` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/ledger` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/terms` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/signing` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/authorize` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/docs/*` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/chat` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/chat/:patchId` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/teach/*` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/train` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/train/knowledge` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/train/upload` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/train/dataset/:dsId` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/train/dataset/:dsId/settings` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/train/lesson/:jobId` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/train/mine` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/train/merge` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/teacher/:address` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/verifier/:address` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/benchmarks/:schema` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/patch/:author/:patchId` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/me` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/me/agents` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/projects/new` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/projects/:id` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/me/projects` | Partial: current-account, failed/malformed/empty render fixtures | Deploy, live navigation and mobile remain |
| `/org` | Partial: malformed membership-list recovery render fixture passes | Deploy, live navigation and mobile remain |
| `/org/new` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/org/join/:token` | Partial: outage vs expiry, stale token exclusion, retry rendering checked | Server mutation fixture, deployment and mobile remain |
| `/org/:id/settings` | Partial: account-scoped reads, selected-tab permissions, failed/empty settings fixtures | Pending action UX, live destinations, deployment and mobile remain |
| `/org/:id` | Partial: account-scoped profile and server-controlled join action checked | Actual members/agents navigation, deployment and mobile remain |
| `/dashboard` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/new-patch` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/my-nodes` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/logs` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/project/:author/:patchId/logs` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/project/:author/:patchId` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/account` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/drive` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/drive/*` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/:org` | Partial: incomplete-list recovery and active Visit fixtures | Deploy, live destinations, member states and mobile remain |
| `/:org/:repo` | Partial: exact folder selection, permission/error and account fixtures | Server mutations, deploy, navigation and mobile remain |
| `*` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |

## Cross-route checks still required

- Signed-out versus signed-in identity, organization selectors, project permissions and account menus.
- Search query changes on the same route; empty query, no hits, partial network failures, keyboard selection and exact deep links.
- Model detail modalities, unavailable models, agent creation/link/edit and execution destinations.
- App deployment/source/run/log/settings/domain actions and state-dependent availability; actual selected monorepo project retained.
- Train upload/dataset/settings/lesson/history/merge; browser-local teaching key and access boundaries.
- Knowledge overview/verification/lineage/buy/manage; direct and legacy URLs and author/ID pairing.
- Chat model/knowledge selection, send/stop/retry and teaching actions.
- Organizations join/settings/invites; account/billing/authorization; operator dashboard/logs/drive and identity-specific guards.
- Home CTA destinations, docs navigation, terms anchors, network/ledger/benchmarks/provider pages.

## Verification log

- 2026-10-30: #141 public SHA 3ad89f7a724577b724114da82955a3d68dcf3f70; Train three subsection links and /teach redirect verified; no horizontal overflow at 390 and 320px. Actual training unavailable.
- Current follow-up: local TypeScript and 31 focused route/search/access checks pass; full server CI and public browser checks not yet run for U04–U10.

- First server deployment attempt for #142 stopped at gen:check before activation because the engineering audit document was in the public docs directory. Move it outside public docs; preserve the last running release and rerun the gate.

- Browser evidence: before the new release, typing `clef` in the global search then Enter opened `/train/knowledge?q=clef`, reported zero results and still displayed unrelated recommendation cards. Public project lookup returns 404 while `/api/patches/defi-engram-eth-vocabulary` returns 200; the project/knowledge routing failure is frontend behavior.
- Public model check: `/models/Qwen%2FQwen3-ASR-1.7B` renders the correct model, audio-file input and disabled Run before a file is chosen. Switching the code example to curl produces the audio transcription endpoint and the same model ID. Actual transcription execution is not verified.
- Follow-up U15: `isReservedFirstSegment` calls decodeURIComponent on a route parameter that React Router already decodes; a malformed percent token may throw instead of showing Not found. Needs a controlled negative-route test before changing it.
- Search follow-up: PR #145 unifies full-list and preview matching, including words in separate fields. TypeScript and 44 focused checks pass. Server release SHA expected e73c892f956d9165b508e144bd0491203d75e620; verification is still pending.

### Release and browser verification: e73c892

- Public `/web-build.json` and standard deploy log agree on e73c892f956d9165b508e144bd0491203d75e620. Release `/home/comcom/ainize-web-releases/releases/20261030T131032Z-e73c892f956d`. Server suite: 494 passed, 0 failed; deploy contract: 5 passed, 0 failed.
- U04: signed-out `/comcom/nextjs-hello-world` now shows project access guidance, login returning to the same project, retry and Apps recovery. No empty knowledge ID or JSON parsing error. Actual authenticated project operations remain unverified.
- U05: `/patch/0xAb6fC64Ed70dEA2294E8f2371e29535ED71278E5/defi-engram-eth-vocabulary?tab=lineage` redirects to the canonical detail with the same ID and tab. It renders the named knowledge and selects lineage.
- U06: top search Enter for clef reaches `/search?q=clef` with two matching models. Searching DeepSeek chat from that same page updates to exactly the matching DeepSeek model. ArrowDown + Enter on the clef preview opens `/models/clef`; Back restores the clef result page.
- U08 and matching consistency: `/models?q=DeepSeek%20chat` shows the same model and only one search field (the global field). No horizontal overflow at 390px. Search page at 320px has scrollWidth=320 and both clef results visible. Viewport restored.
- U07: monorepo destinations and app kind filtering covered by regression tests; authenticated app result rendering remains pending.
- U09: server pagination implemented; production catalogue has too few rows to prove >200-row navigation. A controlled dataset test is still needed. Recommendation suppression is implemented; explicit no-match browser check remains pending.
- Browser artifacts: ui-compact-verification/project-access-after-20261030.png, search-after-20261030.png, search-mobile-after-20261030.png, knowledge-link-after-20261030.png.
- Deployment coordination: final log named 1852a4c82178 as previous release, although this task did not manually activate that SHA. Another deployment mechanism may track main. Inspect active deployment processes before starting another manual deployment; do not restart a live build.

Additional visible findings, not yet fixed: knowledge detail shows a completed verification count alongside a “not yet verified” accuracy summary when score evidence is absent; determine the precise field semantics. Knowledge and agent detail routes do not keep their parent top-level navigation highlighted. Check these as part of the remaining detail audit.

### Account, navigation and project action follow-up

Prepared changes (not yet deployed):
- U12: landing identity consistently opens /me for wallet, SSO and Google sessions. Signed-in SSO/Google visitors on the login page have an explicit Continue action; default login destinations agree on /me.
- U13: shared signInHref preserves pathname, query and anchor in guards, header, project hand-off, run/log access prompts and unavailable-project recovery. Unsafe/self-return destinations fall back to /me.
- U15: malformed percent-encoded route segments return Not found rather than throwing from decodeURIComponent.
- Detail parent selection: agent, knowledge and project details keep Agents, Train and Apps selected respectively.
- U18: non-script/unknown project types no longer show a script Run button/tab. Legacy Run URLs show an explanation and a Deployments action. API runs polling is skipped for non-scripts.
- U19: repository Run shortcuts merge tab=runs into the existing monorepo query rather than producing a second question mark.
- U20: project Visit selects activeDeploymentId/activeCommit, never an arbitrary earlier successful deployment. Missing/unsafe output URLs have no Visit action.
- U21: build-log, deployment-history and run-history failures show recovery instead of empty-state claims. Failed/new logs clear downloaded text, preventing a previous log from being downloaded under a new filename.
- U22: project tab/log navigation uses history entries; redeploy success updates tab and open deployment in one query change.
- Mobile: long repository/source-folder names wrap and organization list actions can wrap below the name.

Validation so far: typecheck and 44 focused navigation, project action, translation, access and route tests passed; generated docs match. Authenticated destructive actions are not exercised on user data. Server CI and production UI checks remain required.

### Release and browser verification: 93a7432

- PR #146 passed isolated ainize CI at fc0e1c2, then the existing automatic deployment passed full CI/build and activated merge 93a7432f2f8ec6ff0d5aaf3c2eb8d6a4ecc39894. Public `/web-build.json` matches. No separate deployment was launched.
- Signed-out `/org/comcom/settings?tab=members#members` now reaches login with the entire destination preserved in both the login URL and AIN SSO link. Previously both tab and anchor were lost. Actual sign-in and authenticated project actions are still not browser-verified.
- Train top navigation and all three subroutes are present; Knowledge and Teach are absent from the top navigation. `/teach?from=bookmark#start` preserves its query and anchor when redirecting to `/train`.
- New U23: at 320px, Train cards produce scrollWidth=323 because the format chip's unbroken text determines grid minimum width. Prepared fix: zero-minimum grid tracks, shrinkable cards, wrapping bounded chips. Public mobile verification remains required after deployment.
- Train still reports serving API unreachable; actual training is not verified. The login page's wallet-first/node-operator copy also remains a separate UI audit finding.
- TeachMinePage query errors currently fall through to an empty-state claim; dataset/job loading and error distinctions need a follow-up fix.

### Release and browser verification: 33e197a

- PR #147 deployed through the existing `ainize-auto-deploy.service` after it was confirmed idle. Server CI/build succeeded, current release and public `/web-build.json` match 33e197accb33fdf3c039db91094dce975c6b3ed4.
- U23 verified on the public site: at 320px both Korean and English now have document scrollWidth=320; both cards are 288px wide with right edge at 304px. Before: document scrollWidth=323 and card right edge=322.83. Language and viewport restored after checking.
- Screenshots: ui-compact-verification/train-mobile-fixed-ko-20261030.png, train-mobile-fixed-en-20261030.png, train-final-20261030.png.
- U15 public negative-route check: `/%25/broken` renders the 404 explanation and Home recovery link, without crashing.
- U09 public no-match check: `/train/knowledge?q=ainize-no-result-check-20261030` renders 0 matching knowledge entries and an explicit empty result. No unrelated recommended cards appear. >200-row pagination still needs controlled data.
- U13 screenshot: ui-compact-verification/account-return-after-20261030.png. Authenticated login execution and project operations remain unverified.
- Additional confirmed finding: initial full-page `/train` and `/train/knowledge?...` can retain the generic root title after content loads; client navigation changes the title correctly. Investigate interaction between app/layout.tsx metadata and useTitle before fixing.


### Training history and sign-in states (current work)

- U24: `/train/mine` claimed empty when one request failed or completed before the other. Added independent dataset/history errors with retry, loading state, and empty state only after both succeed (or the browser has no teaching key). Cached results remain visible with a failure notice.
- U25: lessons whose source dataset was deleted disappeared from history. They now remain under the other-lessons section with their own result link.
- U26: ordinary public login led with MetaMask installation and node-management copy. AIN account comes first; wallet methods are an expandable secondary option. Wallet-only nodes and explicit enrollment invitations expand wallets. SSO/Google visitors retain Continue and optional wallet connection; pending account linking remains explicit. Failed option loading is retryable.
- Added real component rendering against isolated RTK Query fixtures: failures, asynchronous partial loading, removed-dataset lessons, failed refresh, SSO ordering, wallet-only/enrollment, signed-in Continue, option loading and option errors. These exercise rendered output rather than source-text assertions. esbuild is an explicit test dependency for browser-compatible JSX/ESM transforms.
- Remaining: teaching-key changes reuse void-argument caches in `myTeachJobs` and `teachDatasets`; inspect and scope cached results by teacher identity, including Chat's MyKnowledgePanel. Do not mark private identity switching verified yet.
- These changes require server CI, deployment and public login/mobile checks before being marked deployed.

### Release and browser verification: 913b03a

- PR #148 passed isolated server CI at 157da04db9e6a14d99a89218fc4eed1a1bf0e0ed; the existing automatic pipeline passed CI/build again and activated 913b03afa8876470803ed8027c7805a788d59d58. Public `/web-build.json` matches. No local containers or real account mutations were used.
- U24–U26 are deployed. Nine fixture scenarios render actual components, covering failed lists, waiting for both requests, retained lessons after dataset deletion, cached history after failure, account-first sign-in, wallet-only/enrollment, signed-in Continue, loading options and failed options.
- Public login verified: AIN account first, generic apps/agents copy, wallet disclosure initially closed, opens and closes correctly, AIN link retains `next=/apps`. Korean at 320px, English at 320px and expanded English at 390px have no horizontal overflow. Language and viewport restored. Actual authentication was not performed.
- Screenshots: ui-compact-verification/signing-before-20261030.png, signing-after-20261030.png, signing-wallet-mobile-20261030.png, signing-mobile-en-20261030.png.
- U14 now confirmed publicly: the homepage's EXAMPLE_PROJECT (`/comcom/clef-artwork-search`) reaches “project unavailable” for signed-out visitors. Screenshot home-example-unavailable-20261030.png. Replace the inaccessible demo destination/claim with a verified public example or appropriately labeled accessible walkthrough; do not change project permissions just to make the link work.
- Additional findings for the next pass: AppsPage's Open link still uses lastDeployment while ProjectPage uses activeProjectUrl; accessibleApps fails the entire list on any organization error and only gathers SSO-token organizations. MyPage treats API-key and node-list query errors as empty; private void-argument query caches and issued-key memory need identity-change checks. These are unresolved, not verified complete.

### App results and public example follow-up

- U29: Apps Open used the newest ready build rather than the active deployment. App cards now use the same activeProjectUrl helper as the detail page and resolve missing active history when needed; failed address lookup has retry.
- U30: accessibleApps discarded every success if one org failed, and read only SSO org hints. It now includes server-returned memberships, deduplicates sources/results, reports partial sources, and preserves known results. Empty partial results are not presented as a new/empty account. Search reports incomplete app sources while keeping matches. All-source failures remain errors; failed refreshes retain previous lists with a notice.
- U14: both the project console and AIN Drive source require access (Drive visibly redirects to login). Homepage example CTAs now point to the public localized walkthrough and explicitly label the organization source as requiring sign-in and access. Removed the unverified “60 seconds” promise. Both guide languages describe the access boundary. Existing Korean `#완전한-예` anchor publicly verified at viewport y=84.
- **Correction to earlier test evidence:** the PR #148 render-test subprocess inherited NODE_TEST_CONTEXT and could exit 0 without executing scenarios. Thus the earlier claim of nine executed render cases was not supported. The runner now clears that inherited context, supplies the bundled ESM require bridge, forces TAP, and requires the executed/passed count to equal every declared scenario. All 15 current scenarios (including those original nine) actually executed and passed locally, with named TAP output inspected. Public screenshots from the earlier release remain valid browser evidence.
- Current validation: typecheck, generated docs check, 29 focused top-level tests including 15 real render scenarios pass. Server CI/deployment and public endpoint checks pending for this batch.

### Release and browser verification: 8b6fea6

- PR #149 passed isolated ainize CI/build at 23530d67545627ddaa2952688dfd73358cbf8592. The existing automatic deployment validated and activated merge 8b6fea64174159294cae8c00692684b7b99541e0 at 2026-10-30 14:13:12 UTC. Public `/web-build.json` matched that exact revision. No local containers were run.
- The initial server check found a stale Korean translation source hash; it was corrected and generated docs refreshed before the successful run.
- Public homepage example buttons now link to the localized public guide. Clicking the example reached the Korean complete-example section without sign-in; the new access explanation was visible. At 320px the English button reached `/docs/en/how-to/deploy-with-ainize-json#a-complete-example`, heading y=83.97 and document scrollWidth=320. Both localized destination anchors were confirmed. Browser language and viewport were restored.
- Screenshots: ui-compact-verification/public-example-after-20261030.png and public-example-mobile-en-20261030.png. The English mobile screenshot visibly includes the public walkthrough, organization-access explanation, repository link and model guide link.
- App partial failures, total failures, retained results and active-deployment links were verified with transport fixtures and actual component rendering, not by switching a real user's account or mutating production projects.
- Remaining audit: account/key-scoped caches and MyPage loading/error/revoke states, home Teach action/copy, initial document titles, controlled large-catalog pagination, and the rest of the route/action inventory above. This release does not complete the full UI/UX audit.


### Account lists and issued-key ownership follow-up

- U31: API-key, membership and wallet-node caches were not identity-scoped. These queries now require a viewer identity (wallet subject for nodes), all consumers read currentData, and unused caches expire immediately. Header organization names and sharing options use the same scoped membership query. This does not yet cover other private endpoint families.
- U32: a raw issued key in sessionStorage was restored for any account. The held record now names its owner, clears on logout/account change, rejects late creation responses from the former account, and updates all mounted consumers. Legacy unowned values are discarded. Account forms and model playground state remount on identity changes. Copy failures get an actionable message; the retention explanation now names logout/account change.
- U33: MyPage treated loading/failed API-key and node requests as empty, and revoke failures were silent. It now distinguishes loading, failure, success and empty, retains cached current-account rows with an error, and shows revoke pending/failure/success. Accounts without a wallet get an explanation and an explicit wallet-connection link, which opens wallet controls. Google identity is displayed rather than only saying no wallet.
- U34: Model playground's key-management links went to node settings for node owners. They now go to /me for every account, and failed key-list queries offer retry.
- Prepared validation: six issued-key lifecycle tests cover ownership, logout, late responses, reload, legacy/corrupt storage, blocked storage and subscriber updates. Actual component fixtures now also cover account loading/failure/empty, retained rows, cross-identity keys/orgs/nodes, absent wallet, model key-management destination and explicit wallet controls. Real key issuance/revocation and real account switching were not performed against user data.
- Remaining: teacher-key scoped history/detail/chat queries; other session-private endpoint caches; logout failure handling; the previously recorded route/action inventory. Server CI/deployment still required for this batch.

### Release verification: 252c117

- PR #150 merged as 252c1179f7902f32e559a884bdf9b0f746d9493c. Isolated ainize CI passed at da6e6cca3b2220995ffb4ce8879fa3937110b51e (514 tests, 21 executed render scenarios, six issued-key lifecycle tests; deploy contract, typecheck, generated files and production build passed).
- The existing automatic deployment was started only after it was confirmed inactive. It completed web CI/build and activated 252c117; public `/web-build.json` matched. Real account switching and key mutations remain fixture-tested rather than performed on user data.

### Direct account login — user-requested follow-up

- U35: publicly reproduced Apps “Sign in with AIN” leading to another sign-in-method page with a wallet option. Normal `/signing?next=…` now goes directly to the configured account provider; an already signed-in visitor resumes the exact original URL without another Continue click. Ordinary login does not discover browser wallets.
- Explicit wallet proof, node enrollment, pending legacy-account linking and error recovery remain explicit flows. Wallet-dependent entry points carry `wallet=1`, so they do not loop through account login. This change does not claim to replace CLI/node delegation with account authentication; that requires its separate server authorization contract.
- Authentication failures remain on a recovery screen and retain a verified return destination, avoiding both automatic retry loops and lost URL selections. SSO callback destinations are recovered only from the matching authenticated flow cookie.
- Focused validation: direct-login decision tests and 22 executed render scenarios pass. Added OIDC route-fixture cases for return-path recovery and provider discovery failure; those require the ainize server suite. Server CI, deployment and public direct-login verification remain pending for this change.
- Next audit evidence: signedFetch currently reads the teaching key again after awaiting node discovery, and teacher-key list/detail caches still need ownership scope. Cross-tab teacher-key removal may fall back to a stale in-memory key. Inspect these together before claiming identity switching is covered globally.

### Terminal account login and section content — user follow-up

- PR #151 is deployed as 63909d41d9127e89ffef052898592e0c22007a89. Public `/signing?next=/apps` was observed going directly to AIN account sign-in.
- U36: `/authorize` only offered wallet approval even when an AIN account was signed in. Added explicit account approval for CLI sessions and inventory node connections; logged-out visitors return from AIN sign-in to the same request. The backend creates only an SSO session, with the original account session expiry and OIDC logout identity, and never a wallet binding. Requests remain single-use and require the terminal's private poll secret. Approval fails after parent logout, suspension or request expiry.
- U37: `/my-nodes` and the personal account node summary forced SSO users back into wallet connection despite the backend already accepting account inventory. Both now use the current account, with identity-scoped caches.
- U38: selected navigation tabs were repeated as large headings and introductions above the actual content. Removed visible section titles and generic introductions from Agents, Models, Apps, AinCode and Train's three subsection pages. Agents also drops the public-count heading and signed-out scope notice. Accessible headings remain visually hidden; list actions, filters and actionable loading/error/empty states remain. The first model group no longer inherits a 56px heading gap.
- Prepared validation: 55 login/node tests passed on ainize; 25 actual component render scenarios and three server-bridge fixtures passed. The earlier web source 84e2c5c passed full server CI; final combined source still needs full CI, deployment and public desktop/mobile verification. No production account was delegated or signed in through a fixture.
- Still pending: the broader audit inventory; teacher-key scoped caches and cross-tab ownership; the observed model code-copy toolbar overflow at 320px. This batch does not complete the full audit.

### Public section verification and mobile follow-up

- Web PR #152 deployed as 118e93c5b7d16bf04c182afe28d7c36a29c5718d; final web CI passed 524 tests plus 25 executed render scenarios. The node account-login PR #300 is merged as 1bea395566b365619e78813a04338807ccbebace; isolated full CI passed with canonical TMPDIR. The prior in-flight node release 961c60d5 failed documentation drift against the newer web reference, without replacing the serving node. Final node deployment still pending.
- Public Agents no longer contains the introduction, public count heading or signed-out scope note. Its first link moved from y=366.7 to y=186.5 at 1280px before authenticated scope controls loaded. The 390px browser subsequently had an existing AIN session; account scope filters remained available.
- U39: mobile Agents overflowed to 408px at both 390px and 320px because a hosted-model badge's unbroken address set the badge row's minimum width. Constrain badge rows/chips and allow long model/skill/name text to wrap. Also wrap model snippet tabs and header controls to keep the copy button inside its panel at 320px (previously observed spilling from right=285 to right=319). No content is hidden to conceal overflow.
- Before-fix proof: ui-compact-verification/agents-direct-list-mobile-390-20261031.png. Follow-up needs server CI, deployment and post-fix measurements.

### Final public release verification — 2026-10-31 KST

- Public `/web-build.json` now reports **5f1d2ccaca4be77740abc3fdd72d8bfff4f110a8** (PR #154, containing #152); `/api/build` reports **1bea395566b365619e78813a04338807ccbebace** (node PR #300). Both standard deployment CI states are `complete/success`; automatic deployment is inactive after completion. The temporary read-only SSH release watcher was stopped.
- Agents: repeated introduction, public-count heading and signed-out explanation absent. Long model badges remain within their cards; document width equals viewport width at **320px and 390px**. Both responsive measurements were made on deployed code. Proof: `ui-compact-verification/agents-direct-list-mobile-320-fixed-20261031.png` and `agents-direct-list-mobile-390-fixed-20261031.png`.
- Models, Apps and AinCode: repeated visible titles and introductions absent; each measured `scrollWidth = innerWidth = 320`. The existing browser session became authenticated during verification; Apps rendered 103 accessible cards. This is read-only signed-in evidence, not proof of mutations or account switching. Train's repeated title/intro are absent, but its pre-existing serving-API-unreachable warning remains and training is not verified.
- `/models/clef`: at 320px, the copy button bounds are x=35..99 inside the panel x=16..304; page width remains 320. This resolves the previously recorded toolbar overflow.
- Terminal approval: a fresh unauthenticated, ten-minute preview request was opened with an existing AIN browser session. The enabled button reads **이 기기 로그인**; wallet-signature message count is zero; the AIN account is displayed. At 320x740, document width is 320 and approval-button bottom is y=699.2. No approval button was pressed, poll secret was discarded, and no real account token was issued. CLI/node issuance, expiry, replay and revocation remain covered by the isolated server tests. Proof: `ui-compact-verification/terminal-account-approval-mobile-320-20261031.png`.
- U36–U39 are deployed and checked as described. The broader route/action audit remains active, particularly teaching-key identity races/cache ownership and remaining member/operator actions.

### Teaching-key lifecycle and private views — follow-up

- U40: removing a teaching key in another tab could revive an old in-memory key; other tabs were not notified. Storage absence/corruption now clears the old key, storage events refresh subscribers, and failed writes/removals preserve the user's current in-tab choice without claiming an older stored key is a backup.
- U41: signed requests could change signing identity while awaiting node discovery/body reads. Capture and guard the identity, reject stale query scopes before signing, and reject responses after a key change. Dataset downloads also require node identity and check before saving bytes. Publish approval checks its displayed owner before signing.
- U42: private lists/details shared cache entries across teaching keys. Scope chat drafts, own jobs/datasets, dataset details/rows, job details/events, training-set previews and publish previews by public address; consumers use currentData and unused entries expire immediately. Keys never enter Redux/cache arguments.
- Local validation: typecheck and generated-file check passed; 10 storage/transport regression tests and 26 actual component-render cases passed, including old-key history exclusion. Server full CI and deployment still pending. No real key was changed, imported, or removed in the user's browser.
- Remaining audit includes session-cookie private endpoint families, chat-local draft/history ownership, operator/member actions and the broader route inventory. This is not completion of the full audit.

### Dataset recovery follow-up

- PR #155 merged as b1d2aa5a624b30df38fb56505ff4ee3c2d77fd8d. Isolated ainize CI at 814cf255 passed all 534 tests, 26 executed render cases, typecheck, generated-file/deploy checks and production build. Standard production deployment is running; public verification is pending.
- U43: dataset settings reported every failed request as a deleted dataset. Preview/settings now distinguish fetching current identity from absent data and offer retry on read failure. Chat and the private lesson panel also show current-identity loading rather than relying on an older query's isLoading state.
- A new actual-render scenario checks pending and failed dataset preview/settings routes, including parameterized URLs, retry controls and absence of the incorrect deletion message. Local typecheck and all 27 render scenarios pass. Production gate/deployment pending.

### Public teaching-key / dataset recovery release verification

- PR #155 (b1d2aa5a624b30df38fb56505ff4ee3c2d77fd8d) and #156 are deployed. Final public `/web-build.json` is **cf86dbfd8266472d6ec055ce7ee7d7de2b36867d**. Standard ainize CI passed **534 tests**, **27 executed render scenarios**, five deployment-contract tests and production build; auto-deploy ended inactive/success. The temporary SSH monitor exited normally. No local containers were run.
- Public read-only UI: `/train/mine` renders the current browser's empty teaching list, Upload reaches `/train/upload`, and Back restores the list. Both views measured `scrollWidth == innerWidth` at 320 and 390px. This browser had an AIN account session but no teaching-key list; no key was imported/created/removed and no dataset was uploaded.
- Final release: the intentionally absent `/train/dataset/ui-audit-missing-dataset/settings` route renders the missing-dataset state with an enabled Retry button. Clicking Retry returns to the same expected absent-resource result. At 390px the button is inside the first screen (bottom y=254.4); page width is also 320 at the 320px check. Proof: `ui-compact-verification/dataset-retry-mobile-320-20261031.png`. The actual production absence is distinct from the controlled 503/fetching fixtures; those verify the non-deletion error states.
- U44 follow-up: the old missing-dataset copy says the dataset is “no longer” on the node and suggests downloading it from My datasets, although a missing identifier proves neither prior existence nor download availability. Reword with a direct address/list recovery. Initial direct-navigation document titles can still stay at the generic brand metadata; investigate the Next/SPA title timing separately.
- U40–U43 deployed with the stated evidence. Full route/action coverage remains unfinished; private session-query families, browser-local chat history/draft ownership and member/operator actions still need work.

### Account agent lists, node menu and sign-out — follow-up

- U45: My agents read private hosted agents but omitted private/unlisted linked agents, treating only the public catalogue as the linked source. Read the owned linked list too; combine local rows without allowing a peer's same ID to acquire local edit/delete actions. Store ownership/visibility/permissions take precedence over public catalogue metadata. Loading, failed, malformed, partial and confirmed-empty results are distinct, with retry; deletion has a pending state. Removed the unsupported assertion that AIN Teams has exactly this management list.
- U46: manageable/owned agent and archive caches were not account-scoped. They now use the current account identity and currentData, release unused caches, and remount management state on account changes. Archive downloads/restoration responses cannot surface after leaving the account's panel.
- U47: sign-out ignored active-session failures and continued to SSO logout or silently restored the old login. Both active cookie families must confirm success; pending/failure states are visible and failure has retry. Successful logout clears private API caches; a failed active session does not proceed to SSO handoff. Unused provider failures do not block the active account's logout.
- U48: the header still hid My nodes from SSO accounts after inventory support was deployed. AIN account and wallet users now both have the menu entry.
- U44: missing-dataset copy now says the identifier cannot be found and points to address/list recovery, without claiming past existence or suggesting an unavailable download.
- Prepared validation: 17 agent/parser tests (five new aggregation cases), four logout coordination cases, 33 actual render cases and typecheck passed locally. Coverage includes private linked Open/Edit targets, shared edit-without-delete permission, failed/partial lists, old-account private/archived result exclusion, SSO node menu and logout notices. Actual user logout, agent deletion/restoration and private downloads were not performed. Full ainize CI/build and deployment remain pending.

### AinCode account and list recovery follow-up

- U49: AinCode used an unscoped manual fetch effect keyed only by the signed-in boolean. Switching between signed-in accounts could preserve the previous account's list, and late responses could overwrite a newer fetch. Use an account-keyed RTK query, read only currentData, skip signed-out/auth-loading requests, and immediately expire unused lists. A gateway 401 hides cached rows and offers retry rather than looping a still-signed-in account through `/signing`.
- U50: malformed rows were silently dropped and missing workspace fields could crash grouping. Reject malformed/incomplete/duplicate/orphaned rows as a recoverable read failure; verify action paths are under `/code` and repository links use web protocols. Existing successful rows remain on a transient refresh failure, with an alert and retry. An empty workspace keeps its exact workspace-specific New session action instead of replacing it with a generic start link. Long workspace/repository names wrap.
- Validation: three AinCode parser/grouping tests plus the 36 actually executed render scenarios pass, along with the agent/logout focused tests, typecheck and generated-file check. AinCode fixtures cover exact Open/New session destinations, pending/failed/retained/empty states, former-account exclusion, signed-out entry and a signed-in gateway 401. They do not prove the remote gateway opens the correct session; that remains a live verification item.
- Deployment evidence: public `/web-build.json` still reports cf86dbfd8266472d6ec055ce7ee7d7de2b36867d. The old CI-launch SSH session exited 255 (broken master), and its control socket is absent. The server job's existence/result is unknown; inspect remote process/status before starting another job. Asked the user to reopen ainize SSH; VPN/auth settings were not changed. These changes are not yet deployed.

### Organization route and recovery audit — continuation

- U51: organization profiles, requests, invites, billing, security, audit and the shared-agent registry reused account-private query entries. Their arguments now carry a browser-only identity; all consumers use currentData and unused caches expire immediately. Org details/settings/invite forms remount on resource/account changes. Late invite acceptance or organization deletion cannot navigate a view the user already left. Project/repository endpoint families remain a separate pending audit.
- U52: requests/invites/audit treated failed/malformed reads as empty; billing/security could spin forever. Added explicit read failure/retry states, validated response shapes, and kept independent panels separate. Malformed membership lists no longer imply no organizations. A signed-out settings URL preserves its query/anchor through sign-in.
- U53: an explicit `/explore?kind=agent&agents=org&org=...` could silently pick the first other membership. Preserve the requested organization; show its read error with retry and no unrelated/empty list. Settings URLs requesting an inaccessible tab now show a permission state and available tabs, instead of silently replacing Billing with Groups.
- U54: OrgPage offered Request to join even when the server said can_request=false. Honor that contract. Invite-page network failures no longer claim the invite is used/expired; only the server's 404/410 does. Failed refreshes cannot leave a stale Accept button active.
- U55: invalid spend-cap text could turn into NaN and then JSON null, effectively removing the cap; negative/fractional inputs were silently coerced. Only an intentionally blank field removes the cap; otherwise require a safe non-negative integer. An unavailable key store no longer displays No organization keys. No real billing setting was changed.
- Local evidence: 11 organization contract/unit tests and **45 actually executed component-render scenarios** pass; typecheck, generated-file check and diff whitespace check pass. Fixtures cover allowed/read/write settings tabs, loading/failed/empty members lists, malformed billing/security responses, independent audit failure, prior-account exclusion, invite outage/expiry/token changes and exact requested-org creation destination. These are controlled fixture checks, not proof of browser mutations, mobile layout or the remote gateway.
- PR #157 remains a draft; GitHub showed no CI checks. The ainize SSH socket remains absent, so full server CI/build/deployment is still pending. No VPN/auth changes or local containers were used. Remaining org work: mutation pending/success UX, settings table responsiveness, create-form account transitions, browser navigation and server verification; the broader inventory remains active.

### Organization action and mobile follow-up

- U56: reproduced on the public site via My organizations → ComCom → Settings → Resource groups. Clicking **New group** left the DOM unchanged and `org-group-form` count at zero. The old code reset every input to empty, then used non-empty inputs as the condition for showing the form. Track form-open state explicitly; New opens an empty editor, Cancel closes it, successful save closes it, and deleting the group being edited closes that editor. Cancel now has its own label instead of Remove.
- U57: public group help claimed group membership restricted private-agent visibility. The node's `organization-routes.ts` profile returns all organization-shared agents to every member and states groups are labels. Corrected this copy and removed an unsupported reference to a resource-group picker in the agent editor. No access rules were changed.
- U58: organization mutation controls lacked a shared pending guard and some failures (notably group deletion with the editor closed) had no visible output. Added a synchronous per-panel guard, disabled relevant controls during requests, pending/success/error feedback, and ignored outcomes after leaving the view. Revoking a newly generated invite clears its copyable link. General/billing background refreshes no longer overwrite unsaved input. These async UI paths still need controlled client/server interaction checks; SSR does not execute clicks.
- U59: on the deployed Members tab at **320×740**, document width was 320 and table width 238, but names/email wrapped into one or two characters per line. Saved baseline `ui-compact-verification/org-members-mobile-320-before-20261031.png`. Mobile tables now lay out each row as labelled fields with the first value spanning the row; desktop table layout remains. This also covers billing keys/calls and audit rows. Post-change **320px/390px visual verification remains pending**; no before-fix screenshot is claimed as an after-fix result.
- Read-only browser actions only: navigated organization/settings tabs and clicked the broken New group control (which made no API mutation). No organization, group, member, invite or payment setting was changed. Temporary viewport override was reset. Typecheck/generated-file/render regression checks are run locally; full ainize CI/build and deployment remain blocked by the missing SSH control socket.


### Project selection, account state and recovery — continuation

- U60: an explicit `?project=worker` silently selected the root project while the organization list was loading, failed, or did not contain that folder. Wait for the exact folder inventory, show failure/retry for an unreadable list, and show unavailable/retry plus an explicit repository recovery link for an absent folder. Never substitute root permissions, run controls or history for an explicitly requested folder.
- U61: project, source, deployment/run history, logs, environment, domains and organization repository queries reused account-independent cache entries. Scope these reads to the full current identity, use currentData, and immediately expire unused entries. Project console and creation state remount on account/resource changes; completed creation/run/redeploy/delete requests cannot navigate a departed view or start the AIN Drive handoff there. This does not prove every asynchronous settings mutation is covered.
- U62: My projects treated failures as empty, partial repository failures could appear complete, and malformed list envelopes could crash rendering. Show recovery rather than empty/complete claims. A signed-in nonmember gets organization navigation instead of another login loop. Hide failed profile/drive metadata and hide cached project controls after a failed permission refresh. Environment denial takes precedence over cached writer data; domain denial hides old hostnames and disables changes, with retry. Deployment monitoring failures now expose retry.
- U63: organization repository Visit links used the last successful deployment even when a different deployment was active after rollback. Reuse the active-deployment URL contract; only expose a verified active URL, keeping the project console link when active deployment details are unavailable. Existing non-script Run-tab recovery was inspected and already handled; no additional change was needed there.
- Local evidence: **23 focused top-level tests**, including **53 executed component-render scenarios**, pass. Fixtures cover exact folder selection and absence, list loading/error/malformed envelopes, old-account exclusion, revoked project/environment/domain controls, partial organization lists and active-vs-historical Visit destinations. Typecheck, generated-file and whitespace checks also passed. No production run, deploy, secret, domain or project mutation was performed. Full ainize CI/build, controlled client mutations, deployment and post-change desktop/mobile remain pending; the SSH control socket is still absent.
- AinCode follow-up e8c2ceb also removes the remaining section heading and unused introduction translation. Public pre-change inspection still showed an AinCode heading; no post-change public deployment claim is made.


### Chat selection and local lesson history — continuation

- U64: the browser stored one global list of recent lesson IDs, so changing teaching keys could auto-open a previous teacher's job. Job references now use the captured teaching address; reads/removal are scoped, addresses normalize case, and anonymous callers do not acquire another teacher's history. Old unowned records are retained but never implicitly assigned; the authenticated My lessons API remains the source for existing owned history. The visible job card also derives from the current identity immediately, with explicit `?lesson=` taking precedence. This change does **not** yet scope lesson baskets or conversation transcripts.
- U65: ChatPage's selection effect removed unavailable IDs from the URL, then could select a different public item on the next render. Keep explicitly requested IDs in the URL, show recovery, and prevent chat/training with an incomplete selection. A failed catalog refresh remains visible with retry and also blocks sending instead of using a retained partial context. Draft carrying and saved-stack writes pause while the requested stack is unresolved; edits stay under the requested stack. A plain `/chat` with teaching enabled still supports an intentionally unaugmented model. The Try lesson callback no longer navigates after identity changes, leaving the view or a failed refresh.
- Local verification: three storage behavior tests and **55 executed component-render scenarios** pass, as do typecheck, generated-file and whitespace checks. Fixtures distinguish an unavailable requested knowledge from an intentional plain-model chat with the same available runtime; they preserve the typed question and verify disabled controls/retry. Storage fixtures cover two identities with matching job IDs, scoped removal, malformed/unavailable storage and retained unowned legacy records. No real teaching key, training job or stored browser conversation was changed.
- Still pending: browser interaction proof that URLs remain unchanged across the effect, partial multi-knowledge selection, scoped baskets/transcripts with a deliberate anonymous-to-new-key handoff, controlled late-response interactions, server CI/deployment and mobile verification. The standard ainize SSH socket remains absent; no replacement job was started and no VPN/authentication setting was changed.


### Draft ownership and first-key continuity — continuation

- U66: chat transcripts, unsent composer text, lesson baskets and the remembered knowledge stack were shared across identities (or only component-local for unsent text). Their storage now uses the account identity plus teaching address. The chat account waits for authentication to resolve and remounts its private state on account/key transitions; former requests are aborted and late replies cannot repopulate the new view. Changing the selected knowledge still carries a draft within its owner, but never across owners. Failed storage writes no longer delete the original basket while moving it. Empty-but-configured target baskets keep their chosen base/conflict settings.
- U67: a naive key-scoped remount would discard the anonymous work when first creating a teaching key. The account-level credit flow captures the basket, completed transcript and unsent question, creates the key once, and hands the captured work to that fresh key. Handoff data is consumed once rather than replayed after switching back. Importing an existing key does not overwrite its saved basket; the dialog offers the current draft as JSONL and an explicit Open saved draft action. Choosing saved work does not silently import the other transcript/question. Legacy unowned baskets/transcripts remain untouched and have an explicit backup download; they are never replayed as a new account's chat context.
- U68: delayed backup-file imports could change the key after leaving the dialog/account. Ignore file-read results after leaving or after a key-generation change. Continue verifies that the displayed key is still current before updating metadata. Importing a different key resets the backup confirmation and refreshes the persistence warning, so a backup of the old key cannot count as a backup of the restored one.
- U65 follow-up: removed the remaining first-catalog-item autoselection for an empty `/chat` route. A deliberately empty stack remains empty across key creation/remount and never changes to unrelated knowledge. Explicit selection still drives actual sends and training context.
- Validation: **18 focused top-level tests**, including **56 actually executed component-render scenarios**, pass; typecheck/generated-file/whitespace checks pass. Storage behavior covers account and key separation, stranded-draft scoping, occupied target preservation, failed-write preservation, unowned legacy export, first-key acceptance and existing-key conflict. Rendered Chat shows only the current account's transcript/unsent question and an explicit legacy recovery control, without rendering legacy/private-other content. No actual user key, stored browser conversation, training or payment was changed.
- Remaining verification: real client interactions for first key, import conflict, canceled credit flow, account/key switch, pending-call cancellation and delayed file import; mobile 320/390 layouts; full ainize CI/build and deployment. Storage/helper/SSR tests do not prove those interactions. The SSH socket is absent and no new remote job was started. The broader route inventory, especially agent editors/detail actions and remaining organization creation flows, is still open.


### Agent editors and detail actions — continuation

- U69: agent detail silently sent an empty `message/send` to discover an input form on page load and whenever the polled agent object changed. Form discovery is now an explicit **Ask agent for an input form** action. Sending and form discovery share a synchronous in-flight guard, abort on account/resource departure, and ignore late results. HTTP/malformed responses no longer masquerade as successful silence. A2A form discovery without a form gives a clear fallback to the message field. Card GETs no longer repeat for each equivalent catalog object. Client effect/interaction verification is still required.
- U70: local URL normalization stripped the host from any peer endpoint under `/agents` or `/api`, potentially sending to a different agent on this node. It now relativizes only the same protocol/port/site (including the www alias). Peer hosts retain their destination. Hosted management/history/binding panels are restricted to local hosted agents; a peer with the same owner or id cannot expose local management controls. Config and linked agents no longer receive unrelated hosted panels.
- U71: a successful create followed by a failed secret upload could create another suffixed agent on retry. The save coordinator records the accepted id before secrets, freezes the id and retries updates to the existing agent. It checks view ownership before collision retries and each subsequent secret write. Both editors prevent duplicate submissions, disable their fields while saving, preserve the full sign-in destination and ignore late navigation/results.
- U72: hosted/linked spec, alias and linked-list queries now use account-scoped cache arguments and currentData. Account/resource/query changes reset editor state. Forms initialize once, preserving typing across background refetches; they do not briefly display a blank editable draft while initializing. Hosted edit respects can_manage (including explicit denial), with owner fallback for older nodes. Read-only linked responses lacking upstream and mismatched ids do not become blank editable records. Failed reads offer retry. Creating within an organization respects can_request=false and distinguishes failed/malformed organization reads from an editable form. Form grids and shared visibility fields can shrink below 240px rather than overflow the mobile card.
- U73: private-agent lookup failures were shown as nonexistent agents or reused stale cached private details. Alias/spec/list failures now show recovery; exact resolved ids and response shape are checked. Linked creation now distinguishes unknown reachability from confirmed success and shows its returned notice on detail (including an alias redirect). Card copy reports success/failure; late audio file reads cannot replace a newer selection.
- Validation: **46 focused top-level tests**, including **62 executed component-render scenarios**, pass locally. Behavior tests cover partial-secret retry, chosen suffix preservation, departed-view retries/writes, explicit-id collisions, permission denial/older-node ownership and peer URL destinations. Render fixtures cover denied/mismatched/failed editors, identity-separated caches, closed organization requests, failure recovery, explicit form discovery and hidden local panels for peers. Typecheck, generated-file and whitespace checks pass. These are pure/helper/SSR checks, not proof of client clicks/effects. No local containers, user agent calls or production data mutations were run.
- Remaining: server CI/build, controlled browser submit/secret-failure/cancel/account-switch/alias flows, 320/390px mobile verification and deployment. Nested owner/history/preview controls and their private query caches still need the same audit. Linked-agent GET exposes full upstream only to the exact owner whereas PUT permits organization admins: resolve that backend read/write mismatch before claiming organization-admin linked editing works. Multi-field A2UI action serialization, peer/local id collisions in detail links, and absent/invalid streamed artifact handling remain to audit. The ainize SSH socket is still absent; no new remote job was started, and the existing remote job must be inspected once access resumes.

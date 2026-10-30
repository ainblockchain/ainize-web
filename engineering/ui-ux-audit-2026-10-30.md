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
| `/me/projects` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/org` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/org/new` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/org/join/:token` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/org/:id/settings` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/org/:id` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/dashboard` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/new-patch` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/my-nodes` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/logs` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/project/:author/:patchId/logs` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/project/:author/:patchId` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/account` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/drive` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/drive/*` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/:org` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
| `/:org/:repo` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
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

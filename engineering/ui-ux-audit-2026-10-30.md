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
| U04 | An inaccessible project fell into PatchPage with an empty ID, requesting HTML and showing a knowledge JSON error | Reproduced publicly at /comcom/nextjs-hello-world; ProjectByNamePage fallback + mismatched route parameter names | Fix prepared; production verification pending |
| U05 | Legacy /patch/:author/:patchId redirected to home | App.tsx Navigate ../ | Fix prepared |
| U06 | Unified search Enter opened knowledge only; dropdown and full results had different app scope | GlobalSearch.tsx and api.ts inspected | Shared search hook and grouped results prepared |
| U07 | App search lost monorepo sourcePath and included non-app project kinds | globalSearch.ts docsFromProjects; regression assertions cover exact paths and kinds | Fix prepared |
| U08 | Model list repeated the top search and retained a stale query after same-page navigation | ModelsPage.tsx local useState seeded from URL | Fix prepared |
| U09 | Knowledge search showed unrelated recommendation shelves and pagination stopped after 200 fetched rows | ExplorePage.tsx fetch limit=200 followed by client slicing | Server pagination and search-only results prepared |
| U10 | Generic missing-page recovery always sent visitors to knowledge | NotFoundPage.tsx | Home recovery prepared |
| U11 | Production Train cannot start while serving API is unreachable | Public /train policy warning observed after #141 | Runtime issue unresolved; do not present training as verified |

## Newly identified follow-up findings

- U12: Landing signed-in identity links to `/my-nodes` for wallet sessions and `/models` for SSO/Google, rather than the account/profile destination the label implies. Source: LandingPage.tsx landing-nav-account. Not fixed yet.
- U13: SignedInLayout and SigningCheckLayout preserve only pathname in the login return link, dropping query/anchor selections. Source: components/base/Layout.tsx. Not fixed yet.
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
| `/aincode` | Pending | Route target, visible actions, auth/empty/error states, back/deep links, mobile |
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

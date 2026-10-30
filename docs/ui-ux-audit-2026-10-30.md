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

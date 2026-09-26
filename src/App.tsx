import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Provider } from 'react-redux';
import { ThemeProvider } from 'styled-components';
import { store } from './store';
import { theme } from './theme/theme';
import { GlobalStyle } from './styles/GlobalStyle';
import { AuthProvider } from './auth/AuthContext';
import { LocaleProvider } from './i18n';
import { FocusedLayout, FullScreenLayout, Layout, NewPatchGate, SigningCheckLayout } from './components/base/Layout';
import { CenterProgress } from './components/ui/Misc';

// Pages are code-split like ainize-web did with @loadable/component.
const LandingPage = lazy(() => import('./screens/LandingPage'));
const ExplorePage = lazy(() => import('./screens/ExplorePage'));
const PatchPage = lazy(() => import('./screens/PatchPage'));
const BenchmarkPage = lazy(() => import('./screens/BenchmarkPage'));
const LedgerPage = lazy(() => import('./screens/LedgerPage'));
const NetworkPage = lazy(() => import('./screens/NetworkPage'));
const ModelsPage = lazy(() => import('./screens/ModelsPage'));
const AgentPage = lazy(() => import('./screens/AgentPage'));
// Hosted agents (ainize-node hosted-agents design): a model's own page, and the form that builds an agent on it.
const ModelDetailPage = lazy(() => import('./screens/ModelDetailPage'));
const AgentCreatePage = lazy(() => import('./screens/AgentCreatePage'));
// Throughput billing (ainize-node throughput-billing design): now N tok/s → deposit X → M tok/s, and the deposit.
const BillingPage = lazy(() => import('./screens/BillingPage'));
const TrackPage = lazy(() => import('./screens/TrackPage'));
const TermsPage = lazy(() => import('./screens/TermsPage'));
const NotFoundPage = lazy(() => import('./screens/NotFoundPage'));
const SigningPage = lazy(() => import('./screens/SigningPage'));
const AuthorizePage = lazy(() => import('./screens/AuthorizePage'));
const DashboardPage = lazy(() => import('./screens/DashboardPage'));
const ManagePage = lazy(() => import('./screens/ManagePage'));
const LogsPage = lazy(() => import('./screens/LogsPage'));
// Finding 133: the node-wide event stream (`/api/events`) had no screen — only the per-knowledge log did.
const NodeLogsPage = lazy(() => import('./screens/NodeLogsPage'));
const MyNodesPage = lazy(() => import('./screens/MyNodesPage'));
const NewPatchPage = lazy(() => import('./screens/NewPatchPage'));
const AccountPage = lazy(() => import('./screens/AccountPage'));
const DrivePage = lazy(() => import('./screens/DrivePage'));
const ChatPage = lazy(() => import('./screens/ChatPage'));
const DocsPage = lazy(() => import('./screens/DocsPage'));
const TeacherPage = lazy(() => import('./screens/TeacherPage'));
const VerifierPage = lazy(() => import('./screens/VerifierPage'));
// Teach mode v2 — the dataset wizard (docs/teachable-dataset-design.md §5.1). One pipeline, two doors.
const TeachPage = lazy(() => import('./screens/TeachPage'));
const TeachUploadPage = lazy(() => import('./screens/TeachUploadPage'));
const TeachDatasetPage = lazy(() => import('./screens/TeachDatasetPage'));
const TeachSettingsPage = lazy(() => import('./screens/TeachSettingsPage'));
const TeachLessonPage = lazy(() => import('./screens/TeachLessonPage'));
const TeachMinePage = lazy(() => import('./screens/TeachMinePage'));
const MergePage = lazy(() => import('./screens/MergePage'));

const fallback = <CenterProgress />;

export default function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <GlobalStyle />
        <LocaleProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={fallback}>
              <Routes>
                {/* Landing (FullScreenLayout) */}
                <Route path="/" element={<FullScreenLayout><LandingPage /></FullScreenLayout>} />

                {/* Public pages (Layout) */}
                <Route path="/explore" element={<Layout><ExplorePage /></Layout>} />
                <Route path="/models" element={<Layout><ModelsPage /></Layout>} />
                <Route path="/models/:id" element={<Layout><ModelDetailPage /></Layout>} />
                {/* `?model=` preselects; linked from the model page and from the free tier's "tries used up" */}
                <Route path="/billing" element={<Layout><BillingPage /></Layout>} />
                <Route path="/network" element={<Layout><NetworkPage /></Layout>} />
                {/* A2A agents this node operates, and the live test for one (NEWS-AGENT-REQUIREMENTS §6) */}
                {/* One agent. `/agent/<id>` singular, because `/agents/<id>` is the agent's own A2A address
                    (app/agents/[...path]/route.ts) and a page there would shadow the endpoint. */}
                {/* `/agent/new` beside `/agent/:id`: React Router ranks a static segment above a dynamic one, so the
                    form wins. An agent whose id were `new` would therefore have no page — the form refuses that id
                    (`HOSTED_AGENT_RESERVED_IDS`). The form checks sign-in itself so it can send you back here after. */}
                <Route path="/agent/new" element={<Layout><AgentCreatePage /></Layout>} />
                <Route path="/agent/:id/edit" element={<Layout><AgentCreatePage /></Layout>} />
                <Route path="/agent/:id" element={<Layout><AgentPage /></Layout>} />
                {/* The list lives in one place. /agents used to be a second one, and clicking an item on the
                    marketplace landed the reader back on a grid of every agent. */}
                <Route path="/agents" element={<Navigate to="/explore?kind=agent" replace />} />
                {/* a track name contains slashes (`finance/KRX-latest`), so the route is a splat: /tracks/finance/KRX-latest */}
                <Route path="/tracks/*" element={<Layout><TrackPage /></Layout>} />
                <Route path="/ledger" element={<Layout><LedgerPage /></Layout>} />
                <Route path="/terms" element={<Layout><TermsPage /></Layout>} />
                <Route path="/signing" element={<Layout><SigningPage /></Layout>} />
                {/* `ainize login` prints a link to here. Not behind a sign-in guard: a person who is not signed in
                    must be able to READ what is being asked before being told to connect a wallet for it. */}
                <Route path="/authorize" element={<Layout><AuthorizePage /></Layout>} />
                {/* one route for the whole docs tree: /docs, /docs/<page>, /docs/ko/<page> — React Router matches the splat against the empty remainder, so /docs still resolves */}
                <Route path="/docs/*" element={<Layout><DocsPage /></Layout>} />
                <Route path="/chat" element={<Layout><ChatPage /></Layout>} />
                <Route path="/chat/:patchId" element={<Layout><ChatPage /></Layout>} />
                {/* Teach mode: the entry choice, the dataset wizard, and the public data-provider page (spec §11) */}
                {/* the wizard runs under the slim FocusedLayout (logo · exit · language); the data-provider page keeps the marketplace chrome */}
                <Route path="/teach" element={<FocusedLayout><TeachPage /></FocusedLayout>} />
                <Route path="/teach/upload" element={<FocusedLayout><TeachUploadPage /></FocusedLayout>} />
                <Route path="/teach/dataset/:dsId" element={<FocusedLayout><TeachDatasetPage /></FocusedLayout>} />
                <Route path="/teach/dataset/:dsId/settings" element={<FocusedLayout><TeachSettingsPage /></FocusedLayout>} />
                <Route path="/teach/lesson/:jobId" element={<FocusedLayout><TeachLessonPage /></FocusedLayout>} />
                <Route path="/teach/mine" element={<FocusedLayout><TeachMinePage /></FocusedLayout>} />
                {/* Combining two knowledges (lineage design §4 SC-14, §9) — the third door, behind the `teach.lineage` flag */}
                <Route path="/teach/merge" element={<FocusedLayout><MergePage /></FocusedLayout>} />
                <Route path="/teacher/:address" element={<Layout><TeacherPage /></Layout>} />
                {/* item 337: what one verifier has actually done — the record behind a tick that had no page at all */}
                <Route path="/verifier/:address" element={<Layout><VerifierPage /></Layout>} />
                <Route path="/benchmarks/:schema" element={<Layout><BenchmarkPage /></Layout>} />
                <Route path="/patch/:author/:patchId" element={<Navigate to="../" replace />} />
                <Route path="/:author/:patchId" element={<Layout><PatchPage /></Layout>} />

                {/* Operator pages (SigningCheckLayout) */}
                <Route path="/dashboard" element={<SigningCheckLayout><DashboardPage /></SigningCheckLayout>} />
                {/* signed out → public pre-screen (spec §5.2); signed in → the register form */}
                <Route path="/new-patch" element={<NewPatchGate><NewPatchPage /></NewPatchGate>} />
                {/* Owning a node somewhere is not owning THIS node, so this page asks only for a signature —
                    SigningCheckLayout would send the owner of a node in another room to "not your node". */}
                <Route path="/my-nodes" element={<Layout><MyNodesPage /></Layout>} />
                <Route path="/logs" element={<SigningCheckLayout><NodeLogsPage /></SigningCheckLayout>} />
                <Route path="/project/:author/:patchId/logs" element={<SigningCheckLayout><LogsPage /></SigningCheckLayout>} />
                <Route path="/project/:author/:patchId" element={<SigningCheckLayout><ManagePage /></SigningCheckLayout>} />
                <Route path="/account" element={<SigningCheckLayout><AccountPage /></SigningCheckLayout>} />
                <Route path="/drive" element={<SigningCheckLayout><DrivePage /></SigningCheckLayout>} />
                <Route path="/drive/*" element={<SigningCheckLayout><DrivePage /></SigningCheckLayout>} />

                <Route path="*" element={<Layout><NotFoundPage /></Layout>} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
        </LocaleProvider>
      </ThemeProvider>
    </Provider>
  );
}

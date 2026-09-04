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
const LandingPage = lazy(() => import('./pages/LandingPage'));
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const PatchPage = lazy(() => import('./pages/PatchPage'));
const BenchmarkPage = lazy(() => import('./pages/BenchmarkPage'));
const LedgerPage = lazy(() => import('./pages/LedgerPage'));
const NetworkPage = lazy(() => import('./pages/NetworkPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const SigningPage = lazy(() => import('./pages/SigningPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ManagePage = lazy(() => import('./pages/ManagePage'));
const LogsPage = lazy(() => import('./pages/LogsPage'));
const NewPatchPage = lazy(() => import('./pages/NewPatchPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const DrivePage = lazy(() => import('./pages/DrivePage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const DocsPage = lazy(() => import('./pages/DocsPage'));
const TeacherPage = lazy(() => import('./pages/TeacherPage'));
// Teach mode v2 — the dataset wizard (docs/teachable-dataset-design.md §5.1). One pipeline, two doors.
const TeachPage = lazy(() => import('./pages/TeachPage'));
const TeachUploadPage = lazy(() => import('./pages/TeachUploadPage'));
const TeachDatasetPage = lazy(() => import('./pages/TeachDatasetPage'));
const TeachSettingsPage = lazy(() => import('./pages/TeachSettingsPage'));
const TeachLessonPage = lazy(() => import('./pages/TeachLessonPage'));
const TeachMinePage = lazy(() => import('./pages/TeachMinePage'));

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
                <Route path="/network" element={<Layout><NetworkPage /></Layout>} />
                <Route path="/ledger" element={<Layout><LedgerPage /></Layout>} />
                <Route path="/terms" element={<Layout><TermsPage /></Layout>} />
                <Route path="/signing" element={<Layout><SigningPage /></Layout>} />
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
                <Route path="/teacher/:address" element={<Layout><TeacherPage /></Layout>} />
                <Route path="/benchmarks/:schema" element={<Layout><BenchmarkPage /></Layout>} />
                <Route path="/patch/:author/:patchId" element={<Navigate to="../" replace />} />
                <Route path="/:author/:patchId" element={<Layout><PatchPage /></Layout>} />

                {/* Operator pages (SigningCheckLayout) */}
                <Route path="/dashboard" element={<SigningCheckLayout><DashboardPage /></SigningCheckLayout>} />
                {/* signed out → public pre-screen (spec §5.2); signed in → the register form */}
                <Route path="/new-patch" element={<NewPatchGate><NewPatchPage /></NewPatchGate>} />
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

import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';

// Signed-in pages load on demand so the public landing page doesn't ship them.
const HomePage = lazy(() => import('./pages/HomePage'));
const ExamPage = lazy(() => import('./pages/ExamPage'));
const CoursePage = lazy(() => import('./pages/CoursePage'));
const PaperPage = lazy(() => import('./pages/PaperPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const SavedPage = lazy(() => import('./pages/SavedPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

import RootLayout from '@/components/layout/RootLayout';
import RequireAuth from '@/components/RequireAuth';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { BOOKMARKS_ENABLED } from '@/lib/featureFlags';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<RootLayout />}>
            {/* Public front door + only sign-in entry point. */}
            <Route index element={<LandingPage />} />
            {/* Clerk OAuth / hosted links land on these paths as full page
                loads. Vercel must serve the SPA; these routes keep React from
                rendering an empty outlet. */}
            <Route path="sign-in/*" element={<LandingPage />} />
            <Route path="sign-up/*" element={<LandingPage />} />
            {/* Everything else requires a signed-in user. */}
            <Route element={<Suspense fallback={null}><RequireAuth /></Suspense>}>
              <Route path="home" element={<HomePage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="profile" element={<ProfilePage />} />
              {BOOKMARKS_ENABLED && <Route path="saved" element={<SavedPage />} />}
              <Route path="exam/:examId" element={<ExamPage />} />
              <Route path="exam/:examId/course/:courseId" element={<CoursePage />} />
              <Route path="paper/:paperId" element={<PaperPage />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LandingPage from './pages/LandingPage';
import ExamPage from './pages/ExamPage';
import CoursePage from './pages/CoursePage';
import PaperPage from './pages/PaperPage';
import SearchPage from './pages/SearchPage';
import SavedPage from './pages/SavedPage';

import RootLayout from '@/components/layout/RootLayout';
import RequireAuth from '@/components/RequireAuth';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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
            <Route element={<RequireAuth />}>
              <Route path="home" element={<HomePage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="saved" element={<SavedPage />} />
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

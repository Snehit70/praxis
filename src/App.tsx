import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ExamPage from './pages/ExamPage';
import CoursePage from './pages/CoursePage';
import PaperPage from './pages/PaperPage';
import DebugExams from './pages/DebugExams';

import RootLayout from '@/components/layout/RootLayout';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<HomePage />} />
          <Route path="debug-exams" element={<DebugExams />} />
          <Route path="exam/:examId" element={<ExamPage />} />
          <Route path="course/:courseId" element={<CoursePage />} />
          <Route path="paper/:paperId" element={<PaperPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

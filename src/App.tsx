import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ExamPage from './pages/ExamPage';
import CoursePage from './pages/CoursePage';
import PaperPage from './pages/PaperPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground font-sans">
        <header className="border-b p-4 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-10">
          <h1 className="text-xl font-bold tracking-tight">Praxis</h1>
          <nav className="flex gap-4 text-sm font-medium">
            <a href="/" className="hover:text-primary transition-colors">Home</a>
          </nav>
        </header>
        <main className="container mx-auto p-4 md:p-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/exam/:examId" element={<ExamPage />} />
            <Route path="/course/:courseId" element={<CoursePage />} />
            <Route path="/paper/:paperId" element={<PaperPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

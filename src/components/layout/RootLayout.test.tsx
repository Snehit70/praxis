import { expect, mock, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

mock.module('@/lib/api', () => ({
  getProfile: async () => ({ avatarKey: null }),
}));

mock.module('@clerk/clerk-react', () => ({
  SignedIn: ({ children }: { children: React.ReactNode }) => children,
  SignedOut: () => null,
  SignIn: () => null,
  SignUp: () => null,
  useAuth: () => ({ isSignedIn: true, getToken: async () => null }),
  useUser: () => ({ user: { id: 'user_1' } }),
}));

const { default: RootLayout } = await import('./RootLayout');

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route path="paper/:paperId" element={<div>paper body</div>} />
          <Route path="exam/:examId" element={<div>exam body</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

test('hides the archive footer on the exam-taking page', () => {
  renderAt('/paper/40258573-d2c');
  expect(screen.getByText('paper body')).toBeInTheDocument();
  expect(screen.queryByText(/exam paper archive/i)).not.toBeInTheDocument();
});

test('keeps the archive footer on other signed-in pages', () => {
  renderAt('/exam/quiz1');
  expect(screen.getByText('exam body')).toBeInTheDocument();
  expect(screen.getByText(/exam paper archive/i)).toBeInTheDocument();
});

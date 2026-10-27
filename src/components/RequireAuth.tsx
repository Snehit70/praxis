import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { PageLoading } from '@/components/ui/page-loading';

/**
 * Route guard for everything except the public landing page. While Clerk is
 * still resolving the session we show a calm loader (avoids a flash of the
 * sign-in redirect); once resolved, signed-out visitors are sent to `/` where
 * the only sign-in entry point lives. The original path is preserved in
 * location state so a future "return to where you were" can use it.
 */
export default function RequireAuth() {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();

  if (!isLoaded) {
    return <PageLoading label="Checking your session" />;
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}

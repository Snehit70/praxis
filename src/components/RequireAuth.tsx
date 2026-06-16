import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Loader2 } from 'lucide-react';

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
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center"
        role="status"
        aria-live="polite"
        aria-label="Checking your session"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground motion-reduce:animate-none" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}

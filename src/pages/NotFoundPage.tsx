import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/** Catch-all for unknown URLs, so a typo never lands on a blank page. */
export default function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">This road doesn't lead anywhere</h1>
      <p className="mt-3 text-muted-foreground">
        The page you're looking for has moved or never existed.
      </p>
      <Button asChild className="mt-6">
        <Link to="/home">Back to courses</Link>
      </Button>
    </div>
  );
}

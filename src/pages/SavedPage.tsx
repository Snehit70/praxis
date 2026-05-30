import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import { SignInTrigger } from '@/components/auth/AuthDialog';
import { Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatePanel } from '@/components/ui/state-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { getSavedPapers, type SavedPaper } from '@/lib/api';
import { getExamSlugFromUuid } from '@/lib/examMapping';
import { getDisplayCourseName } from '@/lib/courseMapping';
import { formatPaperName } from '@/lib/paperUtils';
import { logger } from '@/lib/logger';

function paperHref(paper: SavedPaper) {
  const examSlug = getExamSlugFromUuid(paper.examUuid);
  const params = new URLSearchParams();
  if (paper.courseUuid) params.set('course', paper.courseUuid);
  if (examSlug) params.set('exam', examSlug);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return `/paper/${encodeURIComponent(paper.uuid)}${suffix}`;
}

function SavedList() {
  const { getToken } = useAuth();
  const [papers, setPapers] = useState<SavedPaper[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getSavedPapers(getToken)
      .then((rows) => {
        if (active) setPapers(rows);
      })
      .catch((error) => {
        logger.error('Failed to load saved papers', error);
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [getToken]);

  if (failed) {
    return (
      <StatePanel
        compact
        tone="error"
        title="Couldn't load your saved papers"
        description="Please try again in a moment."
        announce
      />
    );
  }

  if (papers === null) {
    return (
      <div className="space-y-3" role="status" aria-live="polite" aria-label="Loading saved papers">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <StatePanel
        compact
        title="No saved papers yet"
        description="Open a paper and tap Save to keep it here for later."
        actions={(
          <Button asChild variant="outline">
            <Link to="/search">Browse papers</Link>
          </Button>
        )}
      />
    );
  }

  return (
    <ul className="space-y-3">
      {papers.map((paper) => (
        <li key={paper.id}>
          <Link
            to={paperHref(paper)}
            className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/50"
          >
            <p className="text-sm font-medium text-primary">{paper.examName}</p>
            <p className="mt-0.5 font-semibold tracking-tight">
              {formatPaperName(paper.paperName, paper.year ?? undefined)}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {getDisplayCourseName(paper.courseName)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function SavedPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2.5">
        <Bookmark className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Saved papers</h1>
      </div>

      <SignedIn>
        <SavedList />
      </SignedIn>
      <SignedOut>
        <StatePanel
          compact
          title="Sign in to see your saved papers"
          description="Your saved papers are tied to your account, so you can find them on any device."
          actions={(
            <SignInTrigger>
              <Button>Sign in</Button>
            </SignInTrigger>
          )}
        />
      </SignedOut>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { SignedIn, SignedOut, SignInButton, useAuth } from '@clerk/clerk-react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addSavedPaper, getSavedPapers, removeSavedPaper } from '@/lib/api';
import { logger } from '@/lib/logger';

/**
 * Bookmark toggle for a paper. `paperId` is the paper_variants id (PaperDetails._id).
 * Signed-out users see a sign-in prompt instead.
 */
export function SaveButton({ paperId }: { paperId: string }) {
  const { getToken, isSignedIn } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  // Determine initial saved state for this paper.
  useEffect(() => {
    if (!isSignedIn) {
      setSaved(false);
      return;
    }
    let active = true;
    getSavedPapers(getToken)
      .then((rows) => {
        if (active) setSaved(rows.some((row) => row.id === paperId));
      })
      .catch((error) => logger.error('Failed to load saved state', error));
    return () => {
      active = false;
    };
  }, [getToken, isSignedIn, paperId]);

  const toggle = useCallback(async () => {
    setBusy(true);
    const next = !saved;
    setSaved(next); // optimistic
    try {
      if (next) {
        await addSavedPaper(paperId, getToken);
      } else {
        await removeSavedPaper(paperId, getToken);
      }
    } catch (error) {
      logger.error('Failed to toggle saved paper', error);
      setSaved(!next); // revert
    } finally {
      setBusy(false);
    }
  }, [getToken, paperId, saved]);

  return (
    <>
      <SignedIn>
        <Button
          variant={saved ? 'default' : 'outline'}
          size="sm"
          onClick={toggle}
          disabled={busy}
          aria-pressed={saved}
          className="gap-1.5"
        >
          {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          {saved ? 'Saved' : 'Save'}
        </Button>
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Bookmark className="h-4 w-4" />
            Save
          </Button>
        </SignInButton>
      </SignedOut>
    </>
  );
}

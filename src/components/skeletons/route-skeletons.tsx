import { ArrowLeft } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { CourseCardSkeleton } from '@/components/CourseCard';
import { cn } from '@/lib/utils';
import examHall from '@/assets/exam-hall.webp';

/*
 * Every loading placeholder lives here, not in the page chunks. The lazy-route
 * fallback (RouteSkeleton) and each page's own loading state render the same
 * component, so the placeholder never swaps for a different one mid-load.
 */

/**
 * Page scene: the Mage Association hall on exam day, held still behind the page.
 * The hall and sky stay clear up top; scrims only darken where text sits.
 */
export function ExamHallBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <img src={examHall} alt="" fetchPriority="high" className="h-full w-full object-cover object-[65%_30%]" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/45 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent from-30% via-background/55 via-55% to-background/85" />
    </div>
  );
}

export function PaperCardSkeleton() {
  return (
    <div className="relative flex aspect-[5/7] flex-col overflow-hidden rounded-2xl border border-[rgba(214,178,110,0.3)] bg-[#15120c]/80 p-4 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7),inset_0_0_0_1px_rgba(214,178,110,0.1)]">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <div className="flex-1" />
      <Skeleton className="h-5 w-4/5 rounded-md" />
      <Skeleton className="mt-2 h-5 w-1/2 rounded-md" />
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
      <Skeleton className="mt-3 h-9 w-full rounded-lg" />
    </div>
  );
}

export function BundlesSkeleton() {
  return (
    <div className="space-y-12">
      {[4, 3].map((cards, section) => (
        <section key={section} className="space-y-4">
          <div className="flex items-end justify-between gap-4 border-b border-white/15 pb-2">
            <Skeleton className="h-7 w-48 rounded-md" />
            <Skeleton className="h-3 w-12 rounded-full" />
          </div>
          <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: cards }, (_, i) => (
              <PaperCardSkeleton key={i} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function CourseLoadingSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <SkeletonRegion label="Loading paper bundles" tone="glass" className="relative isolate space-y-8">
      <ExamHallBackdrop />
      <header className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 -ml-2 text-white/75 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3.5">
              <Skeleton className="hidden h-14 w-14 shrink-0 rounded-2xl sm:block" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-24 rounded-full" />
                <Skeleton className="h-10 w-64 rounded-lg sm:h-12 sm:w-80" />
                <Skeleton className="h-3.5 w-40 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-11 w-56 rounded-xl" />
          </div>
          <Skeleton className="h-11 w-full rounded-xl md:w-72" />
        </div>
      </header>
      <BundlesSkeleton />
    </SkeletonRegion>
  );
}

/**
 * The Mage Association hall from the course page, carried into the paper so
 * the walk in feels continuous. `dim` softens it further while a run is open.
 */
export function HallBackdrop({ dim = false }: { dim?: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <img
        src={examHall}
        alt=""
        fetchPriority="high"
        className={cn('h-full w-full object-cover object-[65%_30%]', dim && 'scale-105 blur-[3px]')}
      />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/45 to-transparent" />
      <div className={cn('absolute inset-0', dim ? 'bg-[#0b1020]/72' : 'bg-[#0b1020]/35')} />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent from-40% to-[#0b1020]/80" />
    </div>
  );
}

/**
 * Stand-in for the cover briefing (the page a paper opens on): the same hall,
 * the same two-page tome, with the briefing and the run choice still blank.
 */
export function PaperLoadingSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <SkeletonRegion label="Loading paper" tone="glass" className="relative isolate flex min-h-[calc(100vh-14rem)] w-full flex-col">
      <HallBackdrop />
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-sm text-white/75 transition-colors [text-shadow:0_1px_8px_rgba(0,0,0,0.6)] hover:bg-white/10 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to papers
      </button>
      <div className="flex flex-1 items-center justify-center py-6">
        <div className="exam-tome relative isolate grid w-full max-w-4xl overflow-hidden rounded-2xl border border-[rgb(var(--ex-line)/0.24)] backdrop-blur-sm lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div aria-hidden="true" className="hidden min-h-[26rem] bg-black/25 lg:block" />
          <div className="relative z-10 flex flex-col px-6 py-8 sm:px-10 sm:py-10">
            <Skeleton className="h-3 w-40 rounded-full" />
            <Skeleton className="mt-2.5 h-3.5 w-28 rounded-full" />
            <Skeleton className="mt-3 h-10 w-4/5 rounded-lg sm:h-12" />
            <div className="mt-7 flex gap-8">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-8 w-10 rounded-md" />
                  <Skeleton className="h-3 w-16 rounded-full" />
                </div>
              ))}
            </div>
            <div className="mt-8 space-y-3">
              <Skeleton className="h-[74px] w-full rounded-xl" />
              <Skeleton className="h-[74px] w-full rounded-xl" />
            </div>
            <div className="mt-5 flex gap-2">
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="h-9 w-36 rounded-lg" />
            </div>
          </div>
          <div className="tcard-frame" aria-hidden="true" />
          <span className="tcard-corner tcard-corner-tl" aria-hidden="true" />
          <span className="tcard-corner tcard-corner-tr" aria-hidden="true" />
          <span className="tcard-corner tcard-corner-bl" aria-hidden="true" />
          <span className="tcard-corner tcard-corner-br" aria-hidden="true" />
        </div>
      </div>
    </SkeletonRegion>
  );
}

/**
 * Stand-in for the attempt report, used when the saved run is already handed
 * in: the page opens straight onto the report, so the cover tome would flash
 * the wrong page.
 */
export function PaperReportSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <SkeletonRegion label="Loading your report" tone="glass" className="relative isolate w-full">
      <HallBackdrop />
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-sm text-white/75 transition-colors [text-shadow:0_1px_8px_rgba(0,0,0,0.6)] hover:bg-white/10 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to papers
      </button>
      <div className="mx-auto mt-6 max-w-[1180px] space-y-5 pb-10">
        <div className="exam-tome relative isolate overflow-hidden rounded-2xl border border-[rgb(var(--ex-line)/0.24)] px-5 pb-5 pt-6 backdrop-blur-sm sm:px-8 sm:pb-7 sm:pt-8">
          {/* Mirrors AttemptReport's hero: eyebrow, score, verdict, outcome bar, figures, actions. */}
          <Skeleton className="h-3 w-48 rounded-full" />
          <Skeleton className="mt-5 h-14 w-56 rounded-lg sm:h-16" />
          <Skeleton className="mt-3 h-5 w-72 max-w-full rounded-full" />
          <Skeleton className="mt-6 h-2 w-full rounded-full" />
          <Skeleton className="mt-3 h-4 w-64 max-w-full rounded-full" />
          <Skeleton className="mt-4 h-4 w-80 max-w-full rounded-full" />
          <div className="mt-6 flex gap-2 border-t border-white/[0.07] pt-5">
            <Skeleton className="h-9 w-44 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
          <div className="tcard-frame" aria-hidden="true" />
          <span className="tcard-corner tcard-corner-tl" aria-hidden="true" />
          <span className="tcard-corner tcard-corner-tr" aria-hidden="true" />
          <span className="tcard-corner tcard-corner-bl" aria-hidden="true" />
          <span className="tcard-corner tcard-corner-br" aria-hidden="true" />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </div>
    </SkeletonRegion>
  );
}

export function ExamLoadingSkeleton({ examName }: { examName: string | null }) {
  return (
    <SkeletonRegion label="Loading exam courses" className="space-y-8">
      <header className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-muted-foreground">
          <Link to="/home">
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </Button>
        <div>
          <p className="text-sm font-medium text-primary">{examName}</p>
          <h1 className="text-3xl font-bold tracking-tight mt-1">Courses</h1>
        </div>
      </header>

      <div className="space-y-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border-l-4 border-l-muted pl-4 md:pl-6">
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-24 mb-4" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

export function CourseGridSkeleton({ label, count = 3 }: { label: string; count?: number }) {
  return (
    <SkeletonRegion label={label} tone="glass" className="space-y-5">
      <Skeleton className="h-4 w-56 rounded-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <CourseCardSkeleton key={i} />
        ))}
      </div>
    </SkeletonRegion>
  );
}

export function SearchSkeleton() {
  return (
    <SkeletonRegion label="Loading search results" className="space-y-8">
      {[1, 2].map((section) => (
        <div key={section} className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <div className="grid gap-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="rounded-xl border border-border bg-card p-4">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}

export function ProfileLoadingSkeleton() {
  const card = 'squircle overflow-hidden rounded-3xl border border-white/10 bg-[#0d1220]/75 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl md:p-7';
  // Same header geometry and card frames as the loaded page, so the scene
  // stays put and only the blanks fill in.
  return (
    <SkeletonRegion label="Loading your profile" tone="glass" className="relative isolate pb-16">
      <section className="relative isolate overflow-hidden">
        <div className="h-[72px] w-full sm:h-[clamp(200px,28vh,280px)]" />
        <div className="relative -mt-10 sm:absolute sm:inset-x-0 sm:bottom-0 sm:mt-0">
          <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 sm:flex-row sm:items-end sm:justify-between sm:pb-6 md:px-8">
            <div className="min-w-0">
              <Skeleton className="mb-4 h-5 w-32 rounded-md" />
              <div className="flex items-end gap-4 md:gap-5">
              <Skeleton className="squircle size-20 shrink-0 rounded-[1.75rem] md:size-24" />
              <div className="space-y-2.5 pb-0.5">
                <Skeleton className="h-10 w-56 rounded-lg md:h-12 md:w-72" />
                <Skeleton className="h-4 w-64 rounded-full md:w-80" />
                <Skeleton className="h-3 w-48 rounded-full" />
              </div>
            </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-32 rounded-xl" />
              <Skeleton className="h-9 w-28 rounded-xl" />
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto grid max-w-6xl items-start gap-6 px-4 pt-4 md:px-8 lg:grid-cols-2">
        {[0, 1].map((panel) => (
          <section key={panel} className={card}>
            <div className="flex items-end justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20 rounded-full" />
                <Skeleton className="h-7 w-44 rounded-md" />
              </div>
              <Skeleton className="h-8 w-24 rounded-xl" />
            </div>
            <div className="mt-4 space-y-1 border-t border-white/10 pt-2">
              {Array.from({ length: panel === 0 ? 4 : 2 }, (_, row) => (
                <div key={row} className="flex items-center gap-4 py-3">
                  <Skeleton className="squircle size-11 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4 rounded-full" />
                    <Skeleton className="h-3 w-1/3 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </SkeletonRegion>
  );
}

export function SavedLoadingSkeleton() {
  return (
    <SkeletonRegion label="Loading saved papers" className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-3.5 w-24 rounded-full" />
          <Skeleton className="mt-2 h-5 w-2/3 rounded-md" />
          <Skeleton className="mt-2 h-3.5 w-1/3 rounded-full" />
        </div>
      ))}
    </SkeletonRegion>
  );
}

/** Route-aware fallback: the same placeholder the page itself would show. */
export function RouteSkeleton({ label = 'Loading' }: { label?: string }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const back = () => navigate(-1);

  if (pathname.startsWith('/paper/')) return <PaperLoadingSkeleton onBack={back} />;
  if (pathname.includes('/course/')) return <CourseLoadingSkeleton onBack={back} />;
  if (/^\/exam\/[^/]+$/.test(pathname)) return <ExamLoadingSkeleton examName={null} />;
  if (pathname.startsWith('/profile')) return <ProfileLoadingSkeleton />;
  if (pathname.startsWith('/search')) return <SearchSkeleton />;
  if (pathname.startsWith('/saved')) return <SavedLoadingSkeleton />;
  return (
    <div className="container mx-auto px-4 py-10 md:px-8">
      <CourseGridSkeleton label={label} />
    </div>
  );
}

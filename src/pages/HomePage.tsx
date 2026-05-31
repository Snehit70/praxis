import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useUser, UserButton } from '@clerk/clerk-react';
import { ArrowRight, BookMarked, BookOpen, Clock, Pencil, Plus, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CourseCard } from '@/components/CourseCard';
import { CourseSelector } from '@/components/CourseSelector';
import { useEnrolledCourses } from '@/hooks/useEnrolledCourses';
import { getAllCourses, getHistory, type CatalogueCourse, type HistoryItem } from '@/lib/api';
import { buildCatalogue, LEVEL_META, type CatalogueEntry } from '@/lib/courseCatalogue';
import { getDisplayCourseName, LEVEL_ORDER, type CourseLevel } from '@/lib/courseMapping';
import { getExamSlugFromUuid } from '@/lib/examMapping';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

/**
 * Frieren's voice, keyed to the local clock — the measured, slightly dry-warm
 * register of someone who has walked this road many times and always returns.
 * One fixed line per part of day (no random quips): calm, won't wear out.
 */
function roadLine(date = new Date()): string {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Early on the road today.';
  if (h >= 12 && h < 17) return "The road's still here. So are you.";
  if (h >= 17 && h < 22) return 'Still walking. Good.';
  return "Late. The road doesn't mind.";
}

/** Build the in-app paper route for a viewed-history item (mirrors SavedPage). */
function historyHref(item: HistoryItem): string {
  const examSlug = getExamSlugFromUuid(item.examUuid);
  const params = new URLSearchParams();
  if (item.courseUuid) params.set('course', item.courseUuid);
  if (examSlug) params.set('exam', examSlug);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return `/paper/${encodeURIComponent(item.uuid)}${suffix}`;
}

/**
 * Asset filenames contain spaces / commas / unicode, which break plain ES
 * imports — resolve them through Vite's glob and look them up by name (same
 * pattern as the landing page).
 */
const assetUrls = import.meta.glob('../assets/*', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const asset = (name: string): string => {
  const hit = Object.entries(assetUrls).find(([path]) => path.endsWith('/' + name));
  return hit?.[1] ?? '';
};

// Header banner: "the road you return to" — Frieren kneeling in a golden field
// (Ep.11), web-optimized to webp. Continuity with the landing/sign-in: Himmel
// handed you off, Frieren is the companion you travel with now. Greeting sits
// over the open field to the lower-left; CSS object-cover keeps her centered.
const headerImg = asset('home-road.webp');
// Empty state: a quiet, contemplative frame inviting the first selection.
const emptyArt = asset('feature-frieren-pray.jpeg');
// Page backdrop: the Ep.18 First-Class Mage Exam frame held behind the whole
// dashboard — the test ahead is the ground you stand on. webp, dimmed enough to
// keep the dark UI legible but present enough to actually read (DESIGN.md).
const pageBg = asset('home-ground.webp');

/** Frosted-glass control styling for use over imagery (DESIGN.md secondary CTA). */
const glassControl =
  'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50';

function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading your courses">
      <Skeleton className="h-[clamp(360px,48vh,520px)] w-full" />
      <div className="container mx-auto space-y-6 px-4 py-6 md:px-8 md:py-8">
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const {
    level,
    courseKeys,
    enrolled,
    loading: enrollLoading,
    failed: enrollFailed,
    saving,
    save,
    reload,
  } = useEnrolledCourses();

  const [catalogue, setCatalogue] = useState<CatalogueEntry[] | null>(null);
  const [catalogueFailed, setCatalogueFailed] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);
  const [archiveQuery, setArchiveQuery] = useState('');
  const [resume, setResume] = useState<HistoryItem | null>(null);

  useEffect(() => {
    logger.info('Dashboard mounted');
    const controller = new AbortController();
    getAllCourses({ signal: controller.signal })
      .then((rows: CatalogueCourse[]) => setCatalogue(buildCatalogue(rows)))
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        logger.error('Failed to load course catalogue', error);
        setCatalogueFailed(true);
      });
    return () => controller.abort();
  }, []);

  // Resume affordance: surface the most recently viewed paper as "where you left
  // off". Best-effort — a failure just hides the line, never blocks the page.
  useEffect(() => {
    let active = true;
    getHistory(getToken)
      .then((rows) => {
        if (!active || rows.length === 0) return;
        const latest = [...rows].sort(
          (a, b) => (b.viewedAt ?? '').localeCompare(a.viewedAt ?? ''),
        )[0];
        if (latest?.viewedAt) setResume(latest);
      })
      .catch((error) => logger.debug('No resume history', error));
    return () => {
      active = false;
    };
  }, [getToken]);

  // First-time setup: if the catalogue and enrollment have both loaded and the
  // user has no courses yet, open the selector once.
  useEffect(() => {
    if (autoOpened) return;
    if (catalogue && !enrollLoading && !enrollFailed && courseKeys.length === 0) {
      setSelectorOpen(true);
      setAutoOpened(true);
    }
  }, [autoOpened, catalogue, enrollLoading, enrollFailed, courseKeys.length]);

  const enrolledCourses = useMemo(
    () => (catalogue ?? []).filter((entry) => enrolled.has(entry.key)),
    [catalogue, enrolled],
  );

  const archiveByLevel = useMemo(() => {
    const q = archiveQuery.trim().toLowerCase();
    const groups = {} as Record<CourseLevel, CatalogueEntry[]>;
    for (const lvl of LEVEL_ORDER) groups[lvl] = [];
    for (const entry of catalogue ?? []) {
      if (q && !entry.displayName.toLowerCase().includes(q) && !entry.courseCode.toLowerCase().includes(q)) {
        continue;
      }
      groups[entry.level].push(entry);
    }
    return groups;
  }, [catalogue, archiveQuery]);

  const archiveTotal = LEVEL_ORDER.reduce((sum, lvl) => sum + archiveByLevel[lvl].length, 0);

  const handleToggleEnroll = (course: CatalogueEntry) => {
    const next = new Set(enrolled);
    if (next.has(course.key)) next.delete(course.key);
    else next.add(course.key);
    void save({ level, courseKeys: Array.from(next) });
  };

  const handleSaveSelection = async (payload: { level: string | null; courseKeys: string[] }) => {
    const ok = await save(payload);
    if (ok) setSelectorOpen(false);
  };

  if (catalogueFailed) {
    return (
      <div className="container mx-auto px-4 py-10 md:px-8">
        <StatePanel
          tone="error"
          title="Couldn't load courses"
          description="We couldn't reach the course catalogue. Please try again in a moment."
          actions={<Button onClick={() => window.location.reload()}>Reload</Button>}
          announce
        />
      </div>
    );
  }

  if (!catalogue || enrollLoading) {
    return <DashboardSkeleton />;
  }

  const greetingName = user?.firstName?.trim();

  return (
    <div className="relative isolate">
      {/* Page backdrop — the soft Ep.18 exam frame held faintly behind the
          dashboard as cinematic ground. Dimmed hard (near-solid by the lower
          half) so it's only a whisper of warmth, never a prominent blob. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <img src={pageBg} alt="" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/55 via-background/72 to-background/84" />
      </div>

      <Tabs defaultValue="mine">
        {/* ── Full-bleed cinematic hero — absorbs the top nav (no separate bar):
            Praxis + account sit over the image, greeting lower-left, the section
            tabs lower-right, so the whole page stays compact. ── */}
        <header className="relative w-full overflow-hidden">
          <div className="relative h-[clamp(360px,48vh,520px)] w-full">
            <img
              src={headerImg}
              alt=""
              aria-hidden="true"
              fetchPriority="high"
              className="animate-kenburns absolute inset-0 h-full w-full object-cover object-center"
            />
            {/* Legibility scrims: strong floor (greeting + tabs), top (nav), left. */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-background/75 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/55 via-transparent to-transparent" />

            {/* Top row — Praxis left, actions + account right (the old navbar). */}
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-4 md:px-8 md:py-5">
              <Link
                to="/"
                className="flex items-center gap-2.5 text-foreground transition-opacity hover:opacity-80 [text-shadow:0_1px_10px_rgba(0,0,0,0.7)]"
              >
                <BookOpen className="h-5 w-5 text-primary" />
                <span className="text-lg font-semibold tracking-tight">Praxis</span>
              </Link>
              <div className="flex items-center gap-2">
                <Link to="/saved" className={glassControl}>
                  <BookMarked className="h-4 w-4" />
                  <span className="hidden sm:inline">Saved</span>
                </Link>
                <button type="button" onClick={() => setSelectorOpen(true)} className={glassControl}>
                  <Pencil className="h-4 w-4" />
                  <span className="hidden sm:inline">Edit courses</span>
                </button>
                <UserButton afterSignOutUrl="/" />
              </div>
            </div>

            {/* Bottom cluster — greeting (left) + section tabs (right). */}
            <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-4 p-5 md:flex-row md:items-end md:justify-between md:p-8">
              <div className="max-w-xl">
                <h1 className="font-display text-3xl font-normal leading-[1.05] tracking-tight text-foreground sm:text-4xl md:text-5xl">
                  {greetingName ? `There you are, ${greetingName}` : 'There you are'}
                </h1>
                {/* Frieren's voice — keyed to the time of day (calm, fixed lines). */}
                <p className="mt-1.5 font-display text-lg italic leading-snug text-foreground/85 sm:text-xl">
                  {roadLine()}
                </p>
                {/* Resume — pick up the last paper you were on, if any. */}
                {resume && (
                  <Link
                    to={historyHref(resume)}
                    className="group mt-2 inline-flex items-center gap-1.5 text-sm"
                  >
                    <span className="font-medium text-primary transition-colors group-hover:text-primary/80">
                      Last on the road
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-primary transition-transform group-hover:translate-x-0.5" />
                    <span className="text-foreground/85">
                      {getDisplayCourseName(resume.courseName)}
                      {resume.examName ? ` · ${resume.examName}` : ''}
                    </span>
                  </Link>
                )}
              </div>

              <TabsList className="inline-flex gap-1 self-start rounded-lg border border-white/15 bg-black/35 p-1 backdrop-blur-md md:self-auto">
                <TabsTrigger
                  value="mine"
                  className="rounded-md px-4 py-1.5 text-sm text-white/80 transition-colors data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Companions
                </TabsTrigger>
                <TabsTrigger
                  value="archive"
                  className="rounded-md px-4 py-1.5 text-sm text-white/80 transition-colors data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  The World
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
        </header>

        {/* ── Content below the hero ── */}
        <div className="container mx-auto px-4 py-6 md:px-8 md:py-8">

        {/* Companions — the courses you travel with this term. */}
        <TabsContent value="mine" className="space-y-4">
          {enrolledCourses.length > 0 && (
            <p className="text-sm text-muted-foreground">
              The courses you&apos;re taking this term.
            </p>
          )}
          {enrolledCourses.length === 0 ? (
            <div className="relative flex min-h-[380px] overflow-hidden rounded-2xl border border-border md:min-h-[440px]">
              <img
                src={emptyArt}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
              {/* Dark on the text side, image breathing on the right. */}
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/30" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
              <div className="relative z-10 flex max-w-lg flex-col justify-center p-8 md:p-12">
                <h2 className="font-display text-3xl font-normal tracking-tight text-foreground md:text-4xl">
                  Your journey starts here
                </h2>
                <p className="mt-3 max-w-md text-pretty leading-relaxed text-muted-foreground">
                  Add the courses you&apos;re taking this term and they&apos;ll live here for quick
                  practice — sit any past paper, review it, and arrive at the exam already ready.
                </p>
                <div className="mt-6">
                  <Button size="lg" onClick={() => setSelectorOpen(true)} className="gap-1.5 shadow-lg shadow-primary/20">
                    <Plus className="h-4 w-4" />
                    Choose your courses
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* Companions tiles are clean — no per-tile toggle; manage via Edit courses. */}
              {enrolledCourses.map((course) => (
                <CourseCard key={course.key} course={course} enrolled />
              ))}
            </div>
          )}
        </TabsContent>

        {/* The World — every course in the archive; roads not yet walked. */}
        <TabsContent value="archive" className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Every course in the archive — roads you haven&apos;t walked yet.
          </p>
          <div className="relative max-w-md">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={archiveQuery}
              onChange={(event) => setArchiveQuery(event.target.value)}
              placeholder="Search all courses..."
              autoComplete="off"
              aria-label="Search all courses"
              className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {archiveQuery && (
              <button
                type="button"
                onClick={() => setArchiveQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {archiveTotal === 0 ? (
            <StatePanel
              dashed
              icon={<Search className="h-10 w-10 text-muted-foreground/70" />}
              title="No courses match"
              description="Try a broader course name or code."
            />
          ) : (
            <div className="space-y-10">
              {LEVEL_ORDER.map((lvl) => {
                const entries = archiveByLevel[lvl];
                if (entries.length === 0) return null;
                const meta = LEVEL_META[lvl];
                return (
                  <section key={lvl} className={`border-l-4 ${meta.accent} pl-4 md:pl-6`}>
                    <div className="mb-4 flex items-center gap-3">
                      <img
                        src={meta.image}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        className={cn('h-9 w-9 rounded-lg object-cover object-top ring-2', meta.ring)}
                      />
                      <div>
                        <h2 className={cn('text-lg font-semibold', meta.text)}>{meta.label}</h2>
                        <p className="text-sm text-muted-foreground">
                          {entries.length} {entries.length === 1 ? 'course' : 'courses'}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {entries.map((course) => (
                        <CourseCard
                          key={course.key}
                          course={course}
                          enrolled={enrolled.has(course.key)}
                          onToggleEnroll={handleToggleEnroll}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </TabsContent>
        </div>
      </Tabs>

      {enrollFailed && (
        <p className="container mx-auto px-4 pb-6 text-sm text-muted-foreground md:px-8" role="status">
          <Clock className="mr-1 inline h-3.5 w-3.5" />
          We couldn&apos;t load your saved courses.{' '}
          <button type="button" onClick={reload} className="text-primary hover:underline">
            Retry
          </button>
        </p>
      )}

      {selectorOpen && (
        <CourseSelector
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
          catalogue={catalogue}
          initialLevel={level}
          initialCourseKeys={courseKeys}
          saving={saving}
          mandatory={courseKeys.length === 0 && !enrollFailed}
          onSave={handleSaveSelection}
        />
      )}
    </div>
  );
}

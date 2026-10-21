import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useUser, UserButton } from '@clerk/clerk-react';
import { ArrowRight, BookMarked, Clock, Pencil, Plus, Search, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { SearchField } from '@/components/ui/search-field';
import { SEGMENTED_LIST, SEGMENTED_TRIGGER } from '@/components/ui/segmented';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CourseCard, CourseCardSkeleton } from '@/components/CourseCard';
import { PraxisBrand } from '@/components/PraxisBrand';
import { CourseSelector } from '@/components/CourseSelector';
import { Reveal } from '@/components/Reveal';
import { useEnrolledCourses } from '@/hooks/useEnrolledCourses';
import { useScrollParallax } from '@/hooks/useScrollParallax';
import { getAllCourses, getHistory, type CatalogueCourse, type HistoryItem } from '@/lib/api';
import { buildCatalogue, LEVEL_META, type CatalogueEntry } from '@/lib/courseCatalogue';
import { getDisplayCourseName, LEVEL_ORDER, type CourseLevel } from '@/lib/courseMapping';
import { getExamSlugFromUuid } from '@/lib/examMapping';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { BOOKMARKS_ENABLED } from '@/lib/featureFlags';

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
// Empty state: a quiet, contemplative frame inviting the first selection.
const emptyArt = asset('feature-frieren-pray.jpeg');
// Full-page scene: a crossroads at early afternoon, Frieren, Fern and Stark resting
// by the signpost while the roads (your courses) fan out under the cards.
const sceneImg = asset('home-scene.webp');

// Shared content column so hero chrome, greeting and the card grid line up.
const column = 'mx-auto w-full max-w-6xl px-4 md:px-8';

/** Inline `--rise-i` style so an element takes its place in the stagger cascade. */
const rise = (i: number) => ({ '--rise-i': i }) as React.CSSProperties;

/** Card grid stand-in while the catalogue and enrollments load; the scene,
 *  header and greeting are already real by then. */
function CourseGridSkeleton({ label, count = 3 }: { label: string; count?: number }) {
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
  const pendingEnrolled = useRef(new Set<string>());
  // Slow scroll-parallax on the fixed page backdrop (desktop, motion-safe only).
  const bgParallaxRef = useScrollParallax<HTMLImageElement>();

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

  useEffect(() => {
    if (!saving) pendingEnrolled.current = new Set(courseKeys);
  }, [courseKeys, saving]);

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
    const next = new Set(pendingEnrolled.current);
    if (next.has(course.key)) next.delete(course.key);
    else next.add(course.key);
    pendingEnrolled.current = next;
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

  const booting = !catalogue || enrollLoading;
  const greetingName = user?.firstName?.trim();

  return (
    <div className="relative isolate">
      {/* One continuous scene behind the whole dashboard: open sky over the
          greeting, the party at the signpost on the right, and the meadow
          under the cards. Fixed so long lists keep the same ground; the floor
          scrim deepens only where cards sit. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
        <img
          ref={bgParallaxRef}
          src={sceneImg}
          alt=""
          fetchPriority="high"
          className="absolute inset-x-0 -top-[6%] h-[112%] w-full object-cover object-[62%_40%] will-change-transform"
          style={{ transform: 'translate3d(0, var(--scroll-shift, 0px), 0)' }}
        />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/45 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/35 via-transparent to-transparent" />
        {/* Dusk over the open sky where the greeting and tabs sit: the haze there
            is the palest part of the painting, so light text washed out. Fades
            before the tree and the party on the right. */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_20%_36%,rgb(10_16_32/0.6),rgb(10_16_32/0.25)_55%,transparent_80%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent from-35% via-background/40 via-60% to-background/80" />
      </div>

      {/* Same bar as every other page (RootLayout): glass over the scene,
          container width, quiet text links. */}
      <header className="sticky top-0 z-50 bg-black/20 backdrop-blur-md">
        <div className="container relative mx-auto flex h-14 items-center px-4 md:px-8">
          <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <PraxisBrand className="text-[#f1ead9]" />
          </Link>
          <nav className="ml-auto flex items-center gap-4">
            {BOOKMARKS_ENABLED && (
              <Link to="/saved" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
                <BookMarked className="h-4 w-4" />
                <span className="hidden sm:inline">Saved papers</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => setSelectorOpen(true)}
              disabled={!catalogue}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white/90 transition-colors hover:text-white disabled:pointer-events-none disabled:opacity-50"
            >
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Companions</span>
            </button>
            <Link to="/profile" className="inline-flex items-center gap-1.5 text-sm font-medium text-white/90 transition-colors hover:text-white">
              <UserRound className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </Link>
            <UserButton afterSignOutUrl="/" userProfileMode="navigation" userProfileUrl="/profile" />
          </nav>
        </div>
      </header>

      <Tabs defaultValue="mine">
        {/* ── Hero: the greeting on the open sky of the page scene. ── */}
        <section className="relative w-full">
          <div className="relative h-[clamp(244px,calc(40vh-56px),384px)] w-full">
            {/* Bottom cluster — greeting on the open field (tabs live below the hero). */}
            <div className={cn(column, 'absolute inset-x-0 bottom-0 z-10 flex flex-col gap-4 pb-6 md:flex-row md:items-end md:justify-between md:pb-8')}>
              <Reveal className="max-w-xl">
                <h1 style={rise(0)} className="praxis-rise font-display text-3xl font-normal leading-[1.05] tracking-tight text-foreground sm:text-4xl md:text-5xl">
                  {greetingName ? `There you are, ${greetingName}` : 'There you are'}
                </h1>
                {/* Frieren's voice — keyed to the time of day (calm, fixed lines). */}
                <p style={rise(1)} className="praxis-rise mt-1.5 font-display text-lg italic leading-snug text-foreground/85 sm:text-xl">
                  {roadLine()}
                </p>
                {/* Resume — pick up the last paper you were on, if any. */}
                {resume && (
                  <Link
                    to={historyHref(resume)}
                    style={rise(2)}
                    className="praxis-rise group mt-2 inline-flex items-center gap-1.5 text-sm [text-shadow:0_1px_10px_rgb(0_0_0/0.5)]"
                  >
                    <span className="font-semibold text-white underline-offset-4 group-hover:underline">
                      Last on the road
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-white drop-shadow transition-transform group-hover:translate-x-0.5" />
                    <span className="text-white/85">
                      {getDisplayCourseName(resume.courseName)}
                      {resume.examName ? ` · ${resume.examName}` : ''}
                    </span>
                  </Link>
                )}
              </Reveal>

            </div>
          </div>
        </section>

        {/* ── Content below the hero ── */}
        <div className={cn(column, 'py-6 md:py-8')}>
          <div className="mb-6 flex items-center justify-between gap-4">
          <TabsList className={SEGMENTED_LIST}>
            <TabsTrigger
              value="mine"
              className={SEGMENTED_TRIGGER}
            >
              Companions
              {!booting && enrolledCourses.length > 0 && (
                <span
                  aria-label={`${enrolledCourses.length} ${enrolledCourses.length === 1 ? 'course' : 'courses'} this term`}
                  className="ml-2 inline-flex min-w-5 items-center justify-center rounded-md bg-current/15 px-1.5 text-xs font-semibold tabular-nums"
                >
                  {enrolledCourses.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="archive"
              className={SEGMENTED_TRIGGER}
            >
              The World
            </TabsTrigger>
          </TabsList>
          </div>

        {/* Companions — the courses you travel with this term. */}
        <TabsContent value="mine" className="space-y-5">
          {booting ? (
            <CourseGridSkeleton label="Loading your courses" />
          ) : (
            <>
              {enrolledCourses.length === 0 ? (
                <div className="squircle relative flex min-h-[380px] overflow-hidden rounded-3xl border border-border md:min-h-[440px]">
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
                <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Companions tiles are clean — no per-tile toggle; manage via the Companions button. */}
                  {enrolledCourses.map((course, i) => (
                    <CourseCard key={course.key} course={course} enrolled revealIndex={i} />
                  ))}
                </Reveal>
              )}
            </>
          )}
        </TabsContent>

        {/* The World — every course in the archive; roads not yet walked. */}
        <TabsContent value="archive" className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Every course in the archive — roads you haven&apos;t walked yet.
          </p>
          <SearchField
            value={archiveQuery}
            onChange={setArchiveQuery}
            placeholder="Search all courses..."
            label="Search all courses"
            className="max-w-md"
          />

          {booting ? (
            <CourseGridSkeleton label="Loading the archive" count={6} />
          ) : archiveTotal === 0 ? (
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
                    <Reveal>
                      {/* Header leads its grid in the reveal cascade. */}
                      <div style={rise(0)} className="praxis-rise mb-4 flex items-center gap-3">
                        <img
                          src={meta.image}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          className={cn('squircle h-9 w-9 rounded-xl object-cover object-top ring-2', meta.ring)}
                        />
                        <div>
                          <h2 className={cn('text-lg font-semibold', meta.text)}>{meta.label}</h2>
                          <p className="text-sm text-muted-foreground">
                            {entries.length} {entries.length === 1 ? 'course' : 'courses'}
                          </p>
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {entries.map((course, i) => (
                          <CourseCard
                            key={course.key}
                            course={course}
                            enrolled={enrolled.has(course.key)}
                            onToggleEnroll={handleToggleEnroll}
                            revealIndex={i + 1}
                          />
                        ))}
                      </div>
                    </Reveal>
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

      {selectorOpen && catalogue && (
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

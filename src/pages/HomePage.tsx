import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { BookMarked, Clock, Pencil, Plus, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CourseCard } from '@/components/CourseCard';
import { CourseSelector } from '@/components/CourseSelector';
import { useEnrolledCourses } from '@/hooks/useEnrolledCourses';
import { getAllCourses, type CatalogueCourse } from '@/lib/api';
import { buildCatalogue, LEVEL_META, type CatalogueEntry } from '@/lib/courseCatalogue';
import { LEVEL_ORDER, type CourseLevel } from '@/lib/courseMapping';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

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

// Header banner: Frieren under an open sky — the source portrait rotated to a
// 16:9 landscape so the full frame shows in the banner without cropping.
const headerImg = asset('Frieren-banner.jpeg');
// Empty state: a quiet, contemplative frame inviting the first selection.
const emptyArt = asset('feature-frieren-pray.jpeg');
// Page backdrop: a soft, light-filled Ep.18 frame held behind the whole
// dashboard — dimmed so the dark UI stays legible (DESIGN.md image-first).
const pageBg = asset('Sousou no Frieren - Ep. 18_ First-Class Mage Exam - 00_00.png');

/** Frosted-glass control styling for use over imagery (DESIGN.md secondary CTA). */
const glassControl =
  'inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50';

function DashboardSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-live="polite" aria-label="Loading your courses">
      <div className="mx-auto w-full max-w-4xl">
        <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
      </div>
      <Skeleton className="h-9 w-72" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user } = useUser();
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
      <StatePanel
        tone="error"
        title="Couldn't load courses"
        description="We couldn't reach the course catalogue. Please try again in a moment."
        actions={<Button onClick={() => window.location.reload()}>Reload</Button>}
        announce
      />
    );
  }

  if (!catalogue || enrollLoading) {
    return <DashboardSkeleton />;
  }

  const greetingName = user?.firstName?.trim();
  const levelLabel = level ? (LEVEL_META[level as CourseLevel]?.label ?? level) : null;

  return (
    <div className="relative isolate space-y-8">
      {/* Page backdrop — a soft, light-filled frame held still behind the whole
          dashboard so it reads as cinematic ground; dimmed for legibility. The
          `isolate` + `-z-10` keeps it above the app's opaque background but
          below the content, without affecting other routes. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <img src={pageBg} alt="" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/88 to-background/95" />
      </div>

      {/* Header banner — a contained card whose 16:9 frame matches the image's
          aspect ratio, so Frieren is shown in full with no crop. The greeting
          sits over the lower edge; the page backdrop breathes around it. */}
      <header>
        <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-border shadow-xl shadow-black/30">
          <div className="aspect-[16/9] w-full">
            <img
              src={headerImg}
              alt=""
              aria-hidden="true"
              fetchPriority="high"
              className="animate-kenburns h-full w-full object-cover object-center"
            />
          </div>
          {/* Legibility scrims for the overlaid greeting. */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/10 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/40 via-transparent to-transparent" />

          {/* Actions — glass over the image, top-right. */}
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
            <Link to="/saved" className={glassControl}>
              <BookMarked className="h-4 w-4" />
              <span className="hidden sm:inline">Saved</span>
            </Link>
            <button type="button" onClick={() => setSelectorOpen(true)} className={glassControl}>
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Edit courses</span>
            </button>
          </div>

          {/* Greeting — pinned to the bottom of the banner. */}
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 md:p-8">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              IITM BS · This term
            </p>
            <h1 className="font-display text-3xl font-normal leading-[1.05] tracking-tight text-foreground sm:text-4xl md:text-5xl">
              {greetingName ? `Welcome back, ${greetingName}` : 'Welcome back'}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
              {levelLabel ? `${levelLabel} · ` : ''}
              {enrolledCourses.length} {enrolledCourses.length === 1 ? 'course' : 'courses'} this term
            </p>
          </div>
        </div>
      </header>

      <Tabs defaultValue="mine" className="space-y-6">
        <TabsList className="inline-flex gap-1 rounded-lg border border-border bg-card p-1">
          <TabsTrigger
            value="mine"
            className="rounded-md px-4 py-1.5 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            My Courses
          </TabsTrigger>
          <TabsTrigger
            value="archive"
            className="rounded-md px-4 py-1.5 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Archives
          </TabsTrigger>
        </TabsList>

        {/* My Courses */}
        <TabsContent value="mine">
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
              {enrolledCourses.map((course) => (
                <CourseCard
                  key={course.key}
                  course={course}
                  enrolled
                  onToggleEnroll={handleToggleEnroll}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Archives */}
        <TabsContent value="archive" className="space-y-6">
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
      </Tabs>

      {enrollFailed && (
        <p className="text-sm text-muted-foreground" role="status">
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

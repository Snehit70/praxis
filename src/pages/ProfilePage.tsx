import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useClerk, useUser } from '@clerk/clerk-react';
import { ArrowLeft, ArrowRight, Check, Edit3, Loader2, LogOut, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogClose } from '@/components/ui/dialog';
import { CourseSelector } from '@/components/CourseSelector';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { useEnrolledCourses } from '@/hooks/useEnrolledCourses';
import { buildCatalogue, courseHref, LEVEL_META } from '@/lib/courseCatalogue';
import { getExamSlugFromUuid } from '@/lib/examMapping';
import { getAllCourses, getProfile, updateProfile, type UserProfile } from '@/lib/api';
import { getDisplayCourseName } from '@/lib/courseMapping';
import { formatPaperName } from '@/lib/paperUtils';
import { logger } from '@/lib/logger';

import editArt from '@/assets/profile-edit-desk.webp';
import { AVATARS } from '@/lib/avatars';

function initials(name: string | null | undefined, email: string | null | undefined) {
  const value = name?.trim() || email?.split('@')[0]?.trim() || 'P';
  const parts = value.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}` : value.slice(0, 2)).toUpperCase();
}

function paperHref(item: UserProfile['recentViews'][number]) {
  const params = new URLSearchParams();
  if (item.courseUuid) params.set('course', item.courseUuid);
  const exam = getExamSlugFromUuid(item.examUuid);
  if (exam) params.set('exam', exam);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return `/paper/${encodeURIComponent(item.uuid)}${suffix}`;
}

export default function ProfilePage() {
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const courses = useEnrolledCourses();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [catalogue, setCatalogue] = useState<ReturnType<typeof buildCatalogue> | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const [courseEditorOpen, setCourseEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState({ displayName: '', bio: '', avatarKey: '' });

  useEffect(() => {
    let active = true;
    Promise.all([getProfile(getToken), getAllCourses()])
      .then(([next, rawCourses]) => {
        if (!active) return;
        setProfile(next);
        setDraft({
          displayName: next.displayName ?? user?.fullName ?? '',
          bio: next.bio ?? '',
          avatarKey: next.avatarKey ?? '',
        });
        setCatalogue(buildCatalogue(rawCourses));
      })
      .catch((error) => {
        logger.error('Failed to load profile', error);
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [getToken, user?.fullName]);

  const avatar = useMemo(() => AVATARS.find((item) => item.key === (profile?.avatarKey ?? draft.avatarKey)), [draft.avatarKey, profile?.avatarKey]);
  const displayName = profile?.displayName || user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Traveller';
  const avatarInitials = initials(profile?.displayName || user?.fullName, user?.primaryEmailAddress?.emailAddress);
  const selectedCourses = useMemo(() => {
    if (!catalogue) return [];
    return catalogue.filter((entry) => courses.enrolled.has(entry.key));
  }, [catalogue, courses.enrolled]);

  // Start every edit from what's saved, so a cancelled edit never lingers.
  const openEditor = () => {
    setDraft({
      displayName: profile?.displayName ?? user?.fullName ?? '',
      bio: profile?.bio ?? '',
      avatarKey: profile?.avatarKey ?? '',
    });
    setSaved(false);
    setEditing(true);
  };
  const draftAvatar = AVATARS.find((item) => item.key === draft.avatarKey);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const next = await updateProfile(
        { displayName: draft.displayName || null, bio: draft.bio || null, avatarKey: draft.avatarKey || null },
        getToken,
      );
      setProfile(next);
      window.dispatchEvent(new Event('praxis:profile-updated'));
      setEditing(false);
      setSaved(true);
    } catch (error) {
      logger.error('Failed to save profile', error);
    } finally {
      setSaving(false);
    }
  };

  if (failed) {
    return <div className="container mx-auto px-4 py-10 md:px-8"><StatePanel tone="error" title="Couldn’t load your profile" description="Please try again in a moment." actions={<Button onClick={() => window.location.reload()}>Reload</Button>} announce /></div>;
  }

  const card = 'squircle overflow-hidden rounded-3xl border border-white/10 bg-[#0d1220]/75 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl md:p-7';

  if (!profile || !catalogue) {
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

  const kicker = 'text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50';
  const rowLink = 'squircle group -mx-3 flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

  return (
    <div className="relative isolate pb-16">
      {/* ── Header: open daytime sky from the layout scene; the party watches
           from the horizon at the bottom of the page. ── */}
      <section className="relative isolate overflow-hidden">
        <div className="h-[72px] w-full sm:h-[clamp(200px,28vh,280px)]" />

        <div className="relative -mt-10 sm:absolute sm:inset-x-0 sm:bottom-0 sm:mt-0">
          <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 sm:pb-6 sm:flex-row sm:items-end sm:justify-between md:px-8">
            <div className="min-w-0">
            <Link
              to="/home"
              onMouseEnter={() => { void import('@/pages/HomePage'); }}
              onFocus={() => { void import('@/pages/HomePage'); }}
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-white/90 transition-colors [text-shadow:0_1px_10px_rgba(0,0,0,0.5)] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to courses
            </Link>
            <div className="flex items-end gap-4 md:gap-5">
              <div className="squircle flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-[1.75rem] border-2 border-white/40 bg-primary/80 text-2xl font-semibold text-primary-foreground shadow-xl md:size-24">
                {avatar ? <img src={avatar.src} alt={avatar.label} className="h-full w-full object-cover" /> : avatarInitials}
              </div>
              <div className="min-w-0 pb-0.5">
                <h1 className="truncate font-display text-4xl font-normal tracking-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.45)] md:text-5xl">
                  {displayName}
                </h1>
                <p className="mt-1 max-w-xl text-sm text-white/85 [text-shadow:0_1px_10px_rgba(0,0,0,0.5)] md:text-base">
                  {profile.bio || 'Choose your road and make this archive yours.'}
                </p>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-[#1c2433]">
                  <span className="rounded-md bg-white px-2.5 py-1">{profile.level || 'No program yet'}</span>
                  <span className="rounded-md bg-white px-2.5 py-1 tabular-nums">{selectedCourses.length} {selectedCourses.length === 1 ? 'course' : 'courses'}</span>
                  <span className="rounded-md bg-white px-2.5 py-1 tabular-nums">{profile.viewedPaperCount} {profile.viewedPaperCount === 1 ? 'paper' : 'papers'} viewed</span>
                </p>
              </div>
            </div>
            </div>
            <div className="flex flex-wrap gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              className="squircle shrink-0 self-start rounded-2xl border-white/25 bg-black/30 text-white backdrop-blur-md hover:bg-black/45 sm:self-auto"
              onClick={openEditor}
            >
              <Edit3 /> Edit profile
            </Button>
            <Button variant="outline" className="squircle rounded-2xl border-white/25 bg-black/30 text-white hover:bg-black/45" onClick={() => { setSignOutFailed(false); setConfirmSignOut(true); }}>
              <LogOut /> Sign out
            </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-6 px-4 pt-4 md:px-8">
        {saved && (
          <p className="flex items-center gap-2 text-sm text-primary" role="status">
            <Check className="size-4" /> Profile saved.
          </p>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-2">
          {/* Recently viewed */}
          <section className={card}>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className={kicker}>Paper view</p>
                <h2 className="mt-1.5 font-display text-2xl font-normal tracking-tight">Recently viewed</h2>
              </div>
              <p className="pb-1 text-sm text-white/50">{profile.viewedPaperCount} total</p>
            </div>
            {profile.recentViews.length === 0 ? (
              <div className="mt-5 flex flex-col items-center border-t border-white/10 px-4 py-10 text-center">
                <UserRound className="size-6 text-white/40" />
                <p className="mt-3 font-medium">Your paper trail starts here.</p>
                <p className="mt-1 text-sm text-white/55">Open a paper and it will appear here.</p>
                <Button asChild variant="outline" size="sm" className="squircle mt-5 rounded-xl">
                  <Link to="/search">Browse papers <ArrowRight /></Link>
                </Button>
              </div>
            ) : (
              <ul tabIndex={profile.recentViews.length > 4 ? 0 : undefined} aria-label="Recently viewed papers" className="mt-4 max-h-[17rem] space-y-0.5 overflow-y-auto border-t border-white/10 pt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                {profile.recentViews.map((item, index) => (
                  <li key={item.id}>
                    <Link to={paperHref(item)} className={rowLink}>
                      <span className="w-7 font-display text-xl tabular-nums text-white/25">{String(index + 1).padStart(2, '0')}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-white/90">{formatPaperName(item.paperName, item.year ?? undefined)}</span>
                        <span className="mt-0.5 block truncate text-xs text-white/45">{item.courseName} · {item.examName}</span>
                      </span>
                      <ArrowRight className="size-4 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {/* Study setup */}
          <section className={card}>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className={kicker}>Study setup</p>
                <h2 className="mt-1.5 font-display text-2xl font-normal tracking-tight">Your current road</h2>
              </div>
              <Button variant="outline" size="sm" className="squircle rounded-xl" onClick={() => setCourseEditorOpen(true)}>
                Edit courses
              </Button>
            </div>
            {selectedCourses.length > 0 ? (
              <ul tabIndex={selectedCourses.length > 2 ? 0 : undefined} aria-label="Your courses" className="mt-4 max-h-36 space-y-0.5 overflow-y-auto border-t border-white/10 pt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                {selectedCourses.map((course) => (
                  <li key={course.key}>
                    <Link to={courseHref(course)} className={rowLink}>
                      <img
                        src={LEVEL_META[course.level].image}
                        alt=""
                        className="squircle size-11 rounded-xl object-cover object-top ring-1 ring-white/15"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-white/90">{getDisplayCourseName(course.displayName)}</span>
                        <span className="mt-0.5 block text-xs text-white/45">
                          {course.courseCode} · {course.paperCount} papers
                        </span>
                      </span>
                      <ArrowRight className="size-4 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 text-sm text-white/55">Choose the courses you want waiting on your road.</p>
            )}
            {selectedCourses.length > 2 && (
              <p className="mt-2 text-xs text-white/65">Scroll to see all {selectedCourses.length} courses</p>
            )}
          </section>
        </div>

        <Dialog open={confirmSignOut} onOpenChange={setConfirmSignOut} labelledBy="sign-out-title" dismissable={!signingOut} className="border-white/10 bg-[#0d1220] sm:max-w-md">
          <div className="p-6 sm:p-8">
            <h2 id="sign-out-title" className="font-display text-3xl text-white">Sign out of Praxis?</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">You can sign back in whenever you&rsquo;re ready.</p>
            {signOutFailed && <p role="alert" className="mt-3 text-sm text-red-300">Couldn&rsquo;t sign out. Please try again.</p>}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button variant="outline" disabled={signingOut} onClick={() => setConfirmSignOut(false)}>Cancel</Button>
              <Button disabled={signingOut} onClick={async () => {
                setSigningOut(true);
                setSignOutFailed(false);
                try { await signOut({ redirectUrl: '/' }); }
                catch (error) { logger.error('Failed to sign out', error); setSignOutFailed(true); setSigningOut(false); }
              }}>{signingOut ? 'Signing out...' : 'Sign out'}</Button>
            </div>
          </div>
        </Dialog>

        <Dialog open={editing} onOpenChange={setEditing} labelledBy="edit-profile-title" className="border-white/10 bg-[#0d1220] sm:max-w-2xl">
          {/* Writing desk: the calm left wall carries the title, the window
              looks out on the same field as the profile page. */}
          <div className="relative h-36 shrink-0 sm:h-44">
            <img src={editArt} alt="" aria-hidden="true" className="h-full w-full object-cover object-[50%_45%] [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]" />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#0d1220]/70 via-[#0d1220]/10 to-transparent" />
            <div className="absolute left-6 top-5">
              <h2 id="edit-profile-title" className="font-display text-3xl font-normal tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.5)]">Edit profile</h2>
              <p className="mt-1 text-sm text-white/80 [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">How you appear on your road.</p>
            </div>
          </div>
          <DialogClose onClose={() => setEditing(false)} />

          {/* Live preview: what the profile header will read once saved. */}
          <div className="relative -mt-8 px-6">
            <div className="squircle flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-3 backdrop-blur-md">
              <div className="squircle flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/40 bg-primary/80 text-lg font-semibold text-primary-foreground">
                {draftAvatar ? <img src={draftAvatar.src} alt="" className="h-full w-full object-cover" /> : initials(draft.displayName, user?.primaryEmailAddress?.emailAddress)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-xl tracking-tight">{draft.displayName || 'Your name'}</p>
                <p className="truncate text-sm text-white/55">{draft.bio || 'Choose your road and make this archive yours.'}</p>
              </div>
              <span className="ml-auto hidden shrink-0 self-start text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35 sm:block">Preview</span>
            </div>
          </div>

          <div className="grid gap-6 overflow-y-auto px-6 pb-6 pt-5 sm:grid-cols-[1fr_1.1fr]">
            <div>
              <label className="text-sm font-medium" htmlFor="profile-name">Display name</label>
              <input
                id="profile-name"
                value={draft.displayName}
                onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
                maxLength={80}
                className="squircle mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm text-white outline-none focus:ring-2 focus:ring-primary/40"
              />
              <label className="mt-5 flex items-baseline justify-between text-sm font-medium" htmlFor="profile-bio">
                Bio <span className="text-xs font-normal tabular-nums text-white/45">{draft.bio.length}/160</span>
              </label>
              <textarea
                id="profile-bio"
                value={draft.bio}
                onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
                maxLength={160}
                rows={4}
                className="squircle mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <p className="flex items-baseline justify-between text-sm font-medium">
                Companion <span className="text-xs font-normal text-white/45">{draftAvatar ? draftAvatar.label : 'Initials'}</span>
              </p>
              <div className="mt-2 grid grid-cols-4 gap-2.5">
                {AVATARS.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    aria-label={`Choose ${item.label}`}
                    aria-pressed={draft.avatarKey === item.key}
                    title={item.label}
                    onClick={() => setDraft((d) => ({ ...d, avatarKey: item.key }))}
                    className={`squircle overflow-hidden rounded-2xl border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${draft.avatarKey === item.key ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <img src={item.src} alt="" className="aspect-square w-full object-cover" />
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={!draft.avatarKey}
                  onClick={() => setDraft((d) => ({ ...d, avatarKey: '' }))}
                  className={`squircle flex aspect-square items-center justify-center rounded-2xl border-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${!draft.avatarKey ? 'border-primary bg-primary/15 text-primary' : 'border-white/10 bg-white/[0.04] text-white/60 hover:text-white'}`}
                >
                  {initials(draft.displayName, user?.primaryEmailAddress?.emailAddress)}
                </button>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-white/10 px-6 py-4">
            <Button className="squircle rounded-xl" onClick={save} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}Save profile
            </Button>
          </div>
        </Dialog>

      {catalogue && <CourseSelector open={courseEditorOpen} onOpenChange={setCourseEditorOpen} catalogue={catalogue} initialLevel={courses.level} initialCourseKeys={courses.courseKeys} saving={courses.saving} onSave={async (next) => { const ok = await courses.save(next); if (ok) { setCourseEditorOpen(false); setProfile((current) => current ? { ...current, level: next.level, courseKeys: next.courseKeys } : current); } }} />}
      </div>
    </div>
  );
}

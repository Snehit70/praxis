import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { ArrowRight, Check, Edit3, Loader2, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CourseSelector } from '@/components/CourseSelector';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { useEnrolledCourses } from '@/hooks/useEnrolledCourses';
import { buildCatalogue, courseHref, LEVEL_META } from '@/lib/courseCatalogue';
import { getExamSlugFromUuid } from '@/lib/examMapping';
import { getAllCourses, getProfile, updateProfile, type UserProfile } from '@/lib/api';
import { getDisplayCourseName } from '@/lib/courseMapping';
import { formatPaperName } from '@/lib/paperUtils';
import { logger } from '@/lib/logger';

import bannerImage from '@/assets/Frieren, Fern and Stark.jpeg';
import lawineImage from '@/assets/Lawine.jpeg';
import ubelImage from '@/assets/Übel.jpeg';
import seinImage from '@/assets/Sein.jpeg';
import serieImage from '@/assets/Serie.jpeg';
import flammeImage from '@/assets/Flamme.jpeg';
import himmelImage from '@/assets/𝖧𝗂𝗆𝗆𝖾𝗅.jpeg';

const AVATARS = [
  { key: 'lawine', label: 'Lawine', src: lawineImage },
  { key: 'ubel', label: 'Übel', src: ubelImage },
  { key: 'sein', label: 'Sein', src: seinImage },
  { key: 'serie', label: 'Serie', src: serieImage },
  { key: 'flamme', label: 'Flamme', src: flammeImage },
  { key: 'himmel', label: 'Himmel', src: himmelImage },
] as const;

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
  const { user } = useUser();
  const courses = useEnrolledCourses();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [catalogue, setCatalogue] = useState<ReturnType<typeof buildCatalogue> | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [courseEditorOpen, setCourseEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState({ displayName: '', bio: '', avatarKey: '' });
  const editSectionRef = useRef<HTMLElement>(null);

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

  useEffect(() => {
    if (!editing) return;
    requestAnimationFrame(() => editSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [editing]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const next = await updateProfile(
        { displayName: draft.displayName || null, bio: draft.bio || null, avatarKey: draft.avatarKey || null },
        getToken,
      );
      setProfile(next);
      setEditing(false);
      setSaved(true);
    } catch (error) {
      logger.error('Failed to save profile', error);
    } finally {
      setSaving(false);
    }
  };

  if (failed) {
    return <StatePanel tone="error" title="Couldn’t load your profile" description="Please try again in a moment." actions={<Button onClick={() => window.location.reload()}>Reload</Button>} announce />;
  }

  if (!profile || !catalogue) {
    return <div className="mx-auto max-w-6xl space-y-5"><Skeleton className="h-80 w-full rounded-3xl" /><div className="grid gap-5 lg:grid-cols-2"><Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div></div>;
  }

  return (
    <div
      className="relative isolate -mx-4 -my-8 min-h-[calc(100vh-3.5rem)] overflow-x-hidden bg-[#171616] text-white md:-mx-8 md:-my-10"
      style={{ backgroundImage: `url("${bannerImage}")`, backgroundAttachment: 'fixed', backgroundPosition: 'center', backgroundSize: 'cover' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-[#171616]/90 to-[#171616]" />
      <div className="relative mx-auto max-w-7xl space-y-8 px-6 pb-14 pt-8 md:px-10 md:pt-10">
      <section className="relative isolate flex min-h-[390px] items-end overflow-hidden rounded-[2rem] border border-white/15 shadow-2xl">
        <img src={bannerImage} alt="" aria-hidden="true" className="absolute inset-0 -z-20 h-full w-full object-cover object-center" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/45 to-black/20" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-transparent to-black/20" />
        <div className="relative z-10 flex w-full items-end justify-between gap-8 p-8 md:p-10">
          <div className="flex items-end gap-5">
            <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-4 border-white/50 bg-primary/80 text-3xl font-semibold text-primary-foreground shadow-2xl">
              {avatar ? <img src={avatar.src} alt={avatar.label} className="h-full w-full object-cover" /> : avatarInitials}
            </div>
            <div className="pb-1 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/65">Your Praxis profile</p>
              <h1 className="mt-2 font-display text-5xl font-normal tracking-tight">{displayName}</h1>
              <p className="mt-2 max-w-xl text-base text-white/75">{profile.bio || 'Choose your road and make this archive yours.'}</p>
            </div>
          </div>
          <Button variant="outline" className="shrink-0 border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => { setEditing(true); setSaved(false); }}>
            <Edit3 /> Edit profile
          </Button>
        </div>
      </section>

      {saved && <p className="flex items-center gap-2 text-sm text-primary" role="status"><Check className="size-4" /> Profile saved.</p>}

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[1.5rem] border border-white/15 bg-black/45 p-6 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Study setup</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Your current road</h2></div>
            <Button variant="outline" size="sm" onClick={() => setCourseEditorOpen(true)}>Edit courses</Button>
          </div>
          <div className="mt-6 flex items-end justify-between border-b border-white/10 pb-4"><div><p className="text-xs uppercase tracking-wider text-white/50">Program level</p><p className="mt-2 font-medium text-white/90">{profile.level || 'Not chosen yet'}</p></div><p className="text-sm text-white/55">{selectedCourses.length} courses this term</p></div>
          {selectedCourses.length > 0 ? <ul className="divide-y divide-white/10">{selectedCourses.map((course) => <li key={course.key}><Link to={courseHref(course)} className="group flex items-center gap-4 py-4 transition-colors hover:text-primary"><img src={LEVEL_META[course.level].image} alt="" className="size-12 rounded-xl object-cover opacity-85 ring-1 ring-white/15 transition group-hover:opacity-100" /><span className="flex-1"><span className="block font-medium text-white/90 group-hover:text-primary">{getDisplayCourseName(course.displayName)}</span><span className="mt-1 block text-xs uppercase tracking-wider text-white/45">{course.courseCode} · {course.paperCount} papers</span></span><ArrowRight className="size-4 text-white/35 transition group-hover:translate-x-1 group-hover:text-primary" /></Link></li>)}</ul> : <p className="mt-6 text-sm text-white/55">Choose the courses you want waiting on your road.</p>}
        </section>

        <section className="rounded-[1.5rem] border border-white/15 bg-black/45 p-6 shadow-2xl backdrop-blur-md">
          <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Paper View</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Recently viewed</h2></div><p className="text-sm text-muted-foreground">{profile.viewedPaperCount} total</p></div>
          {profile.recentViews.length === 0 ? <div className="mt-8 border-t border-white/10 pt-6 text-center"><UserRound className="mx-auto size-6 text-white/45" /><p className="mt-3 font-medium">Your paper trail starts here.</p><p className="mt-1 text-sm text-white/55">Open a paper and it will appear here.</p><Button asChild variant="outline" size="sm" className="mt-4 border-white/20 bg-white/10 text-white hover:bg-white/20"><Link to="/search">Browse papers <ArrowRight /></Link></Button></div> : <ul className="mt-4 divide-y divide-white/10">{profile.recentViews.map((item, index) => <li key={item.id}><Link to={paperHref(item)} className="group flex items-center gap-4 py-4 transition-colors hover:text-primary"><span className="font-display text-2xl text-white/25">0{index + 1}</span><span className="flex-1"><span className="block font-medium text-white/90 group-hover:text-primary">{formatPaperName(item.paperName, item.year ?? undefined)}</span><span className="mt-1 block text-sm text-white/50">{item.courseName} · {item.examName}</span></span><ArrowRight className="size-4 text-white/35 transition group-hover:translate-x-1 group-hover:text-primary" /></Link></li>)}</ul>}
        </section>
      </div>

      {editing && <section ref={editSectionRef} className="scroll-mt-6 rounded-[1.5rem] border border-primary/30 bg-black/55 p-6 shadow-2xl backdrop-blur-md"><div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">Edit profile</h2><Button variant="ghost" className="text-white/75 hover:text-white" onClick={() => setEditing(false)}>Cancel</Button></div><div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]"><div><label className="text-sm font-medium" htmlFor="profile-name">Display name</label><input id="profile-name" value={draft.displayName} onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))} maxLength={80} className="mt-2 h-10 w-full rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-primary/40" /><label className="mt-5 block text-sm font-medium" htmlFor="profile-bio">Bio <span className="font-normal text-white/45">({draft.bio.length}/160)</span></label><textarea id="profile-bio" value={draft.bio} onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))} maxLength={160} rows={3} className="mt-2 w-full resize-none rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-primary/40" /></div><div><p className="text-sm font-medium">Choose an avatar</p><div className="mt-3 grid grid-cols-6 gap-3">{AVATARS.map((item) => <button type="button" key={item.key} aria-label={`Choose ${item.label}`} aria-pressed={draft.avatarKey === item.key} onClick={() => setDraft((d) => ({ ...d, avatarKey: item.key }))} className={`overflow-hidden rounded-2xl border-2 transition ${draft.avatarKey === item.key ? 'border-primary ring-2 ring-primary/30' : 'border-white/15 hover:border-primary/50'}`}><img src={item.src} alt="" className="aspect-square w-full object-cover" /><span className="block truncate px-1 py-1 text-[11px]">{item.label}</span></button>)}</div><button type="button" onClick={() => setDraft((d) => ({ ...d, avatarKey: '' }))} className={`mt-3 rounded-lg border px-3 py-2 text-sm ${!draft.avatarKey ? 'border-primary bg-primary/10 text-primary' : 'border-white/15'}`}>Use initials</button></div></div><div className="mt-6 flex justify-end"><Button onClick={save} disabled={saving}>{saving && <Loader2 className="animate-spin" />}Save profile</Button></div></section>}

      {catalogue && <CourseSelector open={courseEditorOpen} onOpenChange={setCourseEditorOpen} catalogue={catalogue} initialLevel={courses.level} initialCourseKeys={courses.courseKeys} saving={courses.saving} onSave={async (next) => { const ok = await courses.save(next); if (ok) { setCourseEditorOpen(false); setProfile((current) => current ? { ...current, level: next.level, courseKeys: next.courseKeys } : current); } }} />}
      </div>
    </div>
  );
}

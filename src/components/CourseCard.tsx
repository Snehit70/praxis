import { Link } from 'react-router-dom';
import { ArrowRight, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { courseHref, LEVEL_META, type CatalogueEntry } from '@/lib/courseCatalogue';

const EXAM_CHIP_LABEL: Record<string, string> = {
  quiz1: 'Quiz 1',
  quiz2: 'Quiz 2',
  'end-term': 'End Term',
  oppe: 'OPPE',
};

interface CourseCardProps {
  course: CatalogueEntry;
  enrolled?: boolean;
  /** When provided, renders an add/remove enrollment toggle in the corner. */
  onToggleEnroll?: (course: CatalogueEntry) => void;
}

export function CourseCard({ course, enrolled = false, onToggleEnroll }: CourseCardProps) {
  const meta = LEVEL_META[course.level];

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-l-4 border-border bg-card transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-black/20',
        meta.accent,
      )}
    >
      <Link to={courseHref(course)} className="block p-4 pr-11">
        <div className="flex gap-3.5">
          {/* Level character portrait — ties the card to its program identity. */}
          <img
            src={meta.image}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className={cn(
              'h-14 w-14 shrink-0 rounded-lg object-cover object-top ring-2 ring-offset-2 ring-offset-card transition-transform duration-200 group-hover:scale-[1.04]',
              meta.ring,
            )}
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={cn('text-[11px] font-semibold uppercase tracking-wider', meta.text)}>
                {meta.label}
              </span>
              {course.courseCode && (
                <span className="truncate text-[11px] text-muted-foreground">· {course.courseCode}</span>
              )}
            </div>

            <p className="mt-0.5 font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary line-clamp-2">
              {course.displayName}
            </p>

            <p className="mt-0.5 text-sm text-muted-foreground">
              {course.paperCount} {course.paperCount === 1 ? 'paper' : 'papers'}
            </p>
          </div>
        </div>

        {course.examSlugs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {course.examSlugs.map((slug) => (
              <span
                key={slug}
                className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {EXAM_CHIP_LABEL[slug] ?? slug}
              </span>
            ))}
          </div>
        )}

        <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
      </Link>

      {onToggleEnroll && (
        <button
          type="button"
          onClick={() => onToggleEnroll(course)}
          aria-pressed={enrolled}
          aria-label={enrolled ? `Remove ${course.displayName} from your courses` : `Add ${course.displayName} to your courses`}
          title={enrolled ? 'Remove from my courses' : 'Add to my courses'}
          className={cn(
            'absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
            enrolled
              ? 'border-primary bg-primary text-primary-foreground hover:opacity-90'
              : 'border-border bg-card/80 text-muted-foreground backdrop-blur hover:border-primary/40 hover:text-foreground',
          )}
        >
          {enrolled ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Accessible name; the field has no visible label. */
  label: string;
  id?: string;
  size?: 'md' | 'lg';
  /** Right-aligned control, e.g. a submit button. Replaces the clear button. */
  trailing?: React.ReactNode;
  className?: string;
}

/**
 * The one search box: glass fill that reads on both the painted scenes and
 * the plain dark pages, with a clear button once there is text.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  id,
  size = 'md',
  trailing,
  className,
}: SearchFieldProps) {
  const large = size === 'lg';
  return (
    <div className={cn('relative w-full', className)}>
      <Search
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 text-white/75',
          large ? 'left-4 h-5 w-5' : 'left-3.5 h-4 w-4',
        )}
      />
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        className={cn(
          'squircle w-full rounded-xl border border-white/25 bg-[#0E1530]/75 text-white shadow-lg shadow-black/25 backdrop-blur-md transition-colors',
          'placeholder:text-white/70 focus:border-white/50 focus:bg-[#0E1530]/90 focus:outline-none focus:ring-2 focus:ring-white/20',
          large ? 'h-14 pl-12 pr-28 text-base' : 'h-11 pl-10 pr-9 text-sm',
        )}
      />
      {trailing ? (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>
      ) : (
        value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-white/75 transition-colors hover:text-white"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        )
      )}
    </div>
  );
}

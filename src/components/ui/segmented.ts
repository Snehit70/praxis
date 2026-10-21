import { cn } from '@/lib/utils';

/** Shared look for segmented tab rows (dashboard tabs, exam-type switcher). */
export const SEGMENTED_LIST =
  'squircle inline-flex flex-wrap gap-1 rounded-2xl border border-white/25 bg-[#0E1530]/75 p-1 shadow-lg shadow-black/25 backdrop-blur-md';

const ITEM_BASE =
  'squircle inline-flex h-9 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50';

/** For `TabsTrigger`, which reports its state through `data-state`. */
export const SEGMENTED_TRIGGER = cn(
  ITEM_BASE,
  'text-white/85 hover:bg-white/10 hover:text-white data-[state=active]:bg-white data-[state=active]:text-[#141414] data-[state=active]:hover:bg-white',
);

export function segmentedItem(active: boolean, className?: string) {
  return cn(
    ITEM_BASE,
    active ? 'bg-white text-[#141414]' : 'text-white/85 hover:bg-white/10 hover:text-white',
    className,
  );
}

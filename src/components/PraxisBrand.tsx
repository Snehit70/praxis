import { cn } from "@/lib/utils";

type PraxisBrandProps = {
  className?: string;
  markClassName?: string;
  nameClassName?: string;
};

export function PraxisBrand({ className, markClassName, nameClassName }: PraxisBrandProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src="/praxis-mark.png"
        alt=""
        aria-hidden="true"
        className={cn("size-7 shrink-0 object-contain", markClassName)}
      />
      <span className={cn("font-semibold tracking-tight", nameClassName)}>Praxis</span>
    </span>
  );
}

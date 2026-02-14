import { type ReactNode } from "react";

interface BadgeChipProps {
  label: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
  labelClassName?: string;
  tooltipClassName?: string;
}

export function BadgeChip({
  label,
  description = "",
  icon,
  className = "",
  labelClassName = "",
  tooltipClassName = "",
}: BadgeChipProps) {
  return (
    <span className="group relative inline-flex">
      <span
        className={className}
        tabIndex={0}
        aria-label={description ? `${label}. ${description}` : label}
      >
        {icon}
        <span className={labelClassName}>{label}</span>
      </span>
      {description ? (
        <span
          role="tooltip"
          className={`pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 w-max max-w-[240px] -translate-x-1/2 rounded-lg border border-white/18 bg-[#0f131c]/98 px-2.5 py-1.5 text-[11px] leading-snug text-[#dce2ed] opacity-0 shadow-[0_20px_50px_-36px_black] transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${tooltipClassName}`}
        >
          {description}
        </span>
      ) : null}
    </span>
  );
}

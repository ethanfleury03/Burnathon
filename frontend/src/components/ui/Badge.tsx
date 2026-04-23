import type { ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "ink"
  | "accent"
  | "ochre"
  | "moss"
  | "slate"
  | "ghost";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-ink-50 text-ink-600 border-ink-100",
  ink: "bg-ink-800 text-paper-50 border-ink-800",
  accent: "bg-accent-50 text-accent-600 border-accent-100",
  ochre: "bg-ochre-50 text-ochre-500 border-ochre-100",
  moss: "bg-moss-50 text-moss-500 border-moss-100",
  slate: "bg-slate2-50 text-slate2-500 border-slate2-100",
  ghost: "bg-transparent text-ink-500 border-transparent",
};

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  dot?: boolean;
  dotClassName?: string;
  className?: string;
  mono?: boolean;
  icon?: ReactNode;
}

export function Badge({
  tone = "neutral",
  children,
  dot = false,
  dotClassName,
  className = "",
  mono = false,
  icon,
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-[2px] text-[11px] font-semibold tracking-wide leading-none h-[22px] ${
        mono ? "mono" : ""
      } ${tones[tone]} ${className}`}
    >
      {dot && (
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            dotClassName ?? "bg-current opacity-70"
          }`}
        />
      )}
      {icon}
      <span className="whitespace-nowrap">{children}</span>
    </span>
  );
}

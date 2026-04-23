import { getStatus, type LectureStatus } from "../../lib/status";

interface StatusPillProps {
  status: LectureStatus;
  size?: "sm" | "md";
  showDescription?: boolean;
  className?: string;
}

/**
 * Visual pill for a lecture processing status.
 * Uses the shared status token map so colors stay consistent.
 */
export function StatusPill({
  status,
  size = "sm",
  showDescription = false,
  className = "",
}: StatusPillProps) {
  const info = getStatus(status);
  const height = size === "md" ? "h-6" : "h-[22px]";
  const pad = size === "md" ? "px-2.5 text-xs" : "px-2 text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold leading-none ${pad} ${height} ${info.pillClass} ${className}`}
      title={showDescription ? info.description : info.label}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${info.dotClass}`} />
      {info.label}
    </span>
  );
}

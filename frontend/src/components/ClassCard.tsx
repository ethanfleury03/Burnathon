import { Link } from "react-router-dom";
import type { ClassOut } from "../api/types";
import { formatDateShort, formatRelative, pluralize } from "../lib/format";
import { Badge } from "./ui/Badge";

interface ClassCardProps {
  cls: ClassOut;
  accent?: string;
}

/**
 * Editorial class card: serif title, measured hierarchy,
 * and quick-scan meta data. Archived state is surfaced with a quiet chip.
 */
export default function ClassCard({ cls, accent }: ClassCardProps) {
  const created = new Date(cls.created_at);
  const monogram = (cls.title || "Class")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "·";

  return (
    <Link
      to={`/classes/${cls.id}`}
      className="group relative block overflow-hidden rounded-[12px] border bg-white shadow-card transition-all duration-150 hover:-translate-y-[1px] hover:shadow-cardHover"
    >
      <div
        className="h-[3px] w-full"
        style={{
          background:
            accent ??
            "linear-gradient(90deg,#1A1915 0%,#56554F 60%,#C69C3C 100%)",
        }}
      />
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border bg-paper-100 font-serif text-[14px] font-semibold text-ink-700">
            {monogram}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-serif text-[17px] font-semibold leading-[1.2] tracking-tightish text-ink-900 line-clamp-2 group-hover:text-ink-800">
                {cls.title}
              </h3>
              {cls.archived_at && (
                <Badge tone="ochre">Archived</Badge>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-2 text-[13px] text-ink-500">
              <span className="font-serif text-[15px] font-semibold text-ink-800 tabular-nums">
                {cls.lecture_count}
              </span>
              <span>{pluralize(cls.lecture_count, "lecture")}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-[var(--rule)] pt-3 text-[12px] text-ink-500">
          <span>Created {formatDateShort(cls.created_at)}</span>
          <span className="mono text-[11.5px] text-ink-400" title={created.toISOString()}>
            {formatRelative(cls.created_at)}
          </span>
        </div>
      </div>
    </Link>
  );
}

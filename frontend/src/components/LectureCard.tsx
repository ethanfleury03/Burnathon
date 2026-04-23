import { Link } from "react-router-dom";
import type { LectureOut } from "../api/types";
import {
  formatBytes,
  formatDateShort,
  formatDuration,
  formatRelative,
} from "../lib/format";
import { StatusPill } from "./ui/StatusPill";

interface LectureCardProps {
  lecture: LectureOut;
  index?: number;
  dense?: boolean;
}

/**
 * Editorial list row for a lecture.
 * Information architecture:
 *   • leading index + serif title + status
 *   • meta row: duration · uploaded · filename · size
 */
export default function LectureCard({ lecture, index, dense }: LectureCardProps) {
  return (
    <Link
      to={`/lectures/${lecture.id}`}
      className="group block rounded-[10px] border bg-white px-4 py-3 shadow-card transition hover:-translate-y-[1px] hover:shadow-cardHover"
    >
      <div className="flex items-start gap-4">
        {typeof index === "number" && (
          <div className="mt-[2px] hidden w-8 flex-none text-right font-serif text-[13px] font-semibold text-ink-400 sm:block">
            {String(index + 1).padStart(2, "0")}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h4 className="font-serif text-[16px] font-semibold leading-snug tracking-tightish text-ink-900 group-hover:text-ink-800 line-clamp-2">
              {lecture.title}
            </h4>
            <StatusPill status={lecture.status} />
          </div>
          {!dense && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="eyebrow text-[9.5px]">Duration</span>
                <span className="tabular-nums text-ink-700">
                  {formatDuration(lecture.duration_seconds)}
                </span>
              </span>
              <span aria-hidden className="text-ink-300">·</span>
              <span
                className="inline-flex items-center gap-1.5"
                title={new Date(lecture.uploaded_at).toLocaleString()}
              >
                <span className="eyebrow text-[9.5px]">Uploaded</span>
                <span className="text-ink-700">
                  {formatDateShort(lecture.uploaded_at)}
                </span>
                <span className="text-ink-400">
                  · {formatRelative(lecture.uploaded_at)}
                </span>
              </span>
            </div>
          )}
          {!dense && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-400 mono">
              <span className="truncate max-w-[280px]">
                {lecture.audio_original_filename}
              </span>
              <span aria-hidden>·</span>
              <span>{formatBytes(lecture.audio_size_bytes)}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

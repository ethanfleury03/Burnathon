import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, getApiErrorMessage } from "../api/client";
import type { ClassDetail, LectureOut } from "../api/types";
import LectureCard from "../components/LectureCard";
import { PageHeader, MetaItem } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import {
  EmptyState,
  ErrorBanner,
  LoadingState,
  Skeleton,
} from "../components/ui/States";
import {
  formatDateLong,
  formatDuration,
  pluralize,
} from "../lib/format";
import type { LectureStatus } from "../lib/status";

type SortKey = "newest" | "oldest" | "longest" | "shortest";

const sortOptions: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  longest: "Longest duration",
  shortest: "Shortest duration",
};

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const [cls, setCls] = useState<ClassDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("newest");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    api
      .get<ClassDetail>(`/api/classes/${classId}`)
      .then((data) => {
        setCls(data);
        setError("");
      })
      .catch((e) => setError(getApiErrorMessage(e, "We couldn't load this class.")))
      .finally(() => setLoading(false));
  }, [classId]);

  const stats = useMemo(() => aggregate(cls?.lectures ?? []), [cls]);

  const filteredLectures = useMemo(() => {
    if (!cls) return [];
    const q = query.trim().toLowerCase();
    let list = q
      ? cls.lectures.filter(
          (l) =>
            l.title.toLowerCase().includes(q) ||
            l.audio_original_filename.toLowerCase().includes(q)
        )
      : [...cls.lectures];
    switch (sort) {
      case "newest":
        list.sort(
          (a, b) =>
            new Date(b.uploaded_at).getTime() -
            new Date(a.uploaded_at).getTime()
        );
        break;
      case "oldest":
        list.sort(
          (a, b) =>
            new Date(a.uploaded_at).getTime() -
            new Date(b.uploaded_at).getTime()
        );
        break;
      case "longest":
        list.sort(
          (a, b) => (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0)
        );
        break;
      case "shortest":
        list.sort(
          (a, b) => (a.duration_seconds ?? 0) - (b.duration_seconds ?? 0)
        );
        break;
    }
    return list;
  }, [cls, query, sort]);

  if (loading && !cls) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-2/3" />
        <LoadingState label="Loading class…" />
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={error || "Class not found."} />
        <Link to="/" className="btn btn-secondary">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Class"
        crumbs={[{ label: "Library", to: "/" }, { label: cls.title }]}
        title={cls.title}
        description={
          cls.lecture_count === 0
            ? "An empty classroom, waiting. Add a lecture to begin the archive."
            : `A working archive of ${cls.lecture_count} ${pluralize(
                cls.lecture_count,
                "lecture"
              )}.`
        }
        meta={
          <>
            <MetaItem
              label="Created"
              value={formatDateLong(cls.created_at)}
            />
            {cls.archived_at && (
              <MetaItem
                label="Archived"
                value={
                  <Badge tone="ochre">
                    {formatDateLong(cls.archived_at)}
                  </Badge>
                }
              />
            )}
            <MetaItem
              label="ID"
              mono
              value={<span className="text-ink-400">{cls.id}</span>}
            />
          </>
        }
        actions={
          <>
            <Link to="/" className="btn btn-ghost">
              ← Library
            </Link>
            <Link
              to={`/new-lecture?classId=${cls.id}`}
              className="btn btn-primary"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              Add lecture
            </Link>
          </>
        }
      />

      {/* Class stats */}
      <section className="grid grid-cols-2 gap-[1px] overflow-hidden rounded-[12px] border bg-[var(--rule)] md:grid-cols-4">
        <MiniStat label="Lectures" value={cls.lectures.length.toString()} />
        <MiniStat label="Ready" value={stats.ready.toString()} tone="moss" />
        <MiniStat
          label="Processing"
          value={stats.processing.toString()}
          tone="slate"
        />
        <MiniStat label="Total audio" value={formatDuration(stats.totalSeconds)} />
      </section>

      {cls.lectures.length === 0 ? (
        <EmptyState
          title="No lectures in this class yet"
          description="Upload an audio file or record directly in the browser. Once processed, it'll appear here with a summary, transcript and optional quiz."
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M10 2v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path
                d="M5 9a5 5 0 0 0 10 0"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path d="M10 15v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
          action={
            <Link
              to={`/new-lecture?classId=${cls.id}`}
              className="btn btn-primary"
            >
              Add first lecture
            </Link>
          }
        />
      ) : (
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h2 className="display-md">Lectures</h2>
              <span className="mono text-[12px] text-ink-400">
                {filteredLectures.length} of {cls.lectures.length}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search lectures…"
                  className="input !py-2 !pl-9"
                  aria-label="Search lectures"
                />
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                  aria-hidden
                >
                  <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="select !py-2 !pr-8"
                aria-label="Sort lectures"
              >
                {Object.entries(sortOptions).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredLectures.length === 0 ? (
            <EmptyState
              title="No matches"
              description={`Nothing in this class matches "${query}".`}
              action={
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="btn btn-secondary"
                >
                  Clear search
                </button>
              }
            />
          ) : (
            <ol className="space-y-2">
              {filteredLectures.map((lec, i) => (
                <li key={lec.id}>
                  <LectureCard lecture={lec} index={i} />
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}

function aggregate(lectures: LectureOut[]) {
  let totalSeconds = 0;
  let totalBytes = 0;
  let ready = 0;
  let processing = 0;
  const byStatus: Record<LectureStatus, number> = {
    uploaded: 0,
    transcribing: 0,
    summarizing: 0,
    ready: 0,
    failed: 0,
  };
  for (const l of lectures) {
    totalSeconds += l.duration_seconds ?? 0;
    totalBytes += l.audio_size_bytes ?? 0;
    byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
    if (l.status === "ready") ready++;
    else if (l.status !== "failed") processing++;
  }
  return { totalSeconds, totalBytes, ready, processing, byStatus };
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "moss" | "slate" | "accent";
}) {
  const toneClass =
    tone === "moss"
      ? "text-moss-500"
      : tone === "slate"
        ? "text-slate2-500"
        : tone === "accent"
          ? "text-accent-500"
          : "text-ink-900";
  return (
    <div className="bg-white px-4 py-4 sm:px-5 sm:py-5">
      <p className="eyebrow">{label}</p>
      <p
        className={`mt-2 font-serif text-[22px] font-semibold leading-none tracking-tightish tabular-nums ${toneClass}`}
      >
        {value}
      </p>
    </div>
  );
}

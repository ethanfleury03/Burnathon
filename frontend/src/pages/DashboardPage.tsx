import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { api, getApiErrorMessage } from "../api/client";
import type { ClassOut, MeOut } from "../api/types";
import ClassCard from "../components/ClassCard";
import { PageHeader } from "../components/ui/PageHeader";
import {
  EmptyState,
  ErrorBanner,
  Skeleton,
} from "../components/ui/States";
import { Badge } from "../components/ui/Badge";
import {
  formatHoursMinutes,
  formatRelative,
  pluralize,
} from "../lib/format";

export default function DashboardPage() {
  const { user } = useUser();
  const [me, setMe] = useState<MeOut | null>(null);
  const [classes, setClasses] = useState<ClassOut[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [createError, setCreateError] = useState("");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const [meData, classesData] = await Promise.all([
          api.get<MeOut>("/api/me"),
          api.get<ClassOut[]>("/api/classes"),
        ]);
        setMe(meData);
        setClasses(classesData);
      } catch (error) {
        setLoadError(
          getApiErrorMessage(
            error,
            "We couldn't load your dashboard. Make sure the backend is running and the database is ready."
          )
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const createClass = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const cls = await api.post<ClassOut>("/api/classes", {
        title: newTitle.trim(),
      });
      setClasses([cls, ...classes]);
      setMe((current) =>
        current
          ? {
              ...current,
              stats: {
                ...current.stats,
                total_classes: current.stats.total_classes + 1,
              },
            }
          : current
      );
      setNewTitle("");
    } catch (error) {
      setCreateError(
        getApiErrorMessage(
          error,
          "We couldn't create the class. Make sure the database is running and migrated."
        )
      );
    } finally {
      setCreating(false);
    }
  };

  const activeClasses = useMemo(
    () => classes.filter((c) => !c.archived_at),
    [classes]
  );
  const archivedClasses = useMemo(
    () => classes.filter((c) => c.archived_at),
    [classes]
  );
  const filteredActive = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeClasses;
    return activeClasses.filter((c) => c.title.toLowerCase().includes(q));
  }, [activeClasses, query]);

  const mostRecentClass = useMemo(() => {
    if (classes.length === 0) return null;
    return [...classes].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  }, [classes]);

  const displayName =
    me?.user.full_name || user?.firstName || user?.fullName || "there";
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "Quiet night";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const audio = formatHoursMinutes(me?.stats.total_audio_seconds);
  const avgPerClass =
    me && me.stats.total_classes > 0
      ? (me.stats.total_lectures / me.stats.total_classes).toFixed(1)
      : "0";

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Dashboard"
        title={
          <>
            {greeting},{" "}
            <span className="italic text-ink-700">{displayName}</span>.
          </>
        }
        description="Your reading-room for classes, lectures and study material. Pick up where you left off or start something new."
        actions={
          me?.user.role === "admin" && (
            <Link to="/admin" className="btn btn-secondary">
              <span>Admin</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M4 3l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          )
        }
      />

      {loadError && <ErrorBanner message={loadError} />}

      {/* Stats board */}
      <section aria-label="Learning library">
        <div className="grid grid-cols-1 gap-[1px] overflow-hidden rounded-[12px] border bg-[var(--rule)] sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Classes"
            loading={loading}
            value={me?.stats.total_classes ?? 0}
            hint={
              me?.stats.total_classes === 0
                ? "Start your first class below"
                : `${pluralize(archivedClasses.length, "archived")} · ${pluralize(activeClasses.length, "active")}`
            }
          />
          <StatTile
            label="Lectures"
            loading={loading}
            value={me?.stats.total_lectures ?? 0}
            hint={
              me
                ? me.stats.total_classes > 0
                  ? `${avgPerClass} avg. per class`
                  : "No classes yet"
                : ""
            }
          />
          <StatTile
            label="Library"
            loading={loading}
            value={audio.value}
            unit={audio.unit}
            hint="Cumulative audio captured"
          />
          <StatTile
            label="Last created"
            loading={loading}
            value={
              mostRecentClass
                ? formatRelative(mostRecentClass.created_at).replace(/ ago/, "")
                : "—"
            }
            hint={mostRecentClass ? mostRecentClass.title : "No activity yet"}
            compact
          />
        </div>
      </section>

      {/* Create class */}
      <section className="surface p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Start a class</p>
            <h2 className="display-md mt-1">New volume in your archive</h2>
            <p className="mt-1 text-[13.5px] text-ink-500">
              A class is a container for lectures. Name it something you'd
              want to read on a shelf.
            </p>
          </div>
          <form
            className="flex w-full max-w-lg flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              void createClass();
            }}
          >
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Microeconomics · Fall 2026"
              className="input"
              aria-label="New class title"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={creating || !newTitle.trim() || loading}
              className="btn btn-primary whitespace-nowrap"
            >
              {creating ? "Creating…" : "Create class"}
            </button>
          </form>
        </div>
        {createError && (
          <p className="mt-3 text-[13px] text-accent-600">{createError}</p>
        )}
      </section>

      {/* Classes list */}
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Your shelf</p>
            <h2 className="display-md mt-1">Classes</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by title…"
                className="input !py-2 !pl-9"
                aria-label="Filter classes"
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
            {archivedClasses.length > 0 && (
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="btn btn-ghost"
              >
                {showArchived ? "Hide archived" : `Show archived (${archivedClasses.length})`}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="surface overflow-hidden p-5">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-3 h-6 w-3/4" />
                <Skeleton className="mt-4 h-3 w-2/5" />
              </div>
            ))}
          </div>
        ) : classes.length === 0 ? (
          <EmptyState
            title="Your library is empty"
            description="Create your first class above to start uploading or recording lectures. Summaries, transcripts, and quizzes follow automatically."
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path
                  d="M3 4.5A1.5 1.5 0 0 1 4.5 3h5a1.5 1.5 0 0 1 1.5 1.5V16H4.5A1.5 1.5 0 0 1 3 14.5v-10Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M13 5.5a1.5 1.5 0 0 1 1.5-1.5h1a1.5 1.5 0 0 1 1.5 1.5V14a2 2 0 0 1-2 2h-1a1 1 0 0 1-1-1V5.5Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
              </svg>
            }
          />
        ) : filteredActive.length === 0 && query ? (
          <EmptyState
            title="No matches"
            description={`Nothing here matches "${query}".`}
            action={
              <button
                type="button"
                onClick={() => setQuery("")}
                className="btn btn-secondary"
              >
                Clear filter
              </button>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredActive.map((cls, i) => (
                <ClassCard
                  key={cls.id}
                  cls={cls}
                  accent={accentFor(cls.id, i)}
                />
              ))}
            </div>
            {showArchived && archivedClasses.length > 0 && (
              <div className="mt-10">
                <div className="mb-3 flex items-center gap-3">
                  <Badge tone="ochre">Archived</Badge>
                  <span className="hairline flex-1" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {archivedClasses.map((cls, i) => (
                    <ClassCard
                      key={cls.id}
                      cls={cls}
                      accent={accentFor(cls.id, i)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  unit,
  hint,
  loading,
  compact,
}: {
  label: string;
  value: number | string;
  unit?: string;
  hint?: string;
  loading?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col justify-between bg-white p-5 md:p-6">
      <p className="eyebrow">{label}</p>
      {loading ? (
        <Skeleton className="mt-4 h-9 w-28" />
      ) : (
        <p
          className={`mt-3 font-serif font-semibold tracking-displaytight text-ink-900 tabular-nums ${
            compact ? "text-[22px]" : "text-[38px]"
          } leading-none`}
        >
          {value}
          {unit && (
            <span className="ml-1.5 text-[14px] font-medium text-ink-500">
              {unit}
            </span>
          )}
        </p>
      )}
      {hint !== undefined && (
        <p
          className="mt-3 truncate text-[12px] text-ink-500"
          title={typeof hint === "string" ? hint : undefined}
        >
          {loading ? <Skeleton className="h-3 w-24" /> : hint}
        </p>
      )}
    </div>
  );
}

// A small deterministic accent selector so each class gets its own spine color.
function accentFor(id: string, i: number): string {
  const palette = [
    "linear-gradient(90deg,#1A1915 0%,#9C3F2F 100%)",
    "linear-gradient(90deg,#1A1915 0%,#C69C3C 100%)",
    "linear-gradient(90deg,#1A1915 0%,#527640 100%)",
    "linear-gradient(90deg,#1A1915 0%,#47606F 100%)",
    "linear-gradient(90deg,#9C3F2F 0%,#C69C3C 100%)",
    "linear-gradient(90deg,#47606F 0%,#527640 100%)",
  ];
  let h = i;
  for (let c = 0; c < id.length; c++) h = (h * 31 + id.charCodeAt(c)) >>> 0;
  return palette[h % palette.length];
}

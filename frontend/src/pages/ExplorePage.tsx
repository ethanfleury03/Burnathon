import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, getApiErrorMessage } from "../api/client";
import type { ClassOut, ClassSummaryOut } from "../api/types";
import ClassCard from "../components/ClassCard";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState, ErrorBanner, Skeleton } from "../components/ui/States";

export default function ExplorePage() {
  const [items, setItems] = useState<ClassSummaryOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api.get<ClassSummaryOut[]>("/api/classes/explore");
        setItems(data);
      } catch (e) {
        setError(
          getApiErrorMessage(
            e,
            "We couldn't load the public library. Try again in a moment."
          )
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        (it.owner_display_name ?? "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const renderCard = (item: ClassSummaryOut) => {
    const pseudoClass: ClassOut = {
      id: item.id,
      owner_user_id: item.owner_user_id,
      title: item.title,
      created_at: item.published_at ?? new Date().toISOString(),
      archived_at: null,
      visibility: item.visibility,
      published_at: item.published_at,
      lecture_count: item.lecture_count,
      can_edit: false,
    };
    return (
      <ClassCard
        key={item.id}
        cls={pseudoClass}
        publicByline={item.owner_display_name ?? "Anonymous"}
      />
    );
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Explore"
        title="Public library"
        description="Browse classes other students have made public. Open one to read summaries, transcripts, and ask questions of the material."
        actions={
          <Link to="/" className="btn btn-ghost">
            Back to my library
          </Link>
        }
      />

      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <label className="sr-only" htmlFor="explore-search">
              Search public classes
            </label>
            <input
              id="explore-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or author…"
              className="field w-full sm:max-w-md"
            />
          </div>
          <div className="eyebrow text-ink-500">
            {loading
              ? "Loading"
              : `${filtered.length} of ${items.length} public ${
                  items.length === 1 ? "class" : "classes"
                }`}
          </div>
        </div>

        {error && <ErrorBanner message={error} />}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-[150px] rounded-[12px]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={
              items.length === 0
                ? "No public classes yet"
                : "Nothing matches your search"
            }
            description={
              items.length === 0
                ? "When someone publishes a class, it will show up here for everyone to browse."
                : "Try a different title or author name."
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(renderCard)}
          </div>
        )}
      </section>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api, getApiErrorMessage } from "../api/client";
import type { DbColumnOut, DbTableOut, MeOut } from "../api/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Spinner } from "../components/ui/Spinner";
import {
  EmptyState,
  ErrorBanner,
  LoadingState,
} from "../components/ui/States";

type DbTab = "users" | "classes" | "lectures";

const tableDescriptions: Record<DbTab, string> = {
  users:
    "Identity table mirroring each Clerk user. Role is the only mutable field.",
  classes:
    "A container for lectures. Owned by one user, may be soft-archived.",
  lectures:
    "A single recording with processing state, audio metadata and denormalized content.",
};

export default function DbPage() {
  const [me, setMe] = useState<MeOut | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [schema, setSchema] = useState<DbTableOut[]>([]);
  const [tab, setTab] = useState<DbTab>("users");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await api.get<DbTableOut[]>("/api/db/schema");
      setSchema(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load schema."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const currentUser = await api.get<MeOut>("/api/me");
        setMe(currentUser);
        if (currentUser.user.role === "admin") {
          await load();
        }
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to verify admin access."));
      } finally {
        setAccessChecked(true);
      }
    })();
  }, []);

  const table = useMemo(() => schema.find((t) => t.name === tab), [schema, tab]);

  const filteredColumns = useMemo(() => {
    if (!table) return [];
    const q = query.trim().toLowerCase();
    if (!q) return table.columns;
    return table.columns.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q) ||
        c.foreign_keys.join(" ").toLowerCase().includes(q)
    );
  }, [table, query]);

  if (!accessChecked) {
    return <LoadingState label="Checking access…" />;
  }

  if (me?.user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Internal · Schema reference"
        title="Database schema"
        description="Live SQLAlchemy model inspection. Use this as a developer reference — mutations still happen through the API."
        actions={
          <>
            <Link to="/admin" className="btn btn-secondary">
              ← Admin
            </Link>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing || loading}
              className="btn btn-secondary"
            >
              {refreshing ? <Spinner /> : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M2.5 5.5A4 4 0 0 1 10 4M9.5 6.5A4 4 0 0 1 2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M10 2v2.5H7.5M2 10V7.5h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              )}
              Refresh
            </button>
          </>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Table switcher */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="inline-flex rounded-md border rule bg-paper-50 p-1">
          {(["users", "classes", "lectures"] as const).map((t) => {
            const active = tab === t;
            const columnCount = schema.find((s) => s.name === t)?.columns.length ?? 0;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex items-center gap-2 rounded px-3 py-1.5 text-[12.5px] font-medium transition ${
                  active
                    ? "bg-white text-ink-900 shadow-card"
                    : "text-ink-500 hover:text-ink-800"
                }`}
              >
                <span className="mono">{t}</span>
                <span
                  className={`mono text-[10.5px] ${
                    active ? "text-ink-400" : "text-ink-300"
                  }`}
                >
                  {columnCount}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter columns…"
            className="input !py-1.5 !pl-8 text-[12.5px] mono"
            aria-label="Filter columns"
          />
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400"
            aria-hidden
          >
            <circle cx="5" cy="5" r="3.3" stroke="currentColor" strokeWidth="1.4" />
            <path d="M7.5 7.5L10 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading schema…" />
      ) : !table ? (
        <EmptyState
          title="No such table"
          description={`The server didn't report a table named "${tab}".`}
        />
      ) : (
        <section className="surface overflow-hidden">
          {/* Table header block — code/docs inspired */}
          <div className="flex flex-col gap-3 border-b rule bg-paper-50 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <p className="eyebrow">Table</p>
              <h2 className="mt-1 font-mono text-[18px] font-semibold tracking-tight text-ink-900">
                {table.name}
              </h2>
              <p className="mt-1 max-w-xl text-[12.5px] text-ink-500">
                {tableDescriptions[tab]}
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11.5px] text-ink-500">
              <Badge tone="neutral" mono>
                {table.columns.length} columns
              </Badge>
              <Badge tone="neutral" mono>
                {table.columns.filter((c) => c.primary_key).length} pk
              </Badge>
              <Badge tone="neutral" mono>
                {table.columns.filter((c) => c.foreign_keys.length > 0).length} fk
              </Badge>
            </div>
          </div>

          {/* Columns as a docs/code layout */}
          <div>
            {filteredColumns.length === 0 ? (
              <div className="px-6 py-10 text-center text-[13px] text-ink-500">
                No columns match{" "}
                <span className="mono text-ink-700">&quot;{query}&quot;</span>.
              </div>
            ) : (
              <ul className="divide-y divide-[var(--rule)]">
                {filteredColumns.map((col) => (
                  <ColumnRow key={col.name} col={col} />
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function ColumnRow({ col }: { col: DbColumnOut }) {
  return (
    <li className="group grid grid-cols-1 gap-3 px-5 py-4 transition hover:bg-paper-50/60 md:grid-cols-[1fr_auto] md:items-center md:px-6">
      <div className="flex items-start gap-3 min-w-0">
        <span
          className={`mt-[3px] inline-flex h-5 min-w-[28px] items-center justify-center rounded border font-mono text-[10px] font-semibold tracking-wide uppercase ${
            col.primary_key
              ? "border-ochre-200 bg-ochre-50 text-ochre-500"
              : col.foreign_keys.length > 0
                ? "border-slate2-100 bg-slate2-50 text-slate2-500"
                : "border-[var(--rule)] bg-white text-ink-400"
          }`}
          title={
            col.primary_key
              ? "Primary key"
              : col.foreign_keys.length > 0
                ? "Foreign key"
                : "Column"
          }
        >
          {col.primary_key ? "PK" : col.foreign_keys.length > 0 ? "FK" : "·"}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-[14px] font-semibold text-ink-900">
              {col.name}
            </span>
            <span className="font-mono text-[12px] text-ink-500">
              {col.type}
            </span>
          </div>
          {col.foreign_keys.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-500">
              <span className="eyebrow text-[9.5px]">references</span>
              {col.foreign_keys.map((fk) => (
                <code
                  key={fk}
                  className="rounded bg-slate2-50 px-1.5 py-[1px] font-mono text-[11px] text-slate2-500"
                >
                  {fk}
                </code>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {col.primary_key && <Badge tone="ochre">Primary key</Badge>}
        {col.foreign_keys.length > 0 && (
          <Badge tone="slate">Foreign key</Badge>
        )}
        <Badge tone={col.nullable ? "neutral" : "ink"}>
          {col.nullable ? "nullable" : "not null"}
        </Badge>
      </div>
    </li>
  );
}

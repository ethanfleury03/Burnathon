import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { api, getApiErrorMessage } from "../api/client";
import type { ClassOut, LectureOut, MeOut, UserOut } from "../api/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import { StatusPill } from "../components/ui/StatusPill";
import { Spinner } from "../components/ui/Spinner";
import {
  EmptyState,
  ErrorBanner,
  LoadingState,
  Skeleton,
} from "../components/ui/States";
import {
  formatBytes,
  formatDateLong,
  formatDateShort,
  formatDuration,
} from "../lib/format";

type AdminTab = "users" | "classes" | "lectures";

const tabs: {
  key: AdminTab;
  label: string;
  blurb: string;
}[] = [
  { key: "users", label: "Users", blurb: "Everyone signed into the portal" },
  { key: "classes", label: "Classes", blurb: "Containers of lectures" },
  { key: "lectures", label: "Lectures", blurb: "Every recording across the system" },
];

export default function AdminPage() {
  const [me, setMe] = useState<MeOut | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [users, setUsers] = useState<UserOut[]>([]);
  const [classes, setClasses] = useState<ClassOut[]>([]);
  const [lectures, setLectures] = useState<LectureOut[]>([]);
  const [tab, setTab] = useState<AdminTab>("users");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | LectureOut["status"]>("all");
  const [busyUser, setBusyUser] = useState<string | null>(null);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [usersData, classesData, lecturesData] = await Promise.all([
        api.get<UserOut[]>("/api/admin/users"),
        api.get<ClassOut[]>("/api/admin/classes"),
        api.get<LectureOut[]>("/api/admin/lectures"),
      ]);
      setUsers(usersData);
      setClasses(classesData);
      setLectures(lecturesData);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load admin data."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const m = await api.get<MeOut>("/api/me");
        setMe(m);
        if (m.user.role === "admin") {
          await loadData();
        }
      } catch {
        setMe(null);
      } finally {
        setAccessChecked(true);
      }
    })();
  }, []);

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    setBusyUser(userId);
    try {
      const updated = await api.patch<UserOut>(`/api/admin/users/${userId}`, {
        role: newRole,
      });
      setUsers(users.map((u) => (u.id === userId ? updated : u)));
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn't update user role."));
    } finally {
      setBusyUser(null);
    }
  };

  const adminCount = useMemo(
    () => users.filter((u) => u.role === "admin").length,
    [users]
  );

  const totalAudioSeconds = useMemo(
    () => lectures.reduce((sum, l) => sum + (l.duration_seconds ?? 0), 0),
    [lectures]
  );

  const usersById = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users]
  );
  const classesById = useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes]
  );

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      if (!matchesRole) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        u.clerk_user_id.toLowerCase().includes(q)
      );
    });
  }, [users, query, roleFilter]);

  const filteredClasses = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.owner_user_id.toLowerCase().includes(q)
    );
  }, [classes, query]);

  const filteredLectures = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lectures.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (!q) return true;
      return (
        l.title.toLowerCase().includes(q) ||
        l.audio_original_filename.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q)
      );
    });
  }, [lectures, query, statusFilter]);

  const counts: Record<AdminTab, number> = {
    users: users.length,
    classes: classes.length,
    lectures: lectures.length,
  };

  const visibleCount =
    tab === "users"
      ? filteredUsers.length
      : tab === "classes"
        ? filteredClasses.length
        : filteredLectures.length;

  if (!accessChecked) {
    return <LoadingState label="Checking access…" />;
  }

  if (me?.user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Internal · Operations"
        title="Admin"
        description="A working view of users, classes and lectures across the system. Read-only except for toggling admin role."
        actions={
          <>
            <Link to="/db" className="btn btn-secondary">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <ellipse cx="6" cy="3" rx="4" ry="1.6" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M2 3v6c0 .9 1.8 1.6 4 1.6s4-.7 4-1.6V3" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M2 6c0 .9 1.8 1.6 4 1.6S10 6.9 10 6" stroke="currentColor" strokeWidth="1.4"/>
              </svg>
              Schema
            </Link>
            <button
              type="button"
              onClick={() => void loadData(true)}
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

      {/* Overview tiles */}
      <section className="grid grid-cols-2 gap-[1px] overflow-hidden rounded-[12px] border bg-[var(--rule)] md:grid-cols-4">
        <OpsStat
          label="Users"
          value={users.length}
          hint={`${adminCount} admin · ${users.length - adminCount} regular`}
          loading={loading}
        />
        <OpsStat
          label="Classes"
          value={classes.length}
          hint={`${classes.filter((c) => c.archived_at).length} archived`}
          loading={loading}
        />
        <OpsStat
          label="Lectures"
          value={lectures.length}
          hint={`${lectures.filter((l) => l.status === "ready").length} ready · ${lectures.filter((l) => l.status === "failed").length} failed`}
          loading={loading}
        />
        <OpsStat
          label="Audio"
          value={formatDuration(totalAudioSeconds)}
          hint="Aggregate duration"
          loading={loading}
          compact
        />
      </section>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Segmented tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="inline-flex rounded-md border rule bg-paper-50 p-1">
            {tabs.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 rounded px-3 py-1.5 text-[12.5px] font-medium transition ${
                    active
                      ? "bg-white text-ink-900 shadow-card"
                      : "text-ink-500 hover:text-ink-800"
                  }`}
                >
                  <span>{t.label}</span>
                  <span
                    className={`mono text-[10.5px] ${
                      active ? "text-ink-400" : "text-ink-300"
                    }`}
                  >
                    {counts[t.key]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search id, title, email…"
                className="input !py-1.5 !pl-8 text-[12.5px]"
                aria-label="Filter rows"
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
            {tab === "users" && (
              <select
                value={roleFilter}
                onChange={(e) =>
                  setRoleFilter(e.target.value as typeof roleFilter)
                }
                className="select !py-1.5 text-[12.5px]"
                aria-label="Filter by role"
              >
                <option value="all">All roles</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            )}
            {tab === "lectures" && (
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as typeof statusFilter
                  )
                }
                className="select !py-1.5 text-[12.5px]"
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                <option value="uploaded">Queued</option>
                <option value="transcribing">Transcribing</option>
                <option value="summarizing">Summarizing</option>
                <option value="ready">Ready</option>
                <option value="failed">Failed</option>
              </select>
            )}
          </div>
        </div>

        {/* Description + count */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-500">
          <p>{tabs.find((t) => t.key === tab)?.blurb}</p>
          <p className="mono">
            {visibleCount} / {counts[tab]} rows
          </p>
        </div>

        {/* Table */}
        {loading ? (
          <LoadingState label="Loading admin data…" />
        ) : tab === "users" ? (
          <UsersTable
            rows={filteredUsers}
            totalRows={users.length}
            query={query}
            onToggleRole={toggleRole}
            busyUser={busyUser}
          />
        ) : tab === "classes" ? (
          <ClassesTable
            rows={filteredClasses}
            totalRows={classes.length}
            query={query}
            users={usersById}
          />
        ) : (
          <LecturesTable
            rows={filteredLectures}
            totalRows={lectures.length}
            query={query}
            classesById={classesById}
          />
        )}
      </div>
    </div>
  );
}

function OpsStat({
  label,
  value,
  hint,
  loading,
  compact,
}: {
  label: string;
  value: number | string;
  hint?: string;
  loading?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="bg-white p-5">
      <p className="eyebrow">{label}</p>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <p
          className={`mt-2 font-serif font-semibold tabular-nums text-ink-900 ${
            compact ? "text-[22px]" : "text-[30px]"
          } leading-none`}
        >
          {value}
        </p>
      )}
      {hint && <p className="mt-2 text-[11.5px] text-ink-500">{hint}</p>}
    </div>
  );
}

function TableShell({
  children,
  empty,
}: {
  children: ReactNode;
  empty?: boolean;
}) {
  if (empty) {
    return (
      <EmptyState
        title="No rows"
        description="There's nothing here yet, or nothing matches your filter."
      />
    );
  }
  return (
    <div className="surface overflow-hidden">
      <div className="max-h-[70vh] overflow-auto scroll-paper">{children}</div>
    </div>
  );
}

function Mono({
  value,
  className = "",
  short = false,
}: {
  value: string;
  className?: string;
  short?: boolean;
}) {
  const display = short && value.length > 14
    ? `${value.slice(0, 8)}…${value.slice(-4)}`
    : value;
  return (
    <span
      className={`mono text-[11.5px] text-ink-500 ${className}`}
      title={value}
    >
      {display}
    </span>
  );
}

function UsersTable({
  rows,
  totalRows,
  query,
  onToggleRole,
  busyUser,
}: {
  rows: UserOut[];
  totalRows: number;
  query: string;
  onToggleRole: (id: string, role: string) => void;
  busyUser: string | null;
}) {
  if (totalRows === 0) {
    return (
      <EmptyState
        title="No users yet"
        description="Users appear automatically when they sign in via Clerk."
      />
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No matches"
        description={`No users match "${query}".`}
      />
    );
  }
  return (
    <TableShell>
      <table className="data-table w-full min-w-[980px]">
        <thead>
          <tr>
            <th>Identity</th>
            <th>Clerk</th>
            <th>Role</th>
            <th>Joined</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td>
                <div className="flex flex-col">
                  <span className="font-serif text-[14.5px] font-semibold text-ink-900">
                    {u.full_name || u.email.split("@")[0]}
                  </span>
                  <span className="text-[12.5px] text-ink-500">{u.email}</span>
                  <Mono value={u.id} short className="mt-1" />
                </div>
              </td>
              <td>
                <Mono value={u.clerk_user_id} short />
              </td>
              <td>
                {u.role === "admin" ? (
                  <Badge tone="accent" dot>
                    Admin
                  </Badge>
                ) : (
                  <Badge tone="neutral" dot>
                    User
                  </Badge>
                )}
              </td>
              <td className="text-ink-500">{formatDateShort(u.created_at)}</td>
              <td className="text-right">
                <button
                  type="button"
                  onClick={() => onToggleRole(u.id, u.role)}
                  disabled={busyUser === u.id}
                  className="btn btn-ghost text-[12.5px]"
                >
                  {busyUser === u.id ? <Spinner /> : null}
                  {u.role === "admin" ? "Demote" : "Promote"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );
}

function ClassesTable({
  rows,
  totalRows,
  query,
  users,
}: {
  rows: ClassOut[];
  totalRows: number;
  query: string;
  users: Map<string, UserOut>;
}) {
  if (totalRows === 0) {
    return (
      <EmptyState
        title="No classes"
        description="Once someone creates a class, it'll show up here."
      />
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No matches"
        description={`No classes match "${query}".`}
      />
    );
  }
  return (
    <TableShell>
      <table className="data-table w-full min-w-[980px]">
        <thead>
          <tr>
            <th>Class</th>
            <th>Owner</th>
            <th className="text-right">Lectures</th>
            <th>Created</th>
            <th>Archived</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((cls) => {
            const owner = users.get(cls.owner_user_id);
            return (
              <tr key={cls.id}>
                <td>
                  <Link
                    to={`/classes/${cls.id}`}
                    className="font-serif text-[14.5px] font-semibold text-ink-900 underline-offset-2 hover:underline"
                  >
                    {cls.title}
                  </Link>
                  <div className="mt-1">
                    <Mono value={cls.id} short />
                  </div>
                </td>
                <td>
                  <div className="flex flex-col">
                    <span className="text-ink-800">
                      {owner?.full_name || owner?.email || "—"}
                    </span>
                    <Mono value={cls.owner_user_id} short className="mt-0.5" />
                  </div>
                </td>
                <td className="text-right">
                  <span className="mono text-[13px] text-ink-800 tabular-nums">
                    {cls.lecture_count}
                  </span>
                </td>
                <td className="text-ink-500">{formatDateShort(cls.created_at)}</td>
                <td>
                  {cls.archived_at ? (
                    <Badge tone="ochre" dot>
                      {formatDateShort(cls.archived_at)}
                    </Badge>
                  ) : (
                    <span className="text-ink-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableShell>
  );
}

function LecturesTable({
  rows,
  totalRows,
  query,
  classesById,
}: {
  rows: LectureOut[];
  totalRows: number;
  query: string;
  classesById: Map<string, ClassOut>;
}) {
  if (totalRows === 0) {
    return (
      <EmptyState
        title="No lectures"
        description="Uploaded or recorded lectures across all users will show up here."
      />
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No matches"
        description={`No lectures match "${query}".`}
      />
    );
  }
  return (
    <TableShell>
      <table className="data-table w-full min-w-[1100px]">
        <thead>
          <tr>
            <th>Lecture</th>
            <th>Class</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Size</th>
            <th>Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lec) => {
            const parent = classesById.get(lec.class_id);
            return (
              <tr key={lec.id}>
                <td>
                  <Link
                    to={`/lectures/${lec.id}`}
                    className="font-serif text-[14.5px] font-semibold text-ink-900 underline-offset-2 hover:underline line-clamp-2"
                  >
                    {lec.title}
                  </Link>
                  <div className="mt-1 text-[11.5px] text-ink-400 mono truncate max-w-[280px]">
                    {lec.audio_original_filename}
                  </div>
                </td>
                <td>
                  {parent ? (
                    <Link
                      to={`/classes/${parent.id}`}
                      className="text-ink-800 underline-offset-2 hover:underline"
                    >
                      {parent.title}
                    </Link>
                  ) : (
                    <Mono value={lec.class_id} short />
                  )}
                </td>
                <td>
                  <StatusPill status={lec.status} />
                </td>
                <td className="mono text-[12.5px] text-ink-700 tabular-nums">
                  {formatDuration(lec.duration_seconds)}
                </td>
                <td className="mono text-[12.5px] text-ink-500 tabular-nums">
                  {formatBytes(lec.audio_size_bytes)}
                </td>
                <td
                  className="text-ink-500"
                  title={formatDateLong(lec.uploaded_at)}
                >
                  {formatDateShort(lec.uploaded_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableShell>
  );
}

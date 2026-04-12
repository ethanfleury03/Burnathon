import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api/client";
import type { ClassOut, LectureOut, MeOut, UserOut } from "../api/types";

type AdminTab = "users" | "classes" | "lectures";

export default function AdminPage() {
  const [me, setMe] = useState<MeOut | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [users, setUsers] = useState<UserOut[]>([]);
  const [classes, setClasses] = useState<ClassOut[]>([]);
  const [lectures, setLectures] = useState<LectureOut[]>([]);
  const [tab, setTab] = useState<AdminTab>("users");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
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
      setError(err instanceof Error ? err.message : "Failed to load database view");
    } finally {
      setLoading(false);
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
    const updated = await api.patch<UserOut>(`/api/admin/users/${userId}`, {
      role: newRole,
    });
    setUsers(users.map((u) => (u.id === userId ? updated : u)));
  };

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleString() : "-";

  if (!accessChecked) {
    return (
      <div className="bg-white rounded-xl border px-4 py-8 text-sm text-gray-500 text-center">
        Loading…
      </div>
    );
  }

  if (me?.user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Database Viewer</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quick development view of the current users, classes, and lectures.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void loadData()}
            className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition"
          >
            Refresh
          </button>
          <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-800">
            &larr; Dashboard
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">Users</p>
          <p className="text-3xl font-bold text-gray-900">{users.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">Classes</p>
          <p className="text-3xl font-bold text-gray-900">{classes.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">Lectures</p>
          <p className="text-3xl font-bold text-gray-900">{lectures.length}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-1 border-b">
        {(["users", "classes", "lectures"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === t
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)} (
            {t === "users" ? users.length : t === "classes" ? classes.length : lectures.length})
          </button>
        ))}
      </div>

      {loading && (
        <div className="bg-white rounded-xl border px-4 py-8 text-sm text-gray-500 text-center">
          Loading database tables...
        </div>
      )}

      {!loading && tab === "users" && users.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">id</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">clerk_user_id</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">full_name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">created_at</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="align-top">
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{u.id}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{u.clerk_user_id}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3 text-gray-600">{u.full_name || "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          u.role === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => void toggleRole(u.id, u.role)}
                        className="text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        {u.role === "admin" ? "Demote" : "Promote"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === "classes" && classes.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">id</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">owner_user_id</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">title</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">lecture_count</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">created_at</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">archived_at</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {classes.map((cls) => (
                  <tr key={cls.id} className="align-top">
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cls.id}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cls.owner_user_id}</td>
                    <td className="px-4 py-3 font-medium">
                      <Link to={`/classes/${cls.id}`} className="text-indigo-600 hover:text-indigo-800">
                        {cls.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{cls.lecture_count}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(cls.created_at)}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(cls.archived_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === "lectures" && lectures.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">id</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">class_id</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">title</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">duration_seconds</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">audio_original_filename</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">audio_size_bytes</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">uploaded_at</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lectures.map((lec) => (
                  <tr key={lec.id} className="align-top">
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{lec.id}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{lec.class_id}</td>
                    <td className="px-4 py-3 font-medium">
                      <Link to={`/lectures/${lec.id}`} className="text-indigo-600 hover:text-indigo-800">
                        {lec.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          lec.status === "ready"
                            ? "bg-green-100 text-green-700"
                            : lec.status === "failed"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {lec.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono">
                      {lec.duration_seconds == null ? "-" : lec.duration_seconds}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{lec.audio_original_filename}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {lec.audio_size_bytes.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(lec.uploaded_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === "users" && users.length === 0 && (
        <div className="bg-white rounded-xl border px-4 py-8 text-sm text-gray-500 text-center">
          No users found.
        </div>
      )}

      {!loading && tab === "classes" && classes.length === 0 && (
        <div className="bg-white rounded-xl border px-4 py-8 text-sm text-gray-500 text-center">
          No classes found.
        </div>
      )}

      {!loading && tab === "lectures" && lectures.length === 0 && (
        <div className="bg-white rounded-xl border px-4 py-8 text-sm text-gray-500 text-center">
          No lectures found.
        </div>
      )}
    </div>
  );
}

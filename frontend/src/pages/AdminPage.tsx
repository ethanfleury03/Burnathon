import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { LectureOut, UserOut } from "../api/types";

export default function AdminPage() {
  const [users, setUsers] = useState<UserOut[]>([]);
  const [lectures, setLectures] = useState<LectureOut[]>([]);
  const [tab, setTab] = useState<"users" | "lectures">("users");

  useEffect(() => {
    api.get<UserOut[]>("/api/admin/users").then(setUsers).catch(() => {});
    api.get<LectureOut[]>("/api/admin/lectures").then(setLectures).catch(() => {});
  }, []);

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    const updated = await api.patch<UserOut>(`/api/admin/users/${userId}`, {
      role: newRole,
    });
    setUsers(users.map((u) => (u.id === userId ? updated : u)));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-800">
          &larr; Dashboard
        </Link>
      </div>

      <div className="flex gap-1 border-b">
        {(["users", "lectures"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === t
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)} ({t === "users" ? users.length : lectures.length})
          </button>
        ))}
      </div>

      {tab === "users" && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id}>
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
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleRole(u.id, u.role)}
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
      )}

      {tab === "lectures" && (
        <div className="space-y-3">
          {lectures.map((lec) => (
            <Link
              key={lec.id}
              to={`/lectures/${lec.id}`}
              className="block bg-white rounded-lg border p-4 hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{lec.title}</span>
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
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {new Date(lec.uploaded_at).toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

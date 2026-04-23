import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api, getApiErrorMessage } from "../api/client";
import type { DbTableOut, MeOut } from "../api/types";

type DbTab = "users" | "classes" | "lectures";

export default function DbPage() {
  const [me, setMe] = useState<MeOut | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [schema, setSchema] = useState<DbTableOut[]>([]);
  const [tab, setTab] = useState<DbTab>("users");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<DbTableOut[]>("/api/db/schema");
      setSchema(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load schema."));
    } finally {
      setLoading(false);
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

  const table = schema.find((t) => t.name === tab);

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
          <h1 className="text-2xl font-bold">DB</h1>
          <p className="text-sm text-gray-500 mt-1">
            Current SQLAlchemy model columns (development reference).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void load()}
            className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition"
          >
            Refresh
          </button>
          <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-800">
            &larr; Dashboard
          </Link>
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
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === t
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && (
        <div className="bg-white rounded-xl border px-4 py-8 text-sm text-gray-500 text-center">
          Loading schema…
        </div>
      )}

      {!loading && table && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">column</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">nullable</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">primary_key</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">foreign_keys</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {table.columns.map((col) => (
                  <tr key={col.name} className="align-top">
                    <td className="px-4 py-3 font-mono text-xs text-gray-900">{col.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{col.type}</td>
                    <td className="px-4 py-3 text-gray-600">{col.nullable ? "yes" : "no"}</td>
                    <td className="px-4 py-3 text-gray-600">{col.primary_key ? "yes" : "no"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {col.foreign_keys.length ? col.foreign_keys.join(", ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

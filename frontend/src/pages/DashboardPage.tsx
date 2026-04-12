import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { ClassOut, MeOut } from "../api/types";
import ClassCard from "../components/ClassCard";

export default function DashboardPage() {
  const [me, setMe] = useState<MeOut | null>(null);
  const [classes, setClasses] = useState<ClassOut[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get<MeOut>("/api/me").then(setMe);
    api.get<ClassOut[]>("/api/classes").then(setClasses);
  }, []);

  const createClass = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const cls = await api.post<ClassOut>("/api/classes", {
        title: newTitle.trim(),
      });
      setClasses([cls, ...classes]);
      setNewTitle("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      {me && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">Classes</p>
            <p className="text-3xl font-bold text-gray-900">
              {me.stats.total_classes}
            </p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">Lectures</p>
            <p className="text-3xl font-bold text-gray-900">
              {me.stats.total_lectures}
            </p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">Audio Duration</p>
            <p className="text-3xl font-bold text-gray-900">
              {Math.round(me.stats.total_audio_seconds / 60)} min
            </p>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">My Classes</h2>
          {me?.user.role === "admin" && (
            <Link
              to="/admin"
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              Admin Panel
            </Link>
          )}
        </div>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createClass()}
            placeholder="New class title..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={createClass}
            disabled={creating || !newTitle.trim()}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
          >
            Create
          </button>
        </div>

        {classes.length === 0 ? (
          <p className="text-gray-500 text-center py-12">
            No classes yet. Create one above to get started.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((cls) => (
              <ClassCard key={cls.id} cls={cls} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

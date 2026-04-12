import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { ClassDetail } from "../api/types";
import LectureCard from "../components/LectureCard";

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const [cls, setCls] = useState<ClassDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!classId) return;
    api
      .get<ClassDetail>(`/api/classes/${classId}`)
      .then(setCls)
      .catch((e) => setError(e.message));
  }, [classId]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!cls) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-800">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold mt-1">{cls.title}</h1>
          <p className="text-sm text-gray-500">
            {cls.lecture_count} {cls.lecture_count === 1 ? "lecture" : "lectures"}
          </p>
        </div>
        <Link
          to={`/new-lecture?classId=${cls.id}`}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          Add Lecture
        </Link>
      </div>

      {cls.lectures.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No lectures yet. Click "Add Lecture" to upload or record.
        </p>
      ) : (
        <div className="space-y-3">
          {cls.lectures.map((lec) => (
            <LectureCard key={lec.id} lecture={lec} />
          ))}
        </div>
      )}
    </div>
  );
}

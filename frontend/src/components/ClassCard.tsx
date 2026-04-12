import { Link } from "react-router-dom";
import type { ClassOut } from "../api/types";

export default function ClassCard({ cls }: { cls: ClassOut }) {
  return (
    <Link
      to={`/classes/${cls.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition"
    >
      <h3 className="text-lg font-semibold text-gray-900 truncate">{cls.title}</h3>
      <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
        <span>
          {cls.lecture_count} {cls.lecture_count === 1 ? "lecture" : "lectures"}
        </span>
        <span>{new Date(cls.created_at).toLocaleDateString()}</span>
      </div>
      {cls.archived_at && (
        <span className="mt-2 inline-block text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
          Archived
        </span>
      )}
    </Link>
  );
}

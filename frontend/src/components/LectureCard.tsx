import { Link } from "react-router-dom";
import type { LectureOut } from "../api/types";

const statusColors: Record<string, string> = {
  uploaded: "bg-blue-100 text-blue-700",
  transcribing: "bg-yellow-100 text-yellow-700",
  summarizing: "bg-purple-100 text-purple-700",
  ready: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function LectureCard({ lecture }: { lecture: LectureOut }) {
  return (
    <Link
      to={`/lectures/${lecture.id}`}
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition"
    >
      <div className="flex items-start justify-between">
        <h4 className="font-medium text-gray-900 truncate">{lecture.title}</h4>
        <span
          className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[lecture.status] || ""}`}
        >
          {lecture.status}
        </span>
      </div>
      <div className="mt-1 text-sm text-gray-500 flex items-center gap-3">
        <span>{formatBytes(lecture.audio_size_bytes)}</span>
        <span>{new Date(lecture.uploaded_at).toLocaleDateString()}</span>
      </div>
    </Link>
  );
}

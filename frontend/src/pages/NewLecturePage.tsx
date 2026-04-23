import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, getApiErrorMessage } from "../api/client";
import type { ClassOut, LectureOut } from "../api/types";
import AudioRecorder from "../components/AudioRecorder";

export default function NewLecturePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [classes, setClasses] = useState<ClassOut[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(
    searchParams.get("classId") || ""
  );
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<"record" | "upload">("record");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [loadingClasses, setLoadingClasses] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoadingClasses(true);
      try {
        const classData = await api.get<ClassOut[]>("/api/classes");
        setClasses(classData);
      } catch (err) {
        setError(
          getApiErrorMessage(
            err,
            "We couldn't load your classes. Make sure the backend is running and the database is ready."
          )
        );
      } finally {
        setLoadingClasses(false);
      }
    })();
  }, []);

  const onRecordingComplete = useCallback(
    (blob: Blob, _duration: number) => {
      setAudioBlob(blob);
    },
    []
  );

  const handleSubmit = async () => {
    if (!selectedClassId || !title.trim()) return;
    const audio = mode === "record" ? audioBlob : audioFile;
    if (!audio) return;

    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      if (notes.trim()) formData.append("notes", notes.trim());

      if (mode === "record" && audioBlob) {
        formData.append("audio", audioBlob, "recording.webm");
      } else if (audioFile) {
        formData.append("audio", audioFile);
      }

      const lecture = await api.upload<LectureOut>(
        `/api/classes/${selectedClassId}/lectures`,
        formData
      );
      navigate(`/lectures/${lecture.id}`);
    } catch (error) {
      setError(
        getApiErrorMessage(
          error,
          "We couldn't upload the lecture. Please verify the backend setup and try again."
        )
      );
    } finally {
      setUploading(false);
    }
  };

  const hasAudio = mode === "record" ? !!audioBlob : !!audioFile;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">New Lecture</h1>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Class *
        </label>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          disabled={loadingClasses || classes.length === 0}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">
            {loadingClasses ? "Loading classes..." : "Select a class..."}
          </option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Lecture title..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Any notes to attach..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <div className="flex gap-1 mb-4">
          <button
            onClick={() => setMode("record")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              mode === "record"
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Record Audio
          </button>
          <button
            onClick={() => setMode("upload")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              mode === "upload"
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Upload File
          </button>
        </div>

        {mode === "record" ? (
          <AudioRecorder onRecordingComplete={onRecordingComplete} />
        ) : (
          <div>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {audioFile && (
              <p className="mt-2 text-sm text-gray-500">
                Selected: {audioFile.name} (
                {(audioFile.size / 1048576).toFixed(1)} MB)
              </p>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loadingClasses || !selectedClassId || !title.trim() || !hasAudio || uploading}
        className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
      >
        {uploading ? "Uploading..." : "Upload & Process"}
      </button>
    </div>
  );
}

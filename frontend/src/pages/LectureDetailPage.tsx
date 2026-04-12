import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { LectureDetail } from "../api/types";
import QuizView from "../components/QuizView";

const statusLabels: Record<string, string> = {
  uploaded: "Uploaded - waiting to process",
  transcribing: "Transcribing audio...",
  summarizing: "Generating summary...",
  ready: "Ready",
  failed: "Processing failed",
};

export default function LectureDetailPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const [lecture, setLecture] = useState<LectureDetail | null>(null);
  const [error, setError] = useState("");
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [activeTab, setActiveTab] = useState<"transcript" | "summary" | "quiz" | "notes">("summary");

  const fetchLecture = () => {
    if (!lectureId) return;
    api
      .get<LectureDetail>(`/api/lectures/${lectureId}`)
      .then(setLecture)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    fetchLecture();
    const interval = setInterval(() => {
      if (
        lecture &&
        !["ready", "failed"].includes(lecture.status)
      ) {
        fetchLecture();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [lectureId, lecture?.status]);

  const handleGenerateQuiz = async () => {
    if (!lectureId) return;
    setGeneratingQuiz(true);
    try {
      await api.post(`/api/lectures/${lectureId}/generate-quiz`);
      setTimeout(fetchLecture, 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGeneratingQuiz(false);
    }
  };

  if (error) return <p className="text-red-600">{error}</p>;
  if (!lecture) return <p className="text-gray-500">Loading...</p>;

  const isProcessing = !["ready", "failed"].includes(lecture.status);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/classes/${lecture.class_id}`}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          &larr; Back to Class
        </Link>
        <h1 className="text-2xl font-bold mt-1">{lecture.title}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {statusLabels[lecture.status] || lecture.status}
          {isProcessing && (
            <span className="ml-2 inline-block w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin align-middle" />
          )}
        </p>
        {lecture.processing_error && (
          <p className="text-sm text-red-600 mt-1">
            Error: {lecture.processing_error}
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl border p-4">
        <audio
          controls
          src={`/files/${lecture.id}/${lecture.audio_original_filename}`}
          className="w-full"
        />
        <p className="text-xs text-gray-400 mt-1">
          {lecture.audio_original_filename} &middot;{" "}
          {(lecture.audio_size_bytes / 1048576).toFixed(1)} MB
        </p>
      </div>

      {lecture.status === "ready" && (
        <>
          <div className="flex gap-1 border-b">
            {(["summary", "transcript", "quiz", "notes"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  activeTab === tab
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border p-6">
            {activeTab === "summary" && (
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                {lecture.summary_text || "No summary available."}
              </div>
            )}
            {activeTab === "transcript" && (
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
                {lecture.transcript_text || "No transcript available."}
              </div>
            )}
            {activeTab === "notes" && (
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
                {lecture.notes_text || "No notes attached."}
              </div>
            )}
            {activeTab === "quiz" && (
              <>
                {lecture.quiz_data ? (
                  <QuizView data={lecture.quiz_data} />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">
                      No quiz generated yet.
                    </p>
                    <button
                      onClick={handleGenerateQuiz}
                      disabled={generatingQuiz}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                      {generatingQuiz ? "Generating..." : "Generate Quiz & Flashcards"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

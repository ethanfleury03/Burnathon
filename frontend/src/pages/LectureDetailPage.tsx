import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { LectureDetail } from "../api/types";
import MarkdownBody from "../components/MarkdownBody";
import QuizView from "../components/QuizView";
import {
  downloadBlob,
  downloadTextFile,
  safeFilenameSegment,
} from "../utils/download";

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
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null);
  const [audioLoadError, setAudioLoadError] = useState("");
  const [audioLoading, setAudioLoading] = useState(false);
  const audioBlobRef = useRef<Blob | null>(null);
  const audioBlobUrlRef = useRef<string | null>(null);

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

  // Audio is fetched with Clerk Bearer via fetch + blob URL: plain <audio src="/..."> cannot send Authorization.
  useEffect(() => {
    if (!lectureId) return;
    let cancelled = false;

    const revoke = () => {
      if (audioBlobUrlRef.current) {
        URL.revokeObjectURL(audioBlobUrlRef.current);
        audioBlobUrlRef.current = null;
      }
    };

    revoke();
    audioBlobRef.current = null;
    setAudioObjectUrl(null);
    setAudioLoadError("");
    setAudioLoading(true);

    void (async () => {
      try {
        const blob = await api.getBlob(`/api/lectures/${lectureId}/audio`);
        if (cancelled) return;
        const u = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        audioBlobUrlRef.current = u;
        audioBlobRef.current = blob;
        setAudioObjectUrl(u);
      } catch (e: unknown) {
        if (!cancelled) {
          audioBlobRef.current = null;
          setAudioLoadError(
            e instanceof Error ? e.message : "Could not load audio"
          );
        }
      } finally {
        if (!cancelled) setAudioLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      revoke();
      audioBlobRef.current = null;
      setAudioObjectUrl(null);
    };
  }, [lectureId]);

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
  const safeTitle = safeFilenameSegment(lecture.title, "lecture");

  const handleDownloadAudio = () => {
    const blob = audioBlobRef.current;
    if (blob) {
      downloadBlob(blob, lecture.audio_original_filename);
      return;
    }
    void api
      .getBlob(`/api/lectures/${lecture.id}/audio`)
      .then((b) => downloadBlob(b, lecture.audio_original_filename))
      .catch((e: unknown) =>
        setAudioLoadError(e instanceof Error ? e.message : "Download failed")
      );
  };

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
        {audioLoadError ? (
          <p className="text-sm text-red-600">{audioLoadError}</p>
        ) : (
          <audio
            controls
            src={audioObjectUrl ?? undefined}
            className="w-full"
          />
        )}
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-400">
            {lecture.audio_original_filename} &middot;{" "}
            {(lecture.audio_size_bytes / 1048576).toFixed(1)} MB
            {audioLoading ? " · Loading audio…" : null}
          </p>
          <button
            type="button"
            onClick={handleDownloadAudio}
            disabled={audioLoading || !!audioLoadError}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Download audio
          </button>
        </div>
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
              <div className="space-y-4">
                {lecture.summary_text ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const text = lecture.summary_text;
                        if (!text) return;
                        downloadTextFile(
                          text,
                          `${safeTitle}-summary.md`,
                          "text/markdown;charset=utf-8"
                        );
                      }}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      Download summary (.md)
                    </button>
                  </div>
                ) : null}
                <MarkdownBody>
                  {lecture.summary_text || "No summary available."}
                </MarkdownBody>
              </div>
            )}
            {activeTab === "transcript" && (
              <div className="space-y-4">
                {lecture.transcript_text ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const text = lecture.transcript_text;
                        if (!text) return;
                        downloadTextFile(
                          text,
                          `${safeTitle}-transcript.txt`,
                          "text/plain;charset=utf-8"
                        );
                      }}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      Download transcript (.txt)
                    </button>
                  </div>
                ) : null}
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
                  {lecture.transcript_text || "No transcript available."}
                </div>
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

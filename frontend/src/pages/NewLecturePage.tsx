import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, getApiErrorMessage } from "../api/client";
import type { ClassOut, LectureOut } from "../api/types";
import AudioRecorder from "../components/AudioRecorder";
import { PageHeader } from "../components/ui/PageHeader";
import { ErrorBanner } from "../components/ui/States";
import { Badge } from "../components/ui/Badge";
import { Spinner } from "../components/ui/Spinner";
import { formatBytes } from "../lib/format";

type Mode = "record" | "upload";

export default function NewLecturePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [classes, setClasses] = useState<ClassOut[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(
    searchParams.get("classId") || ""
  );
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<Mode>("record");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoadingClasses(true);
      try {
        const classData = await api.get<ClassOut[]>("/api/classes");
        setClasses(classData);
        if (!selectedClassId && classData.length === 1) {
          setSelectedClassId(classData[0].id);
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRecordingComplete = useCallback(
    (blob: Blob, duration: number) => {
      setAudioBlob(blob);
      setAudioDuration(duration);
    },
    []
  );

  const handleFile = (file: File | null) => {
    setAudioFile(file);
    if (file) setAudioDuration(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("audio/")) handleFile(f);
  };

  const activeClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) ?? null,
    [classes, selectedClassId]
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
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          "We couldn't upload the lecture. Please verify the backend setup and try again."
        )
      );
    } finally {
      setUploading(false);
    }
  };

  const hasAudio = mode === "record" ? !!audioBlob : !!audioFile;
  const canSubmit =
    !loadingClasses &&
    !!selectedClassId &&
    !!title.trim() &&
    hasAudio &&
    !uploading;

  const steps = [
    { label: "Context", done: !!selectedClassId },
    { label: "Metadata", done: !!title.trim() },
    { label: "Audio", done: hasAudio },
  ];

  return (
    <div className="mx-auto max-w-[880px] space-y-8">
      <PageHeader
        eyebrow="Compose"
        title="New lecture"
        description="Attach a recording to a class, describe it, and leave notes for your future self. Transcripts and summaries follow automatically."
        crumbs={[{ label: "Library", to: "/" }, { label: "New lecture" }]}
      />

      {/* Progress strip */}
      <div className="surface flex items-stretch divide-x divide-[var(--rule)] overflow-hidden text-[12.5px]">
        {steps.map((s, i) => (
          <div
            key={s.label}
            className={`flex flex-1 items-center gap-3 px-4 py-3 ${
              s.done ? "bg-paper-50" : "bg-white"
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border font-semibold ${
                s.done
                  ? "border-moss-200 bg-moss-50 text-moss-500"
                  : "border-[var(--rule-strong)] bg-white text-ink-400"
              }`}
            >
              {s.done ? "✓" : i + 1}
            </span>
            <div className="flex flex-col">
              <span className="eyebrow">Step {i + 1}</span>
              <span className="font-medium text-ink-800">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Context: class */}
      <Section
        number="01"
        title="Choose a class"
        description="Lectures live inside a class. This keeps your library coherent and makes search easier later."
      >
        {loadingClasses ? (
          <div className="flex items-center gap-2 text-[13px] text-ink-500">
            <Spinner />
            Loading classes…
          </div>
        ) : classes.length === 0 ? (
          <div className="rounded-md border rule bg-paper-50 px-4 py-3 text-[13px] text-ink-600">
            You don't have any classes yet.{" "}
            <button
              type="button"
              onClick={() => navigate("/")}
              className="underline"
            >
              Create one from the dashboard
            </button>
            .
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {classes.map((c) => {
              const active = c.id === selectedClassId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedClassId(c.id)}
                  className={`flex flex-col items-start rounded-[10px] border px-3.5 py-3 text-left transition ${
                    active
                      ? "border-ink-800 bg-ink-50 shadow-card"
                      : "border-[var(--rule)] bg-white hover:border-[var(--rule-strong)]"
                  }`}
                >
                  <span className="eyebrow">{c.lecture_count} lectures</span>
                  <span className="mt-1 font-serif text-[15px] font-semibold leading-tight text-ink-900 line-clamp-2">
                    {c.title}
                  </span>
                  {c.archived_at && (
                    <span className="mt-2">
                      <Badge tone="ochre">Archived</Badge>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Section>

      {/* Metadata */}
      <Section
        number="02"
        title="Describe the lecture"
        description="A clear title and a few notes now saves hunting later."
      >
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="field-label" htmlFor="lec-title">
              Title
            </label>
            <input
              id="lec-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lecture 07 · Utility maximization"
              className="input"
            />
            <p className="field-hint">
              {activeClass
                ? `Will be filed under “${activeClass.title}”.`
                : "Pick a class above so this lecture has a home."}
            </p>
          </div>
          <div>
            <label className="field-label" htmlFor="lec-notes">
              Notes <span className="text-ink-400">· optional</span>
            </label>
            <textarea
              id="lec-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Context for your future self: assigned reading, themes to listen for, professor's framing…"
              className="textarea"
            />
            <p className="field-hint">
              Notes are stored verbatim and shown alongside the generated
              summary. Markdown-style formatting is preserved.
            </p>
          </div>
        </div>
      </Section>

      {/* Audio */}
      <Section
        number="03"
        title="Attach the audio"
        description="Record live in the browser or upload an existing file."
      >
        <div className="mb-4 grid grid-cols-2 gap-2">
          <ModeCard
            active={mode === "record"}
            onClick={() => setMode("record")}
            title="Record in browser"
            description="Live microphone capture with level meter."
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <rect x="6" y="2" width="6" height="9" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M3 9a6 6 0 0 0 12 0M9 15v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            }
          />
          <ModeCard
            active={mode === "upload"}
            onClick={() => setMode("upload")}
            title="Upload a file"
            description="Any common audio format. Drag and drop works too."
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path d="M3 12v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M9 2v9M5.5 5.5L9 2l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
          />
        </div>

        {mode === "record" ? (
          <AudioRecorder onRecordingComplete={onRecordingComplete} />
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`surface cursor-pointer p-6 text-center transition ${
              dragOver ? "border-ink-800 bg-paper-50" : ""
            }`}
          >
            <input
              id="lec-file"
              type="file"
              accept="audio/*"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
              className="sr-only"
            />
            <label
              htmlFor="lec-file"
              className="flex cursor-pointer flex-col items-center gap-3"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--rule-strong)] bg-paper-50 text-ink-500">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                  <path d="M9 2v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M5.5 5.5L9 2l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 12v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </span>
              <div>
                <p className="font-serif text-[16px] font-semibold text-ink-900">
                  Drop an audio file here
                </p>
                <p className="text-[12.5px] text-ink-500">
                  or <span className="underline">browse</span> from your device
                </p>
              </div>
              {audioFile && (
                <div className="mt-2 flex items-center gap-2 rounded-md border rule bg-paper-50 px-3 py-2 text-[12.5px] text-ink-700">
                  <span className="mono max-w-[220px] truncate">
                    {audioFile.name}
                  </span>
                  <span className="text-ink-400">·</span>
                  <span className="mono">{formatBytes(audioFile.size)}</span>
                </div>
              )}
            </label>
          </div>
        )}
      </Section>

      {/* Submit */}
      <div className="surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[13px] text-ink-500">
          {canSubmit
            ? "All set. We'll process the audio in the background."
            : "Fill in the class, title, and audio to continue."}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-ghost"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="btn btn-primary"
          >
            {uploading ? (
              <>
                <Spinner /> Uploading…
              </>
            ) : (
              <>Upload &amp; process</>
            )}
          </button>
        </div>
      </div>

      {audioDuration && mode === "record" && (
        <p className="text-center text-[12px] text-ink-400">
          Recorded clip: approximately {audioDuration} seconds.
        </p>
      )}
    </div>
  );
}

function Section({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface overflow-hidden">
      <div className="grid gap-0 md:grid-cols-[220px_1fr]">
        <div className="border-b rule bg-paper-50/70 px-5 py-4 md:border-b-0 md:border-r">
          <p className="mono text-[11px] text-ink-400">{number}</p>
          <h3 className="mt-1 font-serif text-[17px] font-semibold text-ink-900">
            {title}
          </h3>
          {description && (
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-500">
              {description}
            </p>
          )}
        </div>
        <div className="p-5">{children}</div>
      </div>
    </section>
  );
}

function ModeCard({
  active,
  onClick,
  title,
  description,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 rounded-[10px] border px-4 py-3 text-left transition ${
        active
          ? "border-ink-800 bg-ink-50 shadow-card"
          : "border-[var(--rule)] bg-white hover:border-[var(--rule-strong)]"
      }`}
      aria-pressed={active}
    >
      <span
        className={`flex h-9 w-9 flex-none items-center justify-center rounded-md border ${
          active
            ? "border-ink-700 bg-ink-800 text-paper-50"
            : "border-[var(--rule-strong)] bg-paper-50 text-ink-600"
        }`}
      >
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="font-serif text-[15px] font-semibold text-ink-900">
          {title}
        </span>
        <span className="text-[12.5px] text-ink-500">{description}</span>
      </span>
    </button>
  );
}

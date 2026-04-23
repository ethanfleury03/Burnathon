import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ApiError,
  api,
  getApiErrorMessage,
  resolveApiUrl,
} from "../api/client";
import type { ClassOut, LectureDetail } from "../api/types";
import QuizView from "../components/QuizView";
import InlineEdit from "../components/InlineEdit";
import { PageHeader, MetaItem } from "../components/ui/PageHeader";
import { StatusPill } from "../components/ui/StatusPill";
import { Spinner } from "../components/ui/Spinner";
import { Badge } from "../components/ui/Badge";
import {
  EmptyState,
  ErrorBanner,
  LoadingState,
  Skeleton,
} from "../components/ui/States";
import {
  formatBytes,
  formatDateLong,
  formatDuration,
  formatRelative,
} from "../lib/format";
import {
  getStatus,
  isLectureProcessing,
  type LectureStatus,
} from "../lib/status";
import { chunkTranscript } from "../lib/chunkTranscript";

type Tab = "summary" | "deep-dive" | "transcript" | "quiz" | "notes";

const tabDescriptors: Record<
  Tab,
  { label: string; hint: string }
> = {
  summary: { label: "Summary", hint: "The takeaway in editor's voice" },
  "deep-dive": {
    label: "Deep dive",
    hint: "LLM-expanded teaching article with live web citations",
  },
  transcript: { label: "Transcript", hint: "The full machine transcript" },
  quiz: { label: "Quiz & Cards", hint: "Self-check on the material" },
  notes: { label: "Your notes", hint: "What you attached before uploading" },
};

const processingStages: LectureStatus[] = [
  "uploaded",
  "transcribing",
  "summarizing",
  "ready",
];

export default function LectureDetailPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const [search] = useSearchParams();
  const highlight = search.get("highlight");
  const [lecture, setLecture] = useState<LectureDetail | null>(null);
  const [parentClass, setParentClass] = useState<ClassOut | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [justCopied, setJustCopied] = useState<Tab | null>(null);
  const [augmenting, setAugmenting] = useState(false);
  const [augmentError, setAugmentError] = useState("");

  const fetchLecture = (showLoading = false) => {
    if (!lectureId) return;
    if (showLoading) setLoading(true);
    api
      .get<LectureDetail>(`/api/lectures/${lectureId}`)
      .then((data) => {
        setLecture(data);
        setError("");
      })
      .catch((err) => {
        const message =
          err instanceof ApiError && err.status === 503
            ? `${err.detail} Check /api/health and your PostgreSQL setup.`
            : getApiErrorMessage(err, "We couldn't load this lecture.");
        setError(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLecture(true);
    const interval = setInterval(() => {
      if (lecture && isLectureProcessing(lecture.status)) {
        fetchLecture();
      }
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectureId, lecture?.status]);

  // Load parent class for breadcrumbs (works for public classes too).
  useEffect(() => {
    if (!lecture?.class_id) return;
    let cancelled = false;
    api
      .get<ClassOut>(`/api/classes/${lecture.class_id}`)
      .then((cls) => {
        if (!cancelled) setParentClass(cls);
      })
      .catch(() => {
        /* breadcrumbs are non-essential */
      });
    return () => {
      cancelled = true;
    };
  }, [lecture?.class_id]);

  // Auto-pick the best default tab once we know what's available.
  const preferredTabRef = useRef(false);
  useEffect(() => {
    if (!lecture || preferredTabRef.current) return;
    if (lecture.status === "ready") {
      if (lecture.summary_text) setActiveTab("summary");
      else if (lecture.transcript_text) setActiveTab("transcript");
      else if (lecture.notes_text) setActiveTab("notes");
      preferredTabRef.current = true;
    }
  }, [lecture]);

  const handleGenerateQuiz = async () => {
    if (!lectureId) return;
    setGeneratingQuiz(true);
    try {
      await api.post(`/api/lectures/${lectureId}/generate-quiz`);
      setTimeout(() => fetchLecture(), 2000);
    } catch (err) {
      setError(getApiErrorMessage(err, "We couldn't generate the quiz."));
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const renameLecture = async (next: string) => {
    if (!lectureId) return;
    const updated = await api.patch<LectureDetail>(
      `/api/lectures/${lectureId}`,
      { title: next }
    );
    setLecture(updated);
  };

  const handleGenerateDeepDive = async () => {
    if (!lectureId) return;
    setAugmenting(true);
    setAugmentError("");
    try {
      const updated = await api.post<LectureDetail>(
        `/api/lectures/${lectureId}/augment`
      );
      setLecture(updated);
    } catch (err) {
      setAugmentError(
        getApiErrorMessage(
          err,
          "Couldn't generate the deep dive. Try again shortly."
        )
      );
    } finally {
      setAugmenting(false);
    }
  };

  // Scroll to a referenced chunk when landing with ?highlight=chunk-N.
  useEffect(() => {
    if (!highlight || !lecture || lecture.status !== "ready") return;
    setActiveTab("transcript");
    const id = window.requestAnimationFrame(() => {
      const el = document.getElementById(highlight);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("chunk-flash");
        window.setTimeout(() => el.classList.remove("chunk-flash"), 2400);
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [highlight, lecture]);

  const summaryStats = useMemo(() => {
    if (!lecture?.summary_text) return null;
    return textStats(lecture.summary_text);
  }, [lecture?.summary_text]);

  const transcriptStats = useMemo(() => {
    if (!lecture?.transcript_text) return null;
    return textStats(lecture.transcript_text);
  }, [lecture?.transcript_text]);

  const copyCurrent = async (tab: Tab) => {
    if (!lecture) return;
    const text =
      tab === "summary"
        ? lecture.summary_text
        : tab === "transcript"
          ? lecture.transcript_text
          : tab === "notes"
            ? lecture.notes_text
            : "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setJustCopied(tab);
      setTimeout(() => setJustCopied((c) => (c === tab ? null : c)), 1200);
    } catch {
      // Clipboard is a nice-to-have.
    }
  };

  if (loading && !lecture) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <LoadingState label="Loading lecture…" />
      </div>
    );
  }

  if (!lecture) {
    return (
      <div className="space-y-4">
        <ErrorBanner
          message={error || "Lecture not found."}
          action={
            <button
              type="button"
              className="btn btn-ghost text-accent-500"
              onClick={() => fetchLecture(true)}
            >
              Retry
            </button>
          }
        />
        <Link to="/" className="btn btn-secondary">
          ← Back to library
        </Link>
      </div>
    );
  }

  const isProcessing = isLectureProcessing(lecture.status);
  const statusInfo = getStatus(lecture.status);
  const canEdit = lecture.can_edit;
  const isPublicClass = parentClass?.visibility === "public";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={canEdit ? "Lecture" : "Public lecture"}
        crumbs={[
          {
            label: canEdit ? "Library" : "Explore",
            to: canEdit ? "/" : "/explore",
          },
          {
            label: parentClass?.title ?? "Class",
            to: `/classes/${lecture.class_id}`,
          },
          { label: lecture.title },
        ]}
        title={
          <InlineEdit
            value={lecture.title}
            onSave={renameLecture}
            canEdit={canEdit}
            ariaLabel="Rename lecture"
            className="inline-block"
          />
        }
        description={
          lecture.status === "failed"
            ? "This recording didn't finish processing. The details below can help you retry or inspect."
            : isProcessing
              ? "We're still listening to this recording. This page will refresh automatically as each step completes."
              : "Summary, transcript and quiz sit side-by-side with the original audio."
        }
        meta={
          <>
            <MetaItem
              label="Status"
              value={<StatusPill status={lecture.status} />}
            />
            <MetaItem
              label="Uploaded"
              value={
                <span title={new Date(lecture.uploaded_at).toLocaleString()}>
                  {formatDateLong(lecture.uploaded_at)}
                </span>
              }
            />
            <MetaItem
              label="Duration"
              value={formatDuration(lecture.duration_seconds)}
            />
            <MetaItem
              label="Source"
              mono
              value={
                <span
                  className="truncate max-w-[280px]"
                  title={lecture.audio_original_filename}
                >
                  {lecture.audio_original_filename}
                </span>
              }
            />
            {isPublicClass && (
              <MetaItem
                label="Visibility"
                value={<Badge tone="moss">Public · via {parentClass?.title}</Badge>}
              />
            )}
          </>
        }
        actions={
          <>
            <Link
              to={`/classes/${lecture.class_id}`}
              className="btn btn-ghost"
            >
              ← {parentClass?.title ? "Class" : "Back"}
            </Link>
            <a
              href={resolveApiUrl(lecture.audio_url)}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
              download={lecture.audio_original_filename}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M6 2v6M3 5l3 3 3-3M2 10h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Download
            </a>
          </>
        }
      />

      {error && lecture && <ErrorBanner message={error} />}

      {/* Player + processing strip */}
      <section className="surface overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[1fr_minmax(260px,320px)]">
          <div className="flex flex-col gap-3 p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">Recording</p>
              <span className="mono text-[11.5px] text-ink-400">
                {formatBytes(lecture.audio_size_bytes)}
              </span>
            </div>
            <audio
              controls
              preload="metadata"
              src={resolveApiUrl(lecture.audio_url)}
              className="w-full"
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-500">
              <span className="mono truncate max-w-full text-ink-500">
                {lecture.audio_original_filename}
              </span>
              <span aria-hidden className="text-ink-300">·</span>
              <span>{formatRelative(lecture.uploaded_at)}</span>
            </div>
          </div>
          <div className="border-t rule bg-paper-50 p-5 md:border-l md:border-t-0 md:p-6">
            <p className="eyebrow mb-2">Processing pipeline</p>
            <PipelineTrack status={lecture.status} />
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-500">
              {statusInfo.description}
            </p>
            {lecture.processing_error && (
              <div className="mt-3 rounded-md border border-accent-100 bg-accent-50 px-3 py-2 text-[12px] text-accent-600">
                <p className="font-semibold">Error</p>
                <p className="mt-1 whitespace-pre-wrap mono text-[11.5px]">
                  {lecture.processing_error}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {lecture.status === "failed" ? (
        <EmptyState
          title="Processing failed"
          description={
            lecture.processing_error ||
            "This recording wasn't transcribed. Check the worker logs or try uploading a new file."
          }
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 6v5M10 13.2v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          }
          action={
            <Link
              to={`/new-lecture?classId=${lecture.class_id}`}
              className="btn btn-primary"
            >
              Upload a new recording
            </Link>
          }
        />
      ) : lecture.status !== "ready" ? (
        <ProcessingShell status={lecture.status} />
      ) : (
        <>
          {/* Tabs */}
          <nav
            className="sticky top-14 z-10 -mx-4 flex items-end gap-1 overflow-x-auto border-b border-[var(--rule)] bg-paper-100/80 px-4 pt-1 backdrop-blur sm:-mx-6 sm:px-6 scroll-paper"
            aria-label="Lecture sections"
          >
            {(Object.entries(tabDescriptors) as [Tab, typeof tabDescriptors[Tab]][]).map(
              ([key, desc]) => {
                const active = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`relative -mb-px flex min-w-max items-center gap-2 rounded-t-md px-3 pb-2.5 pt-2 text-[13.5px] font-medium transition ${
                      active
                        ? "text-ink-900"
                        : "text-ink-500 hover:text-ink-800"
                    }`}
                    aria-selected={active}
                  >
                    {desc.label}
                    {active && (
                      <span
                        aria-hidden
                        className="absolute inset-x-2 -bottom-[1px] h-[2px] rounded-full bg-ink-800"
                      />
                    )}
                  </button>
                );
              }
            )}
          </nav>

          {/* Content */}
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div>
              {activeTab === "summary" && (
                <ReadingPane
                  title="Editor's summary"
                  sub={tabDescriptors.summary.hint}
                  stats={summaryStats}
                  onCopy={
                    lecture.summary_text
                      ? () => void copyCurrent("summary")
                      : undefined
                  }
                  copied={justCopied === "summary"}
                >
                  {lecture.summary_text ? (
                    <article className="prose-editorial">
                      {paragraphs(lecture.summary_text)}
                    </article>
                  ) : (
                    <p className="text-[14px] text-ink-500">
                      No summary was generated for this lecture.
                    </p>
                  )}
                </ReadingPane>
              )}

              {activeTab === "deep-dive" && (
                <DeepDivePane
                  lecture={lecture}
                  canEdit={canEdit}
                  working={augmenting}
                  onGenerate={() => void handleGenerateDeepDive()}
                  error={augmentError}
                />
              )}

              {activeTab === "transcript" && (
                <ReadingPane
                  title="Transcript"
                  sub={tabDescriptors.transcript.hint}
                  stats={transcriptStats}
                  onCopy={
                    lecture.transcript_text
                      ? () => void copyCurrent("transcript")
                      : undefined
                  }
                  copied={justCopied === "transcript"}
                >
                  {lecture.transcript_text ? (
                    <div className="prose-reading font-sans">
                      {chunkTranscript(lecture.transcript_text).map((chunk, i) => (
                        <p
                          key={i}
                          id={`chunk-${i}`}
                          className="whitespace-pre-wrap scroll-mt-24 text-ink-700"
                        >
                          {chunk.trim()}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[14px] text-ink-500">
                      No transcript available.
                    </p>
                  )}
                </ReadingPane>
              )}

              {activeTab === "notes" && (
                <ReadingPane
                  title="Your notes"
                  sub={tabDescriptors.notes.hint}
                  onCopy={
                    lecture.notes_text
                      ? () => void copyCurrent("notes")
                      : undefined
                  }
                  copied={justCopied === "notes"}
                >
                  {lecture.notes_text ? (
                    <div className="prose-reading font-sans">
                      {paragraphs(lecture.notes_text, "text-ink-700")}
                    </div>
                  ) : (
                    <p className="text-[14px] text-ink-500">
                      You didn't attach any notes with this lecture.
                    </p>
                  )}
                </ReadingPane>
              )}

              {activeTab === "quiz" && (
                <div className="surface p-5 md:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="display-sm">Quiz &amp; flashcards</h2>
                      <p className="mt-0.5 text-[12.5px] text-ink-500">
                        {tabDescriptors.quiz.hint}
                      </p>
                    </div>
                  </div>
                  {lecture.quiz_data ? (
                    <QuizView data={lecture.quiz_data} />
                  ) : (
                    <EmptyState
                      className="!py-10"
                      title="No quiz yet"
                      description={
                        canEdit
                          ? "Generate multiple-choice questions and flashcards from this lecture's transcript and summary."
                          : "The owner hasn't generated a quiz for this lecture."
                      }
                      icon={
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                          <path
                            d="M6 4h8a2 2 0 0 1 2 2v10l-3-2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
                            stroke="currentColor"
                            strokeWidth="1.4"
                          />
                          <path d="M8.5 9.5a1.5 1.5 0 1 1 2.5 1.1V11M10.5 13v.05" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                      }
                      action={
                        canEdit ? (
                          <button
                            type="button"
                            onClick={() => void handleGenerateQuiz()}
                            disabled={generatingQuiz}
                            className="btn btn-primary"
                          >
                            {generatingQuiz ? (
                              <>
                                <Spinner /> Generating…
                              </>
                            ) : (
                              "Generate quiz & flashcards"
                            )}
                          </button>
                        ) : undefined
                      }
                    />
                  )}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <aside className="flex flex-col gap-4">
              <SideCard title="At a glance">
                <SideRow
                  label="Status"
                  value={<StatusPill status={lecture.status} />}
                />
                <SideRow
                  label="Duration"
                  value={formatDuration(lecture.duration_seconds)}
                />
                <SideRow
                  label="File size"
                  value={formatBytes(lecture.audio_size_bytes)}
                />
                <SideRow
                  label="Uploaded"
                  value={formatRelative(lecture.uploaded_at)}
                />
                <SideRow
                  label="Lecture ID"
                  value={
                    <span className="mono text-[11.5px] text-ink-400">
                      {lecture.id.slice(0, 8)}…{lecture.id.slice(-4)}
                    </span>
                  }
                />
              </SideCard>

              {summaryStats && (
                <SideCard title="Summary length">
                  <SideRow
                    label="Words"
                    value={summaryStats.words.toLocaleString()}
                  />
                  <SideRow
                    label="Read"
                    value={`≈ ${summaryStats.minutes} min`}
                  />
                </SideCard>
              )}

              {transcriptStats && (
                <SideCard title="Transcript length">
                  <SideRow
                    label="Words"
                    value={transcriptStats.words.toLocaleString()}
                  />
                  <SideRow
                    label="Read"
                    value={`≈ ${transcriptStats.minutes} min`}
                  />
                </SideCard>
              )}

              <SideCard title="Source">
                <p className="mono text-[12px] leading-snug text-ink-700 break-all">
                  {lecture.audio_original_filename}
                </p>
                <a
                  href={resolveApiUrl(lecture.audio_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary mt-3 w-full"
                  download={lecture.audio_original_filename}
                >
                  Download audio
                </a>
              </SideCard>
            </aside>
          </section>
        </>
      )}
    </div>
  );
}

function PipelineTrack({ status }: { status: LectureStatus }) {
  const activeIndex =
    status === "failed"
      ? processingStages.indexOf("summarizing")
      : processingStages.indexOf(status);
  const labels: Record<LectureStatus, string> = {
    uploaded: "Queued",
    transcribing: "Transcribe",
    summarizing: "Summarize",
    ready: "Ready",
    failed: "Failed",
  };
  return (
    <div className="flex items-center gap-2">
      {processingStages.map((s, i) => {
        const done = i < activeIndex || status === "ready";
        const current = i === activeIndex && status !== "ready" && status !== "failed";
        const failed = status === "failed" && i === activeIndex;
        return (
          <div key={s} className="flex flex-1 flex-col items-stretch">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border text-[10px] font-semibold ${
                  failed
                    ? "border-accent-200 bg-accent-50 text-accent-600"
                    : done
                      ? "border-moss-200 bg-moss-50 text-moss-500"
                      : current
                        ? "border-ochre-200 bg-ochre-50 text-ochre-500"
                        : "border-[var(--rule-strong)] bg-white text-ink-400"
                }`}
              >
                {failed ? "!" : done ? "✓" : i + 1}
              </span>
              {i < processingStages.length - 1 && (
                <span
                  className={`h-[2px] flex-1 rounded-full ${
                    done ? "bg-moss-200" : "bg-ink-100"
                  }`}
                />
              )}
            </div>
            <span
              className={`mt-1 truncate text-[10.5px] font-semibold tracking-wide uppercase ${
                current
                  ? "text-ochre-500"
                  : done
                    ? "text-moss-500"
                    : failed
                      ? "text-accent-500"
                      : "text-ink-400"
              }`}
            >
              {labels[s]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ProcessingShell({ status }: { status: LectureStatus }) {
  const info = getStatus(status);
  return (
    <div className="surface flex flex-col items-center gap-4 p-10 text-center">
      <div className="flex items-center gap-3">
        <Spinner size={18} />
        <StatusPill status={status} size="md" />
      </div>
      <div>
        <h2 className="display-sm">{info.label}</h2>
        <p className="mt-1 max-w-md text-[13.5px] text-ink-500">
          {info.description}
        </p>
      </div>
      <div className="hairline w-20" />
      <p className="max-w-md text-[12.5px] text-ink-400">
        This page refreshes itself every few seconds. You can safely leave it
        open or come back later.
      </p>
    </div>
  );
}

function ReadingPane({
  title,
  sub,
  stats,
  children,
  onCopy,
  copied,
}: {
  title: string;
  sub?: string;
  stats?: { words: number; minutes: number } | null;
  children: ReactNode;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <article className="surface overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b rule px-5 py-4 md:px-6">
        <div>
          <h2 className="display-sm">{title}</h2>
          {sub && <p className="mt-0.5 text-[12.5px] text-ink-500">{sub}</p>}
        </div>
        <div className="flex items-center gap-3">
          {stats && (
            <span className="mono text-[11.5px] text-ink-400">
              {stats.words.toLocaleString()} words · {stats.minutes} min read
            </span>
          )}
          {onCopy && (
            <button
              type="button"
              onClick={onCopy}
              className="btn btn-ghost text-[12.5px]"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          )}
        </div>
      </header>
      <div className="px-5 py-6 md:px-8 md:py-8">{children}</div>
    </article>
  );
}

function SideCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="surface p-4">
      <p className="eyebrow mb-3">{title}</p>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function SideRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="text-ink-500">{label}</span>
      <span className="text-right text-ink-800 font-medium">{value}</span>
    </div>
  );
}

function paragraphs(
  text: string,
  className = "",
  idPrefix?: string
): ReactNode[] {
  const parts = text.split(/\n{2,}/);
  return parts.map((p, i) => (
    <p
      key={i}
      id={idPrefix ? `${idPrefix}${i}` : undefined}
      className={`whitespace-pre-wrap scroll-mt-24 ${className}`}
    >
      {p.trim()}
    </p>
  ));
}

function textStats(text: string): { words: number; minutes: number } {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 220));
  return { words, minutes };
}

function DeepDivePane({
  lecture,
  canEdit,
  working,
  onGenerate,
  error,
}: {
  lecture: LectureDetail;
  canEdit: boolean;
  working: boolean;
  onGenerate: () => void;
  error: string;
}) {
  const citations = lecture.augmented_citations ?? [];
  const renderWithCitations = (text: string): ReactNode[] => {
    const nodes: ReactNode[] = [];
    const pattern = /\[(\d+)\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(text.slice(lastIndex, match.index));
      }
      const idx = match[1];
      const citation = citations.find((c) => String(c.idx) === idx);
      nodes.push(
        <sup key={`cite-${key++}`} className="mx-0.5 align-super">
          <a
            href={citation?.url ?? `#ref-${idx}`}
            target={citation ? "_blank" : undefined}
            rel={citation ? "noreferrer" : undefined}
            className="rounded bg-paper-200 px-1 py-0.5 text-[10.5px] font-semibold text-ink-800 no-underline hover:bg-ochre-100 hover:text-ochre-500"
            title={citation?.title ?? `Reference ${idx}`}
          >
            {idx}
          </a>
        </sup>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
    return nodes;
  };

  return (
    <article className="surface overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b rule px-5 py-4 md:px-6">
        <div>
          <h2 className="display-sm">Deep dive</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-500">
            An expanded teaching article written with live web citations, built
            from this lecture&rsquo;s summary.
          </p>
        </div>
        {canEdit && lecture.augmented_text && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={working}
            className="btn btn-ghost text-[12.5px]"
          >
            {working ? (
              <>
                <Spinner /> Regenerating…
              </>
            ) : (
              "Regenerate"
            )}
          </button>
        )}
      </header>
      <div className="px-5 py-6 md:px-8 md:py-8">
        {error && <ErrorBanner message={error} />}
        {lecture.augmented_text ? (
          <div className="space-y-8">
            <article className="prose-editorial">
              {lecture.augmented_text
                .split(/\n{2,}/)
                .map((para, i) => (
                  <p key={i} className="whitespace-pre-wrap">
                    {renderWithCitations(para.trim())}
                  </p>
                ))}
            </article>
            {citations.length > 0 && (
              <section>
                <p className="eyebrow mb-3">References</p>
                <ol className="space-y-3">
                  {citations.map((c) => (
                    <li
                      key={c.idx}
                      id={`ref-${c.idx}`}
                      className="rounded-md border bg-paper-50 p-3"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="mono text-[11.5px] text-ink-400 tabular-nums">
                          [{c.idx}]
                        </span>
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-serif text-[14.5px] font-semibold text-ink-900 hover:text-ochre-500"
                        >
                          {c.title}
                        </a>
                      </div>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-600">
                        {c.snippet}
                      </p>
                      <p className="mt-1 mono text-[11px] text-ink-400 truncate">
                        {c.url}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {lecture.augmented_at && (
              <p className="mono text-[11.5px] text-ink-400">
                Last generated {formatRelative(lecture.augmented_at)}.
              </p>
            )}
          </div>
        ) : canEdit ? (
          <EmptyState
            className="!py-10"
            title="Expand this lecture into a teaching article"
            description="We'll run 2-3 focused web searches and ask the model to weave the lecture summary together with external sources. Citations are shown inline and in a References section."
            action={
              <button
                type="button"
                onClick={onGenerate}
                disabled={working}
                className="btn btn-primary"
              >
                {working ? (
                  <>
                    <Spinner /> Generating…
                  </>
                ) : (
                  "Generate deep dive"
                )}
              </button>
            }
          />
        ) : (
          <EmptyState
            className="!py-10"
            title="No deep dive yet"
            description="The owner hasn't generated a deep dive for this lecture."
          />
        )}
      </div>
    </article>
  );
}

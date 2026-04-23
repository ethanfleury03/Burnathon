export interface UserOut {
  id: string;
  clerk_user_id: string;
  email: string;
  full_name: string | null;
  role: "user" | "admin";
  created_at: string;
}

export interface UserStats {
  total_classes: number;
  total_lectures: number;
  total_audio_seconds: number;
}

export interface MeOut {
  user: UserOut;
  stats: UserStats;
}

/** SQLAlchemy model column (development DB tab). */
export interface DbColumnOut {
  name: string;
  type: string;
  nullable: boolean;
  primary_key: boolean;
  foreign_keys: string[];
}

export interface DbTableOut {
  name: string;
  columns: DbColumnOut[];
}

export type ClassVisibility = "private" | "public";

export interface ClassOut {
  id: string;
  owner_user_id: string;
  title: string;
  created_at: string;
  archived_at: string | null;
  visibility: ClassVisibility;
  published_at: string | null;
  lecture_count: number;
  can_edit: boolean;
}

export interface ClassSummaryOut {
  id: string;
  title: string;
  owner_user_id: string;
  owner_display_name: string | null;
  lecture_count: number;
  published_at: string | null;
  visibility: ClassVisibility;
}

export interface AugmentedCitation {
  idx: number;
  title: string;
  url: string;
  snippet: string;
}

export interface LectureOut {
  id: string;
  class_id: string;
  title: string;
  audio_original_filename: string;
  audio_url: string;
  audio_size_bytes: number;
  duration_seconds: number | null;
  status: "uploaded" | "transcribing" | "summarizing" | "ready" | "failed";
  uploaded_at: string;
}

export interface LectureDetail extends LectureOut {
  notes_text: string | null;
  transcript_text: string | null;
  summary_text: string | null;
  quiz_data: QuizData | null;
  processing_error: string | null;
  owner_user_id: string;
  can_edit: boolean;
  augmented_text: string | null;
  augmented_citations: AugmentedCitation[] | null;
  augmented_at: string | null;
}

export interface ClassDetail extends ClassOut {
  lectures: LectureOut[];
}

export interface QuizData {
  questions: {
    question: string;
    options: string[];
    correct_index: number;
  }[];
  flashcards: {
    front: string;
    back: string;
  }[];
}

// ── Chat types ──────────────────────────────────────────────────────

export interface Citation {
  label: string;
  lecture_id: string;
  lecture_title: string;
  chunk_index: number;
  excerpt: string;
}

export interface ClassChatOut {
  id: string;
  class_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ClassChatMessageOut {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[] | null;
  created_at: string;
}

/** Result of ``POST /api/admin/reindex`` (transcript chunk backfill). */
export interface ReindexResult {
  scanned: number;
  indexed: number;
  chunks_written: number;
  skipped: number;
  errors: string[];
}

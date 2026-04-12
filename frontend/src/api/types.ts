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

export interface ClassOut {
  id: string;
  owner_user_id: string;
  title: string;
  created_at: string;
  archived_at: string | null;
  lecture_count: number;
}

export interface LectureOut {
  id: string;
  class_id: string;
  title: string;
  audio_original_filename: string;
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

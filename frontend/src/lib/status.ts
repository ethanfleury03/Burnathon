import type { LectureOut } from "../api/types";

export type LectureStatus = LectureOut["status"];

export interface StatusDescriptor {
  label: string;
  tone: "neutral" | "info" | "warn" | "ok" | "bad";
  description: string;
  dotClass: string;
  pillClass: string;
  ringClass: string;
}

export const lectureStatusInfo: Record<LectureStatus, StatusDescriptor> = {
  uploaded: {
    label: "Queued",
    tone: "neutral",
    description: "Audio received. Waiting for the worker to pick it up.",
    dotClass: "bg-ink-300",
    pillClass: "bg-ink-50 text-ink-600 border-ink-100",
    ringClass: "ring-ink-100",
  },
  transcribing: {
    label: "Transcribing",
    tone: "info",
    description: "Turning the recording into text. This usually takes a minute.",
    dotClass: "bg-slate2-300 animate-pulseSoft",
    pillClass: "bg-slate2-50 text-slate2-500 border-slate2-100",
    ringClass: "ring-slate2-100",
  },
  summarizing: {
    label: "Summarizing",
    tone: "info",
    description: "Reading the transcript and preparing a summary.",
    dotClass: "bg-ochre-300 animate-pulseSoft",
    pillClass: "bg-ochre-50 text-ochre-500 border-ochre-100",
    ringClass: "ring-ochre-100",
  },
  ready: {
    label: "Ready",
    tone: "ok",
    description: "Summary, transcript and notes are available.",
    dotClass: "bg-moss-300",
    pillClass: "bg-moss-50 text-moss-500 border-moss-100",
    ringClass: "ring-moss-100",
  },
  failed: {
    label: "Failed",
    tone: "bad",
    description:
      "Something went wrong while processing this recording. Check the error details.",
    dotClass: "bg-accent-400",
    pillClass: "bg-accent-50 text-accent-600 border-accent-100",
    ringClass: "ring-accent-100",
  },
};

export function isLectureProcessing(status: LectureStatus): boolean {
  return !["ready", "failed"].includes(status);
}

export function getStatus(status: LectureStatus): StatusDescriptor {
  return lectureStatusInfo[status] ?? lectureStatusInfo.uploaded;
}

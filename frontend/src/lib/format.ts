/**
 * Small, pure formatting helpers used across the redesigned UI.
 * No dependencies on React or app state.
 */

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, "0")}m`;
  }
  if (m > 0) {
    return `${m}m ${sec.toString().padStart(2, "0")}s`;
  }
  return `${sec}s`;
}

export function formatDurationClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export function formatHoursMinutes(seconds: number | null | undefined): {
  value: string;
  unit: string;
} {
  if (seconds == null || Number.isNaN(seconds) || seconds <= 0) {
    return { value: "0", unit: "min" };
  }
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) {
    return { value: totalMinutes.toString(), unit: "min" };
  }
  const hours = totalMinutes / 60;
  if (hours < 10) {
    return { value: hours.toFixed(1), unit: "hrs" };
  }
  return { value: Math.round(hours).toString(), unit: "hrs" };
}

export function formatDateLong(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs)) return "—";
  const absMs = Math.abs(diffMs);
  const SEC = 1000;
  const MIN = 60 * SEC;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY;
  const YEAR = 365 * DAY;
  const future = diffMs < 0;
  const label = (n: number, unit: string) =>
    future
      ? `in ${n} ${unit}${n === 1 ? "" : "s"}`
      : `${n} ${unit}${n === 1 ? "" : "s"} ago`;
  if (absMs < 45 * SEC) return future ? "in a moment" : "just now";
  if (absMs < 60 * MIN) return label(Math.round(absMs / MIN), "min");
  if (absMs < 24 * HOUR) return label(Math.round(absMs / HOUR), "hour");
  if (absMs < 7 * DAY) return label(Math.round(absMs / DAY), "day");
  if (absMs < 4 * WEEK) return label(Math.round(absMs / WEEK), "week");
  if (absMs < 12 * MONTH) return label(Math.round(absMs / MONTH), "month");
  return label(Math.round(absMs / YEAR), "year");
}

export function truncateId(id: string, head = 6, tail = 4): string {
  if (!id) return "";
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  return count === 1 ? singular : plural ?? `${singular}s`;
}

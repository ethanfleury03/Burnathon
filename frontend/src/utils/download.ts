const MAX_BASE_LEN = 80;

/**
 * Produces a single path segment safe for download filenames (no slashes, etc.).
 */
export function safeFilenameSegment(title: string, fallback: string): string {
  const trimmed = title.trim();
  const base =
    trimmed.length > 0
      ? trimmed.replace(/[/\\:*?"<>|]+/g, "-").replace(/\s+/g, " ")
      : fallback;
  const capped =
    base.length > MAX_BASE_LEN ? base.slice(0, MAX_BASE_LEN).trimEnd() : base;
  return capped || fallback;
}

export function downloadTextFile(
  content: string,
  filename: string,
  mime: string
): void {
  const blob = new Blob([content], { type: mime });
  downloadBlob(blob, filename);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Mirrors backend `app.services.retrieval.chunk_transcript` so transcript
 * paragraph ids (`chunk-0`, `chunk-1`, …) line up with RAG `chunk_index`.
 */
const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z0-9])/g;
const WHITESPACE_RE = /\s+/g;

function splitSentences(text: string): string[] {
  const clean = text.replace(WHITESPACE_RE, " ").trim();
  if (!clean) return [];
  const parts = clean.split(SENTENCE_SPLIT_RE).map((s) => s.trim()).filter(Boolean);
  return parts;
}

export function chunkTranscript(
  transcript: string,
  maxTokens = 500,
  overlap = 50
): string[] {
  if (!transcript?.trim()) return [];
  const sentences = splitSentences(transcript);
  if (!sentences.length) return [];

  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;

  for (const sentence of sentences) {
    const sentenceLen = sentence.split(/\s+/).filter(Boolean).length;
    if (currentLen + sentenceLen > maxTokens && current.length) {
      chunks.push(current.join(" ").trim());
      if (overlap > 0 && current.length) {
        const tailWords = current.join(" ").split(/\s+/).slice(-overlap);
        current = tailWords.length ? [tailWords.join(" ")] : [];
        currentLen = tailWords.length;
      } else {
        current = [];
        currentLen = 0;
      }
    }
    current.push(sentence);
    currentLen += sentenceLen;
  }
  if (current.length) chunks.push(current.join(" ").trim());
  return chunks.filter(Boolean);
}

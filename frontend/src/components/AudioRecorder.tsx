import { useCallback, useEffect, useRef, useState } from "react";
import { formatDurationClock } from "../lib/format";

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void;
}

/**
 * In-browser audio recorder.
 * Presentation: an editorial "on-air" console with level meter,
 * explicit states, and a clean preview.
 */
export default function AudioRecorder({ onRecordingComplete }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [startError, setStartError] = useState<string | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime = useRef(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanupMetering = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      void audioCtxRef.current.close();
    }
    audioCtxRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    setStartError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      chunks.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        const duration = Math.round((Date.now() - startTime.current) / 1000);
        onRecordingComplete(blob, duration);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        cleanupMetering();
      };

      mediaRecorder.current = recorder;
      startTime.current = Date.now();
      recorder.start(1000);
      setRecording(true);
      setElapsed(0);
      setAudioUrl(null);

      timerRef.current = setInterval(() => {
        setElapsed(Math.round((Date.now() - startTime.current) / 1000));
      }, 1000);

      // Live level meter.
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        analyserRef.current = analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          setLevel(Math.min(1, rms * 2.4));
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        // Metering is a nice-to-have; ignore failures.
      }
    } catch (err) {
      setStartError(
        err instanceof Error && err.message
          ? err.message
          : "Microphone access was denied."
      );
    }
  }, [cleanupMetering, onRecordingComplete]);

  const stopRecording = useCallback(() => {
    mediaRecorder.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cleanupMetering();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [cleanupMetering]);

  const bars = Array.from({ length: 22 });

  return (
    <div className="surface overflow-hidden">
      <div className="flex flex-col items-stretch gap-5 bg-gradient-to-b from-white to-paper-50 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                recording
                  ? "border-accent-200 bg-accent-50 text-accent-500"
                  : "border-[var(--rule-strong)] bg-paper-50 text-ink-500"
              }`}
              aria-hidden
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="4.5" y="2" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M2.5 7a4.5 4.5 0 0 0 9 0M7 11.5V13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </span>
            <div>
              <p className="eyebrow">Studio</p>
              <p className="font-serif text-[15px] font-semibold text-ink-900">
                {recording ? "Recording live" : audioUrl ? "Take complete" : "Ready to record"}
              </p>
            </div>
          </div>
          <div className="font-mono text-[26px] font-semibold tabular-nums text-ink-900">
            {formatDurationClock(elapsed)}
          </div>
        </div>

        {/* Level meter */}
        <div className="flex h-10 items-end justify-between gap-[3px] rounded-md border bg-paper-50 px-2 py-2">
          {bars.map((_, i) => {
            const threshold = (i + 1) / bars.length;
            const active = recording && level > threshold - 0.05;
            const h = Math.max(3, Math.round(((i % 7) + 2) * 2.2));
            return (
              <span
                key={i}
                className={`block w-[3px] rounded-sm transition-all duration-100 ${
                  active
                    ? i > bars.length * 0.85
                      ? "bg-accent-400"
                      : i > bars.length * 0.6
                        ? "bg-ochre-300"
                        : "bg-moss-300"
                    : "bg-ink-100"
                }`}
                style={{ height: active ? Math.max(h, level * 28 + 4) : h }}
              />
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!recording ? (
            <button
              type="button"
              onClick={() => void startRecording()}
              className="btn btn-accent"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-paper-50" />
              {audioUrl ? "Re-record" : "Start recording"}
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="btn btn-primary"
            >
              <span className="inline-block h-2 w-2 rounded-sm bg-paper-50" />
              Stop recording
            </button>
          )}
          {recording && (
            <span className="flex items-center gap-2 text-[12.5px] text-accent-600">
              <span className="h-2 w-2 rounded-full bg-accent-400 animate-pulse" />
              Capturing microphone…
            </span>
          )}
          {startError && (
            <p className="text-[12.5px] text-accent-600">{startError}</p>
          )}
        </div>

        {audioUrl && (
          <div className="rounded-md border rule bg-paper-50 p-3">
            <p className="eyebrow mb-1.5">Preview</p>
            <audio controls src={audioUrl} className="w-full" />
          </div>
        )}
      </div>
    </div>
  );
}

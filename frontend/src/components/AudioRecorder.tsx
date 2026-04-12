import { useCallback, useEffect, useRef, useState } from "react";

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void;
}

export default function AudioRecorder({ onRecordingComplete }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime = useRef(0);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
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
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    mediaRecorder.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {!recording ? (
          <button
            onClick={startRecording}
            className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition flex items-center gap-2"
          >
            <span className="w-3 h-3 rounded-full bg-white" />
            Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="px-6 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 transition flex items-center gap-2"
          >
            <span className="w-3 h-3 bg-white" />
            Stop Recording
          </button>
        )}
        <span className="text-2xl font-mono tabular-nums text-gray-700">
          {formatTime(elapsed)}
        </span>
        {recording && (
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
        )}
      </div>

      {audioUrl && (
        <div className="bg-gray-100 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-2">Preview:</p>
          <audio controls src={audioUrl} className="w-full" />
        </div>
      )}
    </div>
  );
}

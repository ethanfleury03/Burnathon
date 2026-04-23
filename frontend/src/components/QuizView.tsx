import { useMemo, useState } from "react";
import type { QuizData } from "../api/types";

type Mode = "quiz" | "flashcards";

export default function QuizView({ data }: { data: QuizData }) {
  const [mode, setMode] = useState<Mode>("quiz");
  const [currentCard, setCurrentCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);

  const score = useMemo(() => {
    const correct = data.questions.filter(
      (q, i) => answers[i] === q.correct_index
    ).length;
    return { correct, total: data.questions.length };
  }, [answers, data.questions]);

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="inline-flex rounded-md border rule bg-paper-50 p-1">
        {(
          [
            { key: "quiz", label: `Quiz · ${data.questions.length}` },
            { key: "flashcards", label: `Flashcards · ${data.flashcards.length}` },
          ] as const
        ).map((m) => {
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`rounded px-3 py-1.5 text-[12.5px] font-medium transition ${
                active
                  ? "bg-white text-ink-900 shadow-card"
                  : "text-ink-500 hover:text-ink-800"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {mode === "quiz" && (
        <>
          {/* Progress */}
          <div className="flex items-center justify-between text-[12.5px] text-ink-500">
            <span>
              {answeredCount} of {data.questions.length} answered
            </span>
            {showResults && (
              <span className="mono text-ink-700">
                Score {score.correct} / {score.total}
              </span>
            )}
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full bg-ink-800 transition-all"
              style={{
                width: `${(answeredCount / data.questions.length) * 100}%`,
              }}
            />
          </div>

          <ol className="space-y-4">
            {data.questions.map((q, qi) => (
              <li key={qi} className="surface overflow-hidden">
                <div className="border-b rule bg-paper-50 px-4 py-2.5 flex items-center gap-3">
                  <span className="mono text-[11px] text-ink-400">
                    Q{String(qi + 1).padStart(2, "0")}
                  </span>
                  <p className="font-serif text-[15px] font-semibold leading-snug text-ink-900">
                    {q.question}
                  </p>
                </div>
                <div className="space-y-2 p-4">
                  {q.options.map((opt, oi) => {
                    const selected = answers[qi] === oi;
                    const isCorrect = oi === q.correct_index;
                    const state =
                      showResults && selected && isCorrect
                        ? "correct"
                        : showResults && selected && !isCorrect
                          ? "incorrect"
                          : showResults && isCorrect
                            ? "correct-unselected"
                            : selected
                              ? "selected"
                              : "idle";

                    const classes: Record<typeof state, string> = {
                      idle: "border-[var(--rule)] bg-white hover:border-[var(--rule-strong)]",
                      selected: "border-ink-800 bg-paper-50",
                      correct: "border-moss-200 bg-moss-50 text-moss-500",
                      "correct-unselected":
                        "border-moss-200 bg-moss-50/70 text-moss-500",
                      incorrect:
                        "border-accent-200 bg-accent-50 text-accent-600",
                    };

                    return (
                      <button
                        key={oi}
                        type="button"
                        onClick={() => {
                          if (!showResults)
                            setAnswers({ ...answers, [qi]: oi });
                        }}
                        className={`flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left text-[13.5px] transition ${classes[state]}`}
                      >
                        <span className="mono mt-0.5 text-[11px] text-ink-400">
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span className="flex-1">{opt}</span>
                        {state === "correct" && (
                          <span className="text-moss-500">✓</span>
                        )}
                        {state === "correct-unselected" && (
                          <span className="text-moss-500">✓</span>
                        )}
                        {state === "incorrect" && (
                          <span className="text-accent-500">✗</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowResults((v) => !v)}
              disabled={!showResults && answeredCount === 0}
              className="btn btn-primary"
            >
              {showResults ? "Hide answers" : "Check answers"}
            </button>
            {showResults && (
              <button
                type="button"
                onClick={() => {
                  setAnswers({});
                  setShowResults(false);
                }}
                className="btn btn-secondary"
              >
                Reset
              </button>
            )}
          </div>
        </>
      )}

      {mode === "flashcards" && data.flashcards.length > 0 && (
        <div className="space-y-4">
          <div className="mx-auto max-w-lg">
            <button
              type="button"
              onClick={() => setFlipped((v) => !v)}
              className={`relative flex min-h-[220px] w-full items-center justify-center rounded-[14px] border border-[var(--rule-strong)] px-8 py-10 text-center transition ${
                flipped
                  ? "bg-paper-50 text-ink-700"
                  : "bg-white text-ink-900"
              }`}
              aria-label="Flip card"
            >
              <span className="absolute top-3 left-4 eyebrow">
                {flipped ? "Back" : "Front"}
              </span>
              <p
                className={`font-serif leading-[1.3] ${
                  flipped ? "text-[17px]" : "text-[22px] font-semibold"
                }`}
              >
                {flipped
                  ? data.flashcards[currentCard].back
                  : data.flashcards[currentCard].front}
              </p>
              <span className="absolute bottom-3 right-4 mono text-[11px] text-ink-400">
                {currentCard + 1} / {data.flashcards.length}
              </span>
            </button>
            <p className="mt-2 text-center text-[12px] text-ink-400">
              Click the card to flip.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCurrentCard((c) => Math.max(0, c - 1));
                setFlipped(false);
              }}
              disabled={currentCard === 0}
              className="btn btn-secondary"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentCard((c) =>
                  Math.min(data.flashcards.length - 1, c + 1)
                );
                setFlipped(false);
              }}
              disabled={currentCard === data.flashcards.length - 1}
              className="btn btn-secondary"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

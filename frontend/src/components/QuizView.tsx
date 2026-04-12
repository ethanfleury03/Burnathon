import { useState } from "react";
import type { QuizData } from "../api/types";

export default function QuizView({ data }: { data: QuizData }) {
  const [mode, setMode] = useState<"quiz" | "flashcards">("quiz");
  const [currentCard, setCurrentCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setMode("quiz")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            mode === "quiz"
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Quiz ({data.questions.length})
        </button>
        <button
          onClick={() => setMode("flashcards")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            mode === "flashcards"
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Flashcards ({data.flashcards.length})
        </button>
      </div>

      {mode === "quiz" && (
        <div className="space-y-6">
          {data.questions.map((q, qi) => (
            <div key={qi} className="bg-white rounded-lg border p-4">
              <p className="font-medium mb-3">
                {qi + 1}. {q.question}
              </p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  const isCorrect = oi === q.correct_index;
                  let optClass = "border-gray-200 hover:border-indigo-300";
                  if (showResults && selected && isCorrect)
                    optClass = "border-green-500 bg-green-50";
                  else if (showResults && selected && !isCorrect)
                    optClass = "border-red-500 bg-red-50";
                  else if (showResults && isCorrect)
                    optClass = "border-green-400 bg-green-50";
                  else if (selected) optClass = "border-indigo-500 bg-indigo-50";

                  return (
                    <button
                      key={oi}
                      onClick={() => {
                        if (!showResults)
                          setAnswers({ ...answers, [qi]: oi });
                      }}
                      className={`w-full text-left px-3 py-2 rounded border text-sm transition ${optClass}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button
            onClick={() => setShowResults(!showResults)}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
          >
            {showResults ? "Hide Answers" : "Check Answers"}
          </button>
          {showResults && (
            <p className="text-sm text-gray-600">
              Score:{" "}
              {
                data.questions.filter(
                  (q, i) => answers[i] === q.correct_index
                ).length
              }{" "}
              / {data.questions.length}
            </p>
          )}
        </div>
      )}

      {mode === "flashcards" && data.flashcards.length > 0 && (
        <div className="space-y-4">
          <div
            onClick={() => setFlipped(!flipped)}
            className="bg-white rounded-xl border-2 border-gray-200 p-8 min-h-[200px] flex items-center justify-center cursor-pointer hover:shadow-md transition"
          >
            <p className="text-lg text-center">
              {flipped
                ? data.flashcards[currentCard].back
                : data.flashcards[currentCard].front}
            </p>
          </div>
          <p className="text-center text-sm text-gray-400">
            Click card to flip
          </p>
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setCurrentCard(Math.max(0, currentCard - 1));
                setFlipped(false);
              }}
              disabled={currentCard === 0}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              {currentCard + 1} / {data.flashcards.length}
            </span>
            <button
              onClick={() => {
                setCurrentCard(
                  Math.min(data.flashcards.length - 1, currentCard + 1)
                );
                setFlipped(false);
              }}
              disabled={currentCard === data.flashcards.length - 1}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

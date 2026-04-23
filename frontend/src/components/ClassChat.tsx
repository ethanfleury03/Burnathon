import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, getApiErrorMessage, streamPost } from "../api/client";
import type { ClassChatMessageOut, ClassChatOut, Citation } from "../api/types";
import { Spinner } from "./ui/Spinner";
import { ErrorBanner } from "./ui/States";

function MessageBody({
  text,
  citations,
  onOpenCitation,
}: {
  text: string;
  citations: Citation[] | null;
  onOpenCitation: (c: Citation) => void;
}) {
  const byLabel = useMemo(() => {
    const m = new Map<string, Citation>();
    for (const c of citations ?? []) m.set(c.label, c);
    return m;
  }, [citations]);

  const parts = text.split(/(\[L\d+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = /^\[(L\d+)\]$/.exec(part);
        if (!match) {
          return <span key={i}>{part}</span>;
        }
        const label = match[1];
        const cit = byLabel.get(label);
        if (!cit) return <span key={i}>{part}</span>;
        return (
          <button
            key={i}
            type="button"
            className="citation-chip mx-0.5 inline-block align-baseline font-mono text-[11px] font-medium"
            title="Show source excerpt"
            onClick={() => onOpenCitation(cit)}
          >
            {part}
          </button>
        );
      })}
    </>
  );
}

export default function ClassChat({ classId }: { classId: string }) {
  const [chats, setChats] = useState<ClassChatOut[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ClassChatMessageOut[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState("");
  const [popover, setPopover] = useState<Citation | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadChats = useCallback(async () => {
    const list = await api.get<ClassChatOut[]>(`/api/classes/${classId}/chats`);
    if (!list.length) {
      const created = await api.post<ClassChatOut>(
        `/api/classes/${classId}/chats`,
        {}
      );
      setChats([created]);
      setActiveChatId(created.id);
    } else {
      setChats(list);
      setActiveChatId((prev) =>
        prev && list.some((c) => c.id === prev) ? prev : list[0].id
      );
    }
  }, [classId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    loadChats()
      .catch((e) => {
        if (!cancelled) setError(getApiErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadChats]);

  const loadMessages = useCallback(
    async (chatId: string) => {
      const msgs = await api.get<ClassChatMessageOut[]>(
        `/api/classes/${classId}/chats/${chatId}`
      );
      setMessages(msgs);
    },
    [classId]
  );

  useEffect(() => {
    if (!activeChatId) return;
    let cancelled = false;
    loadMessages(activeChatId)
      .catch((e) => {
        if (!cancelled) setError(getApiErrorMessage(e));
      })
      .then(() => {
        if (!cancelled) {
          window.requestAnimationFrame(() =>
            bottomRef.current?.scrollIntoView({ behavior: "smooth" })
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeChatId, loadMessages]);

  const newChat = async () => {
    setError("");
    try {
      const c = await api.post<ClassChatOut>(`/api/classes/${classId}/chats`, {
        title: "New chat",
      });
      setChats((prev) => [c, ...prev]);
      setActiveChatId(c.id);
      setMessages([]);
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  const send = async () => {
    if (!activeChatId || !input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    setStreamingText("");
    setError("");
    setPopover(null);

    const pendingId = `pending-${Date.now()}`;
    const pendingUser: ClassChatMessageOut = {
      id: pendingId,
      chat_id: activeChatId,
      role: "user",
      content: text,
      citations: null,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, pendingUser]);

    let acc = "";
    try {
      await streamPost(
        `/api/classes/${classId}/chats/${activeChatId}/messages`,
        { content: text },
        {
          onToken: (t) => {
            acc += t;
            setStreamingText(acc);
          },
          onError: (err) => setError(err.message),
        }
      );
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      await loadMessages(activeChatId);
      setStreamingText("");
      setSending(false);
    }
  };

  const activeTitle = chats.find((c) => c.id === activeChatId)?.title ?? "Chat";

  return (
    <section className="surface flex max-h-[min(72vh,720px)] min-h-[320px] flex-col overflow-hidden rounded-[14px] border border-[var(--rule)] bg-paper-50 shadow-sm">
      <header className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--rule)] px-4 py-3">
        <div>
          <p className="eyebrow text-ink-500">Class chat</p>
          <h2 className="mt-0.5 font-serif text-[17px] font-semibold tracking-tightish text-ink-900">
            Ask across lectures
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="select !max-w-[160px] !py-1.5 !text-[12px]"
            value={activeChatId ?? ""}
            onChange={(e) => setActiveChatId(e.target.value)}
            aria-label="Chat session"
            disabled={loading || !chats.length}
          >
            {chats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title.length > 28 ? `${c.title.slice(0, 26)}…` : c.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void newChat()}
            className="btn btn-secondary !py-1.5 !text-[12px]"
          >
            New
          </button>
        </div>
      </header>

      {error && (
        <div className="px-4 pt-3">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center gap-2 text-[13px] text-ink-500">
            <Spinner />
            Loading chat…
          </div>
        ) : (
          <>
            <p className="text-[12px] leading-relaxed text-ink-500">
              Answers use retrieved transcript excerpts from{" "}
              <span className="font-medium text-ink-700">{activeTitle}</span>.
              Citations like{" "}
              <span className="font-mono text-[11px] text-ink-700">[L1]</span>{" "}
              link back to the source lecture.
            </p>
            <ul className="space-y-3">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[92%] rounded-2xl rounded-br-md bg-ink-900 px-3.5 py-2.5 text-[13px] leading-relaxed text-paper-50"
                        : "max-w-[92%] rounded-2xl rounded-bl-md border border-[var(--rule)] bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-800 shadow-sm"
                    }
                  >
                    {m.role === "assistant" ? (
                      <MessageBody
                        text={m.content}
                        citations={m.citations}
                        onOpenCitation={(c) => setPopover(c)}
                      />
                    ) : (
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    )}
                  </div>
                </li>
              ))}
              {streamingText ? (
                <li className="flex justify-start">
                  <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-dashed border-accent-300/60 bg-accent-50/40 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-800">
                    <span className="whitespace-pre-wrap">{streamingText}</span>
                    <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-accent-500 align-middle" />
                  </div>
                </li>
              ) : null}
            </ul>
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <footer className="flex-shrink-0 border-t border-[var(--rule)] bg-paper-50/90 p-3 backdrop-blur-sm">
        <div className="flex gap-2">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Ask something grounded in this class…"
            className="input min-h-[44px] flex-1 resize-y !py-2 text-[13px]"
            disabled={sending || loading}
            aria-label="Chat message"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || loading || !input.trim()}
            className="btn btn-primary self-end !px-4"
          >
            {sending ? <Spinner /> : "Send"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-ink-400">
          Enter to send · Shift+Enter for newline
        </p>
      </footer>

      {popover && (
        <div
          className="fixed inset-0 z-40 bg-ink-900/20"
          role="presentation"
          onClick={() => setPopover(null)}
        >
          <div
            className="absolute left-1/2 top-1/2 z-50 w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-[var(--rule)] bg-white p-4 shadow-lg"
            role="dialog"
            aria-label="Citation details"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="eyebrow text-ink-500">{popover.label}</p>
            <p className="mt-1 font-serif text-[15px] font-semibold text-ink-900">
              {popover.lecture_title}
            </p>
            <p className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-600">
              {popover.excerpt}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to={`/lectures/${popover.lecture_id}?highlight=chunk-${popover.chunk_index}`}
                className="btn btn-primary !py-2 !text-[12px]"
                onClick={() => setPopover(null)}
              >
                Open lecture
              </Link>
              <button
                type="button"
                className="btn btn-secondary !py-2 !text-[12px]"
                onClick={() => setPopover(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

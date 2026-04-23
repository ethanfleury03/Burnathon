import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Spinner } from "./ui/Spinner";

interface InlineEditProps {
  value: string;
  onSave: (next: string) => Promise<void> | void;
  canEdit?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  display?: (value: string) => ReactNode;
  maxLength?: number;
  ariaLabel?: string;
}

/**
 * Click-to-edit inline text field. Enter saves, Escape cancels.
 * Falls back to plain text when `canEdit` is false.
 */
export default function InlineEdit({
  value,
  onSave,
  canEdit = true,
  placeholder = "Untitled",
  className = "",
  inputClassName = "",
  display,
  maxLength = 240,
  ariaLabel = "Edit title",
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = async () => {
    const next = draft.trim();
    if (!next) {
      setError("Title cannot be empty");
      return;
    }
    if (next === value) {
      setEditing(false);
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(value);
    setError(null);
    setEditing(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  if (!canEdit) {
    return (
      <span className={className}>{display ? display(value) : value}</span>
    );
  }

  if (editing) {
    return (
      <span className={`relative inline-flex items-center gap-2 ${className}`}>
        <input
          ref={inputRef}
          value={draft}
          maxLength={maxLength}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (!saving) void commit();
          }}
          aria-label={ariaLabel}
          disabled={saving}
          className={`min-w-[200px] rounded-md border border-[var(--rule-strong)] bg-paper-50 px-2 py-1 text-inherit font-inherit leading-tight outline-none focus:border-ink-700 focus:shadow-focus disabled:opacity-60 ${inputClassName}`}
        />
        {saving ? (
          <Spinner size={14} />
        ) : (
          <span className="eyebrow text-[9.5px] text-ink-400">
            Enter · Esc
          </span>
        )}
        {error && (
          <span className="absolute left-0 top-full mt-1 rounded bg-[#fdecec] px-2 py-0.5 text-[11px] text-[#9a2727]">
            {error}
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      className={`group cursor-text rounded-md px-1 -mx-1 transition hover:bg-paper-200/60 focus:bg-paper-200/60 focus:outline-none ${className}`}
      aria-label={ariaLabel}
      title="Click to rename"
    >
      {display ? display(value || placeholder) : value || (
        <span className="text-ink-400">{placeholder}</span>
      )}
      <span
        aria-hidden
        className="ml-1.5 inline-block align-middle text-[11px] text-ink-400 opacity-0 transition group-hover:opacity-100 group-focus:opacity-100"
      >
        ✎
      </span>
    </span>
  );
}

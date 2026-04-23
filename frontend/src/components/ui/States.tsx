import type { ReactNode } from "react";
import { Spinner } from "./Spinner";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`surface flex flex-col items-center text-center px-6 py-14 ${className}`}
      role="status"
    >
      {icon && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border rule bg-paper-50 text-ink-400">
          {icon}
        </div>
      )}
      <p className="display-sm">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-md text-sm text-ink-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({
  label = "Loading",
  className = "",
}: LoadingStateProps) {
  return (
    <div
      className={`surface flex items-center justify-center gap-3 px-5 py-10 text-sm text-ink-500 ${className}`}
      role="status"
      aria-live="polite"
    >
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

interface ErrorBannerProps {
  message: string;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorBanner({
  message,
  action,
  onDismiss,
  className = "",
}: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-[10px] border border-accent-100 bg-accent-50 px-4 py-3 text-[13px] text-accent-600 ${className}`}
    >
      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-accent-200 bg-white text-[11px] font-bold text-accent-500">
        !
      </span>
      <div className="flex-1">
        <p className="leading-snug">{message}</p>
      </div>
      {action}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="btn btn-ghost !py-1 !px-2 text-xs text-accent-500"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`skeleton ${className}`} />;
}

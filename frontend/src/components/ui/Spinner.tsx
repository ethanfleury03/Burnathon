interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 14, className = "" }: SpinnerProps) {
  return (
    <span
      aria-hidden
      className={`inline-block animate-spin rounded-full border-[2px] border-ink-200 border-t-ink-700 align-middle ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export interface Crumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  crumbs?: Crumb[];
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  crumbs,
  meta,
  actions,
  children,
}: PageHeaderProps) {
  return (
    <header className="animate-fadeIn">
      {crumbs && crumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-500"
        >
          {crumbs.map((c, i) => (
            <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              {c.to ? (
                <Link
                  to={c.to}
                  className="hover:text-ink-700 underline-offset-2 hover:underline"
                >
                  {c.label}
                </Link>
              ) : (
                <span className="text-ink-600">{c.label}</span>
              )}
              {i < crumbs.length - 1 && (
                <span aria-hidden className="text-ink-300">
                  /
                </span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h1 className="display-lg break-words">{title}</h1>
          {description && (
            <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink-500">
              {description}
            </p>
          )}
          {meta && (
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-500">
              {meta}
            </div>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {actions}
          </div>
        )}
      </div>
      {children}
    </header>
  );
}

interface MetaItemProps {
  label: string;
  value: ReactNode;
  mono?: boolean;
}

export function MetaItem({ label, value, mono }: MetaItemProps) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
        {label}
      </span>
      <span className={`text-ink-700 ${mono ? "mono text-[12.5px]" : ""}`}>
        {value}
      </span>
    </span>
  );
}

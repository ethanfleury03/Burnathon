import { useEffect, useState, type ReactNode } from "react";
import { UserButton, useUser } from "@clerk/clerk-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { api } from "../../api/client";
import type { MeOut } from "../../api/types";

const primaryNav = [
  { to: "/", label: "Library", end: true },
  { to: "/explore", label: "Explore", end: false },
  { to: "/new-lecture", label: "New lecture", end: false },
];

const adminNav = [
  { to: "/admin", label: "Admin", end: false },
  { to: "/db", label: "Schema", end: false },
];

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { user } = useUser();
  const location = useLocation();
  const [me, setMe] = useState<MeOut | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<MeOut>("/api/me")
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isAdmin = me?.user.role === "admin";
  const nav = isAdmin ? [...primaryNav, ...adminNav] : primaryNav;

  return (
    <div className="app-backdrop relative min-h-screen">
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 border-b border-[var(--rule)] bg-paper-100/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-6">
              <Link
                to="/"
                className="group flex items-center gap-2.5 text-ink-800"
                aria-label="Lecture Portal home"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-800 text-paper-50 font-serif text-[13px] font-semibold tracking-tight shadow-card">
                  Lp
                </span>
                <span className="flex flex-col leading-none">
                  <span className="font-serif text-[15px] font-semibold tracking-tightish text-ink-900">
                    Lecture Portal
                  </span>
                  <span className="eyebrow mt-[3px] hidden text-[9px] sm:block">
                    Editorial Study Workspace
                  </span>
                </span>
              </Link>
              <nav className="hidden items-center gap-1 md:flex">
                {nav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `relative rounded-md px-3 py-1.5 text-[13.5px] font-medium transition ${
                        isActive
                          ? "text-ink-900"
                          : "text-ink-500 hover:text-ink-800"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <span className="flex items-center gap-2">
                        {item.label}
                        {isActive && (
                          <span className="absolute inset-x-3 -bottom-[10px] h-[2px] rounded-full bg-ink-800" />
                        )}
                      </span>
                    )}
                  </NavLink>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-3 text-[12.5px] text-ink-500 sm:flex">
                {isAdmin && (
                  <span className="chip border-accent-100 bg-accent-50 text-accent-600">
                    <span className="chip-dot bg-accent-400" />
                    Admin
                  </span>
                )}
                <span className="truncate max-w-[180px]" title={user?.primaryEmailAddress?.emailAddress}>
                  {user?.primaryEmailAddress?.emailAddress}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="btn btn-ghost md:hidden !px-2"
                aria-label="Toggle navigation"
                aria-expanded={mobileOpen}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                  {mobileOpen ? (
                    <path
                      d="M4 4L14 14M14 4L4 14"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  ) : (
                    <>
                      <path d="M3 5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      <path d="M3 9h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      <path d="M3 13h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </>
                  )}
                </svg>
              </button>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "h-8 w-8 ring-1 ring-[var(--rule-strong)]",
                  },
                }}
              />
            </div>
          </div>
          {mobileOpen && (
            <div className="border-t border-[var(--rule)] bg-paper-100 md:hidden">
              <nav className="mx-auto flex w-full max-w-[1180px] flex-col px-4 py-2 sm:px-6">
                {nav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `rounded-md px-3 py-2 text-sm font-medium ${
                        isActive
                          ? "bg-paper-200 text-ink-900"
                          : "text-ink-600 hover:bg-paper-200"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
                <div className="mt-2 border-t border-[var(--rule)] px-3 pt-3 pb-1 text-[12px] text-ink-500">
                  {user?.primaryEmailAddress?.emailAddress}
                </div>
              </nav>
            </div>
          )}
        </header>

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-20 pt-8 sm:px-6 md:pt-10">
          {children}
        </main>

        <footer className="border-t border-[var(--rule)] bg-paper-100/60">
          <div className="mx-auto flex w-full max-w-[1180px] flex-col items-start justify-between gap-2 px-4 py-5 text-[12px] text-ink-500 sm:flex-row sm:items-center sm:px-6">
            <div className="flex items-center gap-2">
              <span className="font-serif text-[13px] text-ink-700">
                Lecture Portal
              </span>
              <span className="text-ink-300">·</span>
              <span>A calm place to study.</span>
            </div>
            <div className="flex items-center gap-4 mono text-[11px] text-ink-400">
              <span>v1.0</span>
              <span aria-hidden>·</span>
              <span>{new Date().getFullYear()}</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

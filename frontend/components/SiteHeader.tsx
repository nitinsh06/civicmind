"use client";

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

const NAV = [
  { href: "/report", label: "Report an issue" },
  { href: "/incidents", label: "My reports" },
  { href: "/dashboard", label: "Operations" },
]

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0">
      {/* Survey-pin mark */}
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <rect x="1" y="1" width="24" height="24" rx="5" fill="#132238" />
        <path d="M6 13h14M13 6v14" stroke="#fbfbf9" strokeWidth="1.2" opacity="0.45" />
        <circle cx="13" cy="13" r="4" fill="#e8930c" />
        <circle cx="13" cy="13" r="1.6" fill="#132238" />
      </svg>
      <span className="font-display font-700 text-xl font-bold tracking-tight text-ink leading-none">
        CivicMind
      </span>
    </Link>
  )
}

export default function SiteHeader() {
  const pathname = usePathname()
  const { user, loading, signIn, signOutUser } = useAuth()

  return (
    <header className="sticky top-0 z-[1100] bg-paper/95 backdrop-blur border-b border-line">
      <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-8 min-w-0">
          <Wordmark />
          <nav className="hidden sm:flex items-center gap-1">
            {NAV.map(({ href, label }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 text-[13px] font-semibold rounded-md transition-colors ${
                    active
                      ? "text-ink bg-line/60"
                      : "text-ink-soft hover:text-ink hover:bg-line/40"
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {loading ? null : user ? (
            <div className="flex items-center gap-2.5">
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full border border-line"
                />
              )}
              <span className="hidden md:block text-[13px] font-semibold text-ink max-w-32 truncate">
                {user.displayName || user.email}
              </span>
              <button
                type="button"
                onClick={() => signOutUser()}
                className="text-[12px] font-semibold text-ink-faint hover:text-ink transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => signIn().catch(() => {})}
              className="h-8 px-3.5 text-[13px] font-semibold text-ink border border-line bg-card hover:border-ink-faint rounded-md transition-colors"
            >
              Sign in
            </button>
          )}
        </div>
      </div>

      {/* Mobile nav row */}
      <nav className="sm:hidden flex items-center gap-1 px-4 pb-2 -mt-1 overflow-x-auto">
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1 text-[12px] font-semibold rounded-md whitespace-nowrap ${
              pathname === href ? "text-ink bg-line/60" : "text-ink-soft"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  )
}

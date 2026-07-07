"use client";

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

import SiteHeader from "@/components/SiteHeader"
import { getMyIncidentsAction } from "../actions"
import { Incident } from "@/lib/types"
import { useAuth } from "@/lib/auth-context"
import { getIncidentSeverity } from "@/lib/severity"

const SEVERITY_TONE: Record<string, string> = {
  critical: "bg-critical text-white",
  high: "bg-signal-deep text-white",
  medium: "bg-signal text-ink",
  low: "bg-verified text-white",
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Received",
  investigating: "Being investigated",
  dispatched: "Crew dispatched",
  resolved: "Resolved",
}

function ReportCard({ incident }: { incident: Incident }) {
  const text = incident.ai_analysis?.text
  const media = incident.ai_analysis?.media
  const severity = getIncidentSeverity(incident)
  const hasEvidence = incident.imageUrl || media

  return (
    <div className="bg-card border border-line rounded-xl overflow-hidden">
      {severity === "critical" && <div className="hazard-stripe h-1.5" />}
      <div className={`grid grid-cols-1 ${hasEvidence ? "lg:grid-cols-5" : ""}`}>
        {/* Report panel */}
        <div className="lg:col-span-3 p-6">
          <div className="flex items-start justify-between gap-4 mb-1">
            <h2 className="font-display text-3xl font-bold tracking-tight leading-none capitalize">
              {incident.title}
            </h2>
            {severity ? (
              <span className={`shrink-0 font-display uppercase text-[12px] font-bold tracking-wider px-2.5 py-1 rounded ${SEVERITY_TONE[severity] || "bg-line text-ink"}`}>
                {severity} severity
              </span>
            ) : incident.analysis_status === "failed" ? (
              <span className="shrink-0 bg-line/70 text-ink-soft font-display uppercase text-[12px] font-bold tracking-wider px-2.5 py-1 rounded">
                Analysis unavailable
              </span>
            ) : (
              <span className="shrink-0 bg-line/70 text-ink-soft font-display uppercase text-[12px] font-bold tracking-wider px-2.5 py-1 rounded animate-pulse">
                AI analyzing…
              </span>
            )}
          </div>
          <p className="font-mono text-[11px] text-ink-faint pb-3 border-b border-line">
            {incident.id}
            {incident.address && <> · {incident.address}</>}
            {" · "}{new Date(incident.created_at).toLocaleString()}
          </p>

          <div className="flex items-center gap-2 pt-3">
            <span className="font-display uppercase text-[11px] font-bold tracking-wider text-ink-faint">Status</span>
            <span className={`text-[12.5px] font-semibold px-2.5 py-0.5 rounded-full ${
              incident.status === "resolved"
                ? "bg-verified-wash text-verified"
                : "bg-signal-wash text-signal-deep"
            }`}>
              {STATUS_LABEL[incident.status] || incident.status}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
            <div className="space-y-3.5">
              <h3 className="font-display uppercase text-[12px] font-bold tracking-[0.14em] text-ink-faint">AI analysis</h3>
              <div>
                <p className="text-[11px] font-semibold text-ink-faint">Category</p>
                <p className="text-[14px] font-semibold capitalize">{text?.category || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-ink-faint">Routed to</p>
                <p className="text-[14px] font-semibold">{text?.responsible_department || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-ink-faint">Summary</p>
                <p className="text-[13px] text-ink-soft leading-relaxed">
                  {text?.summary || "The AI is still reading your report."}
                </p>
              </div>
            </div>

            <div className="bg-paper border border-line rounded-lg p-4 space-y-3.5">
              <div>
                <p className="text-[11px] font-semibold text-ink-faint mb-1">Your description</p>
                <p className="text-[13px] italic text-ink-soft">"{incident.description}"</p>
              </div>
              {!!text?.tags?.length && (
                <div className="flex flex-wrap gap-1.5">
                  {text.tags.map((tag) => (
                    <span key={tag} className="bg-verified-wash text-verified text-[11.5px] font-semibold px-2 py-0.5 rounded">
                      #{tag.replace(/^#/, "")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {media?.recommended_action && (
            <div className="mt-5 pt-4 border-t border-line">
              <h3 className="font-display uppercase text-[12px] font-bold tracking-[0.14em] text-ink-faint mb-1.5">
                Recommended actions
              </h3>
              <p className="text-[13px] text-ink-soft leading-relaxed">{media.recommended_action}</p>
            </div>
          )}
        </div>

        {/* Evidence panel */}
        {hasEvidence && (
          <div className="lg:col-span-2 p-6 lg:border-l border-t lg:border-t-0 border-line space-y-4">
            <h3 className="font-display uppercase text-[12px] font-bold tracking-[0.14em] text-ink-faint">
              Photo evidence
            </h3>
            {incident.imageUrl && (
              <img
                src={incident.imageUrl}
                alt={`Evidence for ${incident.title}`}
                className="w-full max-h-64 object-cover rounded-lg border border-line"
              />
            )}
            {media ? (
              <>
                <div>
                  <p className="text-[11px] font-semibold text-ink-faint mb-1">What the AI saw</p>
                  <p className="text-[13px] text-ink-soft leading-relaxed">{media.summary}</p>
                </div>
                {!!media.visible_objects?.length && (
                  <div>
                    <p className="text-[11px] font-semibold text-ink-faint mb-1">Detected</p>
                    <p className="text-[12.5px] text-ink-faint">{media.visible_objects.join(", ")}.</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-[12px] text-ink-faint">
                {incident.analysis_status === "pending"
                  ? "Photo analysis is running…"
                  : "No photo analysis available."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MyReportsPage() {
  const { user, loading: authLoading, signIn } = useAuth()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return
    try {
      const token = await user.getIdToken()
      const data = await getMyIncidentsAction(token)
      setIncidents(data)
    } catch (err) {
      console.error("Failed to load reports:", err)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (!user) {
      setIncidents([])
      setLoading(true)
      return
    }
    refresh()
    const timer = setInterval(refresh, 15_000)
    return () => clearInterval(timer)
  }, [user, refresh])

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-5 py-10 space-y-5">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">My reports</h1>
          <p className="text-[14px] text-ink-soft mt-1">
            Every report you've filed, with the AI's analysis and where it stands.
          </p>
        </div>

        {authLoading ? (
          <p className="font-mono text-[12px] text-ink-faint">Checking your session…</p>
        ) : !user ? (
          <div className="bg-card border border-line rounded-xl p-8 max-w-lg">
            <p className="font-display text-2xl font-semibold leading-tight">
              Sign in to see your reports
            </p>
            <p className="text-[13.5px] text-ink-soft leading-relaxed mt-2">
              Your reports are private — only you can see them here. Anonymous
              reports can't be tracked, so sign in before filing if you want to
              follow what happens.
            </p>
            <button
              type="button"
              onClick={() => signIn().catch(() => {})}
              className="mt-5 h-11 px-5 inline-flex items-center gap-2.5 bg-ink hover:bg-ink/90 text-paper font-display uppercase tracking-wide text-[14px] font-bold rounded-lg transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
              Sign in with Google
            </button>
          </div>
        ) : loading ? (
          <p className="font-mono text-[12px] text-ink-faint">Loading your reports…</p>
        ) : incidents.length === 0 ? (
          <div className="bg-card border border-line rounded-xl p-8 max-w-lg">
            <p className="font-display text-2xl font-semibold leading-tight">Nothing here yet</p>
            <p className="text-[13.5px] text-ink-soft mt-2">
              Reports you file while signed in will show up here with their AI
              analysis and live status.
            </p>
            <Link
              href="/report"
              className="mt-5 h-11 px-5 inline-flex items-center bg-signal hover:bg-signal-deep text-ink hover:text-white font-display uppercase tracking-wide text-[14px] font-bold rounded-lg transition-colors"
            >
              Report an issue
            </Link>
          </div>
        ) : (
          incidents.map((incident) => <ReportCard key={incident.id} incident={incident} />)
        )}
      </main>
    </div>
  )
}

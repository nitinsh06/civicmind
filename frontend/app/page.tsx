"use client";

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

import SiteHeader from "@/components/SiteHeader"
import { getIncidentsAction } from "./actions"
import { Incident } from "@/lib/types"
import { getIncidentSeverity } from "@/lib/severity"

const SEVERITY_TONE: Record<string, string> = {
  critical: "bg-critical text-white",
  high: "bg-signal-deep text-white",
  medium: "bg-signal text-ink",
  low: "bg-verified text-white",
}

/** The product itself is the hero: a real, freshly analyzed incident. */
function IntelligenceCard({ incident }: { incident: Incident | null }) {
  const sample: Partial<Incident> = {
    id: "inc-sample",
    title: "Partial bridge collapse blocking major road",
    address: "Outer Ring Road, Bellandur",
    ai_analysis: {
      text: {
        category: "road damage",
        severity: "critical",
        responsible_department: "Public Works",
        analysis_confidence: 0.95,
        summary:
          "Bridge collapse causing significant road damage; critical safety hazard requiring immediate intervention.",
        tags: ["bridgecollapse", "publicsafety"],
      },
    },
  }
  const inc = incident ?? (sample as Incident)
  const text = inc.ai_analysis?.text
  const severity = incident ? getIncidentSeverity(inc) : "critical"

  return (
    <div className="relative bg-card border border-line rounded-xl shadow-[0_16px_40px_-24px_rgba(19,34,56,0.45)] overflow-hidden">
      {severity === "critical" && <div className="hazard-stripe h-1.5" />}
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] text-ink-faint">{inc.id}</span>
          {severity && (
            <span className={`font-display uppercase text-[12px] font-bold tracking-wider px-2.5 py-1 rounded ${SEVERITY_TONE[severity] || "bg-line text-ink"}`}>
              {severity}
            </span>
          )}
        </div>
        <div>
          <p className="font-display text-2xl font-semibold leading-tight capitalize">{inc.title}</p>
          {inc.address && <p className="text-[13px] text-ink-soft mt-0.5">{inc.address}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div className="bg-paper border border-line rounded-lg px-3 py-2">
            <p className="font-display uppercase text-[11px] font-semibold tracking-wider text-ink-faint">Routed to</p>
            <p className="font-semibold">{text?.responsible_department || "—"}</p>
          </div>
          <div className="bg-paper border border-line rounded-lg px-3 py-2">
            <p className="font-display uppercase text-[11px] font-semibold tracking-wider text-ink-faint">AI confidence</p>
            <p className="font-mono font-medium">
              {text?.analysis_confidence != null ? `${(text.analysis_confidence * 100).toFixed(0)}%` : "—"}
            </p>
          </div>
        </div>
        {text?.summary && (
          <p className="text-[13px] text-ink-soft leading-relaxed line-clamp-3">{text.summary}</p>
        )}
        <p className="font-mono text-[10.5px] text-ink-faint pt-1 border-t border-line">
          {incident ? "LIVE · analyzed by Gemini" : "SAMPLE · what a report becomes"}
        </p>
      </div>
    </div>
  )
}

const STEPS = [
  {
    n: "01",
    title: "Tell us what you see",
    body: "A few words, your location, a photo if you have one. Sign in with Google to build reporter trust — or stay anonymous.",
  },
  {
    n: "02",
    title: "Gemini triages it",
    body: "The AI reads your words and your photo, grades severity, and writes the operational summary a city engineer needs.",
  },
  {
    n: "03",
    title: "It reaches the right desk",
    body: "Routed to the responsible department, ranked by severity — not by who shouted loudest. Track it any time.",
  },
]

export default function Landing() {
  const [incidents, setIncidents] = useState<Incident[]>([])

  useEffect(() => {
    getIncidentsAction().then(setIncidents).catch(() => {})
  }, [])

  const latestAnalyzed = useMemo(
    () =>
      [...incidents]
        .filter((i) => i.ai_analysis?.text)
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))[0] || null,
    [incidents]
  )

  const stats = useMemo(() => {
    const critical = incidents.filter((i) =>
      ["critical", "high"].includes(getIncidentSeverity(i) || "")
    ).length
    const resolved = incidents.filter((i) => i.status === "resolved").length
    return { total: incidents.length, critical, resolved }
  }, [incidents])

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* Hero */}
      <section className="survey-grid border-b border-line">
        <div className="max-w-6xl mx-auto px-5 py-14 md:py-20 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="font-mono text-[11.5px] text-signal-deep font-medium tracking-wide mb-4">
              CIVIC INTELLIGENCE PLATFORM · BENGALURU PILOT
            </p>
            <h1 className="font-display text-5xl md:text-[64px] font-bold leading-[0.95] tracking-tight">
              Broken street?
              <br />
              Report it in{" "}
              <span className="text-signal-deep">sixty seconds.</span>
            </h1>
            <p className="text-[15px] text-ink-soft leading-relaxed mt-5 max-w-md">
              CivicMind turns your report into structured intelligence. Gemini AI
              reads the text and the photo, grades the severity, and routes it to
              the department that can actually fix it.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-7">
              <Link
                href="/report"
                className="h-11 px-6 inline-flex items-center bg-signal hover:bg-signal-deep text-ink hover:text-white font-display uppercase tracking-wide text-[15px] font-bold rounded-lg transition-colors"
              >
                Report an issue
              </Link>
              <Link
                href="/incidents"
                className="h-11 px-5 inline-flex items-center border border-ink/25 hover:border-ink text-ink font-display uppercase tracking-wide text-[15px] font-semibold rounded-lg transition-colors"
              >
                Track my reports
              </Link>
            </div>
          </div>
          <div className="lg:pl-6">
            <IntelligenceCard incident={latestAnalyzed} />
          </div>
        </div>
      </section>

      {/* Signature divider */}
      <div className="hazard-stripe h-2" aria-hidden="true" />

      {/* How it works — a real sequence, so it earns its numbers */}
      <section className="max-w-6xl mx-auto px-5 py-14 w-full">
        <h2 className="font-display uppercase text-[13px] font-bold tracking-[0.18em] text-ink-faint mb-8">
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-card border border-line rounded-xl p-5">
              <p className="font-mono text-[12px] text-signal-deep font-medium">{s.n}</p>
              <p className="font-display text-2xl font-semibold mt-2 leading-tight">{s.title}</p>
              <p className="text-[13.5px] text-ink-soft leading-relaxed mt-2">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live counts */}
      <section className="border-y border-line bg-card">
        <div className="max-w-6xl mx-auto px-5 py-8 grid grid-cols-3 gap-6">
          {[
            { label: "Reports filed", value: stats.total },
            { label: "Urgent right now", value: stats.critical },
            { label: "Resolved", value: stats.resolved },
          ].map((s) => (
            <div key={s.label}>
              <p className="font-mono text-3xl md:text-4xl font-medium tabular-nums">{s.value}</p>
              <p className="font-display uppercase text-[12px] font-semibold tracking-wider text-ink-faint mt-1">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Operators band */}
      <section className="bg-ink text-paper">
        <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <p className="font-display text-3xl font-semibold leading-tight">Running the city?</p>
            <p className="text-[13.5px] text-paper/70 mt-1 max-w-lg">
              The operations dashboard ranks every incident by severity, maps the
              hotspots, and tracks each one from report to resolution.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="h-11 px-6 inline-flex items-center self-start md:self-auto bg-paper text-ink hover:bg-signal font-display uppercase tracking-wide text-[15px] font-bold rounded-lg transition-colors shrink-0"
          >
            Open the dashboard
          </Link>
        </div>
      </section>

      <footer className="mt-auto">
        <div className="max-w-6xl mx-auto px-5 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[12px] text-ink-faint">
          <p className="font-semibold text-ink-soft">CivicMind — AI civic intelligence</p>
          <p className="font-mono">Gemini · Firestore · Cloud Run</p>
        </div>
      </footer>
    </div>
  )
}

"use client";

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

import { getIncidentsAction } from "../actions"
import { Incident } from "@/lib/types"
import { getIncidentSeverity, SEVERITY_RANK } from "@/lib/severity"

const SEVERITY_BANNER: Record<string, string> = {
  critical: "bg-red-600",
  high: "bg-orange-600",
  medium: "bg-amber-500",
  low: "bg-emerald-600",
}

function ReportCard({ incident }: { incident: Incident }) {
  const text = incident.ai_analysis?.text
  const media = incident.ai_analysis?.media
  const severity = getIncidentSeverity(incident)
  const hasEvidence = incident.imageUrl || media

  return (
    <div className={`grid grid-cols-1 ${hasEvidence ? "lg:grid-cols-5" : ""} gap-4`}>
      {/* Incident Report panel */}
      <div className="lg:col-span-3 bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-1">
          <h2 className="text-2xl font-bold text-blue-600 tracking-tight capitalize">
            {incident.title}
          </h2>
          {severity ? (
            <span className={`shrink-0 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded ${SEVERITY_BANNER[severity] || "bg-zinc-500"}`}>
              {severity} severity
            </span>
          ) : incident.analysis_status === "failed" ? (
            <span className="shrink-0 bg-zinc-200 text-zinc-600 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded">
              Analysis unavailable
            </span>
          ) : (
            <span className="shrink-0 bg-zinc-200 text-zinc-600 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded animate-pulse">
              AI analyzing…
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500 pb-3 border-b border-zinc-200">
          ID: {incident.id}
          {incident.address && <> · {incident.address}</>}
          {" · "}{new Date(incident.created_at).toLocaleString()}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
          <div className="space-y-4">
            <h3 className="text-base font-bold text-zinc-900">AI Text Analysis</h3>
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Category</p>
              <p className="text-sm text-zinc-800 capitalize">{text?.category || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Responsible Dept</p>
              <p className="text-sm text-zinc-800">{text?.responsible_department || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Analysis Summary</p>
              <p className="text-sm text-zinc-700 leading-relaxed">
                {text?.summary || "AI analysis is processing in the background."}
              </p>
            </div>
          </div>

          <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-4 space-y-4">
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Citizen Description</p>
              <p className="text-sm italic text-zinc-700">"{incident.description}"</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Reporter Info</p>
              {incident.reporter?.authenticated ? (
                <>
                  <p className="text-sm font-bold text-zinc-900">{incident.reporter.name || incident.reporter.email}</p>
                  <p className="text-xs text-zinc-600">
                    {incident.reporter.trust_level.replaceAll("_", " ")} (Trust: {(incident.reporter.trust_score * 100).toFixed(0)}%)
                  </p>
                </>
              ) : (
                <p className="text-sm text-zinc-600">
                  Anonymous{incident.reporter ? ` (Trust: ${(incident.reporter.trust_score * 100).toFixed(0)}%)` : ""}
                </p>
              )}
            </div>
            {!!text?.tags?.length && (
              <div className="flex flex-wrap gap-2">
                {text.tags.map((tag) => (
                  <span key={tag} className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded">
                    #{tag.replace(/^#/, "")}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {media?.recommended_action && (
          <div className="mt-5 pt-4 border-t border-zinc-200">
            <h3 className="text-base font-bold text-zinc-900 mb-2">Recommended Actions</h3>
            <p className="text-sm text-zinc-700 leading-relaxed">{media.recommended_action}</p>
          </div>
        )}
      </div>

      {/* Media Evidence panel */}
      {hasEvidence && (
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-zinc-900">Incident Media Evidence</h3>
          {incident.imageUrl && (
            <img
              src={incident.imageUrl}
              alt={`Evidence for ${incident.title}`}
              className="w-full max-h-72 object-cover rounded-lg border border-zinc-200"
            />
          )}
          {media ? (
            <>
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Media Analysis Summary</p>
                <p className="text-sm text-zinc-700 leading-relaxed">{media.summary}</p>
              </div>
              {!!media.visible_objects?.length && (
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Detected Objects</p>
                  <p className="text-sm text-zinc-500">{media.visible_objects.join(", ")}.</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-zinc-400">
              {incident.analysis_status === "pending"
                ? "Image analysis is processing in the background…"
                : "No media analysis available for this image."}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const data = await getIncidentsAction()
    setIncidents(data)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 15_000)
    return () => clearInterval(timer)
  }, [])

  // Most severe first, then newest
  const sorted = useMemo(() => {
    return [...incidents].sort((a, b) => {
      const ra = SEVERITY_RANK[getIncidentSeverity(a) || ""] ?? 4
      const rb = SEVERITY_RANK[getIncidentSeverity(b) || ""] ?? 4
      if (ra !== rb) return ra - rb
      return (b.created_at || "").localeCompare(a.created_at || "")
    })
  }, [incidents])

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      <header className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Incident Reports</h1>
          <p className="text-[11px] text-zinc-500">AI-generated intelligence for every citizen report</p>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="h-9 px-4 inline-flex items-center border border-zinc-300 hover:bg-zinc-50 text-zinc-800 text-xs font-bold rounded-lg transition-all"
          >
            Operations Dashboard
          </Link>
          <Link
            href="/"
            className="h-9 px-4 inline-flex items-center bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-lg transition-all"
          >
            + Report Incident
          </Link>
        </nav>
      </header>

      <main className="p-6 max-w-6xl mx-auto space-y-6">
        {loading ? (
          <p className="text-xs text-zinc-400">Loading incident reports…</p>
        ) : sorted.length === 0 ? (
          <p className="text-xs text-zinc-400">No incidents reported yet.</p>
        ) : (
          sorted.map((incident) => <ReportCard key={incident.id} incident={incident} />)
        )}
      </main>
    </div>
  )
}

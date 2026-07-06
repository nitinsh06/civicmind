"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"

import {
  getIncidentsAction,
  updateIncidentStatusAction,
  verifyDroneImageryAction,
} from "../actions"
import { Incident } from "@/lib/types"
import { calibrateImage } from "@/lib/image"
import { getIncidentSeverity, SEVERITY_RANK } from "@/lib/severity"

const IncidentMap = dynamic(() => import("@/components/IncidentMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-xs text-zinc-400">
      Loading map…
    </div>
  ),
})

const POLL_INTERVAL_MS = 10_000

const STATUSES: Incident["status"][] = ["pending", "investigating", "dispatched", "resolved"]

// Status severity badges: color + text label together, never color alone
const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-50 border-red-200 text-red-700",
  high: "bg-orange-50 border-orange-200 text-orange-700",
  medium: "bg-amber-50 border-amber-200 text-amber-700",
  low: "bg-emerald-50 border-emerald-200 text-emerald-700",
}

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-600",
  high: "bg-orange-600",
  medium: "bg-amber-600",
  low: "bg-emerald-600",
}

function SeverityBadge({ severity, analysisStatus }: { severity?: string; analysisStatus?: string }) {
  if (!severity) {
    const failed = analysisStatus === "failed"
    return (
      <span className="inline-flex items-center gap-1.5 border border-zinc-200 bg-zinc-50 text-zinc-500 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
        <span className={`w-1.5 h-1.5 rounded-full bg-zinc-400 ${failed ? "" : "animate-pulse"}`} />
        {failed ? "No analysis" : "Analyzing"}
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 border text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${SEVERITY_BADGE[severity] || "bg-zinc-50 border-zinc-200 text-zinc-600"}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[severity] || "bg-zinc-400"}`} />
      {severity}
    </span>
  )
}

function StatTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold text-zinc-900 mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-zinc-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function Dashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const droneInputRef = useRef<HTMLInputElement>(null)
  const droneTargetId = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    const data = await getIncidentsAction()
    setIncidents(data)
    setLastRefresh(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  // Priority queue: critical first, then newest
  const sorted = useMemo(() => {
    return [...incidents].sort((a, b) => {
      const ra = SEVERITY_RANK[getIncidentSeverity(a) || ""] ?? 4
      const rb = SEVERITY_RANK[getIncidentSeverity(b) || ""] ?? 4
      if (ra !== rb) return ra - rb
      return (b.created_at || "").localeCompare(a.created_at || "")
    })
  }, [incidents])

  const stats = useMemo(() => {
    const active = incidents.filter((i) => i.status !== "resolved")
    const urgent = incidents.filter((i) =>
      ["critical", "high"].includes(getIncidentSeverity(i) || "")
    )
    const analyzing = incidents.filter((i) => i.analysis_status === "pending")
    const resolved = incidents.filter((i) => i.status === "resolved")
    return { total: incidents.length, active: active.length, urgent: urgent.length, analyzing: analyzing.length, resolved: resolved.length }
  }, [incidents])

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const i of incidents) {
      const cat = i.ai_analysis?.text?.category || "unclassified"
      counts.set(cat, (counts.get(cat) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [incidents])
  const maxCategory = categories.length ? categories[0][1] : 1

  const handleStatusChange = async (id: string, status: Incident["status"]) => {
    setBusyId(id)
    setError("")
    const result = await updateIncidentStatusAction(id, status)
    if (!result.success) setError(result.error || "Failed to update status")
    await refresh()
    setBusyId(null)
  }

  const handleDroneVerify = (id: string) => {
    droneTargetId.current = id
    droneInputRef.current?.click()
  }

  const handleDroneFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const id = droneTargetId.current
    e.target.value = ""
    if (!file || !id) return
    setBusyId(id)
    setError("")
    try {
      const base64 = await calibrateImage(file)
      const result = await verifyDroneImageryAction(id, base64)
      if (!result.success) setError(result.error || "Drone verification failed")
    } catch (err: any) {
      setError(err.message || "Failed to process drone image")
    }
    await refresh()
    setBusyId(null)
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* Hidden shared file input for drone verification */}
      <input ref={droneInputRef} type="file" accept="image/*" className="hidden" onChange={handleDroneFile} />

      <header className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between sticky top-0 z-[1000]">
        <div>
          <h1 className="text-lg font-bold tracking-tight">CivicMind — Operations Dashboard</h1>
          <p className="text-[11px] text-zinc-500">
            AI-triaged civic incidents, prioritized by severity
            {lastRefresh && <> · refreshed {lastRefresh.toLocaleTimeString()}</>}
          </p>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            href="/incidents"
            className="h-9 px-4 inline-flex items-center border border-zinc-300 hover:bg-zinc-50 text-zinc-800 text-xs font-bold rounded-lg transition-all"
          >
            Incident Reports
          </Link>
          <Link
            href="/"
            className="h-9 px-4 inline-flex items-center bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-lg transition-all"
          >
            + Report Incident
          </Link>
        </nav>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">{error}</div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatTile label="Total Reports" value={stats.total} />
          <StatTile label="Active" value={stats.active} hint="not yet resolved" />
          <StatTile label="Urgent" value={stats.urgent} hint="critical / high severity" />
          <StatTile label="AI Analyzing" value={stats.analyzing} hint="processing in background" />
          <StatTile label="Resolved" value={stats.resolved} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200">
              <h2 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Incident Map</h2>
            </div>
            <div className="h-105">
              <IncidentMap incidents={incidents} />
            </div>
          </div>

          {/* Category breakdown */}
          <div className="bg-white border border-zinc-200 rounded-xl">
            <div className="px-4 py-3 border-b border-zinc-200">
              <h2 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Reports by Category</h2>
            </div>
            <div className="p-4 space-y-3">
              {categories.length === 0 && (
                <p className="text-xs text-zinc-400">No reports yet.</p>
              )}
              {categories.map(([cat, count]) => (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-700 capitalize">{cat}</span>
                    <span className="text-zinc-500 tabular-nums">{count}</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-zinc-800 rounded-sm transition-all"
                      style={{ width: `${(count / maxCategory) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Priority queue */}
        <div className="bg-white border border-zinc-200 rounded-xl">
          <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
            <h2 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Priority Queue</h2>
            <span className="text-[10px] text-zinc-400">auto-refreshes every {POLL_INTERVAL_MS / 1000}s</span>
          </div>

          {loading ? (
            <p className="p-6 text-xs text-zinc-400">Loading incidents…</p>
          ) : sorted.length === 0 ? (
            <p className="p-6 text-xs text-zinc-400">No incidents reported yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {sorted.map((incident) => {
                const text = incident.ai_analysis?.text
                const severity = getIncidentSeverity(incident)
                const busy = busyId === incident.id
                return (
                  <li key={incident.id} className={`p-4 flex gap-4 ${busy ? "opacity-50" : ""}`}>
                    {incident.imageUrl && (
                      <img
                        src={incident.imageUrl}
                        alt=""
                        className="w-20 h-20 object-cover rounded-lg border border-zinc-200 shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SeverityBadge severity={severity} analysisStatus={incident.analysis_status} />
                        {text?.category && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                            {text.category}
                          </span>
                        )}
                        {incident.drone_verification && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                            Drone: {incident.drone_verification.verification_status.replaceAll("_", " ")}
                          </span>
                        )}
                        {incident.reporter && (
                          incident.reporter.authenticated ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded">
                              ✓ {incident.reporter.trust_level.replaceAll("_", " ")} · {(incident.reporter.trust_score * 100).toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                              Anonymous · {(incident.reporter.trust_score * 100).toFixed(0)}%
                            </span>
                          )
                        )}
                      </div>
                      <p className="font-bold text-sm text-zinc-900 truncate">{incident.title}</p>
                      <p className="text-xs text-zinc-600 line-clamp-2">
                        {text?.summary || incident.description}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {incident.reporter?.authenticated && incident.reporter.name && <>By {incident.reporter.name} · </>}
                        {text?.responsible_department && <>Dept: <strong>{text.responsible_department}</strong> · </>}
                        {text?.analysis_confidence != null && <>AI confidence {(text.analysis_confidence * 100).toFixed(0)}% · </>}
                        {incident.address && <>{incident.address} · </>}
                        {new Date(incident.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <select
                        value={incident.status}
                        disabled={busy}
                        onChange={(e) => handleStatusChange(incident.id, e.target.value as Incident["status"])}
                        className="h-8 px-2 text-xs border border-zinc-300 rounded-lg bg-white focus:outline-none focus:border-zinc-900 capitalize"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s} className="capitalize">{s}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDroneVerify(incident.id)}
                        className="h-8 px-3 text-[11px] font-bold border border-zinc-300 hover:bg-zinc-50 rounded-lg transition-all disabled:opacity-50"
                      >
                        {busy ? "Working…" : "Drone Verify"}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}

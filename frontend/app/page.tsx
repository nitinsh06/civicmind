"use client";

import { useState } from "react"
import { submitIncidentAction } from "./actions"

export default function Home() {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [address, setAddress] = useState("")
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)

  const [gpsLoading, setGpsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [successResult, setSuccessResult] = useState<any | null>(null)

  // Request browser coordinates
  const handleDetectLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setError("Geolocation is not supported by your browser.")
      return
    }

    setGpsLoading(true)
    setError("")
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(parseFloat(position.coords.latitude.toFixed(6)))
        setLongitude(parseFloat(position.coords.longitude.toFixed(6)))
        setGpsLoading(false)
      },
      (err) => {
        console.error("GPS Error:", err)
        setError("Location permission denied or retrieval failed.")
        setLatitude(null)
        setLongitude(null)
        setGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !description.trim()) {
      setError("Please provide a title and description.")
      return
    }

    setError("")
    setIsSubmitting(true)
    setSuccessResult(null)

    const result = await submitIncidentAction({
      title,
      description,
      latitude,
      longitude,
      address: address.trim() || undefined,
    })

    setIsSubmitting(false)

    if (result.success && result.incident) {
      setSuccessResult(result.incident)
      // Reset form fields
      setTitle("")
      setDescription("")
      setAddress("")
      setLatitude(null)
      setLongitude(null)
    } else {
      setError(result.error || "Failed to submit to FastAPI backend.")
    }
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans p-8 md:p-16 flex flex-col items-center">
      <div className="w-full max-w-xl bg-zinc-50 border border-zinc-200 rounded-xl p-8 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 mb-2">
          Report Incident
        </h1>
        <p className="text-sm text-zinc-600 mb-6">
          Submit a report to the FastAPI backend.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
            {error}
          </div>
        )}

        {successResult && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 space-y-2">
            <p className="font-bold text-sm">✓ Incident Registered Successfully!</p>
            <div className="border-t border-emerald-200/50 pt-2 space-y-1">
              <p><strong>Incident ID:</strong> {successResult.id}</p>
              <p><strong>AI Category:</strong> {successResult.ai_analysis.category}</p>
              <p><strong>AI Severity:</strong> {successResult.ai_analysis.severity}</p>
              <p><strong>Assigned Dept:</strong> {successResult.ai_analysis.responsible_department}</p>
              <p><strong>AI Summary:</strong> "{successResult.ai_analysis.summary}"</p>
              <p><strong>Coordinates:</strong> {successResult.latitude}, {successResult.longitude}</p>
              {successResult.address && <p><strong>Address:</strong> {successResult.address}</p>}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Title
            </label>
            <input
              type="text"
              placeholder="e.g. Broken pipe leakage"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={isSubmitting}
              className="h-10 px-3 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:border-zinc-900 transition-all text-zinc-900"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Description
            </label>
            <textarea
              placeholder="Provide incident details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              disabled={isSubmitting}
              className="p-3 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:border-zinc-900 transition-all text-zinc-900"
            />
          </div>

          {/* Address */}
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Address
            </label>
            <input
              type="text"
              placeholder="e.g. 24th and Valencia St, San Francisco"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isSubmitting}
              className="h-10 px-3 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:border-zinc-900 transition-all text-zinc-900"
            />
          </div>

          {/* Geolocation Section */}
          <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-100/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                Browser Coordinates
              </span>
              {latitude && longitude ? (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                  Detected
                </span>
              ) : (
                <span className="text-[10px] bg-zinc-200 text-zinc-700 font-bold px-2 py-0.5 rounded">
                  Not Provided
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono text-zinc-600 bg-white p-2 border border-zinc-200 rounded">
              <div>Lat: {latitude !== null ? latitude : "---"}</div>
              <div>Lng: {longitude !== null ? longitude : "---"}</div>
            </div>

            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={gpsLoading || isSubmitting}
              className="w-full h-9 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-800 text-xs font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
            >
              {gpsLoading ? "Acquiring location..." : "Detect browser Geolocation"}
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center"
          >
            {isSubmitting ? (
              <span className="flex items-center space-x-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Submitting to FastAPI...</span>
              </span>
            ) : (
              "Submit Incident"
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

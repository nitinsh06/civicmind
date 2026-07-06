"use client";

import { useEffect, useState } from "react"
import Script from "next/script"
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth"

import { submitIncidentAction } from "./actions"
import { calibrateImage } from "@/lib/image"
import { auth, googleProvider } from "@/lib/firebase"

// Turnstile site keys are public by design; env override, baked fallback for
// Cloud Run source builds where NEXT_PUBLIC_* isn't available at build time.
const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAADwgHi-AnGoJ8NSv"

export default function Home() {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [address, setAddress] = useState("")
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)

  const [base64Image, setBase64Image] = useState("")
  const [imageName, setImageName] = useState("")

  const [gpsLoading, setGpsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [successResult, setSuccessResult] = useState<any | null>(null)

  const [user, setUser] = useState<User | null>(null)
  const [authBusy, setAuthBusy] = useState(false)

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  const handleSignIn = async () => {
    setAuthBusy(true)
    setError("")
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err: any) {
      console.error("Google sign-in failed:", err)
      if (err?.code !== "auth/popup-closed-by-user") {
        setError("Google sign-in failed. You can still report anonymously.")
      }
    }
    setAuthBusy(false)
  }

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

    const turnstileToken =
      (document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement | null)
        ?.value || undefined

    // Authenticated reports carry a higher trust score on the backend
    let idToken: string | undefined
    try {
      idToken = await auth.currentUser?.getIdToken()
    } catch (err) {
      console.error("Failed to get ID token, submitting anonymously:", err)
    }

    const result = await submitIncidentAction({
      title,
      description,
      latitude,
      longitude,
      address: address.trim() || undefined,
      imageUrl: base64Image || undefined,
      turnstileToken,
      idToken,
    })

    setIsSubmitting(false)
    // Tokens are single-use; issue a fresh one for the next submission
    ;(window as any).turnstile?.reset()

    if (result.success && result.incident) {
      setSuccessResult(result.incident)
      // Reset form fields
      setTitle("")
      setDescription("")
      setAddress("")
      setLatitude(null)
      setLongitude(null)
      setBase64Image("")
      setImageName("")
    } else {
      setError(result.error || "Failed to submit to FastAPI backend.")
    }
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans p-8 md:p-16 flex flex-col items-center">
      <div className="w-full max-w-xl bg-zinc-50 border border-zinc-200 rounded-xl p-8 shadow-sm">
        <div className="flex items-start justify-between mb-2">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Report Incident
          </h1>
          <div className="flex gap-2">
            <a
              href="/incidents"
              className="text-xs font-bold text-zinc-600 hover:text-zinc-900 border border-zinc-300 rounded-lg px-3 py-1.5 transition-all"
            >
              View Reports
            </a>
            <a
              href="/dashboard"
              className="text-xs font-bold text-zinc-600 hover:text-zinc-900 border border-zinc-300 rounded-lg px-3 py-1.5 transition-all"
            >
              Dashboard →
            </a>
          </div>
        </div>
        <p className="text-sm text-zinc-600 mb-4">
          Describe the issue — CivicMind AI will classify it, estimate severity, and route it to the right department.
        </p>

        {/* Identity / trust section */}
        <div className="mb-6 p-3 border border-zinc-200 rounded-lg bg-white flex items-center justify-between gap-3">
          {user ? (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                {user.photoURL && (
                  <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-zinc-200" referrerPolicy="no-referrer" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-900 truncate">{user.displayName || user.email}</p>
                  <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">✓ Verified reporting — higher trust level</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="text-[11px] font-bold text-zinc-500 hover:text-zinc-900 shrink-0"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <p className="text-[11px] text-zinc-600 leading-snug">
                You can report anonymously, but reports from signed-in citizens
                get a <strong>higher trust level</strong> and are prioritized.
              </p>
              <button
                type="button"
                onClick={handleSignIn}
                disabled={authBusy}
                className="h-9 px-3 shrink-0 inline-flex items-center gap-2 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-800 text-xs font-bold rounded-lg transition-all disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
                {authBusy ? "Signing in…" : "Sign in with Google"}
              </button>
            </>
          )}
        </div>

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
              <p><strong>AI Category:</strong> {successResult.ai_analysis.text?.category || "other"}</p>
              <p><strong>AI Severity:</strong> {successResult.ai_analysis.text?.severity || "medium"}</p>
              <p><strong>Assigned Dept:</strong> {successResult.ai_analysis.text?.responsible_department || "General Admin"}</p>
              <p><strong>AI Summary:</strong> "{successResult.ai_analysis.text?.summary || "Incident submitted. AI analysis is processing in the background."}"</p>
              <p><strong>Analysis Status:</strong> <span className="font-mono bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">{successResult.analysis_status || "pending"}</span></p>
              {successResult.reporter && (
                <p>
                  <strong>Reporter Trust:</strong>{" "}
                  <span className="font-mono bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                    {successResult.reporter.trust_level.replaceAll("_", " ")} · {(successResult.reporter.trust_score * 100).toFixed(0)}%
                  </span>
                  {!successResult.reporter.authenticated && " — sign in next time to boost trust"}
                </p>
              )}
              <p><strong>Coordinates:</strong> {successResult.latitude}, {successResult.longitude}</p>
              {successResult.address && <p><strong>Address:</strong> {successResult.address}</p>}
            </div>
            {successResult.imageUrl && (
              <div className="mt-3 pt-2 border-t border-emerald-200/50">
                <p className="font-bold mb-1">Uploaded Image:</p>
                <img
                  src={successResult.imageUrl}
                  alt="Incident Report Upload"
                  className="w-full max-h-48 object-cover rounded-lg border border-emerald-200"
                />
              </div>
            )}
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

          {/* Image (Optional) */}
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Image (Optional)
            </label>
            <input
              type="file"
              accept="image/*"
              disabled={isSubmitting}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setImageName(file.name)
                  setError("")
                  try {
                    const calibratedUrl = await calibrateImage(file)
                    setBase64Image(calibratedUrl)
                  } catch (err) {
                    console.error("Failed to calibrate image:", err)
                    setError("Failed to process image quality calibration.")
                  }
                } else {
                  setImageName("")
                  setBase64Image("")
                }
              }}
              className="block w-full text-xs text-zinc-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-xs file:font-semibold
                file:bg-zinc-200 file:text-zinc-800
                hover:file:bg-zinc-300 file:cursor-pointer transition-all"
            />
            {imageName && (
              <p className="text-[10px] text-zinc-500 font-mono mt-1">
                Selected: {imageName}
              </p>
            )}
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

          {/* Cloudflare Turnstile bot protection (implicit render) */}
          <div
            className="cf-turnstile"
            data-sitekey={TURNSTILE_SITE_KEY}
            data-theme="light"
          />
          <Script
            src="https://challenges.cloudflare.com/turnstile/api.js"
            strategy="afterInteractive"
          />

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
                <span>Submitting...</span>
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

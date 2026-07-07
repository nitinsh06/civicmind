"use client";

import { useEffect, useRef, useState } from "react"
import Script from "next/script"

import SiteHeader from "@/components/SiteHeader"
import { submitIncidentAction } from "../actions"
import { calibrateImage } from "@/lib/image"
import { auth } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"

// Turnstile site keys are public by design; env override, baked fallback for
// Cloud Run source builds where NEXT_PUBLIC_* isn't available at build time.
const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAADwgHi-AnGoJ8NSv"

const LABEL = "font-display uppercase text-[12px] font-bold tracking-[0.12em] text-ink-soft"
const INPUT =
  "border border-line rounded-lg text-sm bg-card focus:outline-none focus:border-ink transition-colors text-ink placeholder:text-ink-faint"

export default function ReportPage() {
  const { user, signIn } = useAuth()

  // Explicit Turnstile rendering: implicit (class-based) rendering only
  // scans the DOM when the CF script first loads, so it misses this page
  // after client-side navigation. Render programmatically instead.
  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  useEffect(() => {
    const tryRender = () => {
      const ts = (window as any).turnstile
      if (!ts || !turnstileRef.current) return false
      if (widgetId.current === null) {
        widgetId.current = ts.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "light",
        })
      }
      return true
    }
    if (tryRender()) return
    const poll = setInterval(() => {
      if (tryRender()) clearInterval(poll)
    }, 200)
    return () => {
      clearInterval(poll)
      const ts = (window as any).turnstile
      if (ts && widgetId.current !== null) {
        try { ts.remove(widgetId.current) } catch {}
        widgetId.current = null
      }
    }
  }, [])

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

  const handleDetectLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setError("Your browser doesn't support location detection.")
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
        setError("Location permission denied — you can type the address instead.")
        setLatitude(null)
        setLongitude(null)
        setGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !description.trim()) {
      setError("Add a title and a short description first.")
      return
    }

    setError("")
    setIsSubmitting(true)
    setSuccessResult(null)

    const ts = (window as any).turnstile
    const turnstileToken =
      (widgetId.current !== null ? ts?.getResponse(widgetId.current) : undefined) ||
      (document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement | null)
        ?.value ||
      undefined

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
    if (widgetId.current !== null) {
      try { ts?.reset(widgetId.current) } catch {}
    }

    if (result.success && result.incident) {
      setSuccessResult(result.incident)
      setTitle("")
      setDescription("")
      setAddress("")
      setLatitude(null)
      setLongitude(null)
      setBase64Image("")
      setImageName("")
    } else {
      setError(result.error || "Something went wrong — try again.")
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="max-w-xl mx-auto px-5 py-10">
        <h1 className="font-display text-4xl font-bold tracking-tight">Report an issue</h1>
        <p className="text-[14px] text-ink-soft mt-1.5 mb-6">
          Gemini AI will classify it, grade the severity, and route it to the
          right department — usually within a minute.
        </p>

        {/* Trust nudge */}
        <div className="mb-6 p-3.5 border border-line rounded-lg bg-card flex items-center justify-between gap-3">
          {user ? (
            <div className="flex items-center gap-2.5 min-w-0">
              {user.photoURL && (
                <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full border border-line" />
              )}
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate">{user.displayName || user.email}</p>
                <p className="font-mono text-[10.5px] text-verified font-medium">VERIFIED REPORTING · HIGHER TRUST</p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[12.5px] text-ink-soft leading-snug">
                Reporting anonymously is fine. Signing in raises your report's{" "}
                <strong className="text-ink">trust level</strong> and lets you track it later.
              </p>
              <button
                type="button"
                onClick={() => signIn().catch(() => setError("Google sign-in failed — you can still report anonymously."))}
                className="h-9 px-3.5 shrink-0 inline-flex items-center gap-2 bg-card border border-line hover:border-ink-faint text-[13px] font-semibold rounded-lg transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
                Sign in
              </button>
            </>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-critical-wash border border-critical/30 rounded-lg text-[13px] text-critical">
            {error}
          </div>
        )}

        {successResult && (
          <div className="mb-6 bg-card border border-verified/40 rounded-xl overflow-hidden">
            <div className="bg-verified-wash px-4 py-2.5 border-b border-verified/20">
              <p className="font-display uppercase text-[13px] font-bold tracking-wider text-verified">
                ✓ Report filed
              </p>
            </div>
            <div className="p-4 text-[13px] space-y-1.5">
              <p><span className="text-ink-faint">ID</span> <span className="font-mono">{successResult.id}</span></p>
              <p>
                <span className="text-ink-faint">AI analysis</span>{" "}
                <span className="font-mono text-[12px] bg-paper border border-line px-1.5 py-0.5 rounded">
                  {successResult.analysis_status || "pending"}
                </span>{" "}
                — results appear in your reports within a minute
              </p>
              {successResult.reporter && (
                <p>
                  <span className="text-ink-faint">Trust</span>{" "}
                  {successResult.reporter.trust_level?.replaceAll("_", " ")} ·{" "}
                  <span className="font-mono">{(successResult.reporter.trust_score * 100).toFixed(0)}%</span>
                </p>
              )}
              {successResult.imageUrl && (
                <img src={successResult.imageUrl} alt="" className="mt-2 w-full max-h-44 object-cover rounded-lg border border-line" />
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col space-y-1.5">
            <label className={LABEL}>What's wrong?</label>
            <input
              type="text"
              placeholder="e.g. Burst water pipe flooding the lane"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={isSubmitting}
              className={`h-11 px-3 ${INPUT}`}
            />
          </div>

          <div className="flex flex-col space-y-1.5">
            <label className={LABEL}>Describe it</label>
            <textarea
              placeholder="What you saw, how bad it is, since when…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              disabled={isSubmitting}
              className={`p-3 ${INPUT}`}
            />
          </div>

          <div className="flex flex-col space-y-1.5">
            <label className={LABEL}>Address</label>
            <input
              type="text"
              placeholder="Street, area, city"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isSubmitting}
              className={`h-11 px-3 ${INPUT}`}
            />
          </div>

          <div className="flex flex-col space-y-1.5">
            <label className={LABEL}>Photo (optional)</label>
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
                    console.error("Failed to process image:", err)
                    setError("Couldn't process that image — try a different one.")
                  }
                } else {
                  setImageName("")
                  setBase64Image("")
                }
              }}
              className="block w-full text-[12px] text-ink-faint
                file:mr-4 file:py-2.5 file:px-4
                file:rounded-lg file:border-0
                file:text-[12px] file:font-semibold
                file:bg-line/70 file:text-ink
                hover:file:bg-line file:cursor-pointer transition-colors"
            />
            {imageName && (
              <p className="font-mono text-[10.5px] text-ink-faint mt-0.5">{imageName}</p>
            )}
          </div>

          <div className="border border-line rounded-lg p-4 bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className={LABEL}>Location</span>
              <span className={`font-mono text-[10.5px] font-medium px-2 py-0.5 rounded ${
                latitude && longitude ? "bg-verified-wash text-verified" : "bg-line/60 text-ink-faint"
              }`}>
                {latitude && longitude ? "DETECTED" : "NOT SET"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-[12px] text-ink-soft bg-paper p-2.5 border border-line rounded-md">
              <div>lat {latitude !== null ? latitude : "——"}</div>
              <div>lng {longitude !== null ? longitude : "——"}</div>
            </div>
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={gpsLoading || isSubmitting}
              className="w-full h-9 bg-paper border border-line hover:border-ink-faint text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {gpsLoading ? "Finding you…" : "Use my location"}
            </button>
          </div>

          {/* Cloudflare Turnstile bot protection (explicitly rendered) */}
          <div ref={turnstileRef} className="min-h-[65px]" />
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="afterInteractive"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 bg-signal hover:bg-signal-deep text-ink hover:text-white font-display uppercase tracking-wide text-[16px] font-bold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center"
          >
            {isSubmitting ? "Submitting…" : "Submit report"}
          </button>
        </form>
      </main>
    </div>
  )
}

# CivicMind — AI-Powered Citizen Engagement & Civic Intelligence Platform

CivicMind transforms unstructured citizen complaints (potholes, flooding, garbage, broken streetlights, collapsed infrastructure…) into **structured, actionable civic intelligence**. Citizens report an issue with text, location, and a photo; Google's Gemini analyzes both the text and the image, classifies the issue, estimates severity, assigns the responsible municipal department, and generates an operational summary — before any human ever triages the ticket.

**Live demo**

- Citizen portal: https://civicmind-web-859933805639.asia-south1.run.app
- API (FastAPI): https://civicmind-api-859933805639.asia-south1.run.app/docs

## Features

- **Multimodal AI triage** — Gemini analyzes the report text (category, severity, responsible department, confidence, summary, tags) and the uploaded photo (scene summary, detected objects, recommended actions) in a background task, so submission stays instant.
- **AI geocoding fallback** — if the citizen declines GPS, Gemini resolves their typed address to coordinates.
- **Reporter trust levels** — optional **Sign in with Google** (Firebase Auth). Anonymous reports are accepted at 35% trust; authenticated citizens start at 70% ("verified citizen") and build trust with each report (up to 95%, "trusted citizen"). Trust is verified server-side via Firebase ID tokens and stored per-user in a `users` collection.
- **Operations Dashboard** (`/dashboard`) — KPI tiles, severity-prioritized incident queue with live refresh, category breakdown, status workflow (pending → investigating → dispatched → resolved), and a Leaflet map with severity-colored markers.
- **Incident Reports** (`/incidents`) — public, per-incident intelligence cards: AI text analysis, citizen description, reporter trust, hashtags, media evidence, detected objects, and recommended actions.
- **Drone verification** — upload drone imagery against an incident; Gemini Vision assesses damage and can auto-escalate the incident status.
- **Security** — Cloudflare Turnstile bot protection on submission (fail-closed), admin-key-guarded write endpoints (status updates and drone analysis are only callable by the Next.js server, never directly), PII redaction on the public API (reporter emails and IP geolocation never leave Firestore), CORS allowlist, server-side Firebase token verification, and environment-based secrets.

## Architecture

```
Citizen ──► Next.js frontend (Cloud Run)
                │  server actions
                ▼
        FastAPI backend (Cloud Run)
                │
    ┌───────────┼──────────────┐
    ▼           ▼              ▼
Firebase     Cloud         Gemini 2.5 Flash
Storage      Firestore     (Vertex AI)
(images)     (incidents,   text + vision analysis
              users)       in background tasks
```

1. Citizen submits title, description, address/GPS, optional photo (compressed client-side to <1 MB).
2. FastAPI verifies the Turnstile token and the Firebase ID token (if signed in), uploads the photo to **Firebase Storage**, and writes the incident to **Firestore** with `analysis_status: pending`.
3. A background task runs **Gemini** text + image analysis and updates the document (`completed`, or `failed` with the error recorded in `analysis_error`).
4. The dashboard and reports pages poll and render the intelligence in near real time.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind CSS 4, react-leaflet, Firebase Auth |
| Backend | FastAPI (Python 3.12), managed with `uv` |
| AI | Gemini 2.5 Flash via Vertex AI (`google-genai` SDK) |
| Data | Cloud Firestore (incidents, users), Firebase Storage (images) |
| Infra | Docker, Google Cloud Run (asia-south1) |
| Security | Cloudflare Turnstile, Firebase ID token verification, CORS allowlist |

## API

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/incidents` | public | List incidents with AI analysis (PII redacted) |
| `POST` | `/api/incidents` | Turnstile token | Submit a report (kicks off background AI analysis) |
| `PATCH` | `/api/incidents/{id}/status` | admin key | Update workflow status |
| `POST` | `/api/incidents/{id}/verify-drone` | admin key | Analyze drone imagery for an incident |

## Running locally

Prereqs: Python 3.12 + [uv](https://docs.astral.sh/uv/), Node 22+, and a `.env` in the repo root (see `.env.example`).

```bash
# Backend → http://127.0.0.1:8000
cd backend
uv sync
uv run uvicorn main:app --reload

# Frontend → http://localhost:3000
cd frontend
npm install
npm run dev
```

### Environment variables (root `.env`)

| Variable | Purpose |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Service-account JSON string — Firestore, Storage, Auth admin, and Vertex AI credentials |
| `GOOGLE_CLOUD_PROJECT` | Enables Gemini via Vertex AI (uses ADC / the service account) |
| `GOOGLE_CLOUD_LOCATION` | Vertex AI region (default `us-central1`) |
| `GEMINI_API_KEY` | Alternative to Vertex AI when `GOOGLE_CLOUD_PROJECT` is unset |
| `GEMINI_MODEL_NAME` | Model override (default `gemini-2.5-flash`) |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile server-side verification (fail-closed when set) |
| `ADMIN_API_KEY` | Shared secret between the Next.js server and FastAPI admin endpoints |
| `NEXT_PUBLIC_API_URL` | Backend URL for the frontend's server actions |

## Deployment

Both services deploy from source to Cloud Run:

```bash
gcloud run deploy civicmind-api --source backend --region asia-south1 \
  --update-env-vars "GOOGLE_CLOUD_PROJECT=<project-id>,GOOGLE_CLOUD_LOCATION=us-central1,ADMIN_API_KEY=<secret>"

gcloud run deploy civicmind-web --source frontend --region asia-south1 \
  --update-env-vars "ADMIN_API_KEY=<secret>"
```

## Roadmap

- Duplicate-incident detection with image embeddings
- Department-specific dashboards and SLA monitoring
- Geographic heatmaps via BigQuery + Looker
- Pub/Sub-based analysis pipeline for scale
- Multilingual reporting with automatic translation

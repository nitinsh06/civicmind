import os
import time
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, status, Request, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load the .env configuration from the parent workspace directory
# (must happen before civicmind imports read the environment)
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

from civicmind.database import get_firestore_client
from civicmind.schemas import (
    IncidentCreate,
    IncidentUpdateStatus,
    DroneVerifyRequest,
    IncidentResponse,
)
from civicmind.ai.adapter import analyze_drone_imagery
from civicmind.analysis import analyze_incident
from civicmind.storage import upload_incident_image
from civicmind.users import resolve_reporter

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address


def rate_limit_key(request: Request) -> str:
    # Cloud Run sits behind a proxy; the real client is in x-forwarded-for
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=rate_limit_key, default_limits=["120/minute"])

app = FastAPI(title="CivicMind AI Platform API", version="0.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Global default (120/min per IP) for every route; sensitive routes carry
# tighter per-route limits below.
from slowapi.middleware import SlowAPIMiddleware
app.add_middleware(SlowAPIMiddleware)

# CORS middleware restricted to production URL and local development
allowed_origins = [
    "https://civicmind-web-859933805639.asia-south1.run.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_admin_key(x_admin_key: str | None = Header(default=None)):
    """Guard for state-changing / Gemini-billing endpoints.

    The key is only known to the Next.js server (server actions attach it
    server-side; it never reaches the browser). If ADMIN_API_KEY is unset,
    the guard is disabled for local development.
    """
    expected = os.environ.get("ADMIN_API_KEY")
    if expected and x_admin_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid admin key.",
        )


async def verify_turnstile(token: str | None, ip: str | None) -> tuple[bool, str]:
    """Verify a Cloudflare Turnstile token.

    Fail-closed for spam/billing protection: when a secret is configured,
    a missing or invalid token rejects the request. The only fail-open
    case is Cloudflare's siteverify being unreachable (not attacker-
    controllable), so an outage can't break legitimate submissions.
    """
    secret = os.environ.get("TURNSTILE_SECRET_KEY")
    if not secret:
        return True, "not-configured"
    if not token:
        return False, "missing-token"
    try:
        import httpx
        payload = {"secret": secret, "response": token}
        if ip:
            payload["remoteip"] = ip
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                data=payload,
                timeout=5.0,
            )
        data = resp.json()
        if data.get("success"):
            return True, "verified"
        codes = data.get("error-codes", [])
        print(f"Turnstile verification rejected: {codes}")
        return False, ",".join(codes) or "rejected"
    except Exception as e:
        print(f"Turnstile siteverify unavailable, failing open: {e}")
        return True, "unavailable"


async def get_ip_geolocation(ip: str) -> dict:
    if not ip or ip in ("127.0.0.1", "localhost", "::1"):
        url = "http://ip-api.com/json/"
    else:
        url = f"http://ip-api.com/json/{ip}"
        
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=5.0)
        if response.status_code == 200:
            res_json = response.json()
            if res_json.get("status") == "success":
                return res_json
    except Exception as e:
        print(f"Error fetching IP geolocation: {e}")
    return {}


# Endpoints
@app.get("/api/incidents/mine", response_model=list[IncidentResponse])
def read_my_incidents(authorization: str | None = Header(default=None), db = Depends(get_firestore_client)):
    """Reports filed by the signed-in citizen only (Firebase ID token)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to view your reports.")
    token = authorization.split(" ", 1)[1]
    try:
        from firebase_admin import auth as firebase_auth
        decoded = firebase_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired — sign in again.")

    try:
        docs = db.collection("incidents").where("reporter.uid", "==", decoded["uid"]).stream()
        items = [d.to_dict() for d in docs]
        items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return items
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch your reports: {str(e)}"
        )


@app.get("/api/incidents", response_model=list[IncidentResponse])
def read_incidents(db = Depends(get_firestore_client)):
    try:
        # Query Firestore collection ordered by created_at descending
        # Direction enum is imported from firestore client dynamically or mocked
        docs = db.collection("incidents").stream()
        
        incidents_list = []
        for doc in docs:
            data = doc.to_dict()
            incidents_list.append(data)
            
        # Re-sort descending on created_at just in case mock didn't do it
        incidents_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return incidents_list
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch incidents: {str(e)}"
        )

@app.post("/api/incidents", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")  # each creation triggers Gemini analysis
async def create_incident(
    request: Request, 
    incident_in: IncidentCreate, 
    background_tasks: BackgroundTasks, 
    db = Depends(get_firestore_client)
):
    # Resolve client IP address (supporting proxy forwarding for Cloud Run)
    client_ip = request.headers.get("x-forwarded-for")
    if client_ip:
        client_ip = client_ip.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else None
        
    # Bot protection: Cloudflare Turnstile (fail-open, see verify_turnstile)
    ts_ok, ts_detail = await verify_turnstile(incident_in.turnstileToken, client_ip)
    if not ts_ok:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Bot verification failed ({ts_detail}). Please refresh and try again.",
        )

    # Query geolocation from ip-api
    ip_loc_data = await get_ip_geolocation(client_ip)

    # Resolve reporter identity & trust (falls back to anonymous on bad token)
    reporter = resolve_reporter(incident_in.idToken, db)

    try:
        # Assemble new incident record with pending status
        timestamp = datetime.utcnow().isoformat()
        incident_id = f"inc-{time.time_ns() // 1_000_000}"

        # Client sends the image as a base64 data URL; persist it to Firebase
        # Storage and store the download URL (Firestore docs cap at 1 MiB, so
        # inlining base64 risks failed writes).
        uploaded_url = incident_in.imageUrl
        if uploaded_url and uploaded_url.startswith("data:"):
            try:
                uploaded_url = upload_incident_image(uploaded_url, incident_id)
                print(f"Uploaded incident image to Firebase Storage: {uploaded_url}")
            except Exception as ue:
                print(f"Firebase Storage upload failed, falling back to inline image: {ue}")
                # Keep the base64 inline only if it fits Firestore's 1 MiB doc limit
                if len(uploaded_url) > 900_000:
                    uploaded_url = None
        
        incident_data = {
            "id": incident_id,
            "title": incident_in.title,
            "description": incident_in.description,
            "latitude": incident_in.latitude,
            "longitude": incident_in.longitude,
            "imageUrl": uploaded_url,
            "address": incident_in.address,
            "status": "pending",
            "created_at": timestamp,
            "ip_loc": ip_loc_data,
            "reporter": reporter,
            "analysis_status": "pending",
            "ai_analysis": {
                "text": None,
                "media": None
            }
        }
        
        # Save document in Firestore
        db.collection("incidents").document(incident_id).set(incident_data)
        
        # Queue the background AI analysis task
        background_tasks.add_task(analyze_incident, incident_id)
        
        return incident_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit incident: {str(e)}"
        )

@app.patch("/api/incidents/{incident_id}/status", response_model=IncidentResponse, dependencies=[Depends(require_admin_key)])
@limiter.limit("30/minute")
def update_incident_status_route(request: Request, incident_id: str, status_in: IncidentUpdateStatus, db = Depends(get_firestore_client)):
    try:
        doc_ref = db.collection("incidents").document(incident_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
            
        # Update field in Firestore document
        doc_ref.update({"status": status_in.status})
        
        # Return updated record
        updated_data = doc.to_dict()
        updated_data["status"] = status_in.status
        return updated_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update status: {str(e)}"
        )

@app.post("/api/incidents/{incident_id}/verify-drone", response_model=IncidentResponse, dependencies=[Depends(require_admin_key)])
@limiter.limit("10/minute")  # each verification triggers Gemini Vision
def verify_incident_drone(request: Request, incident_id: str, drone_in: DroneVerifyRequest, db = Depends(get_firestore_client)):
    try:
        doc_ref = db.collection("incidents").document(incident_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
            
        incident_data = doc.to_dict()
        
        # Run Gemini Vision analysis on the base64 drone footage
        drone_analysis = analyze_drone_imagery(drone_in.base64Image)
        
        # Prepare updates
        update_payload = {
            "damage_assessment": drone_analysis["damage_assessment"],
            "severity_estimate": drone_analysis["severity_estimate"],
            "confidence_score": drone_analysis["confidence_score"],
            "drone_summary": drone_analysis["drone_summary"],
            "verification_status": drone_analysis["verification_status"]
        }
        
        # If drone confirms critical or high damage, ensure status reflects active investigation
        if drone_analysis["severity_estimate"] in ["critical", "high"] and incident_data.get("status") == "pending":
            update_payload["status"] = "investigating"
            
        doc_ref.update(update_payload)
        
        incident_data.update(update_payload)
        return incident_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze drone imagery: {str(e)}"
        )

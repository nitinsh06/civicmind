"""Background AI analysis pipeline for incident reports.

Runs after an incident is created: Gemini text analysis (category, severity,
department, summary, optional address geocoding) plus image analysis when a
photo was attached. Results land back on the Firestore document, moving
analysis_status pending -> completed | failed (with analysis_error set).
"""
import base64

import httpx

from civicmind.database import get_firestore_client
from civicmind.ai.adapter import analyze_incident_report, image_to_text


def _fetch_image_as_data_url(image_url: str) -> str | None:
    """Resolve an incident image to a base64 data URL for Gemini."""
    if image_url.startswith("data:"):
        # Legacy inline images: pass through directly
        return image_url
    print(f"Downloading media asset from: {image_url}")
    resp = httpx.get(image_url, timeout=15.0)
    if resp.status_code != 200:
        print(f"Image download returned {resp.status_code}, skipping media analysis.")
        return None
    content_type = resp.headers.get("content-type", "image/jpeg")
    base64_str = base64.b64encode(resp.content).decode("utf-8")
    return f"data:{content_type};base64,{base64_str}"


def analyze_incident(incident_id: str):
    print(f"Analyzing incident {incident_id} in background task...")
    try:
        db = get_firestore_client()

        doc_ref = db.collection("incidents").document(incident_id)
        doc = doc_ref.get()
        if not doc.exists:
            print(f"Error: Incident {incident_id} not found in Firestore.")
            return

        incident_data = doc.to_dict()

        # Text analysis (also geocodes when only an address was given)
        ai_analysis = analyze_incident_report(
            incident_data.get("title", ""),
            incident_data.get("description", ""),
            incident_data.get("address"),
        )

        # Image analysis, when a photo was attached
        media_analysis = None
        image_url = incident_data.get("imageUrl")
        if image_url:
            try:
                base64_data_url = _fetch_image_as_data_url(image_url)
                if base64_data_url:
                    print("Running client-uploaded image context analysis...")
                    media_analysis = image_to_text(
                        base64_data_url,
                        description=incident_data.get("description", ""),
                    )
            except Exception as me:
                print(f"Failed to perform background media analysis: {me}")

        # Coordinates: prefer citizen GPS, fall back to AI-geocoded address
        lat = incident_data.get("latitude")
        if lat is None:
            lat = ai_analysis.get("latitude")

        lng = incident_data.get("longitude")
        if lng is None:
            lng = ai_analysis.get("longitude")

        doc_ref.update({
            "latitude": lat,
            "longitude": lng,
            "ai_analysis": {
                "text": {
                    "category": ai_analysis.get("category", "other"),
                    "severity": ai_analysis.get("severity", "medium"),
                    "responsible_department": ai_analysis.get("responsible_department", "General Admin"),
                    "analysis_confidence": ai_analysis.get("analysis_confidence", 0.0),
                    "summary": ai_analysis.get("summary", ""),
                    "tags": ai_analysis.get("tags", []),
                },
                "media": media_analysis,
            },
            "analysis_status": "completed",
            "analysis_error": None,
        })
        print(f"Successfully analyzed incident {incident_id} and updated Firestore.")
    except Exception as e:
        print(f"Error during background analysis of incident {incident_id}: {e}")
        try:
            db = get_firestore_client()
            db.collection("incidents").document(incident_id).update({
                "analysis_status": "failed",
                # Keep the cause on the doc so 'failed' is debuggable from the console
                "analysis_error": f"{type(e).__name__}: {str(e)[:500]}",
            })
        except Exception as fe:
            print(f"Failed to update incident analysis_status to failed: {fe}")

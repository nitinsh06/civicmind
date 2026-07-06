import os
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv # Trigger reload to update Firestore credentials config

# Database & AI
from civicmind.database import get_firestore_client
from civicmind.schemas import (
    IncidentCreate,
    IncidentUpdateStatus,
    DroneVerifyRequest,
    IncidentResponse,
)
from civicmind.gemini import analyze_incident_report, analyze_drone_imagery

load_dotenv()

app = FastAPI(title="CivicMind AI Platform API", version="0.1.0")

# CORS middleware to allow the Next.js frontend to fetch endpoints
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper function to generate microsecond timestamps for unique IDs
def time_ns_custom():
    import time
    return int(time.time() * 1000000)

# Endpoints
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
def create_incident(incident_in: IncidentCreate, db = Depends(get_firestore_client)):
    try:
        # Run text analysis using Gemini (with geocoding address if present)
        ai_analysis = analyze_incident_report(
            incident_in.title, incident_in.description, incident_in.address
        )
        
        
        # Extract coordinates (fallback to geocoding, store None if not resolved)
        lat = incident_in.latitude if incident_in.latitude is not None else ai_analysis.get("latitude")
        lng = incident_in.longitude if incident_in.longitude is not None else ai_analysis.get("longitude")
        
        # Assemble new incident record
        timestamp = datetime.utcnow().isoformat()
        incident_id = f"inc-{int(time_ns_custom() // 1000)}"
        
        incident_data = {
            "id": incident_id,
            "title": incident_in.title,
            "description": incident_in.description,
            "latitude": lat,
            "longitude": lng,
            "imageUrl": incident_in.imageUrl,
            "address": incident_in.address,
            "status": "pending",
            "created_at": timestamp,
            "category": ai_analysis["category"],
            "severity": ai_analysis["severity"],
            "responsible_department": ai_analysis["responsible_department"],
            "confidence": ai_analysis["confidence"],
            "summary": ai_analysis["summary"]
        }
        
        # Save document in Firestore
        db.collection("incidents").document(incident_id).set(incident_data)
        
        return incident_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit incident: {str(e)}"
        )

@app.patch("/api/incidents/{incident_id}/status", response_model=IncidentResponse)
def update_incident_status_route(incident_id: str, status_in: IncidentUpdateStatus, db = Depends(get_firestore_client)):
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

@app.post("/api/incidents/{incident_id}/verify-drone", response_model=IncidentResponse)
def verify_incident_drone(incident_id: str, drone_in: DroneVerifyRequest, db = Depends(get_firestore_client)):
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

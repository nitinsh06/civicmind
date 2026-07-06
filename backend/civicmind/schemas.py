from pydantic import BaseModel, ConfigDict
from typing import Optional, List



class IncidentCreate(BaseModel):
    title: str
    description: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    imageUrl: Optional[str] = None
    address: Optional[str] = None
    turnstileToken: Optional[str] = None
    idToken: Optional[str] = None

class IncidentUpdateStatus(BaseModel):
    status: str

class DroneVerifyRequest(BaseModel):
    base64Image: str

class AIAnalysisResponse(BaseModel):
    category: str
    severity: str
    responsible_department: str
    confidence: float
    summary: str

class DroneVerificationResponse(BaseModel):
    damage_assessment: str
    severity_estimate: str
    confidence_score: float
    drone_summary: str
    verification_status: str

class IncidentResponse(BaseModel):
    id: str
    title: str
    description: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    imageUrl: Optional[str] = None
    address: Optional[str] = None
    status: str
    created_at: str
    
    # Drone fields
    damage_assessment: Optional[str] = None
    severity_estimate: Optional[str] = None
    confidence_score: Optional[float] = None
    drone_summary: Optional[str] = None
    verification_status: Optional[str] = None

    # Geolocation lookup field
    ip_loc: Optional[dict] = None

    # AI analysis payload ({"text": {...}, "media": {...}}) — must be declared
    # here or FastAPI's response_model filtering silently strips it
    ai_analysis: Optional[dict] = None

    # Analysis status field
    analysis_status: Optional[str] = None
    analysis_error: Optional[str] = None

    # Reporter identity & trust (authenticated reports score higher)
    reporter: Optional[dict] = None

    # Tagging keywords field
    tags: Optional[List[str]] = []

    model_config = ConfigDict(from_attributes=True)

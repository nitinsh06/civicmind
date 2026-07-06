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

class ReporterPublic(BaseModel):
    """Public projection of the reporter block — never expose email, uid,
    or photo_url through the API; the full record stays in Firestore."""
    authenticated: bool = False
    name: Optional[str] = None
    trust_level: Optional[str] = None
    trust_score: Optional[float] = None


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

    # NOTE: ip_loc (reporter IP geolocation) is intentionally NOT exposed —
    # it stays in Firestore for internal use only.

    # AI analysis payload ({"text": {...}, "media": {...}}) — must be declared
    # here or FastAPI's response_model filtering silently strips it
    ai_analysis: Optional[dict] = None

    # Analysis status field
    analysis_status: Optional[str] = None
    analysis_error: Optional[str] = None

    # Reporter trust (public projection; PII filtered by ReporterPublic)
    reporter: Optional[ReporterPublic] = None

    # Tagging keywords field
    tags: Optional[List[str]] = []

    model_config = ConfigDict(from_attributes=True)

from pydantic import BaseModel, ConfigDict
from typing import Optional

class IncidentCreate(BaseModel):
    title: str
    description: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    imageUrl: Optional[str] = None
    address: Optional[str] = None

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
    
    # AI analysis flattened or grouped
    category: str
    severity: str
    responsible_department: str
    confidence: float
    summary: str
    
    # Drone fields
    damage_assessment: Optional[str] = None
    severity_estimate: Optional[str] = None
    confidence_score: Optional[float] = None
    drone_summary: Optional[str] = None
    verification_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

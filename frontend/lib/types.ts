export interface AITextAnalysis {
  category: "potholes" | "flooding" | "garbage accumulation" | "broken streetlights" | "road damage" | "water leakage" | "other"
  severity: "low" | "medium" | "high" | "critical"
  responsible_department: string
  analysis_confidence: number
  summary: string
  tags?: string[]
}

export interface AIMediaAnalysis {
  category: string
  severity: "low" | "medium" | "high" | "critical"
  department: string
  analysis_confidence: number
  summary: string
  visible_objects: string[]
  recommended_action: string
}

export interface IncidentAnalysis {
  text?: AITextAnalysis
  media?: AIMediaAnalysis | null
}

export interface DroneAnalysis {
  damage_assessment: string
  severity_estimate: "low" | "medium" | "high" | "critical"
  confidence_score: number
  drone_summary: string
  verification_status: "verified_high_damage" | "minor_damage" | "no_damage_detected"
}

export interface Reporter {
  authenticated: boolean
  uid?: string
  name?: string | null
  email?: string | null
  photo_url?: string | null
  trust_level: "unverified" | "verified_citizen" | "trusted_citizen"
  trust_score: number
}

export interface Incident {
  id: string
  title: string
  description: string
  latitude: number | null
  longitude: number | null
  imageUrl?: string
  address?: string
  status: "pending" | "investigating" | "dispatched" | "resolved"
  created_at: string
  ai_analysis: IncidentAnalysis
  drone_verification?: DroneAnalysis
  analysis_status?: string
  reporter?: Reporter
}

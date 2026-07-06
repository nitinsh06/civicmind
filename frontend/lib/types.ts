export interface IncidentAnalysis {
  category: "potholes" | "flooding" | "garbage accumulation" | "broken streetlights" | "road damage" | "water leakage" | "other"
  severity: "low" | "medium" | "high" | "critical"
  responsible_department: string
  confidence: number
  summary: string
}

export interface DroneAnalysis {
  damage_assessment: string
  severity_estimate: "low" | "medium" | "high" | "critical"
  confidence_score: number
  drone_summary: string
  verification_status: "verified_high_damage" | "minor_damage" | "no_damage_detected"
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
}

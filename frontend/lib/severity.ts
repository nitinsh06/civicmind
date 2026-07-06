import { Incident } from "@/lib/types"

// Drone verification (when present) supersedes the text-analysis estimate
export function getIncidentSeverity(incident: Incident): string | undefined {
  return incident.drone_verification?.severity_estimate || incident.ai_analysis?.text?.severity
}

export const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

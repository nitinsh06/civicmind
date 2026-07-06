"use server";

import { Incident } from "@/lib/types"
import { revalidatePath } from "next/cache"

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

// Convert flat database schema fields from Python API to nested frontend model structure
function mapIncidentResponse(flat: any): Incident {
  return {
    id: flat.id,
    title: flat.title,
    description: flat.description,
    latitude: flat.latitude,
    longitude: flat.longitude,
    imageUrl: flat.imageUrl || undefined,
    address: flat.address || undefined,
    status: flat.status,
    created_at: flat.created_at,
    ai_analysis: {
      text: flat.ai_analysis?.text
        ? {
            category: flat.ai_analysis.text.category,
            severity: flat.ai_analysis.text.severity,
            responsible_department: flat.ai_analysis.text.responsible_department,
            analysis_confidence: flat.ai_analysis.text.analysis_confidence,
            summary: flat.ai_analysis.text.summary,
            tags: flat.ai_analysis.text.tags || [],
          }
        : undefined,
      media: flat.ai_analysis?.media
        ? {
            category: flat.ai_analysis.media.category,
            severity: flat.ai_analysis.media.severity,
            department: flat.ai_analysis.media.department,
            analysis_confidence: flat.ai_analysis.media.analysis_confidence,
            summary: flat.ai_analysis.media.summary,
            visible_objects: flat.ai_analysis.media.visible_objects || [],
            recommended_action: flat.ai_analysis.media.recommended_action,
          }
        : flat.ai_analysis?.media === null
        ? null
        : undefined,
    },
    analysis_status: flat.analysis_status,
    reporter: flat.reporter || undefined,
    drone_verification: flat.verification_status
      ? {
          damage_assessment: flat.damage_assessment,
          severity_estimate: flat.severity_estimate,
          confidence_score: flat.confidence_score,
          drone_summary: flat.drone_summary,
          verification_status: flat.verification_status,
        }
      : undefined,
  }
}

// Fetch all incidents from FastAPI
export async function getIncidentsAction(): Promise<Incident[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/incidents`, {
      method: "GET",
      cache: "no-store",
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch: ${res.statusText}`)
    }

    const data = await res.json()
    return Array.isArray(data) ? data.map(mapIncidentResponse) : []
  } catch (error) {
    console.error("Error in getIncidentsAction:", error)
    return []
  }
}

// Submit a citizen report to FastAPI
export async function submitIncidentAction(data: {
  title: string
  description: string
  latitude: number | null
  longitude: number | null
  imageUrl?: string
  address?: string
  turnstileToken?: string
  idToken?: string
}) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/incidents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      cache: "no-store",
    })

    if (!res.ok) {
      const errDetail = await res.text()
      throw new Error(errDetail || "Backend API returned error")
    }

    const created = await res.json()
    revalidatePath("/")
    return { success: true, incident: mapIncidentResponse(created) }
  } catch (error: any) {
    console.error("Error in submitIncidentAction:", error)
    return { success: false, error: error.message || "Failed to submit report" }
  }
}

// Update incident status on FastAPI
export async function updateIncidentStatusAction(id: string, status: Incident["status"]) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/incidents/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
      cache: "no-store",
    })

    if (!res.ok) {
      throw new Error(`Failed to update status: ${res.statusText}`)
    }

    const updated = await res.json()
    revalidatePath("/")
    return { success: true, incident: mapIncidentResponse(updated) }
  } catch (error: any) {
    console.error("Error in updateIncidentStatusAction:", error)
    return { success: false, error: error.message || "Failed to update status" }
  }
}

// Verify imagery via drone scan (FastAPI)
export async function verifyDroneImageryAction(id: string, base64Image: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/incidents/${id}/verify-drone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ base64Image }),
      cache: "no-store",
    })

    if (!res.ok) {
      throw new Error(`Failed to verify drone imagery: ${res.statusText}`)
    }

    const updated = await res.json()
    revalidatePath("/")
    return { success: true, incident: mapIncidentResponse(updated) }
  } catch (error: any) {
    console.error("Error in verifyDroneImageryAction:", error)
    return { success: false, error: error.message || "Failed drone verification" }
  }
}

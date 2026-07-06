"use server";

import { revalidatePath } from "next/cache"
import { Incident } from "@/lib/types"

const BACKEND_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8000"

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
      category: flat.category,
      severity: flat.severity,
      responsible_department: flat.responsible_department,
      confidence: flat.confidence,
      summary: flat.summary,
    },
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
      cache: "no-store",
    })
    if (!res.ok) {
      throw new Error(`Failed to fetch incidents: ${res.statusText}`)
    }
    const data = await res.json()
    return data.map(mapIncidentResponse)
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

// Submit drone verification imagery to FastAPI
export async function verifyDroneIncidentAction(id: string, base64Image: string) {
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
      const errDetail = await res.text()
      throw new Error(errDetail || "Backend API returned error on drone upload")
    }

    const updated = await res.json()
    revalidatePath("/")
    return { success: true, incident: mapIncidentResponse(updated) }
  } catch (error: any) {
    console.error("Error in verifyDroneIncidentAction:", error)
    return { success: false, error: error.message || "Failed to process drone imagery" }
  }
}

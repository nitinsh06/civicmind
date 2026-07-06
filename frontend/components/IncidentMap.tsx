"use client";

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { Incident } from "@/lib/types"
import { getIncidentSeverity } from "@/lib/severity"

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#dc2626", // red-600
  high: "#ea580c",     // orange-600
  medium: "#d97706",   // amber-600
  low: "#059669",      // emerald-600
}

export default function IncidentMap({ incidents }: { incidents: Incident[] }) {
  const located = incidents.filter(
    (i) => typeof i.latitude === "number" && typeof i.longitude === "number"
  )

  // Center on the mean of located incidents, defaulting to Bengaluru
  const center: [number, number] = located.length
    ? [
        located.reduce((s, i) => s + (i.latitude as number), 0) / located.length,
        located.reduce((s, i) => s + (i.longitude as number), 0) / located.length,
      ]
    : [12.9716, 77.5946]

  return (
    <MapContainer center={center} zoom={12} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {located.map((incident) => {
        const severity = getIncidentSeverity(incident) || "medium"
        const color = SEVERITY_COLORS[severity] || "#71717a"
        return (
          <CircleMarker
            key={incident.id}
            center={[incident.latitude as number, incident.longitude as number]}
            radius={9}
            pathOptions={{ color: "#ffffff", weight: 2, fillColor: color, fillOpacity: 0.9 }}
          >
            <Popup>
              <div className="text-xs space-y-1 min-w-40">
                <p className="font-bold">{incident.title}</p>
                <p>Severity: <strong className="uppercase">{severity}</strong></p>
                <p>Status: {incident.status}</p>
                {incident.ai_analysis?.text?.responsible_department && (
                  <p>Dept: {incident.ai_analysis.text.responsible_department}</p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}

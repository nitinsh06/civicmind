import os
import base64
import json
from typing import List, Optional
from google import genai
from google.genai import types

# Load model name from environment, defaulting to gemini-2.5-flash
MODEL_NAME = os.environ.get("GEMINI_MODEL_NAME", "gemini-2.5-flash")

def get_gemini_client() -> genai.Client:
    # If GOOGLE_CLOUD_PROJECT is configured, switch automatically to Vertex AI
    project = os.environ.get("GOOGLE_CLOUD_PROJECT")
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")

    if project:
        try:
            # Prefer the Firebase service-account JSON when provided (works
            # locally without ADC); otherwise fall back to ADC (Cloud Run).
            credentials = None
            sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
            if sa_json:
                from google.oauth2 import service_account
                credentials = service_account.Credentials.from_service_account_info(
                    json.loads(sa_json.strip()),
                    scopes=["https://www.googleapis.com/auth/cloud-platform"],
                )
            return genai.Client(
                vertexai=True, project=project, location=location, credentials=credentials
            )
        except Exception as ve:
            print(f"Error initializing Vertex AI Client: {ve}")
            raise
            
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("Neither GOOGLE_CLOUD_PROJECT nor GEMINI_API_KEY environment variables are configured. Failing loudly.")
    return genai.Client(api_key=api_key)

def analyze_incident_report(title: str, description: str, address: str = None) -> dict:
    client = get_gemini_client()

    try:
        prompt_address_addon = ""
        if address:
            prompt_address_addon = f"""
            The citizen did not allow GPS coordinates. They provided the following textual address: "{address}".
            Please resolve this address to approximate latitude and longitude coordinates, inferring the
            city/region from the address text itself.
            Include these resolved coordinates in the output JSON.
            """

        prompt = f"""
        You are an AI civic engineer. Analyze the following civic incident report and output a structured JSON report.
        
        Incident Title: "{title}"
        Incident Description: "{description}"
        {prompt_address_addon}

        The output JSON schema MUST match the following interface:
        {{
          "category": "potholes" | "flooding" | "garbage accumulation" | "broken streetlights" | "road damage" | "water leakage" | "other",
          "severity": "low" | "medium" | "high" | "critical",
          "responsible_department": string (e.g. "Public Works", "Sanitation", "Water & Sewage", "Energy & Power", "Emergency Services", "General Admin"),
          "analysis_confidence": number (float between 0.0 and 1.0 representing your confidence in this analysis),
          "summary": string (a neat, executive 1-2 sentence description of the problem and its potential public impact),
          "tags": string[] (3-5 short keywords or hashtags representing the issue type){', "latitude": number (float for resolved latitude), "longitude": number (float for resolved longitude)' if address else ''}
        }}
        """

        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        
        return json.loads(response.text)
    except Exception as e:
        print(f"Error in Gemini GenAI Client during text analysis: {e}")
        raise

def analyze_drone_imagery(base64_image: str) -> dict:
    client = get_gemini_client()

    try:
        header = "image/jpeg"
        if base64_image.startswith("data:"):
            header, base64_data = base64_image.split(";base64,", 1)
        else:
            base64_data = base64_image

        image_bytes = base64.b64decode(base64_data)
        
        mime_type = "image/jpeg"
        if "png" in header:
            mime_type = "image/png"
        elif "webp" in header:
            mime_type = "image/webp"

        image_part = types.Part.from_bytes(
            data=image_bytes,
            mime_type=mime_type
        )

        prompt = """
        You are an emergency response AI scanning drone footage.
        Analyze the attached image and estimate damage, severity, and status.
        Output a structured JSON matching this schema:
        {
          "damage_assessment": string (technical assessment of visible damage, roads, cracks, overflows, garbage heaps, etc. Be specific),
          "severity_estimate": "low" | "medium" | "high" | "critical",
          "confidence_score": number (float between 0.0 and 1.0),
          "drone_summary": string (brief executive action summary),
          "verification_status": "verified_high_damage" | "minor_damage" | "no_damage_detected"
        }
        """

        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=[image_part, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )

        return json.loads(response.text)
    except Exception as e:
        print(f"Error in Gemini GenAI Client Vision API: {e}")
        raise

def image_to_text(base64_image: str, description: str = "") -> dict:
    client = get_gemini_client()

    try:
        header = "image/jpeg"
        if base64_image.startswith("data:"):
            header, base64_data = base64_image.split(";base64,", 1)
        else:
            base64_data = base64_image

        image_bytes = base64.b64decode(base64_data)
        
        mime_type = "image/jpeg"
        if "png" in header:
            mime_type = "image/png"
        elif "webp" in header:
            mime_type = "image/webp"

        image_part = types.Part.from_bytes(
            data=image_bytes,
            mime_type=mime_type
        )

        citizen_context = f'Citizen Description:\n        "{description}"' if description else "No citizen description was provided; rely on the image alone."

        prompt = f"""
        You are an AI municipal infrastructure analyst.

        Analyze the attached image together with the citizen's report.

        {citizen_context}

        Return ONLY valid JSON.

        {{
        "category": "",
        "severity": "",
        "department": "",
        "analysis_confidence": 0.0,
        "summary": "",
        "visible_objects": [],
        "recommended_action": ""
        }}
        """

        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=[image_part, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )

        return json.loads(response.text)
    except Exception as e:
        print(f"Error in Gemini GenAI Client image_to_text API: {e}")
        raise

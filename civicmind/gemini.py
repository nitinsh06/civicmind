import os
import time
import random
import json
import base64
from io import BytesIO
from PIL import Image
import google.generativeai as genai

def generate_mock_text_analysis(title: str, description: str, address: str = None) -> dict:
    content = f"{title.lower()} {description.lower()}"
    
    category = "other"
    severity = "medium"
    department = "General Admin"
    summary = f"The incident reports a civic issue regarding: {title}."

    if "flood" in content or "water rise" in content or "rain overflow" in content or "submerged" in content:
        category = "flooding"
        severity = "critical" if ("severe" in content or "house" in content or "danger" in content) else "high"
        department = "Emergency Services"
        summary = "Severe surface accumulation of water threatening public transit routes or residential access. Demands rapid drainage inspection."
    elif "pothole" in content or "crater" in content or "potholes" in content:
        category = "potholes"
        severity = "high" if ("deep" in content or "tire" in content or "accident" in content) else "medium"
        department = "Public Works"
        summary = "Deep structural depression in road asphalt. Presents tire puncture risks and vehicle safety hazards."
    elif "garbage" in content or "trash" in content or "waste" in content or "dump" in content or "litter" in content:
        category = "garbage accumulation"
        severity = "medium" if ("smell" in content or "large" in content or "weeks" in content) else "low"
        department = "Sanitation"
        summary = "Accumulation of public solid waste creating unsanitary conditions and odor. Needs immediate disposal team routing."
    elif "light" in content or "lamp" in content or "streetlight" in content or "dark" in content or "bulb" in content:
        category = "broken streetlights"
        severity = "medium" if ("dark" in content or "crime" in content or "junction" in content) else "low"
        department = "Energy & Power"
        summary = "Public lighting luminaire failure leading to poor evening visibility. Increases security risk for pedestrians."
    elif "leak" in content or "pipe" in content or "burst" in content or "water main" in content or "spill" in content:
        category = "water leakage"
        severity = "high" if ("flooding" in content or "geyser" in content) else "medium"
        department = "Water & Sewage"
        summary = "Pressurized water main leakage leading to clean water runoff and potential pavement erosion underneath."
    elif "road" in content or "crack" in content or "asphalt" in content or "landslide" in content or "debris" in content:
        category = "road damage"
        severity = "critical" if ("blocked" in content or "collapse" in content) else "high"
        department = "Public Works"
        summary = "Fissures or debris blocking traffic. Imposes traffic bottlenecks and requires highway maintenance crews."

    confidence = round(0.82 + random.random() * 0.15, 2)

    res = {
        "category": category,
        "severity": severity,
        "responsible_department": department,
        "confidence": confidence,
        "summary": f"{summary} (Confidence: {int(confidence * 100)}%)"
    }


    return res

def generate_mock_drone_analysis() -> dict:
    assessments = [
        "Thermal and visual spectrum analysis indicates active inundation covering approx 450 sq. meters. Pavement degradation observed.",
        "Structural integrity scan of the roadway shows deep fracturing (Class 3 road fissure). Foundation integrity compromised.",
        "Aerial volumetric sweep indicates approx 3.2 cubic meters of municipal solid waste blocking pedestrian sidewalk.",
        "Aerial survey reveals multiple street lighting installations inactive. Grid connection issue suspected in Sector 4."
    ]
    
    summaries = [
        "Drone verification confirms severe flooding. Immediate drainage clearance advised.",
        "Drone verification confirms severe road cracking. Lane closure and repair scheduled.",
        "Drone verification confirms sanitation pile-up. Commercial cleanup truck requested.",
        "Drone verification confirms lighting outage over localized blocks. Power utility notified."
    ]

    idx = random.randint(0, len(assessments) - 1)
    severities = ["high", "critical", "medium", "low"]
    statuses = ["verified_high_damage", "verified_high_damage", "minor_damage", "no_damage_detected"]

    return {
        "damage_assessment": assessments[idx],
        "severity_estimate": severities[idx],
        "confidence_score": round(0.88 + random.random() * 0.10, 2),
        "drone_summary": summaries[idx],
        "verification_status": statuses[idx]
    }

def analyze_incident_report(title: str, description: str, address: str = None) -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        # Simulate processing delay
        time.sleep(1.5)
        return generate_mock_text_analysis(title, description, address)

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt_address_addon = ""
        if address:
            prompt_address_addon = f"""
            The citizen did not allow GPS coordinates. They provided the following textual address: "{address}".
            Please resolve this street address to approximate latitude and longitude coordinates in San Francisco, CA.
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
          "confidence": number (float between 0.0 and 1.0 representing your confidence in this analysis),
          "summary": string (a neat, executive 1-2 sentence description of the problem and its potential public impact){', "latitude": number (float for resolved latitude), "longitude": number (float for resolved longitude)' if address else ''}
        }}
        """

        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json"
            )
        )
        
        return json.loads(response.text)
    except Exception as e:
        print(f"Error in Gemini API during text analysis: {e}, falling back to mock.")
        return generate_mock_text_analysis(title, description, address)

def analyze_drone_imagery(base64_image: str) -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        time.sleep(2.0)
        return generate_mock_drone_analysis()

    try:
        # Remove data-url prefix if it exists
        if base64_image.startswith("data:"):
            header, base64_data = base64_image.split(";base64,", 1)
        else:
            base64_data = base64_image

        image_bytes = base64.b64decode(base64_data)
        image = Image.open(BytesIO(image_bytes))

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')

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

        response = model.generate_content(
            [image, prompt],
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json"
            )
        )

        return json.loads(response.text)
    except Exception as e:
        print(f"Error in Gemini Vision API: {e}, falling back to mock.")
        return generate_mock_drone_analysis()

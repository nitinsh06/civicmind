import os
import uuid
import base64
from urllib.parse import quote

import firebase_admin
from firebase_admin import storage


def _resolve_bucket_name() -> str:
    explicit = os.environ.get("FIREBASE_STORAGE_BUCKET")
    if explicit:
        return explicit
    project_id = None
    if firebase_admin._apps:
        app = firebase_admin.get_app()
        project_id = app.project_id
    if not project_id:
        project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        raise ValueError("Cannot resolve Firebase Storage bucket: set FIREBASE_STORAGE_BUCKET")
    return f"{project_id}.firebasestorage.app"


def upload_incident_image(base64_data_url: str, incident_id: str) -> str:
    """Upload a base64 data-URL image to Firebase Storage.

    Returns a tokenized public download URL (works with any credential mode,
    no signed-URL support required).
    """
    header = "image/jpeg"
    if base64_data_url.startswith("data:"):
        header, base64_data = base64_data_url.split(";base64,", 1)
        header = header.replace("data:", "")
    else:
        base64_data = base64_data_url

    mime_type = "image/jpeg"
    ext = "jpg"
    if "png" in header:
        mime_type, ext = "image/png", "png"
    elif "webp" in header:
        mime_type, ext = "image/webp", "webp"

    image_bytes = base64.b64decode(base64_data)

    bucket = storage.bucket(_resolve_bucket_name())
    blob = bucket.blob(f"incidents/{incident_id}.{ext}")

    token = str(uuid.uuid4())
    blob.metadata = {"firebaseStorageDownloadTokens": token}
    blob.upload_from_string(image_bytes, content_type=mime_type)

    encoded_path = quote(blob.name, safe="")
    return (
        f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}"
        f"/o/{encoded_path}?alt=media&token={token}"
    )

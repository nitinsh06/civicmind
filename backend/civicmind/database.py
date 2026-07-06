import os
import json
import firebase_admin
from firebase_admin import credentials, firestore

def get_firestore_client():
    # Check if already initialized to avoid duplicate app errors
    if not firebase_admin._apps:
        sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
        sa_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        
        if sa_json:
            # Parse the JSON string. If there are syntax or parsing errors, this will raise a JSONDecodeError loudly.
            sa_info = json.loads(sa_json.strip())
            cred = credentials.Certificate(sa_info)
            firebase_admin.initialize_app(cred)
            print("Firebase Admin initialized via FIREBASE_SERVICE_ACCOUNT_JSON.")
        elif sa_path:
            if not os.path.exists(sa_path):
                raise FileNotFoundError(f"Firebase credentials file not found at: {sa_path}")
            cred = credentials.Certificate(sa_path)
            firebase_admin.initialize_app(cred)
            print("Firebase Admin initialized via GOOGLE_APPLICATION_CREDENTIALS path.")
        else:
            # Cloud Run or Default credentials fallback (Application Default Credentials)
            # This automatically resolves metadata-server credentials inside Google Cloud runtimes.
            firebase_admin.initialize_app()
            print("Firebase Admin initialized via Application Default Credentials (ADC) fallback.")
            
    return firestore.client()

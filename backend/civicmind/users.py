"""Reporter identity and trust scoring.

Reports can be filed anonymously or by a Google-authenticated citizen.
Authenticated reporters get a users/{uid} profile document and a higher
trust score, which grows with their reporting history.
"""
from datetime import datetime

from firebase_admin import auth as firebase_auth

# Trust model: anonymous reports are accepted but start low; authentication
# lifts the floor, and a track record of reports lifts it further.
ANONYMOUS_TRUST = 0.35
AUTHENTICATED_BASE_TRUST = 0.70
TRUST_PER_REPORT = 0.05
MAX_TRUST = 0.95


def _trust_level(score: float, authenticated: bool) -> str:
    if not authenticated:
        return "unverified"
    return "trusted_citizen" if score >= 0.85 else "verified_citizen"


def resolve_reporter(id_token: str | None, db) -> dict:
    """Build the reporter block stored on an incident.

    Verifies the Firebase ID token when present and upserts the user's
    profile. Invalid/expired tokens degrade to an anonymous report rather
    than rejecting the submission.
    """
    if not id_token:
        return {
            "authenticated": False,
            "trust_level": _trust_level(ANONYMOUS_TRUST, False),
            "trust_score": ANONYMOUS_TRUST,
        }

    try:
        decoded = firebase_auth.verify_id_token(id_token)
    except Exception as e:
        print(f"ID token verification failed, treating report as anonymous: {e}")
        return {
            "authenticated": False,
            "trust_level": _trust_level(ANONYMOUS_TRUST, False),
            "trust_score": ANONYMOUS_TRUST,
        }

    uid = decoded["uid"]
    name = decoded.get("name")
    email = decoded.get("email")
    picture = decoded.get("picture")

    # Upsert the user profile and bump their report count
    user_ref = db.collection("users").document(uid)
    snapshot = user_ref.get()
    reports_count = (snapshot.to_dict() or {}).get("reports_count", 0) if snapshot.exists else 0
    reports_count += 1

    trust_score = min(
        AUTHENTICATED_BASE_TRUST + (reports_count - 1) * TRUST_PER_REPORT,
        MAX_TRUST,
    )
    level = _trust_level(trust_score, True)

    user_ref.set(
        {
            "uid": uid,
            "name": name,
            "email": email,
            "photo_url": picture,
            "reports_count": reports_count,
            "trust_score": trust_score,
            "trust_level": level,
            "last_report_at": datetime.utcnow().isoformat(),
            **({} if snapshot.exists else {"created_at": datetime.utcnow().isoformat()}),
        },
        merge=True,
    )

    return {
        "authenticated": True,
        "uid": uid,
        "name": name,
        "email": email,
        "photo_url": picture,
        "trust_level": level,
        "trust_score": trust_score,
    }

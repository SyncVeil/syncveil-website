"""Dashboard, Vault, Security, OAuth endpoints"""
from __future__ import annotations
import os
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import verify_token
from app.db.models import ConnectedAccount, LoginLog, Session as UserSession, User, VaultFile
from app.db.session import get_db

settings  = get_settings()
router    = APIRouter(prefix="/api", tags=["dashboard"])
GOOGLE_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_SE = os.getenv("GOOGLE_CLIENT_SECRET", "")
MS_ID     = os.getenv("MICROSOFT_CLIENT_ID", "")
MS_SE     = os.getenv("MICROSOFT_CLIENT_SECRET", "")
FRONT_URL = os.getenv("FRONTEND_URL", "https://syncveil.software")



# ─── Auth dependency ──────────────────────────────────────────────────────────

class AuthUser:
    def __init__(self, user: User, session: UserSession, db: Session):
        self.user = user; self.session = session; self.db = db


def get_current_user(authorization: str = Header(default=None), db: Session = Depends(get_db)) -> AuthUser:
    if not authorization:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    scheme, _, token = authorization.partition(" ")
    if scheme != "Bearer" or not token.strip():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid token format", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = verify_token(token.strip())
        uid, sid = payload.get("sub"), payload.get("session_id")
        if not uid or not sid:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
        uu, su = UUID(str(uid)), UUID(str(sid))
        sess = db.query(UserSession).filter(
            UserSession.id == su, UserSession.user_id == uu,
            UserSession.revoked.is_(False), UserSession.expires_at > datetime.utcnow(),
        ).first()
        if not sess:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Session expired or revoked")
        user = db.query(User).filter(User.id == uu).first()
        if not user or user.disabled:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="User unavailable")
        return AuthUser(user=user, session=sess, db=db)
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from e


# ─── Dashboard Overview ───────────────────────────────────────────────────────

@router.get("/dashboard")
def get_dashboard(auth: AuthUser = Depends(get_current_user)):
    db, user, now = auth.db, auth.user, datetime.utcnow()
    seven_ago = now - timedelta(days=7)

    vault_count = db.query(VaultFile).filter(VaultFile.user_id == user.id).count()
    vault_size  = db.query(VaultFile).filter(VaultFile.user_id == user.id).with_entities(VaultFile.size_bytes).all()
    total_size  = sum(r.size_bytes or 0 for r in vault_size)

    active_sessions_q = db.query(UserSession).filter(
        UserSession.user_id == user.id, UserSession.revoked.is_(False), UserSession.expires_at > now,
    ).order_by(desc(UserSession.last_used_at)).all()
    active_sessions = len(active_sessions_q)

    threats_7d = db.query(LoginLog).filter(
        LoginLog.user_id == user.id, LoginLog.success.is_(False), LoginLog.timestamp >= seven_ago,
    ).count()

    recent = db.query(LoginLog).filter(LoginLog.user_id == user.id).order_by(desc(LoginLog.timestamp)).limit(10).all()

    connected = db.query(ConnectedAccount).filter(ConnectedAccount.user_id == user.id).all()

    from app.core.device_parser import parse_device
    def _ser_session(s: UserSession, current_sid) -> dict:
        parsed = parse_device(s.device_info)
        is_current = str(s.id) == str(current_sid)
        return {
            "id":           str(s.id),
            "device_name":  s.device_name or parsed["name"],
            "os":           parsed["os"],
            "browser":      parsed["browser"],
            "icon":         parsed["icon"],
            "ip_address":   s.ip_address or "—",
            "location":     s.location or "Unknown location",
            "created_at":   s.created_at.isoformat() if s.created_at else None,
            "last_used_at": s.last_used_at.isoformat() if s.last_used_at else None,
            "trusted":      bool(s.trusted),
            "is_current":   is_current,
        }

    return {"data": {
        "protectedRecords": vault_count + active_sessions,
        "vaultFiles":       vault_count,
        "vaultSize":        total_size,
        "threatsDetected":  threats_7d,
        "activeSessions":   active_sessions,
        "memberSince":      user.created_at.isoformat() if user.created_at else None,
        "lastLogin":        user.last_login_at.isoformat() if user.last_login_at else None,
        "emailVerified":    user.email_verified,
        "connectedAccounts": [{"provider": c.provider, "email": c.email, "displayName": c.display_name, "connectedAt": c.connected_at.isoformat()} for c in connected],
        "recentActivity":    [{"id": str(l.id), "success": l.success, "reason": l.failure_reason, "ip": l.ip_address, "location": getattr(l, "location", None), "device": l.device_info, "timestamp": l.timestamp.isoformat()} for l in recent],
        "sessions":          [_ser_session(s, auth.session.id) for s in active_sessions_q],
    }}


# ─── Profile ─────────────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    date_of_birth: Optional[str] = None

@router.get("/profile")
def get_profile(auth: AuthUser = Depends(get_current_user)):
    u = auth.user
    return {
        "id": str(u.id), "email": u.email,
        "full_name":    getattr(u, "full_name", None),
        "phone":        getattr(u, "phone", None),
        "country":      getattr(u, "country", None),
        "date_of_birth": u.date_of_birth.isoformat() if getattr(u, "date_of_birth", None) else None,
        "avatar_url":   getattr(u, "avatar_url", None),
        "email_verified": u.email_verified,
        "created_at":   u.created_at.isoformat() if u.created_at else None,
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
    }

@router.patch("/profile")
def update_profile(payload: ProfileUpdate, auth: AuthUser = Depends(get_current_user)):
    from app.auth.service import update_user_profile
    updated = update_user_profile(auth.db, auth.user, full_name=payload.full_name, phone=payload.phone, country=payload.country, date_of_birth=payload.date_of_birth)
    return {"success": True, "user": updated}




# ─── Change Password ─────────────────────────────────────────────────────────

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@router.post("/profile/change-password")
def change_password(p: ChangePasswordRequest, auth: AuthUser = Depends(get_current_user)):
    from app.core.security import verify_password, hash_password
    user, db = auth.user, auth.db
    # Rate-limit: max 5 failed change-password attempts per hour
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    recent_fails = db.query(LoginLog).filter(
        LoginLog.user_id == user.id,
        LoginLog.failure_reason == "wrong_current_password",
        LoginLog.timestamp >= one_hour_ago,
    ).count()
    if recent_fails >= 5:
        raise HTTPException(429, "Too many failed attempts. Try again later.")
    if not verify_password(p.current_password, user.password_hash):
        db.add(LoginLog(user_id=user.id, email=user.email, success=False,
                        failure_reason="wrong_current_password",
                        ip_address=auth.session.ip_address, device_info=auth.session.device_info,
                        timestamp=datetime.utcnow()))
        db.commit()
        raise HTTPException(400, "Current password is incorrect")
    if len(p.new_password) < 8:
        raise HTTPException(400, "New password must be at least 8 characters")
    user.password_hash = hash_password(p.new_password)
    # Revoke all OTHER sessions (keep current one active)
    now = datetime.utcnow()
    other_sessions = auth.db.query(UserSession).filter(
        UserSession.user_id == user.id, UserSession.revoked.is_(False), UserSession.id != auth.session.id
    ).all()
    for s in other_sessions:
        s.revoked = True; s.revoked_at = now; s.revoked_reason = "password_changed"
    auth.db.commit()
    return {"success": True, "message": "Password changed. Other devices have been signed out."}


# ─── Security ─────────────────────────────────────────────────────────────────

@router.get("/security/overview")
def security_overview(auth: AuthUser = Depends(get_current_user)):
    db, user, now = auth.db, auth.user, datetime.utcnow()
    seven_ago = now - timedelta(days=7)
    active_sessions = db.query(UserSession).filter(UserSession.user_id==user.id, UserSession.revoked.is_(False), UserSession.expires_at>now).count()
    successes = db.query(LoginLog).filter(LoginLog.user_id==user.id, LoginLog.success.is_(True),  LoginLog.timestamp>=seven_ago).count()
    failures  = db.query(LoginLog).filter(LoginLog.user_id==user.id, LoginLog.success.is_(False), LoginLog.timestamp>=seven_ago).count()
    total = successes + failures
    fail_rate  = failures / total if total > 0 else 0
    risk_score = min(100, int(fail_rate * 100 + failures * 3))
    risk_level = "critical" if risk_score>=80 else "high" if risk_score>=60 else "medium" if risk_score>=30 else "low"
    sec_score  = max(0, min(100, 100 - risk_score + (10 if user.email_verified else 0)))
    return {"data": {"risk_score": risk_score, "risk_level": risk_level, "security_score": sec_score, "active_sessions": active_sessions, "successes_7d": successes, "failures_7d": failures}}


@router.get("/security/events")
def security_events(limit: int = Query(default=25, le=100), auth: AuthUser = Depends(get_current_user)):
    events = auth.db.query(LoginLog).filter(LoginLog.user_id==auth.user.id).order_by(desc(LoginLog.timestamp)).limit(limit).all()
    return {"data": {"events": [{"id": str(e.id), "success": e.success, "reason": e.failure_reason, "ip_address": e.ip_address, "location": getattr(e,"location",None), "device_info": e.device_info, "timestamp": e.timestamp.isoformat()} for e in events]}}


@router.get("/monitor/breaches")
def breach_monitor(auth: AuthUser = Depends(get_current_user)):
    db, user, now = auth.db, auth.user, datetime.utcnow()
    logs = db.query(LoginLog).filter(LoginLog.user_id==user.id, LoginLog.success.is_(False), LoginLog.timestamp>=(now-timedelta(days=30))).order_by(desc(LoginLog.timestamp)).limit(20).all()
    MSGS = {
        "bad_credentials":    ("Failed login with wrong password", "medium"),
        "cooldown":           ("Account temporarily blocked — too many attempts", "high"),
        "otp_challenge_sent": ("New sign-in code requested", "info"),
        "disabled":           ("Login attempt on disabled account", "critical"),
    }
    def classify(r):
        for k,(msg,sev) in MSGS.items():
            if r and k in r: return msg, sev
        return "Unusual login activity detected", "low"
    breaches = []
    for l in logs:
        msg, sev = classify(l.failure_reason or "")
        if sev == "info": continue
        breaches.append({"id": str(l.id), "message": msg, "severity": sev, "type": l.failure_reason, "ip": l.ip_address, "location": getattr(l,"location",None), "timestamp": l.timestamp.isoformat()})
    return {"breaches": {"breaches": breaches, "totalEvents": len(breaches)}}


# ─── Email Security ───────────────────────────────────────────────────────────

@router.get("/email-security")
def email_security(auth: AuthUser = Depends(get_current_user)):
    db, user, now = auth.db, auth.user, datetime.utcnow()
    seven_ago = now - timedelta(days=7)
    fails_7d  = db.query(LoginLog).filter(LoginLog.user_id==user.id, LoginLog.success.is_(False), LoginLog.timestamp>=seven_ago).count()
    unique_ips = db.query(LoginLog.ip_address).filter(LoginLog.user_id==user.id, LoginLog.timestamp>=seven_ago).distinct().count()
    spam_score = min(100, fails_7d * 8 + max(0, unique_ips - 1) * 5)
    spam_level = "critical" if spam_score>=70 else "high" if spam_score>=40 else "medium" if spam_score>=20 else "low"
    connected  = db.query(ConnectedAccount).filter(ConnectedAccount.user_id==user.id).all()
    # Fetch DNS records for the user's email domain
    dns_data = {"spf": {"exists": False, "valid": False, "record": None}, "dkim": {"exists": False, "valid": False, "record": None}, "dmarc": {"exists": False, "valid": False, "record": None}}
    try:
        from app.core.threat_intel import check_dns_records
        domain = user.email.split("@")[-1] if "@" in user.email else ""
        if domain:
            dns_data = check_dns_records(domain)
    except Exception:
        pass
    return {
        "email": user.email, "email_verified": user.email_verified,
        "spam_risk_score": spam_score, "spam_risk_level": spam_level,
        "failed_attempts_7d": fails_7d, "unique_ips_7d": unique_ips,
        "breach_status": "clear", "last_checked": now.isoformat(),
        "connected_emails": [{"provider": c.provider, "email": c.email, "connected_at": c.connected_at.isoformat()} for c in connected],
        "spf": dns_data.get("spf", {}),
        "dkim": dns_data.get("dkim", {}),
        "dmarc": dns_data.get("dmarc", {}),
        "dns_score": dns_data.get("score", 0),
    }


# ─── Connected Accounts ───────────────────────────────────────────────────────

@router.get("/connected-accounts")
def connected_accounts(auth: AuthUser = Depends(get_current_user)):
    accs = auth.db.query(ConnectedAccount).filter(ConnectedAccount.user_id==auth.user.id).all()
    return {"accounts": [{"id": str(a.id), "provider": a.provider, "email": a.email, "display_name": a.display_name, "avatar_url": a.avatar_url, "connected_at": a.connected_at.isoformat()} for a in accs]}

@router.delete("/connected-accounts/{provider}")
def disconnect(provider: str, auth: AuthUser = Depends(get_current_user)):
    a = auth.db.query(ConnectedAccount).filter(ConnectedAccount.user_id==auth.user.id, ConnectedAccount.provider==provider).first()
    if not a: raise HTTPException(404, "Not found")
    auth.db.delete(a); auth.db.commit()
    return {"success": True}


# ─── Google OAuth ─────────────────────────────────────────────────────────────

@router.get("/auth/google")
def google_init(auth: AuthUser = Depends(get_current_user)):
    if not GOOGLE_ID: raise HTTPException(503, "Google OAuth not configured. Add GOOGLE_CLIENT_ID to Render environment.")
    import urllib.parse
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": GOOGLE_ID, "redirect_uri": f"{FRONT_URL}/oauth/google/callback",
        "response_type": "code", "scope": "openid email profile", "access_type": "offline",
        "prompt": "consent", "state": str(auth.user.id),
    })
    return {"url": url}

@router.get("/auth/google/callback")
def google_callback(code: str, state: str, db: Session = Depends(get_db)):
    if not GOOGLE_ID or not GOOGLE_SE: raise HTTPException(503, "Google OAuth not configured")
    import httpx as hx
    try: user_uuid = UUID(state)
    except: raise HTTPException(400, "Invalid state")
    t = hx.post("https://oauth2.googleapis.com/token", data={"code": code, "client_id": GOOGLE_ID, "client_secret": GOOGLE_SE, "redirect_uri": f"{FRONT_URL}/oauth/google/callback", "grant_type": "authorization_code"})
    if not t.is_success: raise HTTPException(400, "OAuth token exchange failed")
    info = hx.get("https://www.googleapis.com/oauth2/v2/userinfo", headers={"Authorization": f"Bearer {t.json()['access_token']}"})
    if not info.is_success: raise HTTPException(400, "Failed to get Google profile")
    g = info.json()
    user = db.query(User).filter(User.id == user_uuid).first()
    if not user: raise HTTPException(404, "User not found")
    acc = db.query(ConnectedAccount).filter(ConnectedAccount.user_id==user.id, ConnectedAccount.provider=="google").first()
    if acc:
        acc.email = g.get("email"); acc.display_name = g.get("name"); acc.avatar_url = g.get("picture"); acc.last_synced_at = datetime.utcnow()
    else:
        db.add(ConnectedAccount(user_id=user.id, provider="google", provider_user_id=g.get("id",""), email=g.get("email"), display_name=g.get("name"), avatar_url=g.get("picture")))
    if not getattr(user, "avatar_url", None) and g.get("picture"): user.avatar_url = g.get("picture")
    db.commit()
    return {"success": True, "provider": "google", "email": g.get("email")}


# ─── Microsoft OAuth ──────────────────────────────────────────────────────────

@router.get("/auth/microsoft")
def ms_init(auth: AuthUser = Depends(get_current_user)):
    if not MS_ID: raise HTTPException(503, "Microsoft OAuth not configured. Add MICROSOFT_CLIENT_ID to Render environment.")
    import urllib.parse
    url = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?" + urllib.parse.urlencode({
        "client_id": MS_ID, "redirect_uri": f"{FRONT_URL}/oauth/microsoft/callback",
        "response_type": "code", "scope": "openid email profile User.Read",
        "response_mode": "query", "state": str(auth.user.id),
    })
    return {"url": url}

@router.get("/auth/microsoft/callback")
def ms_callback(code: str, state: str, db: Session = Depends(get_db)):
    if not MS_ID or not MS_SE: raise HTTPException(503, "Microsoft OAuth not configured")
    import httpx as hx
    try: user_uuid = UUID(state)
    except: raise HTTPException(400, "Invalid state")
    t = hx.post(f"https://login.microsoftonline.com/common/oauth2/v2.0/token", data={"code": code, "client_id": MS_ID, "client_secret": MS_SE, "redirect_uri": f"{FRONT_URL}/oauth/microsoft/callback", "grant_type": "authorization_code"})
    if not t.is_success: raise HTTPException(400, "Microsoft OAuth token exchange failed")
    info = hx.get("https://graph.microsoft.com/v1.0/me", headers={"Authorization": f"Bearer {t.json()['access_token']}"})
    if not info.is_success: raise HTTPException(400, "Failed to get Microsoft profile")
    m = info.json()
    user = db.query(User).filter(User.id == user_uuid).first()
    if not user: raise HTTPException(404, "User not found")
    email = m.get("mail") or m.get("userPrincipalName","")
    acc = db.query(ConnectedAccount).filter(ConnectedAccount.user_id==user.id, ConnectedAccount.provider=="microsoft").first()
    if acc:
        acc.email = email; acc.display_name = m.get("displayName"); acc.last_synced_at = datetime.utcnow()
    else:
        db.add(ConnectedAccount(user_id=user.id, provider="microsoft", provider_user_id=m.get("id",""), email=email, display_name=m.get("displayName")))
    db.commit()
    return {"success": True, "provider": "microsoft", "email": email}


# ─── Public Snapshot ──────────────────────────────────────────────────────────

@router.get("/public/security-snapshot")
def public_snapshot(db: Session = Depends(get_db)):
    try:
        users  = db.query(User).filter(User.disabled.is_(False)).count()
        total  = db.query(LoginLog).count()
        recent = db.query(LoginLog).order_by(desc(LoginLog.timestamp)).limit(20).all()
        recent_events = [
            {
                "message": l.failure_reason or ("Successful login" if l.success else "Failed login"),
                "success": l.success,
                "ip_address": l.ip_address,
                "location": getattr(l, "location", None),
                "timestamp": l.timestamp.isoformat(),
            }
            for l in recent
        ]
        # trend_7d
        seven_ago = datetime.utcnow() - timedelta(days=7)
        trend_rows = db.query(LoginLog).filter(LoginLog.timestamp >= seven_ago).all()
        by_day = defaultdict(lambda: {"attempts": 0, "failed_attempts": 0})
        for row in trend_rows:
            day = row.timestamp.strftime("%Y-%m-%d")
            by_day[day]["attempts"] += 1
            if not row.success:
                by_day[day]["failed_attempts"] += 1
        trend_7d = [{"date": d, **v} for d, v in sorted(by_day.items())]

        failed_total = db.query(LoginLog).filter(LoginLog.success.is_(False)).count()
        risk_challenges = db.query(LoginLog).filter(LoginLog.failure_reason == "otp_challenge_sent").count()

        return {"data": {
            "totalUsers": users, "totalEvents": total,
            "total_attempts": total, "failed_attempts": failed_total,
            "risk_challenges": risk_challenges,
            "status": "operational", "lastUpdated": datetime.utcnow().isoformat(),
            "recent_events": recent_events, "trend_7d": trend_7d,
        }}
    except Exception:
        return {"data": {"totalUsers": 0, "totalEvents": 0, "total_attempts": 0,
                         "failed_attempts": 0, "risk_challenges": 0,
                         "status": "operational", "lastUpdated": datetime.utcnow().isoformat(),
                         "recent_events": [], "trend_7d": []}}


# ─── Threat Intelligence Endpoints ───────────────────────────────────────────

@router.get("/intelligence/scan")
def intelligence_scan(auth: AuthUser = Depends(get_current_user)):
    """Full threat intelligence scan: HIBP + LeakCheck + DNS + IP reputation."""
    from app.core.threat_intel import run_full_scan
    db, user = auth.db, auth.user

    # Get recent login IPs (last 20 distinct)
    recent_ips = [
        r[0] for r in db.query(LoginLog.ip_address)
        .filter(LoginLog.user_id == user.id)
        .distinct().limit(20).all()
        if r[0] and r[0] not in ("127.0.0.1", "::1", "0.0.0.0")
    ]

    return run_full_scan(user.email, recent_ips=recent_ips[:10])


@router.get("/intelligence/breach-check")
def breach_check(auth: AuthUser = Depends(get_current_user)):
    """Check HIBP + LeakCheck for the authenticated user's email."""
    from app.core.threat_intel import check_email_breaches, check_leakcheck
    user = auth.user
    hibp = check_email_breaches(user.email)
    lc   = check_leakcheck(user.email)
    return {
        "email": user.email,
        "hibp": hibp,
        "leakcheck": lc,
        "total_breaches": (hibp.get("count") or 0) + (lc.get("count") or 0),
        "status": "breached" if ((hibp.get("count") or 0) + (lc.get("count") or 0)) > 0 else "clean",
    }


@router.get("/intelligence/dns")
def dns_check(auth: AuthUser = Depends(get_current_user)):
    """Check SPF, DKIM, DMARC for the user's email domain."""
    from app.core.threat_intel import check_dns_records
    email  = auth.user.email
    domain = email.split("@")[-1] if "@" in email else ""
    if not domain:
        raise HTTPException(400, "Could not extract domain from email")
    return check_dns_records(domain)


@router.get("/intelligence/ip-reputation")
def ip_reputation(auth: AuthUser = Depends(get_current_user)):
    """Check AbuseIPDB reputation for recent login IPs."""
    from app.core.threat_intel import check_multiple_ips
    db, user = auth.db, auth.user
    ips = [
        r[0] for r in db.query(LoginLog.ip_address)
        .filter(LoginLog.user_id == user.id, LoginLog.success.is_(True))
        .order_by(desc(LoginLog.timestamp)).limit(20).all()
        if r[0] and r[0] not in ("127.0.0.1", "::1", "0.0.0.0")
    ]
    results = check_multiple_ips(list(dict.fromkeys(ips))[:10])
    return {
        "checked": len(results),
        "malicious": sum(1 for r in results if r.get("is_malicious")),
        "results": results,
    }


@router.get("/intelligence/threat-feed")
def threat_feed(limit: int = Query(default=20, le=100), auth: AuthUser = Depends(get_current_user)):
    """URLhaus live malware URL feed — free, no key required."""
    from app.core.threat_intel import get_threat_feed
    return get_threat_feed(limit=limit)


@router.get("/intelligence/password-check")
def password_check(password: str = Query(..., min_length=1), auth: AuthUser = Depends(get_current_user)):
    """
    Check password against HIBP k-anonymity endpoint.
    The actual password is NEVER sent to any server — only first 5 chars of SHA-1 hash.
    """
    from app.core.threat_intel import check_password_pwned
    return check_password_pwned(password)


# ─── Session Management ───────────────────────────────────────────────────────

class TrustDeviceRequest(BaseModel):
    session_id: str
    trusted: bool = True

class RenameDeviceRequest(BaseModel):
    session_id: str
    name: str


@router.get("/sessions")
def list_sessions(auth: AuthUser = Depends(get_current_user)):
    """List all active sessions for the authenticated user."""
    db, user, now = auth.db, auth.user, datetime.utcnow()
    from app.core.device_parser import parse_device
    sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id, UserSession.revoked.is_(False), UserSession.expires_at > now)
        .order_by(desc(UserSession.last_used_at))
        .all()
    )
    def _ser(s: UserSession) -> dict:
        parsed = parse_device(s.device_info)
        return {
            "id":           str(s.id),
            "device_name":  s.device_name or parsed["name"],
            "os":           parsed["os"],
            "browser":      parsed["browser"],
            "icon":         parsed["icon"],
            "ip_address":   s.ip_address or "—",
            "location":     s.location or "Unknown location",
            "created_at":   s.created_at.isoformat() if s.created_at else None,
            "last_used_at": s.last_used_at.isoformat() if s.last_used_at else None,
            "trusted":      bool(s.trusted),
            "is_current":   str(s.id) == str(auth.session.id),
        }
    return {"sessions": [_ser(s) for s in sessions]}


@router.delete("/sessions/{session_id}")
def revoke_session(session_id: str, auth: AuthUser = Depends(get_current_user)):
    """Revoke a specific session by ID."""
    db, user, now = auth.db, auth.user, datetime.utcnow()
    try:
        sid = UUID(session_id)
    except Exception:
        raise HTTPException(400, "Invalid session ID")
    sess = db.query(UserSession).filter(
        UserSession.id == sid, UserSession.user_id == user.id, UserSession.revoked.is_(False),
    ).first()
    if not sess:
        raise HTTPException(404, "Session not found or already revoked")
    sess.revoked = True
    sess.revoked_at = now
    sess.revoked_reason = "user_revoked"
    db.commit()
    return {"success": True, "revoked_id": session_id}


@router.delete("/sessions")
def revoke_all_sessions(auth: AuthUser = Depends(get_current_user)):
    """Revoke ALL sessions for the user (logout everywhere)."""
    db, user, now = auth.db, auth.user, datetime.utcnow()
    sessions = db.query(UserSession).filter(
        UserSession.user_id == user.id, UserSession.revoked.is_(False),
    ).all()
    for s in sessions:
        s.revoked = True
        s.revoked_at = now
        s.revoked_reason = "logout_all"
    db.commit()
    return {"success": True, "revoked": len(sessions)}


@router.patch("/sessions/trust")
def trust_device(p: TrustDeviceRequest, auth: AuthUser = Depends(get_current_user)):
    """Mark (or unmark) a session as a trusted device."""
    db, user, now = auth.db, auth.user, datetime.utcnow()
    try:
        sid = UUID(p.session_id)
    except Exception:
        raise HTTPException(400, "Invalid session ID")
    sess = db.query(UserSession).filter(
        UserSession.id == sid, UserSession.user_id == user.id, UserSession.revoked.is_(False),
    ).first()
    if not sess:
        raise HTTPException(404, "Session not found")
    sess.trusted = p.trusted
    sess.trusted_at = now if p.trusted else None
    db.commit()
    return {"success": True, "session_id": p.session_id, "trusted": p.trusted}


@router.patch("/sessions/rename")
def rename_device(p: RenameDeviceRequest, auth: AuthUser = Depends(get_current_user)):
    """Set a custom friendly name for a session/device."""
    db, user = auth.db, auth.user
    try:
        sid = UUID(p.session_id)
    except Exception:
        raise HTTPException(400, "Invalid session ID")
    sess = db.query(UserSession).filter(
        UserSession.id == sid, UserSession.user_id == user.id, UserSession.revoked.is_(False),
    ).first()
    if not sess:
        raise HTTPException(404, "Session not found")
    name = (p.name or "").strip()[:100]
    if not name:
        raise HTTPException(400, "Name cannot be empty")
    sess.device_name = name
    db.commit()
    return {"success": True, "session_id": p.session_id, "device_name": name}

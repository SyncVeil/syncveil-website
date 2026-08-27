"""Offline adaptive login risk scoring and automated remediation."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from ipaddress import ip_address, IPv4Address, IPv6Address
from typing import Iterable, Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.auth.models import User
from app.core.config import get_settings
from app.db.models import LoginLog, Session as UserSession

settings = get_settings()

COOLDOWN_WINDOW_MINUTES = 15
COOLDOWN_FAILED_THRESHOLD_EMAIL = 8
COOLDOWN_FAILED_THRESHOLD_IP = 12


@dataclass
class RiskAssessment:
    score: int
    level: str
    action: str
    reasons: list[str]
    cooldown_until: Optional[datetime] = None


@dataclass
class SecurityEvent:
    code: str
    message: str
    severity: str


def _clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, value))


def _device_fingerprint(user_agent: str) -> str:
    normalized = (user_agent or "unknown").lower()

    browser = "other"
    if "edg/" in normalized:
        browser = "edge"
    elif "chrome/" in normalized and "safari/" in normalized:
        browser = "chrome"
    elif "firefox/" in normalized:
        browser = "firefox"
    elif "safari/" in normalized and "chrome/" not in normalized:
        browser = "safari"

    os_name = "other"
    if "windows" in normalized:
        os_name = "windows"
    elif "mac os x" in normalized or "macintosh" in normalized:
        os_name = "mac"
    elif "linux" in normalized:
        os_name = "linux"
    elif "android" in normalized:
        os_name = "android"
    elif "iphone" in normalized or "ipad" in normalized or "ios" in normalized:
        os_name = "ios"

    is_mobile = "mobile" in normalized or "android" in normalized or "iphone" in normalized
    return f"{browser}:{os_name}:{'mobile' if is_mobile else 'desktop'}"


def _network_fingerprint(ip: str) -> str:
    try:
        parsed = ip_address(ip)
    except ValueError:
        return "unknown"

    if isinstance(parsed, IPv4Address):
        octets = parsed.exploded.split(".")
        return f"{octets[0]}.{octets[1]}.0.0/16"

    if isinstance(parsed, IPv6Address):
        parts = parsed.exploded.split(":")
        return ":".join(parts[:4]) + "::/64"

    return "unknown"


def _recent_failed_attempts(
    db: Session,
    *,
    since: datetime,
    email: Optional[str] = None,
    ip: Optional[str] = None,
) -> list[LoginLog]:
    query = db.query(LoginLog).filter(
        LoginLog.success.is_(False),
        LoginLog.timestamp >= since,
    )
    if email:
        query = query.filter(LoginLog.email == email)
    if ip:
        query = query.filter(LoginLog.ip_address == ip)
    return query.order_by(desc(LoginLog.timestamp)).all()


def detect_login_cooldown(
    db: Session,
    *,
    email: str,
    ip_address: str,
    now: Optional[datetime] = None,
) -> Optional[datetime]:
    now = now or datetime.utcnow()
    since = now - timedelta(minutes=COOLDOWN_WINDOW_MINUTES)

    email_failures = _recent_failed_attempts(db, since=since, email=email)
    ip_failures = _recent_failed_attempts(db, since=since, ip=ip_address)

    if len(email_failures) < COOLDOWN_FAILED_THRESHOLD_EMAIL and len(ip_failures) < COOLDOWN_FAILED_THRESHOLD_IP:
        return None

    latest_failure = max(
        [event.timestamp for event in email_failures + ip_failures],
        default=None,
    )
    if latest_failure is None:
        return None

    cooldown_until = latest_failure + timedelta(minutes=COOLDOWN_WINDOW_MINUTES)
    if cooldown_until <= now:
        return None

    return cooldown_until


def compute_login_risk(
    db: Session,
    *,
    user: Optional[User],
    email: str,
    ip_address: str,
    user_agent: str,
    now: Optional[datetime] = None,
) -> RiskAssessment:
    now = now or datetime.utcnow()
    score = 0
    reasons: list[str] = []

    cooldown_until = detect_login_cooldown(
        db,
        email=email,
        ip_address=ip_address,
        now=now,
    )

    # Baseline pressure from recent failures.
    ten_minutes_ago = now - timedelta(minutes=10)
    hour_ago = now - timedelta(hours=1)
    email_failures_10m = len(_recent_failed_attempts(db, since=ten_minutes_ago, email=email))
    ip_failures_10m = len(_recent_failed_attempts(db, since=ten_minutes_ago, ip=ip_address))
    email_failures_1h = len(_recent_failed_attempts(db, since=hour_ago, email=email))

    if email_failures_10m > 0:
        score += min(30, email_failures_10m * 5)
        reasons.append(f"recent_failed_attempts_email:{email_failures_10m}")

    if ip_failures_10m > 0:
        score += min(20, ip_failures_10m * 3)
        reasons.append(f"recent_failed_attempts_ip:{ip_failures_10m}")

    if email_failures_1h >= 12:
        score += 10
        reasons.append("sustained_failed_attempt_pattern")

    if user is not None:
        success_logs: list[LoginLog] = (
            db.query(LoginLog)
            .filter(LoginLog.user_id == user.id, LoginLog.success.is_(True))
            .order_by(desc(LoginLog.timestamp))
            .limit(50)
            .all()
        )

        known_ips = {entry.ip_address for entry in success_logs if entry.ip_address}
        known_devices = {
            _device_fingerprint(entry.device_info or "unknown")
            for entry in success_logs
        }
        current_device = _device_fingerprint(user_agent)

        if known_ips and ip_address not in known_ips:
            score += 22
            reasons.append("new_ip_for_user")

        if known_devices and current_device not in known_devices:
            score += 14
            reasons.append("new_device_fingerprint")

        if success_logs:
            last_success = success_logs[0]
            if last_success.ip_address and last_success.ip_address != ip_address:
                old_network = _network_fingerprint(last_success.ip_address)
                new_network = _network_fingerprint(ip_address)
                hours_since = (now - last_success.timestamp).total_seconds() / 3600
                if old_network != new_network and hours_since < 2:
                    score += 15
                    reasons.append("rapid_network_shift")

        if user.created_at and (now - user.created_at) < timedelta(hours=24):
            score += 6
            reasons.append("new_account_higher_sensitivity")

        revoked_sessions = (
            db.query(UserSession)
            .filter(
                UserSession.user_id == user.id,
                UserSession.revoked.is_(True),
                UserSession.revoked_reason == "security",
                UserSession.revoked_at.is_not(None),
                UserSession.revoked_at >= now - timedelta(days=7),
            )
            .count()
        )
        if revoked_sessions > 0:
            score += 8
            reasons.append("recent_security_revocations")

    score = _clamp(score, 0, 100)

    if cooldown_until is not None:
        score = max(score, 90)
        return RiskAssessment(
            score=score,
            level="critical",
            action="block_temporarily",
            reasons=reasons + ["cooldown_active"],
            cooldown_until=cooldown_until,
        )

    if score >= settings.SECURITY_CRITICAL_THRESHOLD:
        return RiskAssessment(score=score, level="critical", action="challenge", reasons=reasons)
    if score >= settings.SECURITY_CHALLENGE_THRESHOLD:
        return RiskAssessment(score=score, level="high", action="challenge", reasons=reasons)
    if score >= 35:
        return RiskAssessment(score=score, level="medium", action="allow_with_monitor", reasons=reasons)
    return RiskAssessment(score=score, level="low", action="allow", reasons=reasons)


def prune_security_artifacts(db: Session, *, now: Optional[datetime] = None) -> None:
    """Auto-heal stale security artifacts without breaking user requests."""
    now = now or datetime.utcnow()

    # Revoke expired sessions that were not explicitly revoked.
    expired_sessions = (
        db.query(UserSession)
        .filter(
            UserSession.revoked.is_(False),
            UserSession.expires_at <= now,
        )
        .all()
    )

    for session in expired_sessions:
        session.revoked = True
        session.revoked_at = now
        session.revoked_reason = "expired"


def summarize_security_events(logs: Iterable[LoginLog]) -> list[SecurityEvent]:
    events: list[SecurityEvent] = []
    for log in logs:
        if log.success:
            continue
        reason = (log.failure_reason or "unknown").lower()
        if "cooldown" in reason:
            events.append(SecurityEvent(code="cooldown", message="Automatic lockout activated", severity="high"))
        elif "invalid_credentials" in reason:
            events.append(SecurityEvent(code="failed_login", message="Failed sign-in detected", severity="medium"))
        elif "challenge" in reason:
            events.append(SecurityEvent(code="challenge", message="Step-up verification required", severity="high"))
        elif "account_disabled" in reason:
            events.append(SecurityEvent(code="disabled", message="Login blocked for disabled account", severity="critical"))
        elif "email_not_verified" in reason:
            events.append(SecurityEvent(code="not_verified", message="Unverified account login blocked", severity="low"))
    return events

"""Email Service — Brevo Transactional Email API"""
import logging
from datetime import datetime
from typing import Optional
import httpx
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


def _get_location(ip: str) -> str:
    """Get approximate location from IP — never raises."""
    if not ip or ip in ("127.0.0.1", "::1", "0.0.0.0"):
        return "Local / Unknown"
    try:
        r = httpx.get(f"http://ip-api.com/json/{ip}?fields=city,regionName,country,status", timeout=3)
        if r.is_success:
            d = r.json()
            if d.get("status") == "success":
                parts = [d.get("city", ""), d.get("regionName", ""), d.get("country", "")]
                return ", ".join(p for p in parts if p) or "Unknown"
    except Exception:
        pass
    return "Unknown location"


def _parse_device(user_agent: str) -> tuple[str, str]:
    """Return (device_name, browser) from a User-Agent string."""
    if not user_agent:
        return "Unknown device", "Unknown browser"
    ua = user_agent.lower()
    browser = "Browser"
    os_name = "Unknown OS"
    if "chrome" in ua and "edg" not in ua:
        browser = "Chrome"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"
    elif "edg" in ua:
        browser = "Edge"
    elif "opera" in ua or "opr" in ua:
        browser = "Opera"
    if "windows" in ua:
        os_name = "Windows"
    elif "mac os" in ua or "macos" in ua:
        os_name = "macOS"
    elif "iphone" in ua or "ipad" in ua:
        os_name = "iOS"
    elif "android" in ua:
        os_name = "Android"
    elif "linux" in ua:
        os_name = "Linux"
    return os_name, browser


# ── Template: OTP ─────────────────────────────────────────────────────────────

OTP_TEMPLATE = """\
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your login code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b;">
    <div style="max-width: 480px; margin: 40px auto; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);">
        <div style="padding: 40px 32px;">
            <!-- Brand Name / Logo -->
            <div style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #000000; margin-bottom: 32px;">
                SyncVeil.
            </div>

            <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 16px 0; color: #000000;">{{subject_heading}}</h1>

            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #52525b;">
                Hey {{name}},<br><br>
                Here is the code you need to log in. It will expire in {{expires_minutes}} minutes.
            </p>

            <!-- OTP Box -->
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #000000;">{{otp_code}}</span>
            </div>

            <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #71717a;">
                If you didn't request this email, you can safely ignore it. Someone might have typed your email by mistake.
            </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #fafafa; padding: 24px 32px; border-top: 1px solid #e4e4e7; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                &copy; {{year}} SyncVeil Inc. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>"""


# ── Template: Login alert ─────────────────────────────────────────────────────

LOGIN_ALERT_TEMPLATE = """\
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New login detected</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b;">
    <div style="max-width: 480px; margin: 40px auto; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);">
        <div style="padding: 40px 32px;">
            <!-- Brand Name / Logo -->
            <div style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #000000; margin-bottom: 32px;">
                SyncVeil.
            </div>

            <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 16px 0; color: #000000;">New login detected</h1>

            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #52525b;">
                Hey {{name}},<br><br>
                We noticed a new login to your account from a device we haven't seen before.
            </p>

            <!-- Login Details Block -->
            <div style="border-left: 3px solid #000000; padding-left: 16px; margin-bottom: 32px; background-color: #fafafa; padding: 12px 12px 12px 16px; border-radius: 0 6px 6px 0;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #52525b;">
                    <strong>Device:</strong> {{device_name}} ({{browser}})
                </p>
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #52525b;">
                    <strong>Location:</strong> {{location}}
                </p>
                <p style="margin: 0; font-size: 14px; color: #52525b;">
                    <strong>Time:</strong> {{time}}
                </p>
            </div>

            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #52525b;">
                <strong>Was this you?</strong><br>
                If so, you can ignore this email. There's nothing else you need to do.
            </p>

            <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.5; color: #52525b;">
                <strong>Didn't log in recently?</strong><br>
                Someone else might have access to your account. Please secure it right away.
            </p>

            <!-- Call to Action Button -->
            <a href="{{reset_link}}" style="display: inline-block; background-color: #000000; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 6px;">
                Secure my account
            </a>
        </div>

        <!-- Footer -->
        <div style="background-color: #fafafa; padding: 24px 32px; border-top: 1px solid #e4e4e7; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                &copy; {{year}} SyncVeil Inc. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>"""


def _render_otp(otp: str, name: str = "there", heading: str = "Sign in to your account") -> str:
    return (
        OTP_TEMPLATE
        .replace("{{subject_heading}}", heading)
        .replace("{{name}}", name)
        .replace("{{otp_code}}", otp)
        .replace("{{expires_minutes}}", str(settings.OTP_EXPIRE_MINUTES))
        .replace("{{year}}", str(datetime.utcnow().year))
    )


def _render_login_alert(name: str, device_name: str, browser: str,
                        location: str, time: str, reset_link: str) -> str:
    return (
        LOGIN_ALERT_TEMPLATE
        .replace("{{name}}", name)
        .replace("{{device_name}}", device_name)
        .replace("{{browser}}", browser)
        .replace("{{location}}", location)
        .replace("{{time}}", time)
        .replace("{{reset_link}}", reset_link)
        .replace("{{year}}", str(datetime.utcnow().year))
    )


class EmailService:
    def __init__(self):
        self.api_key      = settings.BREVO_API_KEY
        self.sender_email = settings.SMTP_FROM
        self.sender_name  = settings.EMAIL_FROM_NAME
        if settings.EMAIL_ENABLED:
            if not self.api_key or not self.sender_email:
                raise RuntimeError("EMAIL_ENABLED=true but BREVO_API_KEY or SMTP_FROM missing")

    def _send(self, to_email: str, subject: str, html: str) -> bool:
        if not settings.EMAIL_ENABLED:
            logger.info(f"Email disabled — skipped send to {to_email}: {subject}")
            return True
        payload = {
            "sender": {"email": self.sender_email, "name": self.sender_name},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html,
        }
        headers = {"api-key": self.api_key, "accept": "application/json", "content-type": "application/json"}
        try:
            with httpx.Client(timeout=10) as c:
                r = c.post("https://api.brevo.com/v3/smtp/email", json=payload, headers=headers)
            if 200 <= r.status_code < 300:
                logger.info(f"Email sent → {to_email}: {subject}")
                return True
            logger.error(f"Brevo error {r.status_code}: {r.text[:300]}")
            raise RuntimeError(f"Brevo returned {r.status_code}")
        except Exception as e:
            logger.error(f"Email send error → {to_email}: {e}")
            raise

    def send_verification_email(self, to_email: str, otp: str) -> bool:
        html = _render_otp(otp, heading="Verify your email address")
        return self._send(to_email, "Verify your SyncVeil account", html)

    def send_otp_email(self, to_email: str, otp: str) -> bool:
        html = _render_otp(otp, heading="Sign in to your account")
        return self._send(to_email, f"SyncVeil sign-in code: {otp}", html)

    def send_password_reset_email(self, to_email: str, otp: str) -> bool:
        html = _render_otp(otp, heading="Reset your password")
        return self._send(to_email, "Reset your SyncVeil password", html)

    def send_login_notification(self, to_email: str, *, ip: str, user_agent: str, timestamp: str) -> bool:
        device_name, browser = _parse_device(user_agent)
        location = _get_location(ip)
        reset_link = f"{settings.FRONTEND_URL or 'https://syncveil.software'}/#reset"
        html = _render_login_alert(
            name="there",
            device_name=device_name,
            browser=browser,
            location=location,
            time=f"{timestamp} UTC",
            reset_link=reset_link,
        )
        return self._send(to_email, "New login detected — SyncVeil", html)

    def send_new_device_alert(self, to_email: str, device_info: str, ip_address: str) -> bool:
        return self.send_login_notification(
            to_email, ip=ip_address, user_agent=device_info, timestamp="recently"
        )


_svc: Optional[EmailService] = None


def get_email_service() -> EmailService:
    global _svc
    if _svc is None:
        _svc = EmailService()
    return _svc

"""
Email Service - Brevo Transactional Email API
CRITICAL: Uses BREVO_API_KEY from environment; no keys are hardcoded
"""
import logging
from typing import Optional

import httpx

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class EmailService:
    """Production email service using Brevo Transactional Email API"""

    def __init__(self):
        self.api_key = settings.BREVO_API_KEY
        self.sender_email = settings.SMTP_FROM
        self.sender_name = settings.EMAIL_FROM_NAME
        self._validate_config()

    def _validate_config(self) -> None:
        missing = []
        if not self.api_key:
            missing.append("BREVO_API_KEY")
        if not self.sender_email:
            missing.append("SMTP_FROM")
        if missing:
            raise RuntimeError(f"Email configuration missing: {', '.join(missing)}")

    def _send(self, to_email: str, subject: str, html_content: str) -> bool:
        payload = {
            "sender": {"email": self.sender_email, "name": self.sender_name},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html_content,
        }

        headers = {
            "api-key": self.api_key,
            "accept": "application/json",
            "content-type": "application/json",
        }

        try:
            with httpx.Client(timeout=10) as client:
                response = client.post("https://api.brevo.com/v3/smtp/email", json=payload, headers=headers)
            if 200 <= response.status_code < 300:
                logger.info(f"Email sent successfully to {to_email}: {subject}")
                return True
            logger.error(f"Brevo send failure to {to_email}: status={response.status_code}, body={response.text[:200]}")
            raise RuntimeError("Email sending failed")
        except Exception as exc:
            # Do not log secrets; only the exception message
            logger.error(f"Email send error to {to_email}: {exc}")
            raise

    def send_verification_email(self, to_email: str, otp_code: str) -> bool:
        """Send email verification OTP with a short-lived numeric code"""
        verification_url = f"{settings.FRONTEND_URL}/verify-email?token={otp_code}"
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">🛡️ SyncVeil</h1>
            </div>
            <div style="background: white; padding: 40px; border: 1px solid #e2e8f0;">
                <h2>Verify your email</h2>
                <p>Use the one-time code below to verify your account.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #667eea;">{otp_code}</span>
                </div>
                <p style="color: #e53e3e; font-size: 14px;">This code expires in {settings.OTP_EXPIRE_MINUTES} minutes.</p>
                <p style="color: #718096; font-size: 14px;">You can also verify by opening this link: {verification_url}</p>
                <p style="color: #a0aec0; font-size: 12px;">Never share this code. If you didn't request it, ignore this email.</p>
            </div>
        </body>
        </html>
        """
        return self._send(to_email, "Verify your SyncVeil account", html_content)

    def send_otp_email(self, to_email: str, otp_code: str) -> bool:
        """Send OTP code for login verification"""
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">🛡️ SyncVeil</h1>
            </div>
            <div style="background: white; padding: 40px; border: 1px solid #e2e8f0;">
                <h2>Your Login Code</h2>
                <p>Enter this code to complete your login:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #667eea;">{otp_code}</span>
                </div>
                <p style="color: #e53e3e; font-size: 14px;">This code expires in {settings.OTP_EXPIRE_MINUTES} minutes.</p>
                <p style="color: #a0aec0; font-size: 12px;">Never share this code with anyone.</p>
            </div>
        </body>
        </html>
        """
        return self._send(to_email, f"Your SyncVeil login code: {otp_code}", html_content)

    def send_new_device_alert(self, to_email: str, device_info: str, ip_address: str) -> bool:
        """Send alert for new device login"""
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f59e0b; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">🔔 Security Alert</h1>
            </div>
            <div style="background: white; padding: 40px; border: 1px solid #e2e8f0;">
                <h2>New Device Login</h2>
                <p>Your account was accessed from a new device:</p>
                <div style="background: #fef3c7; padding: 16px; margin: 24px 0;">
                    <p><strong>Device:</strong> {device_info}</p>
                    <p><strong>IP:</strong> {ip_address}</p>
                </div>
                <p style="color: #dc2626;">If this wasn't you, change your password immediately.</p>
            </div>
        </body>
        </html>
        """
        return self._send(to_email, "🔔 New device login", html_content)

    def send_password_change_alert(self, to_email: str) -> bool:
        """Send alert after password change"""
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #10b981; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">🛡️ Password Changed</h1>
            </div>
            <div style="background: white; padding: 40px; border: 1px solid #e2e8f0;">
                <h2>Password Changed Successfully</h2>
                <p>Your SyncVeil password was changed.</p>
                <p style="color: #dc2626;">If you didn't make this change, contact support immediately.</p>
            </div>
        </body>
        </html>
        """
        return self._send(to_email, "Password changed", html_content)


_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """Get or create email service singleton"""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
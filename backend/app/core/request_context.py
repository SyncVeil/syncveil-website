"""Request context helpers for security-sensitive endpoints."""
from __future__ import annotations

from dataclasses import dataclass
from ipaddress import ip_address
from typing import Optional

from fastapi import Request


@dataclass(frozen=True)
class RequestContext:
    ip_address: str
    user_agent: str


def _normalize_ip(raw_ip: Optional[str]) -> str:
    if not raw_ip:
        return "0.0.0.0"

    candidate = raw_ip.strip()
    if not candidate:
        return "0.0.0.0"

    # Handle IPv6-mapped IPv4 addresses.
    if candidate.startswith("::ffff:"):
        candidate = candidate.replace("::ffff:", "", 1)

    try:
        return str(ip_address(candidate))
    except ValueError:
        return "0.0.0.0"


def get_request_context(request: Request) -> RequestContext:
    """
    Resolve request context using proxy-aware headers.

    Priority:
    1) X-Forwarded-For first IP (Render / proxy aware)
    2) X-Real-IP
    3) direct client host
    """
    x_forwarded_for = request.headers.get("x-forwarded-for", "")
    forwarded_ip = x_forwarded_for.split(",")[0].strip() if x_forwarded_for else None
    real_ip = request.headers.get("x-real-ip")
    client_ip = request.client.host if request.client else None

    ip = _normalize_ip(forwarded_ip or real_ip or client_ip)

    user_agent = (request.headers.get("user-agent") or "unknown").strip()
    if len(user_agent) > 512:
        user_agent = user_agent[:512]

    return RequestContext(ip_address=ip, user_agent=user_agent)

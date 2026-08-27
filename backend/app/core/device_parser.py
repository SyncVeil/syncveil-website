"""
Parse raw User-Agent strings into human-readable device names.
No external library needed — pure regex pattern matching.

Examples:
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  → "Windows · Chrome"

  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ... Mobile/15E148 Safari/604.1"
  → "iPhone · Safari"

  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 ... Chrome/120.0.0.0 Mobile Safari/537.36"
  → "Android · Chrome"
"""
from __future__ import annotations
import re


# ── OS detection ──────────────────────────────────────────────────────────────

def _parse_os(ua: str) -> str:
    u = ua or ""
    if re.search(r'iPhone|iPod', u, re.I):          return "iPhone"
    if re.search(r'iPad', u, re.I):                  return "iPad"
    if re.search(r'Android', u, re.I):               return "Android"
    if re.search(r'Windows Phone', u, re.I):         return "Windows Phone"
    if re.search(r'Windows NT 10', u, re.I):         return "Windows 10/11"
    if re.search(r'Windows NT 6\.3', u, re.I):       return "Windows 8.1"
    if re.search(r'Windows NT 6\.1', u, re.I):       return "Windows 7"
    if re.search(r'Windows', u, re.I):               return "Windows"
    if re.search(r'Mac OS X', u, re.I):              return "macOS"
    if re.search(r'CrOS', u, re.I):                  return "ChromeOS"
    if re.search(r'Linux', u, re.I):                 return "Linux"
    return "Unknown OS"


# ── Browser / app detection ───────────────────────────────────────────────────

def _parse_browser(ua: str) -> str:
    u = ua or ""
    # Order matters — check specific before generic
    if re.search(r'Edg/', u, re.I):                  return "Edge"
    if re.search(r'EdgA/', u, re.I):                 return "Edge"
    if re.search(r'OPR/', u, re.I):                  return "Opera"
    if re.search(r'Opera', u, re.I):                 return "Opera"
    if re.search(r'SamsungBrowser', u, re.I):        return "Samsung Internet"
    if re.search(r'UCBrowser', u, re.I):             return "UC Browser"
    if re.search(r'YaBrowser', u, re.I):             return "Yandex"
    if re.search(r'DuckDuckGo', u, re.I):            return "DuckDuckGo"
    if re.search(r'Brave', u, re.I):                 return "Brave"
    if re.search(r'CriOS', u, re.I):                 return "Chrome (iOS)"
    if re.search(r'FxiOS', u, re.I):                 return "Firefox (iOS)"
    if re.search(r'Firefox', u, re.I):               return "Firefox"
    if re.search(r'Chrome', u, re.I):                return "Chrome"
    if re.search(r'Safari', u, re.I):                return "Safari"
    if re.search(r'MSIE|Trident', u, re.I):          return "Internet Explorer"
    # Native apps / API clients
    if re.search(r'okhttp', u, re.I):                return "Android App"
    if re.search(r'CFNetwork|Darwin', u, re.I):      return "iOS App"
    if re.search(r'python-httpx|python-requests|axios|node-fetch', u, re.I): return "API Client"
    if re.search(r'curl', u, re.I):                  return "cURL"
    return "Unknown Browser"


# ── Device icon hint ──────────────────────────────────────────────────────────

def _device_icon(os: str, browser: str) -> str:
    """Return a small icon keyword the frontend can map to an icon component."""
    if os in ("iPhone", "iPad", "iOS App", "Android", "Windows Phone", "Android App"):
        return "mobile"
    if "App" in browser or browser in ("API Client", "cURL"):
        return "terminal"
    return "desktop"


# ── Public API ────────────────────────────────────────────────────────────────

def parse_device(user_agent: str | None) -> dict:
    """
    Returns:
        {
          "os":      "Windows 10/11",
          "browser": "Chrome",
          "name":    "Windows 10/11 · Chrome",
          "icon":    "desktop"   # desktop | mobile | terminal
        }
    """
    if not user_agent:
        return {"os": "Unknown", "browser": "Unknown", "name": "Unknown device", "icon": "desktop"}

    os_name  = _parse_os(user_agent)
    browser  = _parse_browser(user_agent)
    name     = f"{os_name} · {browser}"
    icon     = _device_icon(os_name, browser)
    return {"os": os_name, "browser": browser, "name": name, "icon": icon}

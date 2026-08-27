"""
SyncVeil Threat Intelligence Engine
Integrates: HaveIBeenPwned, LeakCheck, AbuseIPDB, DNS checks, URLhaus
All calls are resilient — they never crash the caller.
"""
from __future__ import annotations
import hashlib
import logging
import os
import time
from functools import lru_cache
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

HIBP_API_KEY      = os.getenv("HIBP_API_KEY", "")
ABUSEIPDB_API_KEY = os.getenv("ABUSEIPDB_API_KEY", "")
LEAKCHECK_API_KEY = os.getenv("LEAKCHECK_API_KEY", "")

UA = "SyncVeil-SecurityEngine/1.0 (https://syncveil.software)"

# Simple in-memory cache {cache_key: (result, expires_at)}
_cache: dict[str, tuple[object, float]] = {}

def _get_cache(key: str) -> Optional[object]:
    if key in _cache:
        result, exp = _cache[key]
        if time.time() < exp:
            return result
        del _cache[key]
    return None

def _set_cache(key: str, value: object, ttl_seconds: int = 3600):
    _cache[key] = (value, time.time() + ttl_seconds)


# ─── HaveIBeenPwned ───────────────────────────────────────────────────────────

def check_email_breaches(email: str) -> dict:
    """
    Check email against HaveIBeenPwned v3.
    Requires HIBP_API_KEY env var (https://haveibeenpwned.com/API/Key).
    TTL-cached for 1 hour per email.
    """
    key = f"hibp:{email.lower()}"
    cached = _get_cache(key)
    if cached: return cached

    if not HIBP_API_KEY:
        result = {
            "source": "hibp",
            "available": False,
            "reason": "HIBP_API_KEY not configured",
            "configure_url": "https://haveibeenpwned.com/API/Key",
            "breaches": [],
            "count": 0,
        }
        _set_cache(key, result, 60)
        return result

    try:
        with httpx.Client(timeout=10) as c:
            r = c.get(
                f"https://haveibeenpwned.com/api/v3/breachedaccount/{email.lower()}",
                headers={
                    "hibp-api-key": HIBP_API_KEY,
                    "User-Agent": UA,
                },
                params={"truncateResponse": "false"},
            )
        if r.status_code == 404:
            result = {"source":"hibp","available":True,"breaches":[],"count":0,"status":"clean"}
        elif r.status_code == 401:
            result = {"source":"hibp","available":False,"reason":"Invalid API key","breaches":[],"count":0}
        elif r.status_code == 429:
            result = {"source":"hibp","available":False,"reason":"Rate limited — try again shortly","breaches":[],"count":0}
        else:
            r.raise_for_status()
            breaches = r.json()
            result = {
                "source":   "hibp",
                "available": True,
                "count":    len(breaches),
                "status":   "breached" if breaches else "clean",
                "breaches": [
                    {
                        "name":        b.get("Name",""),
                        "title":       b.get("Title",""),
                        "domain":      b.get("Domain",""),
                        "date":        b.get("BreachDate",""),
                        "pwn_count":   b.get("PwnCount",0),
                        "description": b.get("Description","")[:200],
                        "data_classes":b.get("DataClasses",[]),
                        "verified":    b.get("IsVerified",False),
                        "sensitive":   b.get("IsSensitive",False),
                        "severity":    _breach_severity(b),
                    }
                    for b in breaches
                ],
            }
        _set_cache(key, result, 3600)
        return result
    except Exception as e:
        logger.warning(f"HIBP check failed for {email}: {e}")
        result = {"source":"hibp","available":False,"reason":str(e),"breaches":[],"count":0}
        _set_cache(key, result, 120)
        return result


def _breach_severity(breach: dict) -> str:
    count = breach.get("PwnCount", 0)
    sensitive = breach.get("IsSensitive", False)
    if sensitive or count > 10_000_000: return "critical"
    if count > 1_000_000: return "high"
    if count > 100_000:   return "medium"
    return "low"


def check_password_pwned(password: str) -> dict:
    """
    Check password against HIBP via k-anonymity (no API key needed, free).
    Password is NEVER sent — only first 5 chars of SHA-1 hash.
    """
    if not password:
        return {"pwned": False, "count": 0}
    try:
        sha1   = hashlib.sha1(password.encode()).hexdigest().upper()
        prefix = sha1[:5]
        suffix = sha1[5:]
        with httpx.Client(timeout=5) as c:
            r = c.get(
                f"https://api.pwnedpasswords.com/range/{prefix}",
                headers={"User-Agent": UA, "Add-Padding": "true"},
            )
            r.raise_for_status()
        for line in r.text.splitlines():
            h, cnt = line.split(":")
            if h == suffix:
                return {"pwned": True, "count": int(cnt), "source": "hibp-passwords"}
        return {"pwned": False, "count": 0, "source": "hibp-passwords"}
    except Exception as e:
        logger.warning(f"Password pwned check failed: {e}")
        return {"pwned": None, "error": str(e)}


# ─── LeakCheck ────────────────────────────────────────────────────────────────

def check_leakcheck(email: str) -> dict:
    """
    Check email via LeakCheck API (https://leakcheck.io).
    Free tier: 50 queries/day.  Set LEAKCHECK_API_KEY env var.
    """
    key = f"leakcheck:{email.lower()}"
    cached = _get_cache(key)
    if cached: return cached

    if not LEAKCHECK_API_KEY:
        result = {
            "source": "leakcheck",
            "available": False,
            "reason": "LEAKCHECK_API_KEY not configured",
            "configure_url": "https://leakcheck.io",
            "found": False,
            "sources": [],
        }
        _set_cache(key, result, 60)
        return result

    try:
        with httpx.Client(timeout=10) as c:
            r = c.get(
                f"https://leakcheck.io/api/v2/query/{email.lower()}",
                headers={"X-API-Key": LEAKCHECK_API_KEY, "User-Agent": UA},
            )
        if r.status_code == 404:
            result = {"source":"leakcheck","available":True,"found":False,"count":0,"sources":[]}
        elif r.status_code in (401, 403):
            result = {"source":"leakcheck","available":False,"reason":"Invalid API key","found":False,"sources":[]}
        else:
            r.raise_for_status()
            data = r.json()
            sources = data.get("sources", [])
            result = {
                "source":    "leakcheck",
                "available": True,
                "found":     bool(sources),
                "count":     len(sources),
                "sources": [
                    {
                        "name":    s.get("name",""),
                        "date":    s.get("date",""),
                        "entries": s.get("entries",0),
                        "fields":  s.get("fields",[]),
                    }
                    for s in sources[:15]
                ],
            }
        _set_cache(key, result, 3600)
        return result
    except Exception as e:
        logger.warning(f"LeakCheck failed for {email}: {e}")
        result = {"source":"leakcheck","available":False,"reason":str(e),"found":False,"sources":[]}
        _set_cache(key, result, 120)
        return result


# ─── AbuseIPDB ────────────────────────────────────────────────────────────────

def check_ip_reputation(ip: str) -> dict:
    """
    Check IP reputation via AbuseIPDB (https://www.abuseipdb.com).
    Free tier: 1000 checks/day.  Set ABUSEIPDB_API_KEY env var.
    """
    if not ip or ip in ("127.0.0.1", "::1", "0.0.0.0", ""):
        return {"available": False, "reason": "Local/private IP", "ip": ip}

    cache_key = f"abuseipdb:{ip}"
    cached = _get_cache(cache_key)
    if cached: return cached

    if not ABUSEIPDB_API_KEY:
        result = {
            "source":    "abuseipdb",
            "available": False,
            "reason":    "ABUSEIPDB_API_KEY not configured",
            "configure_url": "https://www.abuseipdb.com/register",
            "ip": ip,
        }
        _set_cache(cache_key, result, 60)
        return result

    try:
        with httpx.Client(timeout=5) as c:
            r = c.get(
                "https://api.abuseipdb.com/api/v2/check",
                headers={"Key": ABUSEIPDB_API_KEY, "Accept": "application/json"},
                params={"ipAddress": ip, "maxAgeInDays": 90, "verbose": True},
            )
            r.raise_for_status()
        d = r.json().get("data", {})
        score = d.get("abuseConfidenceScore", 0)
        result = {
            "source":            "abuseipdb",
            "available":         True,
            "ip":                ip,
            "abuse_score":       score,
            "country":           d.get("countryCode", ""),
            "isp":               d.get("isp", ""),
            "domain":            d.get("domain", ""),
            "total_reports":     d.get("totalReports", 0),
            "distinct_users":    d.get("numDistinctUsers", 0),
            "last_reported":     d.get("lastReportedAt", ""),
            "is_tor":            d.get("isTor", False),
            "is_malicious":      score > 25,
            "risk_level":        "critical" if score > 80 else "high" if score > 50 else "medium" if score > 25 else "clean",
        }
        _set_cache(cache_key, result, 1800)
        return result
    except Exception as e:
        logger.warning(f"AbuseIPDB check failed for {ip}: {e}")
        result = {"source":"abuseipdb","available":False,"reason":str(e),"ip":ip}
        _set_cache(cache_key, result, 120)
        return result


def check_multiple_ips(ips: list[str]) -> list[dict]:
    """Check reputation of multiple IPs, deduped, max 10."""
    seen, results = set(), []
    for ip in ips[:10]:
        if ip and ip not in seen:
            seen.add(ip)
            results.append(check_ip_reputation(ip))
    return results


# ─── DNS Record Check ─────────────────────────────────────────────────────────

def check_dns_records(domain: str) -> dict:
    """
    Check SPF, DKIM, and DMARC DNS records for the given domain.
    Uses dnspython — no API key needed, completely free.
    """
    key = f"dns:{domain.lower()}"
    cached = _get_cache(key)
    if cached: return cached

    result: dict = {
        "domain": domain,
        "spf":    {"exists": False, "valid": False, "record": None, "strength": "none"},
        "dmarc":  {"exists": False, "valid": False, "record": None, "policy": "none"},
        "dkim":   {"exists": False, "valid": False, "record": None, "selector": None},
        "mx":     {"exists": False, "records": []},
        "score":  0,
    }

    try:
        import dns.resolver
        resolver = dns.resolver.Resolver()
        resolver.timeout = 3
        resolver.lifetime = 4
    except ImportError:
        result["error"] = "dnspython not installed — add dnspython to requirements.txt"
        return result

    # SPF
    try:
        for rdata in resolver.resolve(domain, "TXT"):
            txt = str(rdata).strip('"').replace("\" \"", "")
            if txt.startswith("v=spf1"):
                strong = "-all" in txt
                soft   = "~all" in txt
                result["spf"] = {
                    "exists":   True,
                    "valid":    strong or soft,
                    "record":   txt[:200],
                    "strength": "strict" if strong else "soft" if soft else "weak",
                }
                break
    except Exception: pass

    # DMARC
    try:
        for rdata in resolver.resolve(f"_dmarc.{domain}", "TXT"):
            txt = str(rdata).strip('"').replace("\" \"", "")
            if txt.startswith("v=DMARC1"):
                policy = "none"
                if "p=reject" in txt:    policy = "reject"
                elif "p=quarantine" in txt: policy = "quarantine"
                result["dmarc"] = {
                    "exists":  True,
                    "valid":   policy in ("reject", "quarantine"),
                    "record":  txt[:200],
                    "policy":  policy,
                }
                break
    except Exception: pass

    # DKIM — try common selectors
    for selector in ["google", "default", "mail", "dkim", "selector1", "selector2", "k1", "smtp", "email"]:
        try:
            for rdata in resolver.resolve(f"{selector}._domainkey.{domain}", "TXT"):
                txt = str(rdata).strip('"').replace("\" \"", "")
                if "p=" in txt:
                    result["dkim"] = {
                        "exists":   True,
                        "valid":    len(txt) > 60,
                        "record":   txt[:200],
                        "selector": selector,
                    }
                    break
            if result["dkim"]["exists"]: break
        except Exception: continue

    # MX
    try:
        mx_records = []
        for rdata in resolver.resolve(domain, "MX"):
            mx_records.append({"preference": rdata.preference, "exchange": str(rdata.exchange)})
        result["mx"] = {"exists": bool(mx_records), "records": sorted(mx_records, key=lambda x: x["preference"])[:5]}
    except Exception: pass

    # Score (0–100)
    score = 0
    if result["spf"]["valid"]:   score += 30
    if result["dmarc"]["valid"]: score += 40
    if result["dkim"]["valid"]:  score += 30
    result["score"] = score

    _set_cache(key, result, 7200)
    return result


# ─── URLhaus Threat Feed ──────────────────────────────────────────────────────

def get_threat_feed(limit: int = 20) -> dict:
    """
    Get recent malware URLs from URLhaus (abuse.ch).
    Completely free, no API key required.
    """
    key = "urlhaus:recent"
    cached = _get_cache(key)
    if cached: return cached

    try:
        with httpx.Client(timeout=10) as c:
            r = c.post(
                "https://urlhaus-api.abuse.ch/v1/urls/recent/limit/",
                data={"limit": str(min(limit, 100))},
                headers={"User-Agent": UA},
            )
            r.raise_for_status()
        data = r.json()
        urls  = data.get("urls", [])
        result = {
            "available": True,
            "source":    "urlhaus",
            "count":     len(urls),
            "items": [
                {
                    "url":       u.get("url", ""),
                    "url_status":u.get("url_status", ""),
                    "date":      u.get("date_added", ""),
                    "threat":    u.get("threat", ""),
                    "tags":      u.get("tags") or [],
                    "country":   u.get("country_code", ""),
                    "reporter":  u.get("reporter", ""),
                }
                for u in urls[:limit]
            ],
            "query_time": data.get("query_time",""),
        }
        _set_cache(key, result, 900)   # 15 min TTL
        return result
    except Exception as e:
        logger.warning(f"URLhaus feed failed: {e}")
        result = {"available": False, "source": "urlhaus", "reason": str(e), "items": [], "count": 0}
        _set_cache(key, result, 120)
        return result


# ─── Shodan (passive) ─────────────────────────────────────────────────────────

SHODAN_API_KEY = os.getenv("SHODAN_API_KEY", "")

def check_shodan_ip(ip: str) -> dict:
    """
    Lookup IP on Shodan for open ports and vulnerabilities.
    Requires SHODAN_API_KEY (free membership available).
    """
    if not SHODAN_API_KEY or not ip or ip in ("127.0.0.1", "::1"):
        return {"available": False, "reason": "SHODAN_API_KEY not configured or local IP", "ip": ip}

    key = f"shodan:{ip}"
    cached = _get_cache(key)
    if cached: return cached

    try:
        with httpx.Client(timeout=8) as c:
            r = c.get(
                f"https://api.shodan.io/shodan/host/{ip}",
                params={"key": SHODAN_API_KEY},
            )
        if r.status_code == 404:
            result = {"available": True, "ip": ip, "found": False, "ports": [], "vulns": []}
        else:
            r.raise_for_status()
            d = r.json()
            result = {
                "available":   True,
                "ip":          ip,
                "found":       True,
                "org":         d.get("org",""),
                "country":     d.get("country_name",""),
                "city":        d.get("city",""),
                "ports":       d.get("ports",[])[:20],
                "vulns":       list(d.get("vulns",{}).keys())[:10],
                "hostnames":   d.get("hostnames",[])[:5],
                "last_update": d.get("last_update",""),
                "os":          d.get("os",""),
                "risk":        "high" if d.get("vulns") else "low",
            }
        _set_cache(key, result, 3600)
        return result
    except Exception as e:
        logger.warning(f"Shodan check failed for {ip}: {e}")
        result = {"available": False, "reason": str(e), "ip": ip}
        _set_cache(key, result, 120)
        return result


# ─── Combined Dark Web Scan ───────────────────────────────────────────────────

def run_full_scan(email: str, recent_ips: list[str] | None = None) -> dict:
    """
    Run a full threat intelligence scan for a user's email.
    Combines HIBP, LeakCheck, DNS, and IP reputation.
    """
    domain = email.split("@")[-1] if "@" in email else ""

    hibp       = check_email_breaches(email)
    leakcheck  = check_leakcheck(email)
    dns        = check_dns_records(domain) if domain else {}
    ip_reports = check_multiple_ips(recent_ips or []) if recent_ips else []

    total_breaches = (hibp.get("count") or 0) + (leakcheck.get("count") or 0)
    any_malicious  = any(r.get("is_malicious") for r in ip_reports if r.get("available"))

    risk = "critical" if total_breaches > 5 else \
           "high"     if total_breaches > 0 or any_malicious else \
           "medium"   if not dns.get("spf",{}).get("valid") else "low"

    return {
        "email":           email,
        "domain":          domain,
        "risk":            risk,
        "total_breaches":  total_breaches,
        "hibp":            hibp,
        "leakcheck":       leakcheck,
        "dns":             dns,
        "ip_reputation":   ip_reports,
        "summary": {
            "breaches_found":  total_breaches > 0,
            "dns_healthy":     dns.get("score", 0) >= 70,
            "ips_clean":       not any_malicious,
            "recommendation":  _build_recommendation(hibp, leakcheck, dns, any_malicious),
        }
    }


def _build_recommendation(hibp: dict, lc: dict, dns: dict, bad_ip: bool) -> list[str]:
    recs = []
    if hibp.get("count", 0) > 0:
        recs.append("Change your password immediately — your email appeared in known breaches.")
    if lc.get("found"):
        recs.append("Your credentials were found in dark-web leaks — enable two-factor authentication.")
    if not dns.get("spf",{}).get("valid"):
        recs.append("Your email domain is missing or has a weak SPF record — update your DNS configuration.")
    if not dns.get("dmarc",{}).get("valid"):
        recs.append("Your domain lacks a strong DMARC policy — emails can be spoofed from your domain.")
    if not dns.get("dkim",{}).get("valid"):
        recs.append("DKIM signing is not configured — your emails may be marked as spam.")
    if bad_ip:
        recs.append("Malicious IPs detected in your login history — review active sessions.")
    if not recs:
        recs.append("No immediate threats detected. Continue monitoring regularly.")
    return recs

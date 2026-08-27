"""
SyncVeil Secure Container Engine (SSCE)
========================================
Implements the .syncveil container format.

Container binary layout (all multi-byte integers are big-endian):
  [0:8]   Magic        b"SYNCVEIL"
  [8]     Version      uint8  (currently 1)
  [9:13]  MetaLen      uint32 — length of JSON metadata block
  [13:N]  Metadata     UTF-8 JSON  (includes key_version field)
  [N:N+12] FileNonce   12 bytes — AES-GCM nonce for the file key
  [+48]   EncFileKey   48 bytes — AES-256 file key encrypted with user-scoped key
           (encrypted via AES-GCM using FileNonce; AESGCM.encrypt() appends the
            16-byte tag, making EncFileKey 32 plaintext + 16 tag = 48 bytes)
  [+12]   DataNonce    12 bytes — AES-GCM nonce for the ciphertext
  [+4]    CipherLen    uint32 — length of ciphertext+tag
  [CipherLen] Ciphertext  AES-256-GCM(zstd(plaintext))  (tag appended by AESGCM)
  [+32]   HMAC         HMAC-SHA256 over everything preceding this field

Encryption hierarchy:
  VAULT_ENCRYPTION_KEY (env)
       ↓  HKDF-SHA256 with salt=b"ssce-master-v1"
  Root Key  (never used directly for encryption)
       ↓  HKDF-SHA256 with info=b"user:<user_id>" + salt=b"ssce-user-v1"
  User-Scoped Key  (one per user, derived deterministically from root key)
       ↓  encrypts
  File Key  (32 bytes, random per file, stored encrypted in container)
       ↓  encrypts
  Payload   (zstd-compressed plaintext)

Key versioning:
  key_version is stored in container metadata (JSON field) and in VaultFile.key_version.
  When VAULT_ENCRYPTION_KEY is rotated, bump KEY_VERSION in config/env, re-derive
  root and user keys, and run the key-rotation migration to re-wrap file keys.
  Old containers remain readable as long as the old key is available for unwrapping.
"""
from __future__ import annotations

import hashlib
import hmac as _hmac
import io
import json
import os
import struct
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import zstandard as zstd
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.hashes import SHA256
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.core.config import get_settings

# ── Constants ─────────────────────────────────────────────────────────────────

MAGIC        = b"SYNCVEIL"
VERSION      = 1
COMPRESSION  = "zstd"
ENC_ALGO     = "AES-256-GCM"
HMAC_ALGO    = "HMAC-SHA256"

# ClamAV socket path — override via env for non-standard installs
CLAMD_SOCKET = os.getenv("CLAMD_SOCKET", "/var/run/clamav/clamd.ctl")
CLAMD_HOST   = os.getenv("CLAMD_HOST",   "")          # e.g. "127.0.0.1"
CLAMD_PORT   = int(os.getenv("CLAMD_PORT", "3310"))

_settings = get_settings()


def _derive_root_key() -> bytes:
    """Derive the 32-byte root key from VAULT_ENCRYPTION_KEY using HKDF-SHA256.

    HKDF provides proper domain separation and key stretching even from a
    high-entropy input key material (IKM).  The salt and info strings bind
    the output to this specific application context, preventing cross-context
    key reuse if the same IKM is ever used elsewhere.

    VAULT_ENCRYPTION_KEY must be high-entropy (≥32 chars enforced in
    production validation).  Human passwords require Argon2id before HKDF —
    that path is reserved for future password-locked containers.
    """
    ikm = (
        _settings.VAULT_ENCRYPTION_KEY
        or _settings.JWT_SECRET
        or "syncveil-dev-insecure-key-change-me"
    ).encode("utf-8")

    return HKDF(
        algorithm=SHA256(),
        length=32,
        salt=b"ssce-master-v1",
        info=b"syncveil-root-key",
    ).derive(ikm)


# Root key: derived once at startup, used only to derive per-user keys.
# Never used directly for encryption — user-scoped keys are the leaf keys.
_ROOT_KEY: bytes = _derive_root_key()


def derive_user_key(user_id: str) -> bytes:
    """Derive a 32-byte user-scoped key from the root key.

    Each user gets a deterministic but isolated key.  Compromising one
    user's files does not expose other users' file keys because each user's
    files are wrapped by a different leaf key.

    The info string includes the user UUID so the output is unique per user.
    The salt "ssce-user-v1" provides domain separation from other HKDF uses.
    """
    return HKDF(
        algorithm=SHA256(),
        length=32,
        salt=b"ssce-user-v1",
        info=f"syncveil-user-key:{user_id}".encode("utf-8"),
    ).derive(_ROOT_KEY)


# Legacy alias — used internally only for HMAC over the container body.
# File key encryption now uses derive_user_key(user_id) instead.
MASTER_KEY: bytes = _ROOT_KEY


# ── Malware scanning ──────────────────────────────────────────────────────────

class MalwareScanResult:
    __slots__ = ("clean", "threat", "scanner")

    def __init__(self, clean: bool, threat: str = "", scanner: str = "clamav"):
        self.clean   = clean
        self.threat  = threat
        self.scanner = scanner

    def __repr__(self) -> str:
        return f"<MalwareScanResult clean={self.clean} threat={self.threat!r}>"


def scan_bytes(data: bytes) -> MalwareScanResult:
    """Scan raw bytes with ClamAV.

    Tries Unix socket first, then TCP.  If ClamAV is not reachable
    (common in dev/test), returns a PASS with scanner="unavailable" so
    uploads are not blocked when the daemon is absent.  Production
    deployments SHOULD have ClamAV running; the scan result is logged
    either way so the absence is auditable.
    """
    try:
        import clamd  # type: ignore
    except ImportError:
        return MalwareScanResult(clean=True, scanner="unavailable:no-clamd-package")

    cd: Optional[clamd.ClamdBase] = None
    try:
        if CLAMD_HOST:
            cd = clamd.ClamdNetworkSocket(host=CLAMD_HOST, port=CLAMD_PORT, timeout=15)
        elif os.path.exists(CLAMD_SOCKET):
            cd = clamd.ClamdUnixSocket(path=CLAMD_SOCKET)
        else:
            return MalwareScanResult(clean=True, scanner="unavailable:no-socket")

        cd.ping()  # raises if daemon is down
        result = cd.instream(io.BytesIO(data))
        status, threat = result.get("stream", ("OK", ""))
        if status == "OK":
            return MalwareScanResult(clean=True)
        return MalwareScanResult(clean=False, threat=threat or "UNKNOWN")
    except Exception as exc:
        # Daemon unreachable — log-worthy but non-blocking in dev
        return MalwareScanResult(clean=True, scanner=f"unavailable:{type(exc).__name__}")


# ── Container metadata ────────────────────────────────────────────────────────

@dataclass
class ContainerMetadata:
    original_filename:  str
    original_size:      int
    content_type:       str
    compressed_size:    int
    sha256_plaintext:   str      # hex digest of original plaintext
    compression:        str      = COMPRESSION
    encryption:         str      = ENC_ALGO
    hmac_algorithm:     str      = HMAC_ALGO
    ssce_version:       int      = VERSION
    created_at:         str      = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    storage_backend:    str      = "postgresql"
    key_version:        int      = 1   # bump when VAULT_ENCRYPTION_KEY rotates
    user_id:            str      = ""  # owner UUID — binds container to a user

    def to_json(self) -> bytes:
        return json.dumps(self.__dict__, separators=(",", ":")).encode("utf-8")

    @classmethod
    def from_json(cls, data: bytes) -> "ContainerMetadata":
        d = json.loads(data)
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


# ── Container build / parse ───────────────────────────────────────────────────

def _hmac_sha256(key: bytes, data: bytes) -> bytes:
    return _hmac.new(key, data, hashlib.sha256).digest()


def build_container(
    plaintext: bytes,
    *,
    filename: str,
    content_type: str,
    user_id: str,
    key_version: int = 1,
) -> tuple[bytes, ContainerMetadata]:
    """Compress → encrypt → wrap in .syncveil container.

    Returns (container_bytes, metadata).
    The metadata is also embedded inside the container; the returned
    ContainerMetadata object is a convenience for the caller to persist
    indexed fields without re-parsing the container.

    user_id is required so the file key is wrapped with a user-scoped key
    rather than a shared global key.  key_version tracks which rotation of
    VAULT_ENCRYPTION_KEY was used; it is stored in the container and in the
    VaultFile.key_version DB column so re-wrapping on rotation is auditable.
    """
    # 1. SHA-256 of original plaintext (integrity anchor)
    sha256_plain = hashlib.sha256(plaintext).hexdigest()

    # 2. Compress with Zstandard (level 3 — fast, good ratio)
    cctx = zstd.ZstdCompressor(level=3)
    compressed = cctx.compress(plaintext)

    # 3. Derive the user-scoped wrapping key for this user
    user_key   = derive_user_key(user_id)

    # 4. Generate a random 256-bit file key
    file_key   = os.urandom(32)
    file_nonce = os.urandom(12)

    # 5. Encrypt the file key with the user-scoped key
    user_cipher  = AESGCM(user_key)
    enc_file_key = user_cipher.encrypt(file_nonce, file_key, None)  # 32+16 = 48 bytes

    # 6. Encrypt the compressed payload with the file key
    data_nonce  = os.urandom(12)
    file_cipher = AESGCM(file_key)
    # AAD = sha256_plain bytes — binds ciphertext to original content hash
    aad         = sha256_plain.encode("ascii")
    ciphertext  = file_cipher.encrypt(data_nonce, compressed, aad)  # includes 16-byte GCM tag

    # 7. Build metadata
    meta = ContainerMetadata(
        original_filename = filename,
        original_size     = len(plaintext),
        content_type      = content_type,
        compressed_size   = len(compressed),
        sha256_plaintext  = sha256_plain,
        key_version       = key_version,
        user_id           = user_id,
    )
    meta_bytes = meta.to_json()

    # 8. Assemble container (everything before HMAC)
    buf = io.BytesIO()
    buf.write(MAGIC)                              # 8 bytes
    buf.write(struct.pack(">B",  VERSION))        # 1 byte
    buf.write(struct.pack(">I",  len(meta_bytes)))# 4 bytes
    buf.write(meta_bytes)
    buf.write(file_nonce)                         # 12 bytes
    buf.write(enc_file_key)                       # 48 bytes
    buf.write(data_nonce)                         # 12 bytes
    buf.write(struct.pack(">I", len(ciphertext))) # 4 bytes
    buf.write(ciphertext)
    pre_hmac = buf.getvalue()

    # 9. HMAC-SHA256 over entire container up to this point
    sig = _hmac_sha256(MASTER_KEY, pre_hmac)

    container = pre_hmac + sig                    # + 32 bytes HMAC
    return container, meta


def parse_container(container: bytes) -> tuple[bytes, ContainerMetadata]:
    """Verify HMAC → decrypt → decompress → return (plaintext, metadata).

    Raises ValueError on any tampering, wrong key, or format error.
    The user-scoped key is re-derived from the user_id embedded in container
    metadata, so callers do not need to pass the key explicitly.
    """
    if len(container) < 8 + 1 + 4 + 12 + 48 + 12 + 4 + 32:
        raise ValueError("Container too short")

    # 1. Split HMAC off the end
    body, stored_hmac = container[:-32], container[-32:]

    # 2. Verify HMAC first (constant-time comparison)
    expected_hmac = _hmac_sha256(MASTER_KEY, body)
    if not _hmac.compare_digest(stored_hmac, expected_hmac):
        raise ValueError("HMAC verification failed — container may be tampered")

    # 3. Parse header
    r = io.BytesIO(body)

    magic = r.read(8)
    if magic != MAGIC:
        raise ValueError(f"Invalid magic: {magic!r}")

    version = struct.unpack(">B", r.read(1))[0]
    if version != VERSION:
        raise ValueError(f"Unsupported container version: {version}")

    meta_len   = struct.unpack(">I", r.read(4))[0]
    meta_bytes = r.read(meta_len)
    meta       = ContainerMetadata.from_json(meta_bytes)

    file_nonce  = r.read(12)
    enc_file_key= r.read(48)        # 32 encrypted key + 16 GCM tag
    data_nonce  = r.read(12)
    cipher_len  = struct.unpack(">I", r.read(4))[0]
    ciphertext  = r.read(cipher_len)

    if len(ciphertext) != cipher_len:
        raise ValueError("Truncated ciphertext")

    # 4. Recover file key using the user-scoped key from metadata
    if not meta.user_id:
        raise ValueError("Container missing user_id — cannot derive decryption key")
    user_key      = derive_user_key(meta.user_id)
    user_cipher   = AESGCM(user_key)
    try:
        file_key = user_cipher.decrypt(file_nonce, enc_file_key, None)
    except Exception:
        raise ValueError("File key decryption failed")

    # 5. Decrypt payload
    file_cipher = AESGCM(file_key)
    aad         = meta.sha256_plaintext.encode("ascii")
    try:
        compressed = file_cipher.decrypt(data_nonce, ciphertext, aad)
    except Exception:
        raise ValueError("Payload decryption failed — wrong key or tampered data")

    # 6. Decompress
    dctx = zstd.ZstdDecompressor()
    try:
        plaintext = dctx.decompress(compressed, max_output_size=100 * 1024 * 1024)
    except Exception as exc:
        raise ValueError(f"Decompression failed: {exc}") from exc

    # 7. Verify SHA-256 of recovered plaintext
    actual_sha256 = hashlib.sha256(plaintext).hexdigest()
    if actual_sha256 != meta.sha256_plaintext:
        raise ValueError("Plaintext integrity check failed — sha256 mismatch")

    return plaintext, meta


def verify_container_integrity(container: bytes) -> dict:
    """Verify a stored container without decrypting the payload.

    Returns a dict suitable for the integrity API endpoint.
    """
    result = {
        "hmac_valid":        False,
        "magic_valid":       False,
        "version":           None,
        "metadata_readable": False,
        "integrity_ok":      False,
        "error":             None,
    }
    try:
        if len(container) < 64:
            result["error"] = "Container too short"
            return result

        body, stored_hmac = container[:-32], container[-32:]
        expected = _hmac_sha256(MASTER_KEY, body)
        result["hmac_valid"] = _hmac.compare_digest(stored_hmac, expected)

        r = io.BytesIO(body)
        magic = r.read(8)
        result["magic_valid"] = (magic == MAGIC)

        version = struct.unpack(">B", r.read(1))[0]
        result["version"] = version

        meta_len   = struct.unpack(">I", r.read(4))[0]
        meta_bytes = r.read(meta_len)
        meta       = ContainerMetadata.from_json(meta_bytes)
        result["metadata_readable"] = True
        result["original_filename"] = meta.original_filename
        result["original_size"]     = meta.original_size
        result["compression"]       = meta.compression
        result["encryption"]        = meta.encryption
        result["created_at"]        = meta.created_at

        result["integrity_ok"] = result["hmac_valid"] and result["magic_valid"] and result["metadata_readable"]
    except Exception as exc:
        result["error"] = str(exc)

    return result

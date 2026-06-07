import { API_BASE_URL } from './config';

export class APIError extends Error {
  constructor(status, message, details = null) {
    super(message); this.status = status; this.details = details; this.name = 'APIError';
  }
}

const clearAuth = () => ['access_token','refresh_token','user_id','user_email'].forEach(k => localStorage.removeItem(k));

const storeAuth = (data) => {
  if (!data?.access_token) return;
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('refresh_token', data.refresh_token || '');
  localStorage.setItem('user_id', data.user?.id || '');
  localStorage.setItem('user_email', data.user?.email || '');
};

const getMsg = (data, fallback='Request failed') => {
  if (!data) return fallback;
  if (typeof data.detail === 'string') return data.detail;
  if (typeof data.detail === 'object' && data.detail?.message) return data.detail.message;
  if (typeof data.message === 'string') return data.message;
  return fallback;
};

const authHdr = () => {
  const t = localStorage.getItem('access_token');
  if (!t) throw new APIError(401, 'Not authenticated');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` };
};

let _refreshing = null; // singleton refresh promise

const req = async (method, path, body) => {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method, headers: authHdr(), body: body ? JSON.stringify(body) : undefined,
  });
  // Auto-refresh on 401 (expired access token)
  if (res.status === 401 && localStorage.getItem('refresh_token')) {
    if (!_refreshing) {
      _refreshing = authAPI.refresh().finally(() => { _refreshing = null; });
    }
    try {
      await _refreshing;
      // Retry original request with new token
      const res2 = await fetch(`${API_BASE_URL}${path}`, {
        method, headers: authHdr(), body: body ? JSON.stringify(body) : undefined,
      });
      const data2 = await res2.json().catch(() => ({}));
      if (!res2.ok) throw new APIError(res2.status, getMsg(data2, `${method} ${path} failed`), data2);
      return data2;
    } catch {
      clearAuth();
      throw new APIError(401, 'Session expired — please sign in again');
    }
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new APIError(res.status, getMsg(data, `${method} ${path} failed`), data);
  return data;
};

const pubReq = async (method, path, body) => {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new APIError(res.status, getMsg(data, `${method} ${path} failed`), data);
  return data;
};

export const isAuthenticated = () => !!localStorage.getItem('access_token');
export const getCurrentUser  = () => {
  const id = localStorage.getItem('user_id'), email = localStorage.getItem('user_email');
  return (id || email) ? { id, email } : null;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  signup: async (email, password, full_name, phone, country, date_of_birth) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/signup`, {
        method:'POST', headers:{'Content-Type':'application/json'}, signal: ctrl.signal,
        body: JSON.stringify({ email: email.toLowerCase().trim(), password, full_name, phone, country, date_of_birth }),
      });
      const data = await res.json();
      if (!res.ok) throw new APIError(res.status, getMsg(data,'Signup failed'), data);
      storeAuth(data);
      return { success:true, user:data.user, requires_verification: data.requires_verification, email_sent: data.email_sent, ...data };
    } catch(e) {
      if (e.name==='AbortError') throw new APIError(504,'Request timed out — backend may be starting up');
      if (e instanceof APIError) throw e;
      throw new APIError(500, e.message||'Network error', e);
    } finally { clearTimeout(t); }
  },

  login: async (email, password) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status===401) throw new APIError(401,'Invalid email or password');
      if (res.status===403) throw new APIError(403, data.detail || 'Please verify your email before signing in');
      if (res.status===429) throw new APIError(429, getMsg(data,'Too many attempts — try again shortly'));
      throw new APIError(res.status, getMsg(data,'Login failed'), data);
    }
    // Always returns challenge_required:true (OTP always required)
    return { success: false, challengeRequired: true, email: data.email, message: data.message, challenge_token: data.challenge_token };
  },

  verifyLoginChallenge: async (email, code) => {
    const res = await fetch(`${API_BASE_URL}/auth/login/challenge`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email: email.toLowerCase().trim(), code: code.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new APIError(res.status, getMsg(data,'Invalid code'), data);
    // If 2FA enrolled, backend returns totp_required:true instead of tokens
    if (data.totp_required) {
      return { success: false, totpRequired: true, email: data.email, message: data.message };
    }
    storeAuth(data);
    return { success:true, user: data.user };
  },

  verifyTotpChallenge: async (email, code) => {
    const res = await fetch(`${API_BASE_URL}/auth/login/totp`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email: email.toLowerCase().trim(), code: code.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new APIError(res.status, getMsg(data,'Invalid authenticator code'), data);
    storeAuth(data);
    return { success:true, user: data.user };
  },

  verifyEmail: async (token) => {
    const res = await fetch(`${API_BASE_URL}/auth/verify?token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!res.ok) throw new APIError(res.status, getMsg(data,'Verification failed'), data);
    return { success:true, user: data };
  },

  resendVerification: async (email) => pubReq('POST','/auth/resend-verification',{ email: email.toLowerCase().trim() }),

  forgotPassword: async (email) => pubReq('POST','/auth/forgot-password',{ email: email.toLowerCase().trim() }),

  resetPassword: async (email, code, new_password) => pubReq('POST','/auth/reset-password',{ email: email.toLowerCase().trim(), code: code.trim(), new_password }),

  refresh: async () => {
    const refresh_token = localStorage.getItem('refresh_token');
    if (!refresh_token) throw new APIError(401,'No refresh token');
    const res = await fetch(`${API_BASE_URL}/auth/refresh`,{
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ refresh_token }),
    });
    const data = await res.json();
    if (!res.ok) { clearAuth(); throw new APIError(res.status, getMsg(data,'Session expired')); }
    storeAuth(data);
    return { success:true, user: data.user };
  },

  logout: async (allDevices=false) => {
    const refresh_token = localStorage.getItem('refresh_token');
    try {
      if (refresh_token) await fetch(`${API_BASE_URL}/auth/logout`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ refresh_token, all_devices: allDevices }),
      });
    } catch { /* ignore */ } finally { clearAuth(); }
    return { success:true };
  },
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardAPI = {
  getDashboardData:    () => req('GET',  '/api/dashboard'),
  getVaultFiles:       () => req('GET',  '/api/vault/files'),
  getSecurityOverview: () => req('GET',  '/api/security/overview'),
  getSecurityEvents:   (limit=25) => req('GET', `/api/security/events?limit=${limit}`),
  getBreachData:       () => req('GET',  '/api/monitor/breaches'),
  getEmailSecurity:    () => req('GET',  '/api/email-security'),
  getConnectedAccounts:() => req('GET',  '/api/connected-accounts'),
  getProfile:          () => req('GET',  '/api/profile'),
  updateProfile:       (p) => req('PATCH','/api/profile', p),
  disconnectAccount:   (provider) => req('DELETE', `/api/connected-accounts/${provider}`),
  deleteVaultFile:     (id) => req('DELETE', `/api/vault/files/${id}`),
  getVaultStorageStats:() => req('GET',  '/api/vault/storage/stats'),
  checkFileIntegrity:  (id) => req('GET',  `/api/vault/files/${id}/integrity`),

  downloadVaultFile: async (id, filename) => {
    const token = localStorage.getItem('access_token');
    if (!token) throw new APIError(401, 'Not authenticated');
    const res = await fetch(`${API_BASE_URL}/api/vault/files/${id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new APIError(res.status, getMsg(d, 'Download failed'), d);
    }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename || 'download';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    return { success: true };
  },
  changePassword:      (current, next) => req('POST', '/api/profile/change-password', { current_password: current, new_password: next }),
  getGoogleOAuthUrl:   () => req('GET',  '/api/auth/google'),
  getMicrosoftOAuthUrl:() => req('GET',  '/api/auth/microsoft'),

  // ── 2FA ──
  get2FAStatus:             () => req('GET',   '/api/2fa/status'),
  begin2FASetup:            () => req('POST',  '/api/2fa/setup'),
  confirm2FASetup:          (code) => req('POST', '/api/2fa/confirm', { code }),
  disable2FA:               (code) => req('POST', '/api/2fa/disable', { code }),
  regenerateRecoveryCodes:  (code) => req('POST', '/api/2fa/recovery-codes/regenerate', { code }),

  // ── Sessions ──
  getSessions:        () => req('GET',    '/api/sessions'),
  revokeSession:      (id) => req('DELETE', `/api/sessions/${id}`),
  revokeAllSessions:  () => req('DELETE', '/api/sessions'),
  trustDevice:        (session_id, trusted=true) => req('PATCH', '/api/sessions/trust', { session_id, trusted }),
  renameDevice:       (session_id, name) => req('PATCH', '/api/sessions/rename', { session_id, name }),


  // ── Threat Intelligence ──
  getThreatScan:       () => req('GET',  '/api/intelligence/scan'),
  getBreachCheck:      () => req('GET',  '/api/intelligence/breach-check'),
  getDnsCheck:         () => req('GET',  '/api/intelligence/dns'),
  getIpReputation:     () => req('GET',  '/api/intelligence/ip-reputation'),
  getThreatFeed:       (limit=20) => req('GET', `/api/intelligence/threat-feed?limit=${limit}`),
  checkPassword:       (pw) => req('GET', `/api/intelligence/password-check?password=${encodeURIComponent(pw)}`),

  uploadFile: async (file, onProgress) => {
    const token = localStorage.getItem('access_token');
    if (!token) throw new APIError(401,'Not authenticated');
    const fd = new FormData(); fd.append('file', file);
    return new Promise((res, rej) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', e => { if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded/e.total*100)); });
      xhr.addEventListener('load', () => {
        try {
          const d = JSON.parse(xhr.responseText);
          if (xhr.status>=200 && xhr.status<300) res(d);
          else rej(new APIError(xhr.status, getMsg(d,'Upload failed'), d));
        } catch { rej(new APIError(500,'Parse error')); }
      });
      xhr.addEventListener('error', () => rej(new APIError(500,'Network error during upload')));
      xhr.open('POST', `${API_BASE_URL}/api/vault/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(fd);
    });
  },
};

// ─── Public ───────────────────────────────────────────────────────────────────
export const publicAPI = {
  getSecuritySnapshot: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/public/security-snapshot`);
      const data = await res.json();
      return { data };
    } catch { return { data: { totalUsers:0, totalEvents:0, status:'operational' } }; }
  },

  completeOAuth: async (provider, code, state) => {
    const path = provider === 'google'
      ? `/api/auth/google/callback`
      : `/api/auth/microsoft/callback`;
    const res = await fetch(`${API_BASE_URL}${path}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new APIError(res.status, getMsg(data, `${provider} OAuth failed`), data);
    return data;
  },
};

// ─── Passkey ──────────────────────────────────────────────────────────────────
export const passkeyAPI = {
  /** Create or update the cloud passkey PIN (requires auth) */
  createPasskey: async (pin) => {
    const data = await req('POST', '/auth/passkey/create', { pin });
    return data;
  },

  /** Get passkey status for current user */
  getStatus: async () => {
    try { return await req('GET', '/auth/passkey/status'); }
    catch { return { has_passkey: false }; }
  },

  /** Verify passkey during login (no JWT — called after password check) */
  verifyPasskey: async (email, pin) => {
    const data = await pubReq('POST', '/auth/passkey/verify', { email, pin });
    if (data.access_token) {
      localStorage.setItem('access_token',  data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      if (data.user?.id)    localStorage.setItem('user_id',    data.user.id);
      if (data.user?.email) localStorage.setItem('user_email', data.user.email);
    }
    return data;
  },

  /** Delete passkey (requires PIN confirmation) */
  deletePasskey: async (pin) => {
    const data = await req('DELETE', '/auth/passkey/delete', { pin });
    return data;
  },
};

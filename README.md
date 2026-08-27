# SyncVeil

Security-first full-stack platform with React frontend and FastAPI backend.

## Stack
- Frontend: React + Vite (`frontend/`)
- Backend: FastAPI + SQLAlchemy + Alembic (`backend/`)
- Primary data store: PostgreSQL (`DATABASE_URL`)
- Auth/session security: JWT access token + hashed refresh-token sessions
- Deployment: Render (`render.yaml`)

## Core Security Features
- Argon2 password hashing
- SQL-backed email verification OTP flow
- Adaptive offline suspicious-login detection
- Automatic cooldown for repeated failed login behavior
- Step-up login challenge for high-risk sign-ins
- Server-side refresh session validation and rotation
- Server-side encrypted vault storage (AES-GCM)
- Session self-healing (expired sessions auto-revoked)

## Repository Structure
```text
syncveil-website/
├── backend/
│   ├── app/
│   │   ├── auth/
│   │   ├── core/
│   │   ├── db/
│   │   ├── dashboard_routes.py
│   │   └── main.py
│   ├── migrations/
│   ├── requirements.txt
│   └── alembic.ini
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── scripts/
├── render.yaml
└── README.md
```

## Required Environment Variables
### Backend
- `ENV=production`
- `DATABASE_URL=postgresql://...`
- `JWT_SECRET=...` (32+ chars)
- `VAULT_ENCRYPTION_KEY=...` (32+ chars)
- `CORS_ORIGINS=https://syncveil.software,https://www.syncveil.software,https://syncveil-website.onrender.com`
- `FRONTEND_URL=https://syncveil.software`

Optional:
- `EMAIL_ENABLED=true|false`
- `BREVO_API_KEY=...` (required when `EMAIL_ENABLED=true`)
- `SMTP_FROM=...` (required when `EMAIL_ENABLED=true`)
- `EMAIL_VERIFICATION_REQUIRED=true|false`

### Frontend
- `VITE_API_URL=https://syncveil-backend.onrender.com`

## API Surface
### Auth
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/login/challenge`
- `GET /auth/verify?token=...`
- `POST /auth/resend-verification`
- `POST /auth/refresh`
- `POST /auth/logout`

### App
- `GET /api/dashboard`
- `POST /api/vault/upload`
- `GET /api/vault/files`
- `GET /api/monitor/breaches`
- `GET /api/security/overview`
- `GET /api/security/events`
- `GET /api/public/security-snapshot`

### Health
- `GET /health`

## Build and Validation
Run CI-equivalent checks:
```bash
bash scripts/ci-check.sh
```

This runs:
1. Backend syntax compile
2. Backend import smoke test
3. Frontend production build

## Render Deployment
Use `render.yaml` blueprint:
1. Create new Render Blueprint from this repository.
2. Ensure backend env vars are set (especially `DATABASE_URL`, `JWT_SECRET`, `VAULT_ENCRYPTION_KEY`, and email vars when enabled).
3. Ensure frontend `VITE_API_URL` points to the backend Render service URL.

## Security Notes
- Frontend auth state is never trusted by itself; backend validates token + active SQL session.
- Refresh token misuse revokes affected sessions.
- High-risk sign-ins require challenge verification before token issuance.
- Vault files are encrypted before storage and indexed with integrity metadata.

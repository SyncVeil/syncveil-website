// Centralized API configuration
// Uses VITE_API_URL so the frontend can point to any backend without code changes

const rawUrl = (import.meta.env?.VITE_API_URL || '').trim();

// In test / dev environments without a .env file, fall back to localhost
// so module imports don't throw before the app even boots.
if (rawUrl && !/^https?:\/\//i.test(rawUrl)) {
  throw new Error('VITE_API_URL must start with http:// or https://');
}

export const API_BASE_URL = rawUrl || 'http://localhost:8000';

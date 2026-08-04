// API client — thin fetch wrapper + response helpers for the my-saas-api backend.
// All calls go through the Vite dev proxy ('/api' -> http://localhost:3000), so
// we use relative '/api/...' URLs and never deal with CORS during development.

const TOKEN_KEY = 'my_saas_token';
const USER_KEY = 'my_saas_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Core request helper.
 * Throws an Error with `.status` and backend `{error}` message on non-2xx.
 */
async function request(method, path, body, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...options,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed: ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  del: (path) => request('DELETE', path),
};

// ---------------------------------------------------------------------------
// Backend-specific helpers
// ---------------------------------------------------------------------------

/**
 * The backend stores `definition` as a JSON string in some responses and as a
 * parsed object in others. Normalize either form into an object.
 */
export function normalizeDefinition(value) {
  if (value == null) return undefined;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/**
 * Run `output` is always a JSON string; parse safely to an object.
 */
export function parseOutput(value, fallback = {}) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Pretty-print the run output as indented JSON for display.
 */
export function formatOutput(value) {
  try {
    if (typeof value === 'string') return JSON.stringify(JSON.parse(value), null, 2);
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

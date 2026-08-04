// Auth helpers: login, logout, session state, and OAuth token capture.

import { api, setToken, setUser, clearToken, getUser } from './api';

/**
 * Test login (dummy auth backend). Creates/finds the user and stores session.
 */
export async function login(email = 'test@example.com', name = 'Test User') {
  const data = await api.post('/auth/test-login', { email, name });
  setToken(data.token);
  setUser(data.user);
  return data;
}

export function logout() {
  clearToken();
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export function currentUser() {
  return getUser();
}

/**
 * Capture a token passed via /?token=... (used by OAuth callback redirects).
 * Returns true if a token was applied, false otherwise.
 */
export function captureOAuthToken() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) {
    setToken(token);
    // Drop the token from the URL so it isn't shared via history/referrer
    window.history.replaceState({}, document.title, window.location.pathname);
    return true;
  }
  return false;
}

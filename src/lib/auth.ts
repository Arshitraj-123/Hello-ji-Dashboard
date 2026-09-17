/**
 * Authentication client helper — manages JWT token and user session in localStorage.
 *
 * Provides authFetch for authenticated API requests, automatically injecting
 * Authorization: Bearer <token> headers.
 */

export type UserSession = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: "admin" | "agent";
  permissions: string[];
  photo?: string;
  address?: string;
};

const TOKEN_KEY = "helloji_token";
const USER_KEY = "helloji_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): UserSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setSession(token: string, user: UserSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

const API_BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).replace(/\/$/, "")
    : "";

/**
 * Sign in with email or phone number and password.
 */
export async function login(identifier: string, password: string): Promise<{ token: string; user: UserSession }> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ identifier, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "Failed to sign in");
  }

  setSession(data.token, data.user);
  return { token: data.token, user: data.user };
}

/**
 * Sign out and clear session.
 */
export function logout() {
  clearSession();
  if (typeof window !== "undefined") {
    window.location.href = "/";
  }
}

/**
 * Authenticated fetch helper — attaches Bearer token to request.
 */
export async function authFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const url = endpoint.startsWith("/") ? `${API_BASE}${endpoint}` : endpoint;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  // If session is expired or invalid, clear local storage and redirect to login
  if (res.status === 401) {
    clearSession();
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      window.location.href = "/";
    }
  }

  return res;
}

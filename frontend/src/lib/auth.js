const USER_KEY = "user";
const TOKEN_KEY = "token";
const THEME_KEY = "theme";

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredTheme() {
  return localStorage.getItem(THEME_KEY) || "dark";
}

export function setStoredTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

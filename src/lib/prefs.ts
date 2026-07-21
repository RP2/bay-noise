import type { UserPrefs } from "./types.js";

/** localStorage key for user preferences. */
const STORAGE_KEY = "bay-noise-prefs";

/** Default preferences for first-time visitors. */
export const DEFAULT_PREFS: UserPrefs = {
  preferredGenres: [],
  onboarded: false,
};

/**
 * Read user preferences from localStorage.
 * NOTE(port): localStorage access is an intentional side effect — it IS the
 * feature. We catch all errors to handle private browsing, storage quotas,
 * and SSR environments where localStorage is unavailable.
 *
 * Returns DEFAULT_PREFS if nothing stored or if access fails.
 */
export function getPrefs(): UserPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshDefault();
    const parsed = JSON.parse(raw);
    return validatePrefs(parsed);
  } catch {
    return freshDefault();
  }
}

/** Return a deep-ish copy of DEFAULT_PREFS (avoids shared array reference). */
function freshDefault(): UserPrefs {
  return { preferredGenres: [], onboarded: false };
}

/**
 * Save user preferences to localStorage.
 * Silently fails if localStorage is unavailable.
 */
export function setPrefs(prefs: UserPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Silently fail — localStorage not available
  }
}

/**
 * Clear stored preferences (reset to first-time state).
 */
export function clearPrefs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently fail
  }
}

/**
 * Check if the user has completed onboarding.
 * Returns true if stored prefs have onboarded: true.
 */
export function isOnboarded(): boolean {
  return getPrefs().onboarded;
}

/**
 * Validate and sanitize parsed preferences.
 * Ensures the returned object conforms to UserPrefs even if
 * stored data is corrupt, from an older version, or hand-edited.
 */
function validatePrefs(raw: unknown): UserPrefs {
  if (typeof raw !== "object" || raw === null) {
    return { ...DEFAULT_PREFS };
  }

  const obj = raw as Record<string, unknown>;

  const preferredGenres = Array.isArray(obj.preferredGenres)
    ? obj.preferredGenres.filter(
        (g: unknown): g is string => typeof g === "string" && g.length > 0,
      )
    : [];

  const onboarded =
    typeof obj.onboarded === "boolean" ? obj.onboarded : false;

  return { preferredGenres, onboarded };
}

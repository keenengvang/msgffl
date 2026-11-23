/** JSON localStorage read; null on missing key or parse error. */
export function loadLS<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    // eslint-disable-next-line no-restricted-syntax -- localStorage, not a fetch: a missing or corrupt key reads as unset (reviewed 2026-11-23)
    return null;
  }
}

/** JSON localStorage write; silently ignores quota/availability errors. */
export function saveLS(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  // eslint-disable-next-line no-restricted-syntax -- localStorage, not a fetch: full or blocked storage must not break the app (reviewed 2026-11-23)
  } catch {
    // storage full or unavailable — the app works without it
  }
}

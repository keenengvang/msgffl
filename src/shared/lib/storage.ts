/** JSON localStorage read; null on missing key or parse error. */
export function loadLS<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

/** JSON localStorage write; silently ignores quota/availability errors. */
export function saveLS(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable — the app works without it
  }
}

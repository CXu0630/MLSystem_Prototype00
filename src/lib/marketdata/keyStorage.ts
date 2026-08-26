const STORAGE_KEY = 'stockai:apiKey:finnhub'

export function loadFinnhubKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveFinnhubKey(key: string): void {
  try {
    if (key) {
      localStorage.setItem(STORAGE_KEY, key)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // key just won't persist across reloads
  }
}

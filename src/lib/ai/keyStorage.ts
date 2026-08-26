import type { ProviderId } from './types'

const STORAGE_PREFIX = 'stockai:apiKey:'

/**
 * API keys never leave the browser except in the direct call to the
 * provider's API — there is no backend for this app to send them to.
 */
export function loadApiKey(providerId: ProviderId): string {
  try {
    return localStorage.getItem(STORAGE_PREFIX + providerId) ?? ''
  } catch {
    // localStorage unavailable (private browsing, disabled storage, ...)
    return ''
  }
}

export function saveApiKey(providerId: ProviderId, key: string): void {
  try {
    if (key) {
      localStorage.setItem(STORAGE_PREFIX + providerId, key)
    } else {
      localStorage.removeItem(STORAGE_PREFIX + providerId)
    }
  } catch {
    // key just won't persist across reloads
  }
}

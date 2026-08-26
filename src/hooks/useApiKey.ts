import { useCallback, useEffect, useState } from 'react'
import { loadApiKey, saveApiKey } from '../lib/ai/keyStorage'
import type { ProviderId } from '../lib/ai/types'

export function useApiKey(providerId: ProviderId) {
  const [apiKey, setApiKeyState] = useState(() => loadApiKey(providerId))

  // Re-sync when the user switches providers, since each has its own stored key.
  useEffect(() => {
    setApiKeyState(loadApiKey(providerId))
  }, [providerId])

  const setApiKey = useCallback(
    (key: string) => {
      setApiKeyState(key)
      saveApiKey(providerId, key)
    },
    [providerId],
  )

  return { apiKey, setApiKey }
}

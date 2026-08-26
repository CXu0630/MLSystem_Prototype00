import { useCallback, useState } from 'react'
import { loadFinnhubKey, saveFinnhubKey } from '../lib/marketdata/keyStorage'

export function useFinnhubKey() {
  const [apiKey, setApiKeyState] = useState(() => loadFinnhubKey())

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key)
    saveFinnhubKey(key)
  }, [])

  return { apiKey, setApiKey }
}

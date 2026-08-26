import { useEffect, useState } from 'react'
import { getCompanySnapshot } from '../lib/marketdata/finnhub'
import type { CompanySnapshot } from '../lib/marketdata/types'

type Status = 'idle' | 'loading' | 'error'

export function useCompanySnapshot(symbol: string, apiKey: string) {
  const [snapshot, setSnapshot] = useState<CompanySnapshot | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!symbol || !apiKey) {
      setSnapshot(null)
      return
    }

    let cancelled = false
    setStatus('loading')
    setError('')

    getCompanySnapshot(symbol, apiKey)
      .then((result) => {
        if (cancelled) return
        setSnapshot(result)
        setStatus('idle')
      })
      .catch((err: Error) => {
        if (cancelled) return
        setStatus('error')
        setError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [symbol, apiKey])

  return { snapshot, status, error }
}

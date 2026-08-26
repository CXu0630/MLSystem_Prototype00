import { useState } from 'react'

interface MarketDataSettingsProps {
  apiKey: string
  onApiKeyChange: (key: string) => void
}

export function MarketDataSettings({ apiKey, onApiKeyChange }: MarketDataSettingsProps) {
  const [revealed, setRevealed] = useState(false)

  return (
    <section className="settings-panel">
      <h2>Market data provider</h2>
      <label className="field">
        <span>Finnhub API key</span>
        <div className="key-input-row">
          <input
            type={revealed ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="Paste your Finnhub API key"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" onClick={() => setRevealed((r) => !r)}>
            {revealed ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="hint">
          Stored only in this browser (localStorage). Used to fetch company
          fundamentals and news directly from Finnhub — never sent anywhere
          else. Get a free key at{' '}
          <a href="https://finnhub.io/register" target="_blank" rel="noreferrer">
            finnhub.io/register
          </a>
          .
        </p>
      </label>
    </section>
  )
}

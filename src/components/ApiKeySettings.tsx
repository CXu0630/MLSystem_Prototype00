import { useState } from 'react'
import { providerList } from '../lib/ai/providers'
import type { ProviderId } from '../lib/ai/types'

interface ApiKeySettingsProps {
  providerId: ProviderId
  onProviderChange: (id: ProviderId) => void
  modelId: string
  onModelChange: (id: string) => void
  apiKey: string
  onApiKeyChange: (key: string) => void
}

export function ApiKeySettings({
  providerId,
  onProviderChange,
  modelId,
  onModelChange,
  apiKey,
  onApiKeyChange,
}: ApiKeySettingsProps) {
  const provider = providerList.find((p) => p.id === providerId)!
  const [revealed, setRevealed] = useState(false)

  return (
    <section className="settings-panel">
      <h2>AI provider</h2>

      <label className="field">
        <span>Provider</span>
        <select
          value={providerId}
          onChange={(e) => onProviderChange(e.target.value as ProviderId)}
        >
          {providerList.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Model</span>
        <input
          list={`${provider.id}-models`}
          value={modelId}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder={provider.defaultModel}
        />
        <datalist id={`${provider.id}-models`}>
          {provider.suggestedModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </datalist>
      </label>

      <label className="field">
        <span>{provider.label} API key</span>
        <div className="key-input-row">
          <input
            type={revealed ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="Paste your API key"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" onClick={() => setRevealed((r) => !r)}>
            {revealed ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="hint">
          Stored only in this browser (localStorage). Sent directly to{' '}
          {provider.label} — never to any server this app controls. Get a key
          at{' '}
          <a href={provider.apiKeyUrl} target="_blank" rel="noreferrer">
            {provider.apiKeyUrl}
          </a>
          .
        </p>
      </label>
    </section>
  )
}

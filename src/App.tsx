import { useState } from 'react'
import { ApiKeySettings } from './components/ApiKeySettings'
import { CompanySnapshot } from './components/CompanySnapshot'
import { MarketDataSettings } from './components/MarketDataSettings'
import { NewsAnalysisPanel } from './components/NewsAnalysisPanel'
import { StockSearch } from './components/StockSearch'
import { useApiKey } from './hooks/useApiKey'
import { useCompanySnapshot } from './hooks/useCompanySnapshot'
import { useFinnhubKey } from './hooks/useFinnhubKey'
import { getProvider } from './lib/ai/providers'
import type { ProviderId } from './lib/ai/types'
import './App.css'

function App() {
  const [providerId, setProviderId] = useState<ProviderId>('google')
  const [modelId, setModelId] = useState(getProvider('google').defaultModel)
  const { apiKey: aiApiKey, setApiKey: setAiApiKey } = useApiKey(providerId)
  const { apiKey: finnhubApiKey, setApiKey: setFinnhubApiKey } = useFinnhubKey()

  const [symbol, setSymbol] = useState('')
  const { snapshot, status: snapshotStatus, error: snapshotError } = useCompanySnapshot(
    symbol,
    finnhubApiKey,
  )

  function handleProviderChange(id: ProviderId) {
    setProviderId(id)
    setModelId(getProvider(id).defaultModel)
  }

  return (
    <div className="app-shell">
      <header>
        <h1>
          <span aria-hidden="true">🚀</span> <span className="title-gradient">Stock AI</span>{' '}
          <span aria-hidden="true">📈</span>
        </h1>
        <p>Bring your own API keys! Make your own money! 💰</p>
      </header>

      <details className="settings-group">
        <summary>Settings</summary>
        <div className="settings-group-body">
          <ApiKeySettings
            providerId={providerId}
            onProviderChange={handleProviderChange}
            modelId={modelId}
            onModelChange={setModelId}
            apiKey={aiApiKey}
            onApiKeyChange={setAiApiKey}
          />
          <MarketDataSettings apiKey={finnhubApiKey} onApiKeyChange={setFinnhubApiKey} />
        </div>
      </details>

      <main>
        <StockSearch
          onSubmit={setSymbol}
          loading={snapshotStatus === 'loading'}
          activeSymbol={symbol}
        />

        {symbol && (
          <>
            <CompanySnapshot
              symbol={symbol}
              apiKey={finnhubApiKey}
              snapshot={snapshot}
              status={snapshotStatus}
              error={snapshotError}
            />
            <NewsAnalysisPanel
              symbol={symbol}
              finnhubApiKey={finnhubApiKey}
              snapshot={snapshot}
              providerId={providerId}
              modelId={modelId}
              aiApiKey={aiApiKey}
            />
          </>
        )}
      </main>
    </div>
  )
}

export default App

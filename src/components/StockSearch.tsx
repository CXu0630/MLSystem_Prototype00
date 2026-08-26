import { useState } from 'react'
import type { FormEvent } from 'react'

interface StockSearchProps {
  onSubmit: (symbol: string) => void
  loading: boolean
  activeSymbol: string
}

const SAMPLE_STOCKS = ['AAPL', 'TSLA', 'NVDA', 'GOOGL', 'AMZN']

export function StockSearch({ onSubmit, loading, activeSymbol }: StockSearchProps) {
  const [draft, setDraft] = useState('AAPL')

  function submitSymbol(symbol: string) {
    const clean = symbol.trim().toUpperCase()
    if (clean) onSubmit(clean)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    submitSymbol(draft)
  }

  return (
    <div className="hero-search">
      <div className="sample-stocks">
        {SAMPLE_STOCKS.map((s) => (
          <button
            key={s}
            type="button"
            className={s === activeSymbol ? 'btn-primary' : undefined}
            onClick={() => {
              setDraft(s)
              submitSymbol(s)
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <form className="stock-search" onSubmit={handleSubmit}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ticker, e.g. AAPL"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Loading…' : 'Look up'}
        </button>
      </form>
    </div>
  )
}

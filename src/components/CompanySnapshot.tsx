import type { CompanySnapshot as Snapshot } from '../lib/marketdata/types'

interface CompanySnapshotProps {
  symbol: string
  apiKey: string
  snapshot: Snapshot | null
  status: 'idle' | 'loading' | 'error'
  error: string
}

function formatMarketCap(millions: number): string {
  if (millions >= 1_000_000) return `$${(millions / 1_000_000).toFixed(2)}T`
  if (millions >= 1_000) return `$${(millions / 1_000).toFixed(2)}B`
  return `$${millions.toFixed(0)}M`
}

export function CompanySnapshot({ symbol, apiKey, snapshot, status, error }: CompanySnapshotProps) {
  if (!apiKey) {
    return (
      <section className="snapshot-panel">
        <h2>Company snapshot</h2>
        <p className="hint">Add a Finnhub API key in settings to load company data.</p>
      </section>
    )
  }

  if (status === 'loading') {
    return (
      <section className="snapshot-panel">
        <h2>Company snapshot</h2>
        <p>Loading {symbol}…</p>
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="snapshot-panel">
        <h2>Company snapshot</h2>
        <p className="error">{error}</p>
      </section>
    )
  }

  if (!snapshot) return null

  const { profile, quote, metrics, recommendationTrend, insiderTransactions, peers, unavailable } =
    snapshot

  return (
    <section className="snapshot-panel">
      <h2>
        {profile?.name ?? symbol} <span className="ticker">{symbol}</span>
      </h2>
      {profile && (
        <p className="hint">
          {profile.industry} · {profile.exchange} · IPO {profile.ipo}
        </p>
      )}

      {quote && (
        <div className="quote-line">
          <span className={quote.change >= 0 ? 'price shine-anim' : 'price'}>
            {quote.current.toFixed(2)}
          </span>
          <span className={quote.change >= 0 ? 'change up' : 'change down'}>
            {quote.change >= 0 ? '+' : ''}
            {quote.change.toFixed(2)} ({quote.percentChange.toFixed(2)}%)
          </span>
        </div>
      )}

      <h3>At a glance</h3>
      <div className="stat-grid">
        {profile && <Stat label="Market cap" value={formatMarketCap(profile.marketCapitalization)} />}
        {metrics?.peTTM !== undefined && <Stat label="P/E (TTM)" value={metrics.peTTM.toFixed(1)} />}
        {metrics?.pb !== undefined && <Stat label="P/B" value={metrics.pb.toFixed(1)} />}
        {metrics?.psTTM !== undefined && <Stat label="P/S (TTM)" value={metrics.psTTM.toFixed(1)} />}
        {metrics?.epsTTM !== undefined && <Stat label="EPS (TTM)" value={metrics.epsTTM.toFixed(2)} />}
        {metrics?.beta !== undefined && <Stat label="Beta" value={metrics.beta.toFixed(2)} />}
        {metrics?.dividendYieldTTM !== undefined && (
          <Stat label="Dividend yield" value={`${metrics.dividendYieldTTM.toFixed(2)}%`} />
        )}
        {metrics?.roeTTM !== undefined && <Stat label="ROE" value={`${metrics.roeTTM.toFixed(1)}%`} />}
        {metrics?.netMarginTTM !== undefined && (
          <Stat label="Net margin" value={`${metrics.netMarginTTM.toFixed(1)}%`} />
        )}
        {metrics?.week52High !== undefined && metrics.week52Low !== undefined && (
          <Stat label="52-week range" value={`${metrics.week52Low.toFixed(2)} – ${metrics.week52High.toFixed(2)}`} />
        )}
      </div>
      {unavailable.metrics && <p className="hint">Metrics unavailable: {unavailable.metrics}</p>}

      <h3>Beyond the ticker</h3>

      {recommendationTrend && (
        <p>
          Analyst consensus ({recommendationTrend.period}):{' '}
          <strong>{recommendationTrend.strongBuy + recommendationTrend.buy} buy-leaning</strong>,{' '}
          {recommendationTrend.hold} hold,{' '}
          <strong>{recommendationTrend.sell + recommendationTrend.strongSell} sell-leaning</strong>
        </p>
      )}
      {unavailable.recommendation && (
        <p className="hint">Analyst recommendations unavailable: {unavailable.recommendation}</p>
      )}

      {insiderTransactions && insiderTransactions.length > 0 && (
        <>
          <p className="hint">Recent insider transactions</p>
          <table className="insider-table">
            <thead>
              <tr>
                <th>Insider</th>
                <th>Date</th>
                <th>Type</th>
                <th>Shares</th>
              </tr>
            </thead>
            <tbody>
              {insiderTransactions.slice(0, 6).map((t, i) => (
                <tr key={i}>
                  <td>{t.name}</td>
                  <td>{t.transactionDate}</td>
                  <td>{t.transactionCode}</td>
                  <td>{t.change >= 0 ? '+' : ''}{t.change.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {unavailable.insider && (
        <p className="hint">Insider transactions unavailable: {unavailable.insider}</p>
      )}

      {peers && peers.length > 0 && (
        <p className="hint">Peers: {peers.join(', ')}</p>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}

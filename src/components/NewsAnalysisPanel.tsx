import { streamText } from 'ai'
import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { parseLean, stripLeanTag } from '../lib/ai/parseLean'
import { buildAnalysisPrompt } from '../lib/ai/prompts'
import { getProvider } from '../lib/ai/providers'
import type { ProviderId } from '../lib/ai/types'
import { getCompanyNews } from '../lib/marketdata/finnhub'
import type { CompanySnapshot, NewsArticle } from '../lib/marketdata/types'

const LEAN_TEXT = { bullish: 'BUY', bearish: 'SELL', neutral: 'HOLD' } as const
const LEAN_EMOJI = { bullish: '📈', bearish: '📉', neutral: '✋' } as const

function LeanBadge({ report }: { report: string }) {
  const { lean, confidence } = useMemo(() => parseLean(report), [report])
  if (!lean) return null

  return (
    <div className="lean-badge-wrap">
      <span className={`lean-badge lean-${lean}`}>
        {/* gradient-clip wraps only the letters — see .title-gradient comment
           in App.css for why emoji have to stay outside it */}
        <span className={lean === 'bullish' ? 'shine-anim' : undefined}>{LEAN_TEXT[lean]}</span>{' '}
        <span aria-hidden="true">{LEAN_EMOJI[lean]}</span>
      </span>
      {confidence && <span className="lean-confidence">{confidence} confidence</span>}
    </div>
  )
}

interface NewsAnalysisPanelProps {
  symbol: string
  finnhubApiKey: string
  snapshot: CompanySnapshot | null
  providerId: ProviderId
  modelId: string
  aiApiKey: string
}

type NewsStatus = 'idle' | 'loading' | 'error'
type ReportStatus = 'idle' | 'streaming' | 'error'

const LOOKBACK_DAYS = 14

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function NewsAnalysisPanel({
  symbol,
  finnhubApiKey,
  snapshot,
  providerId,
  modelId,
  aiApiKey,
}: NewsAnalysisPanelProps) {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [newsStatus, setNewsStatus] = useState<NewsStatus>('idle')
  const [newsError, setNewsError] = useState('')

  const [report, setReport] = useState('')
  const [reportStatus, setReportStatus] = useState<ReportStatus>('idle')
  const [reportError, setReportError] = useState('')

  useEffect(() => {
    if (!symbol || !finnhubApiKey) {
      setArticles([])
      return
    }

    let cancelled = false
    setNewsStatus('loading')
    setNewsError('')
    setReport('')

    const to = new Date()
    const from = new Date(to.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

    getCompanyNews(symbol, finnhubApiKey, isoDate(from), isoDate(to))
      .then((result) => {
        if (cancelled) return
        setArticles(result)
        setNewsStatus('idle')
      })
      .catch((err: Error) => {
        if (cancelled) return
        setNewsStatus('error')
        setNewsError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [symbol, finnhubApiKey])

  const bySource = useMemo(() => {
    const groups = new Map<string, NewsArticle[]>()
    for (const a of articles) {
      const list = groups.get(a.source) ?? []
      list.push(a)
      groups.set(a.source, list)
    }
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [articles])

  async function generateReport() {
    if (!aiApiKey) {
      setReportStatus('error')
      setReportError('Add an AI provider API key in settings first.')
      return
    }
    if (articles.length === 0) {
      setReportStatus('error')
      setReportError('No news articles to analyze yet.')
      return
    }

    setReportStatus('streaming')
    setReportError('')
    setReport('')

    try {
      const provider = getProvider(providerId)
      const model = provider.createModel(aiApiKey, modelId || provider.defaultModel)
      const prompt = buildAnalysisPrompt(symbol, snapshot ?? { symbol, unavailable: {} }, articles)
      const result = streamText({ model, prompt })

      for await (const chunk of result.textStream) {
        setReport((prev) => prev + chunk)
      }
      setReportStatus('idle')
    } catch (err) {
      setReportStatus('error')
      setReportError(err instanceof Error ? err.message : 'Something went wrong calling the model.')
    }
  }

  if (!finnhubApiKey) {
    return (
      <section className="news-panel">
        <h2>News & sentiment</h2>
        <p className="hint">Add a Finnhub API key in settings to load news.</p>
      </section>
    )
  }

  return (
    <section className="news-panel">
      <h2>News & sentiment</h2>

      {newsStatus === 'loading' && <p>Fetching recent news for {symbol}…</p>}
      {newsStatus === 'error' && <p className="error">{newsError}</p>}

      {newsStatus === 'idle' && articles.length === 0 && (
        <p className="hint">No news found in the last {LOOKBACK_DAYS} days.</p>
      )}

      {bySource.length > 0 && (
        <>
          <p className="hint">
            {articles.length} articles from {bySource.length} sources, last {LOOKBACK_DAYS} days —
            fetched directly from Finnhub, no AI involved yet.
          </p>
          <details className="raw-news">
            <summary>Show raw headlines ({bySource.map(([s, a]) => `${s} ${a.length}`).join(', ')})</summary>
            <ul>
              {articles.slice(0, 30).map((a) => (
                <li key={a.id || a.url}>
                  <a href={a.url} target="_blank" rel="noreferrer">
                    {a.headline}
                  </a>{' '}
                  <span className="hint">
                    — {a.source}, {a.datetime ? new Date(a.datetime * 1000).toLocaleDateString() : ''}
                  </span>
                </li>
              ))}
            </ul>
          </details>

          <button
            type="button"
            className="btn-primary btn-gold"
            onClick={generateReport}
            disabled={reportStatus === 'streaming'}
          >
            {reportStatus === 'streaming' ? 'Analyzing…' : 'Generate AI report'}
          </button>
        </>
      )}

      {reportStatus === 'error' && <p className="error">{reportError}</p>}
      {report && (
        <div className="windfall">
          <p className="windfall-kicker">
            <span aria-hidden="true">✨</span> <span className="kicker-gradient">Windfall Report</span>
          </p>
          <LeanBadge report={report} />
          <div className="report">
            <ReactMarkdown>{stripLeanTag(report)}</ReactMarkdown>
          </div>
        </div>
      )}
    </section>
  )
}

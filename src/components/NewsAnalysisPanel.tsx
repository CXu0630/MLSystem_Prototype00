import { useEffect, useMemo, useState } from 'react'
import { type AnalysisResult, type Lean, generateAnalysis } from '../lib/ai/analysis'
import { getProvider } from '../lib/ai/providers'
import type { ProviderId } from '../lib/ai/types'
import { getCompanyNews } from '../lib/marketdata/finnhub'
import { filterCompanyNews, namesCompany } from '../lib/marketdata/relevance'
import type { CompanySnapshot, NewsArticle } from '../lib/marketdata/types'
import { aggregateSentiment, selectGridArticles } from '../lib/nlp/aggregate'
import { classifyArticles, isModelReady } from '../lib/nlp/finbert'
import type { ArticleSentiment, SentimentAggregate } from '../lib/nlp/types'
import { AnalysisMetrics } from './AnalysisMetrics'
import { SentimentGrid } from './SentimentGrid'

const LEAN_TEXT: Record<Lean, string> = {
  bullish: 'BUY',
  bearish: 'SELL',
  neutral: 'HOLD',
  mixed: 'MIXED',
}
const LEAN_EMOJI: Record<Lean, string> = {
  bullish: '📈',
  bearish: '📉',
  neutral: '✋',
  mixed: '🤔',
}

function LeanBadge({ lean, confidence }: { lean: Lean; confidence: string }) {
  return (
    <div className="lean-badge-wrap">
      <span className={`lean-badge lean-${lean}`}>
        {/* gradient-clip wraps only the letters — see .title-gradient comment
           in App.css for why emoji have to stay outside it */}
        <span className={lean === 'bullish' ? 'shine-anim' : undefined}>{LEAN_TEXT[lean]}</span>{' '}
        <span aria-hidden="true">{LEAN_EMOJI[lean]}</span>
      </span>
      <span className="lean-confidence">{confidence} confidence</span>
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
type ReportStatus = 'idle' | 'loading' | 'error'
type SentStatus = 'idle' | 'loading-model' | 'classifying' | 'done' | 'error'

const LOOKBACK_DAYS = 14
/** Upper bound on how many articles we run through FinBERT per analysis. */
const MAX_CLASSIFY = 30
/** How many article cards to feature in the grid. */
const GRID_SIZE = 6

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

  const [sentStatus, setSentStatus] = useState<SentStatus>('idle')
  const [sentError, setSentError] = useState('')
  const [modelPct, setModelPct] = useState(0)
  const [gridItems, setGridItems] = useState<ArticleSentiment[]>([])
  const [aggregate, setAggregate] = useState<SentimentAggregate | null>(null)

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
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
    setAnalysis(null)
    setReportStatus('idle')
    setReportError('')
    setSentStatus('idle')
    setSentError('')
    setGridItems([])
    setAggregate(null)

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

  // Finnhub's company-news feed still leaks in market round-ups and listicles
  // where the company is one mention among many — drop those before anything
  // downstream (raw list, FinBERT, the LLM) sees them.
  const relevantArticles = useMemo(() => filterCompanyNews(articles), [articles])
  const droppedCount = articles.length - relevantArticles.length

  const companyRef = useMemo(
    () => ({ symbol, companyName: snapshot?.profile?.name }),
    [symbol, snapshot?.profile?.name],
  )

  const bySource = useMemo(() => {
    const groups = new Map<string, NewsArticle[]>()
    for (const a of relevantArticles) {
      const list = groups.get(a.source) ?? []
      list.push(a)
      groups.set(a.source, list)
    }
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [relevantArticles])

  const busy =
    sentStatus === 'loading-model' || sentStatus === 'classifying' || reportStatus === 'loading'

  async function runAnalysis() {
    if (relevantArticles.length === 0) {
      setSentStatus('error')
      setSentError('No news articles to analyze yet.')
      return
    }

    // 1. Local NLP pass — FinBERT in the browser. Works with zero API keys.
    let agg: SentimentAggregate | null = null
    const batch = relevantArticles.slice(0, MAX_CLASSIFY)
    try {
      setSentStatus(isModelReady() ? 'classifying' : 'loading-model')
      setSentError('')
      setModelPct(0)
      setGridItems([])
      setAggregate(null)

      const scored = await classifyArticles(batch, (p) => {
        setModelPct(p.pct)
        if (p.pct >= 100) setSentStatus('classifying')
      })

      setSentStatus('classifying')
      agg = aggregateSentiment(scored)
      setGridItems(selectGridArticles(scored, GRID_SIZE, (a) => namesCompany(a, companyRef)))
      setAggregate(agg)
      setSentStatus('done')
    } catch (err) {
      setSentStatus('error')
      setSentError(
        err instanceof Error ? err.message : 'FinBERT failed to load or run in this browser.',
      )
      // fall through — the written synthesis can still run without the numbers.
    }

    // 2. LLM synthesis — scored dimensions + a one-paragraph read, grounded on
    //    the FinBERT numbers when we have them.
    if (!aiApiKey) {
      setReportStatus('error')
      setReportError('Add an AI provider API key in settings to generate the written synthesis.')
      return
    }

    setReportStatus('loading')
    setReportError('')
    setAnalysis(null)

    try {
      const provider = getProvider(providerId)
      const model = provider.createModel(aiApiKey, modelId || provider.defaultModel)
      const result = await generateAnalysis({
        model,
        symbol,
        snapshot: snapshot ?? { symbol, unavailable: {} },
        articles: relevantArticles,
        sentiment: agg ?? undefined,
      })
      setAnalysis(result)
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

  let buttonLabel = analysis ? 'Re-run analysis' : 'Analyze news'
  if (sentStatus === 'loading-model') buttonLabel = `Downloading FinBERT… ${modelPct}%`
  else if (sentStatus === 'classifying') buttonLabel = 'Running FinBERT…'
  else if (reportStatus === 'loading') buttonLabel = 'Scoring the news…'

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
            {relevantArticles.length} articles from {bySource.length} sources, last {LOOKBACK_DAYS}{' '}
            days — fetched directly from Finnhub, no AI involved yet.
            {droppedCount > 0 && (
              <>
                {' '}
                {droppedCount} market round-{droppedCount === 1 ? 'up' : 'ups'} / listicle
                {droppedCount === 1 ? '' : 's'} set aside.
              </>
            )}
          </p>
          <details className="raw-news">
            <summary>
              Show raw headlines ({bySource.map(([s, a]) => `${s} ${a.length}`).join(', ')})
            </summary>
            <ul>
              {relevantArticles.slice(0, 30).map((a) => (
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
            onClick={runAnalysis}
            disabled={busy}
            aria-busy={busy}
          >
            {busy && <span className="btn-spinner" aria-hidden="true" />}
            {buttonLabel}
          </button>

          {sentStatus === 'loading-model' && (
            <p className="hint">
              First run only: downloading the FinBERT model (~110&nbsp;MB) from the Hugging Face
              CDN. It's cached in your browser afterward, then runs offline.
            </p>
          )}
          {sentStatus === 'classifying' && (
            <p className="hint">
              Classifying {Math.min(relevantArticles.length, MAX_CLASSIFY)} headlines locally…
            </p>
          )}
          {sentStatus === 'error' && (
            <p className="error">FinBERT: {sentError} — continuing with the written synthesis only.</p>
          )}
        </>
      )}

      {sentStatus === 'done' && aggregate && gridItems.length > 0 && (
        <SentimentGrid items={gridItems} aggregate={aggregate} />
      )}

      {reportStatus === 'error' && <p className="error">{reportError}</p>}
      {analysis && (
        <div className="windfall">
          <p className="windfall-kicker">
            <span aria-hidden="true">✨</span> <span className="kicker-gradient">Windfall Report</span>
          </p>
          <LeanBadge lean={analysis.lean} confidence={analysis.confidence} />
          <AnalysisMetrics result={analysis} />
        </div>
      )}
    </section>
  )
}

import type {
  CompanyProfile,
  CompanySnapshot,
  InsiderTransaction,
  KeyMetrics,
  NewsArticle,
  Quote,
  RecommendationTrend,
} from './types'

const BASE_URL = 'https://finnhub.io/api/v1'

class FinnhubError extends Error {}

async function finnhubGet<T>(
  path: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<T> {
  const url = new URL(BASE_URL + path)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  url.searchParams.set('token', apiKey)

  const res = await fetch(url.toString())

  if (res.status === 401 || res.status === 403) {
    throw new FinnhubError('Invalid or unauthorized Finnhub API key.')
  }
  if (res.status === 429) {
    throw new FinnhubError('Finnhub rate limit hit — wait a moment and try again.')
  }
  if (!res.ok) {
    throw new FinnhubError(`Finnhub request failed (${res.status}).`)
  }

  return (await res.json()) as T
}

/** Tries each candidate field name in order and returns the first numeric value found. */
function firstNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && !Number.isNaN(value)) return value
  }
  return undefined
}

interface RawProfile2 {
  name?: string
  ticker?: string
  exchange?: string
  finnhubIndustry?: string
  country?: string
  currency?: string
  ipo?: string
  marketCapitalization?: number
  shareOutstanding?: number
  logo?: string
  weburl?: string
}

async function getProfile(symbol: string, apiKey: string): Promise<CompanyProfile> {
  const raw = await finnhubGet<RawProfile2>('/stock/profile2', { symbol }, apiKey)
  if (!raw.name) throw new FinnhubError('No profile data for this symbol.')
  return {
    name: raw.name,
    ticker: raw.ticker ?? symbol,
    exchange: raw.exchange ?? '—',
    industry: raw.finnhubIndustry ?? '—',
    country: raw.country ?? '—',
    currency: raw.currency ?? 'USD',
    ipo: raw.ipo ?? '—',
    marketCapitalization: raw.marketCapitalization ?? 0,
    shareOutstanding: raw.shareOutstanding ?? 0,
    logo: raw.logo ?? '',
    weburl: raw.weburl ?? '',
  }
}

interface RawQuote {
  c?: number
  d?: number
  dp?: number
  h?: number
  l?: number
  o?: number
  pc?: number
  t?: number
}

async function getQuote(symbol: string, apiKey: string): Promise<Quote> {
  const raw = await finnhubGet<RawQuote>('/quote', { symbol }, apiKey)
  if (raw.c === undefined || raw.c === 0) {
    throw new FinnhubError('No quote data for this symbol.')
  }
  return {
    current: raw.c,
    change: raw.d ?? 0,
    percentChange: raw.dp ?? 0,
    high: raw.h ?? 0,
    low: raw.l ?? 0,
    open: raw.o ?? 0,
    previousClose: raw.pc ?? 0,
    timestamp: raw.t ?? 0,
  }
}

async function getKeyMetrics(symbol: string, apiKey: string): Promise<KeyMetrics> {
  const raw = await finnhubGet<{ metric?: Record<string, unknown> }>(
    '/stock/metric',
    { symbol, metric: 'all' },
    apiKey,
  )
  const metric = raw.metric ?? {}
  if (Object.keys(metric).length === 0) {
    throw new FinnhubError('No metrics data for this symbol.')
  }
  return {
    peTTM: firstNumber(metric, ['peTTM', 'peBasicExclExtraTTM', 'peExclExtraTTM', 'peInclExtraTTM']),
    pb: firstNumber(metric, ['pbAnnual', 'pbQuarterly', 'pb']),
    psTTM: firstNumber(metric, ['psTTM', 'psAnnual']),
    dividendYieldTTM: firstNumber(metric, [
      'dividendYieldIndicatedAnnual',
      'currentDividendYieldTTM',
      'dividendYield5Y',
    ]),
    epsTTM: firstNumber(metric, ['epsTTM', 'epsInclExtraItemsTTM', 'epsExclExtraItemsTTM']),
    roeTTM: firstNumber(metric, ['roeTTM', 'roeRfy']),
    netMarginTTM: firstNumber(metric, ['netProfitMarginTTM', 'netProfitMarginAnnual']),
    beta: firstNumber(metric, ['beta']),
    week52High: firstNumber(metric, ['52WeekHigh']),
    week52Low: firstNumber(metric, ['52WeekLow']),
    priceReturn5D: firstNumber(metric, ['5DayPriceReturnDaily']),
    priceReturn13W: firstNumber(metric, ['13WeekPriceReturnDaily']),
    priceReturn26W: firstNumber(metric, ['26WeekPriceReturnDaily']),
    priceReturn52W: firstNumber(metric, ['52WeekPriceReturnDaily']),
    priceReturnYTD: firstNumber(metric, ['yearToDatePriceReturnDaily', 'ytdPriceReturnDaily']),
  }
}

async function getRecommendationTrend(
  symbol: string,
  apiKey: string,
): Promise<RecommendationTrend | undefined> {
  const raw = await finnhubGet<
    Array<{
      period?: string
      strongBuy?: number
      buy?: number
      hold?: number
      sell?: number
      strongSell?: number
    }>
  >('/stock/recommendation', { symbol }, apiKey)
  const latest = raw[0]
  if (!latest) return undefined
  return {
    period: latest.period ?? '—',
    strongBuy: latest.strongBuy ?? 0,
    buy: latest.buy ?? 0,
    hold: latest.hold ?? 0,
    sell: latest.sell ?? 0,
    strongSell: latest.strongSell ?? 0,
  }
}

async function getInsiderTransactions(symbol: string, apiKey: string): Promise<InsiderTransaction[]> {
  const raw = await finnhubGet<{
    data?: Array<{
      name?: string
      share?: number
      change?: number
      filingDate?: string
      transactionDate?: string
      transactionCode?: string
      transactionPrice?: number
    }>
  }>('/stock/insider-transactions', { symbol }, apiKey)

  return (raw.data ?? [])
    .filter((t) => t.name && t.transactionDate)
    .slice(0, 10)
    .map((t) => ({
      name: t.name!,
      share: t.share ?? 0,
      change: t.change ?? 0,
      filingDate: t.filingDate ?? '',
      transactionDate: t.transactionDate!,
      transactionCode: t.transactionCode ?? '',
      transactionPrice: t.transactionPrice ?? 0,
    }))
}

async function getPeers(symbol: string, apiKey: string): Promise<string[]> {
  const raw = await finnhubGet<string[]>('/stock/peers', { symbol }, apiKey)
  return raw.filter((s) => s !== symbol).slice(0, 6)
}

export async function getCompanyNews(
  symbol: string,
  apiKey: string,
  fromDate: string,
  toDate: string,
): Promise<NewsArticle[]> {
  const raw = await finnhubGet<
    Array<{
      id?: number
      headline?: string
      summary?: string
      source?: string
      url?: string
      datetime?: number
      related?: string
      // Not part of Finnhub's documented schema, but read it defensively in
      // case a feed (or a future source) surfaces a popularity count.
      views?: number
    }>
  >('/company-news', { symbol, from: fromDate, to: toDate }, apiKey)

  return raw
    .filter((a) => a.headline && a.url)
    .map((a) => ({
      id: a.id ?? 0,
      headline: a.headline!,
      summary: a.summary ?? '',
      source: a.source ?? 'Unknown',
      url: a.url!,
      datetime: a.datetime ?? 0,
      related: a.related ?? '',
      views: typeof a.views === 'number' && a.views > 0 ? a.views : undefined,
    }))
    .sort((a, b) => b.datetime - a.datetime)
}

/**
 * Fetches every section of the company snapshot in parallel. Any section
 * that fails (network error, or gated behind a paid Finnhub plan) is
 * recorded in `unavailable` instead of failing the whole snapshot.
 */
export async function getCompanySnapshot(symbol: string, apiKey: string): Promise<CompanySnapshot> {
  const unavailable: CompanySnapshot['unavailable'] = {}

  const [profile, quote, metrics, recommendationTrend, insiderTransactions, peers] =
    await Promise.all([
      getProfile(symbol, apiKey).catch((e: Error) => {
        unavailable.profile = e.message
        return undefined
      }),
      getQuote(symbol, apiKey).catch((e: Error) => {
        unavailable.quote = e.message
        return undefined
      }),
      getKeyMetrics(symbol, apiKey).catch((e: Error) => {
        unavailable.metrics = e.message
        return undefined
      }),
      getRecommendationTrend(symbol, apiKey).catch((e: Error) => {
        unavailable.recommendation = e.message
        return undefined
      }),
      getInsiderTransactions(symbol, apiKey).catch((e: Error) => {
        unavailable.insider = e.message
        return undefined
      }),
      getPeers(symbol, apiKey).catch((e: Error) => {
        unavailable.peers = e.message
        return undefined
      }),
    ])

  return {
    symbol,
    profile,
    quote,
    metrics,
    recommendationTrend,
    insiderTransactions,
    peers,
    unavailable,
  }
}

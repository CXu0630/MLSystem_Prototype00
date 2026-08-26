export interface CompanyProfile {
  name: string
  ticker: string
  exchange: string
  industry: string
  country: string
  currency: string
  ipo: string
  marketCapitalization: number
  shareOutstanding: number
  logo: string
  weburl: string
}

export interface Quote {
  current: number
  change: number
  percentChange: number
  high: number
  low: number
  open: number
  previousClose: number
  timestamp: number
}

/** Curated subset of the ~117 fields in Finnhub's `metric=all` response. */
export interface KeyMetrics {
  peTTM?: number
  pb?: number
  psTTM?: number
  dividendYieldTTM?: number
  epsTTM?: number
  roeTTM?: number
  netMarginTTM?: number
  beta?: number
  week52High?: number
  week52Low?: number
}

export interface RecommendationTrend {
  period: string
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
}

export interface InsiderTransaction {
  name: string
  share: number
  change: number
  filingDate: string
  transactionDate: string
  transactionCode: string
  transactionPrice: number
}

export interface NewsArticle {
  id: number
  headline: string
  summary: string
  source: string
  url: string
  datetime: number
}

export interface CompanySnapshot {
  symbol: string
  profile?: CompanyProfile
  quote?: Quote
  metrics?: KeyMetrics
  recommendationTrend?: RecommendationTrend
  insiderTransactions?: InsiderTransaction[]
  peers?: string[]
  /** Endpoints that failed or are gated behind a paid plan, keyed by section. */
  unavailable: Partial<Record<'profile' | 'quote' | 'metrics' | 'recommendation' | 'insider' | 'peers', string>>
}

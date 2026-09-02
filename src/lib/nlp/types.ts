/**
 * Types for the local (in-browser) NLP layer. FinBERT gives a 3-class
 * softmax per article; everything downstream — the grid cards, the
 * aggregate signal, the numbers injected into the LLM prompt — is derived
 * from these shapes.
 */

export type SentimentLabel = 'positive' | 'negative' | 'neutral'

export interface SentimentProbabilities {
  positive: number
  negative: number
  neutral: number
}

/** One FinBERT result, paired back to the article it was run on. */
export interface ArticleSentiment {
  id: number
  headline: string
  url: string
  source: string
  datetime: number
  /** Popularity signal carried through from the feed, when present. */
  views?: number
  /** Winning label. */
  label: SentimentLabel
  /** Softmax probability of the winning label (0–1). */
  confidence: number
  probabilities: SentimentProbabilities
  /** positive − negative, range −1 (max bearish) … +1 (max bullish). */
  signed: number
}

export interface SourceSentiment {
  source: string
  count: number
  /** Mean `signed` score across this source's articles. */
  meanSigned: number
}

/** Roll-up across all classified articles for one ticker. */
export interface SentimentAggregate {
  articleCount: number
  distribution: Record<SentimentLabel, number>
  /** Simple mean of per-article `signed`. */
  meanSigned: number
  /** `signed` mean weighted by a 7-day recency half-life. */
  recencyWeightedSigned: number
  /** Label derived from `recencyWeightedSigned`. */
  net: SentimentLabel
  /** Heuristic from volume, source diversity, and agreement. */
  confidence: 'low' | 'medium' | 'high'
  /** Share of articles whose label matches `net` (0–1). */
  agreement: number
  sourceCount: number
  bySource: SourceSentiment[]
  mostPositive?: ArticleSentiment
  mostNegative?: ArticleSentiment
}

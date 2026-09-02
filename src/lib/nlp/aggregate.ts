import type {
  ArticleSentiment,
  SentimentAggregate,
  SentimentLabel,
  SourceSentiment,
} from './types'

/** Recency half-life for the weighted score, in days. */
const HALF_LIFE_DAYS = 7
/** |score| below this reads as "no clear direction". */
const NET_THRESHOLD = 0.15

function recencyWeight(datetime: number, now: number): number {
  if (!datetime) return 0.3
  const ageDays = Math.max(0, (now - datetime * 1000) / 86_400_000)
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS)
}

function labelFromScore(score: number): SentimentLabel {
  if (score > NET_THRESHOLD) return 'positive'
  if (score < -NET_THRESHOLD) return 'negative'
  return 'neutral'
}

/** Collapses per-article FinBERT results into one signal for the ticker. */
export function aggregateSentiment(items: ArticleSentiment[]): SentimentAggregate | null {
  if (items.length === 0) return null
  const now = Date.now()

  const distribution: Record<SentimentLabel, number> = { positive: 0, negative: 0, neutral: 0 }
  const bySourceMap = new Map<string, { count: number; signedSum: number }>()
  let signedSum = 0
  let weightSum = 0
  let weightedSigned = 0

  for (const it of items) {
    distribution[it.label] += 1
    signedSum += it.signed

    const w = recencyWeight(it.datetime, now)
    weightSum += w
    weightedSigned += w * it.signed

    const s = bySourceMap.get(it.source) ?? { count: 0, signedSum: 0 }
    s.count += 1
    s.signedSum += it.signed
    bySourceMap.set(it.source, s)
  }

  const meanSigned = signedSum / items.length
  const recencyWeightedSigned = weightSum > 0 ? weightedSigned / weightSum : meanSigned
  const net = labelFromScore(recencyWeightedSigned)

  const agreement = distribution[net] / items.length

  const bySource: SourceSentiment[] = Array.from(bySourceMap.entries())
    .map(([source, v]) => ({ source, count: v.count, meanSigned: v.signedSum / v.count }))
    .sort((a, b) => b.count - a.count)
  const sourceCount = bySource.length

  let confidence: SentimentAggregate['confidence'] = 'low'
  if (items.length >= 10 && agreement >= 0.6 && sourceCount >= 3) {
    confidence = 'high'
  } else if (items.length >= 5 && agreement >= 0.5) {
    confidence = 'medium'
  }

  const sorted = [...items].sort((a, b) => b.signed - a.signed)
  const top = sorted[0]
  const bottom = sorted[sorted.length - 1]

  return {
    articleCount: items.length,
    distribution,
    meanSigned,
    recencyWeightedSigned,
    net,
    confidence,
    agreement,
    sourceCount,
    bySource,
    mostPositive: top && top.signed > 0.05 ? top : undefined,
    mostNegative: bottom && bottom.signed < -0.05 ? bottom : undefined,
  }
}

/**
 * Ranking weight for a candidate grid article. Prefers a real popularity
 * signal when the feed provides one (`views`); otherwise falls back to how
 * much sentiment FinBERT actually found — |signed| scaled by the model's
 * confidence — so the grid leans toward decisive coverage over neutral filler.
 */
function articleWeight(a: ArticleSentiment): number {
  if (typeof a.views === 'number' && a.views > 0) return a.views
  return Math.abs(a.signed) * a.confidence
}

/** Max cards allowed from any one outlet, so a Yahoo-heavy feed still spreads. */
const PER_SOURCE_CAP = 2

/**
 * Picks the N articles for the grid. Articles that actually name the company
 * (per `named`) rank ahead of those merely tagged to it; within that, ranking
 * is by `articleWeight` then recency. Selection runs in widening passes — one
 * per outlet, then up to `PER_SOURCE_CAP` per outlet, then anything — so the
 * grid shows a spread of sources whenever the feed has one.
 */
export function selectGridArticles(
  items: ArticleSentiment[],
  n = 6,
  named: (a: ArticleSentiment) => boolean = () => false,
): ArticleSentiment[] {
  const ranked = [...items].sort((a, b) => {
    const byNamed = Number(named(b)) - Number(named(a))
    if (byNamed !== 0) return byNamed
    const byWeight = articleWeight(b) - articleWeight(a)
    return byWeight !== 0 ? byWeight : b.datetime - a.datetime
  })

  const picked = new Set<ArticleSentiment>()
  const perSource = new Map<string, number>()

  for (const cap of [1, PER_SOURCE_CAP, Infinity]) {
    for (const a of ranked) {
      if (picked.size >= n) break
      if (picked.has(a)) continue
      const key = a.source.trim().toLowerCase()
      const used = perSource.get(key) ?? 0
      if (used >= cap) continue
      perSource.set(key, used + 1)
      picked.add(a)
    }
    if (picked.size >= n) break
  }

  return [...picked]
}

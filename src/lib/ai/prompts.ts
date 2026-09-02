import type { CompanySnapshot, NewsArticle } from '../marketdata/types'
import type { SentimentAggregate } from '../nlp/types'
import { ANALYSIS_METRICS } from './metrics'

function signed(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}`
}

/**
 * Renders the locally-computed FinBERT numbers as a prompt section. The LLM is
 * told to treat these as the measured sentiment and to explain / stress-test
 * them rather than re-estimate polarity from the headlines itself.
 */
function sentimentBlock(s: SentimentAggregate): string {
  const sourceLines = s.bySource
    .slice(0, 8)
    .map((x) => `  - ${x.source}: ${x.count} article(s), avg ${signed(x.meanSigned)}`)
    .join('\n')

  return `## Quantitative sentiment signal — FinBERT, computed locally on the reader's machine (NOT your estimate)
FinBERT (BERT fine-tuned on financial text) classified ${s.articleCount} recent articles:
- Label counts: ${s.distribution.positive} positive / ${s.distribution.neutral} neutral / ${s.distribution.negative} negative
- Mean sentiment score: ${signed(s.meanSigned)} on a −1 (max bearish) … +1 (max bullish) scale
- Recency-weighted score (7-day half-life): ${signed(s.recencyWeightedSigned)}
- Net signal: ${s.net.toUpperCase()} · model-derived confidence: ${s.confidence.toUpperCase()} (label agreement ${Math.round(s.agreement * 100)}%, ${s.sourceCount} distinct sources)
Per source:
${sourceLines || '  - (none)'}

Treat these numbers as the measured direction and magnitude of news sentiment. Your job is to explain WHY the coverage carries this sentiment, whether it should be trusted (source concentration, stale coverage, single-outlet claims), and how it squares with the fundamentals — not to re-score polarity yourself. Do not flip the sign of the FinBERT net signal unless a specific headline plainly contradicts it; if you do, say which one and why.`
}

/** The metric rubric, rendered from ANALYSIS_METRICS so prompt and UI stay in sync. */
function metricRubric(): string {
  return ANALYSIS_METRICS.map(
    (m) => `- ${m.key}: 0 = ${m.low}; 100 = ${m.high}`,
  ).join('\n')
}

/**
 * Produces a prompt whose output is a small JSON object: a one-paragraph
 * synthesis, a directional lean, and a 0–100 score + rationale for each of the
 * curated dimensions in ANALYSIS_METRICS. Sentiment-research framing carries
 * over from the earlier long-form version — per-dimension scoring rather than
 * one blended number, source diversity and recency as first-class signals,
 * and an explicit non-advice stance.
 */
export function buildAnalysisPrompt(
  symbol: string,
  snapshot: CompanySnapshot,
  articles: NewsArticle[],
  sentiment?: SentimentAggregate,
): string {
  const sourceCounts = new Map<string, number>()
  for (const a of articles) {
    sourceCounts.set(a.source, (sourceCounts.get(a.source) ?? 0) + 1)
  }
  const sourceSummary = Array.from(sourceCounts.entries())
    .map(([source, count]) => `${source} (${count})`)
    .join(', ')

  const articleList = articles
    .slice(0, 25)
    .map((a) => {
      const date = a.datetime ? new Date(a.datetime * 1000).toISOString().slice(0, 10) : 'unknown'
      return `- [${date}] (${a.source}) ${a.headline}${a.summary ? ` — ${a.summary}` : ''}`
    })
    .join('\n')

  const fundamentalsLines: string[] = []
  if (snapshot.profile) {
    fundamentalsLines.push(
      `${snapshot.profile.name} (${symbol}), ${snapshot.profile.industry}, ${snapshot.profile.exchange}`,
    )
  }
  if (snapshot.quote) {
    fundamentalsLines.push(
      `Price: ${snapshot.quote.current} (${snapshot.quote.percentChange >= 0 ? '+' : ''}${snapshot.quote.percentChange.toFixed(2)}% today)`,
    )
  }
  if (snapshot.metrics) {
    const m = snapshot.metrics
    fundamentalsLines.push(
      [
        m.peTTM !== undefined ? `P/E (TTM): ${m.peTTM.toFixed(1)}` : undefined,
        m.pb !== undefined ? `P/B: ${m.pb.toFixed(1)}` : undefined,
        m.beta !== undefined ? `Beta: ${m.beta.toFixed(2)}` : undefined,
        m.dividendYieldTTM !== undefined ? `Div yield: ${m.dividendYieldTTM.toFixed(2)}%` : undefined,
      ]
        .filter(Boolean)
        .join(', '),
    )
  }
  if (snapshot.recommendationTrend) {
    const r = snapshot.recommendationTrend
    fundamentalsLines.push(
      `Latest analyst consensus (${r.period}): ${r.strongBuy + r.buy} buy-leaning, ${r.hold} hold, ${r.sell + r.strongSell} sell-leaning`,
    )
  }

  return `You are a financial research assistant producing a preliminary, informational read on recent news for a retail investor. You are given real news headlines/summaries retrieved from a data API (not written or selected by you), some fundamentals, and${sentiment ? ' a locally-computed FinBERT sentiment breakdown' : ' (no model sentiment breakdown this run)'}. Do not invent facts, prices, or events not present in the data below. Base every score, note, and sentence only on this data.

## Company snapshot (non-AI sourced data)
${fundamentalsLines.join('\n') || 'No fundamentals data available.'}

## Recent news for ${symbol} (${articles.length} articles from ${sourceCounts.size} distinct sources: ${sourceSummary || 'none'})
${articleList || 'No recent news articles were found.'}
${sentiment ? `\n${sentimentBlock(sentiment)}\n` : ''}
## Output — a JSON object with these fields:

- "synthesis": ONE paragraph, 3-5 sentences, plain prose (no markdown, no headings, no lists). A general read on what the recent coverage says and the near-term stock outlook. Hedged and informational — not a recommendation.
- "lean": one of bullish | bearish | neutral | mixed — the directional lean of the public news signal above${sentiment ? ", consistent with the FinBERT net signal unless a specific headline plainly contradicts it" : ''}. This is a summary of sentiment, not a price prediction.
- "confidence": one of low | medium | high — how much weight the lean deserves, based on source agreement, source diversity, and article volume${sentiment ? ` (FinBERT's own model-derived confidence this run is ${sentiment.confidence.toUpperCase()})` : ''}.
- "metrics": an array with exactly one entry per key below — {"key", "score" (integer 0-100), "note" (1-2 sentences citing dates/sources from the news above)}.

Metric keys and what the ends of the 0-100 scale mean:
${metricRubric()}

Also return this exact sentence as the last one of "synthesis": "This is an automated summary of public news sentiment for informational purposes only, not financial advice."`
}

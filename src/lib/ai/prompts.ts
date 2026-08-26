import type { CompanySnapshot, NewsArticle } from '../marketdata/types'

/**
 * Report structure follows common patterns from financial sentiment-analysis
 * research: sentiment broken out per theme/catalyst rather than one blended
 * score, source-diversity and recency treated as first-class signals (not
 * just headline polarity), and an explicit non-advice framing throughout
 * rather than a bare "buy/sell" verdict.
 */
export function buildAnalysisPrompt(
  symbol: string,
  snapshot: CompanySnapshot,
  articles: NewsArticle[],
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

  return `You are a financial research assistant producing a preliminary, informational news-sentiment report for a retail investor. You are given real news headlines/summaries retrieved from a data API (not written or selected by you) and some fundamentals. Do not invent facts, prices, or events not present in the data below.

## Company snapshot (non-AI sourced data)
${fundamentalsLines.join('\n') || 'No fundamentals data available.'}

## Recent news for ${symbol} (${articles.length} articles from ${sourceCounts.size} distinct sources: ${sourceSummary || 'none'})
${articleList || 'No recent news articles were found.'}

## Write the report with these sections, in markdown:

1. **Overview** — 2-3 sentences on what the recent coverage is broadly about and the overall tone.
2. **Sentiment by theme** — group the news into 2-5 themes (e.g. earnings, product, regulatory, macro, leadership, litigation). For each theme give a sentiment label (Positive / Negative / Neutral / Mixed), 1-2 sentences of rationale, and cite which articles it's based on by date+source.
3. **Source & recency context** — comment on how many distinct outlets are represented, whether they agree or conflict, and whether the coverage is fresh or stale. Low source diversity or single-source claims should be flagged as lower-confidence.
4. **Catalysts & risks** — bullet list of concrete upcoming or recent events mentioned in the articles that could move the stock (earnings dates, product launches, regulatory decisions, etc).
5. **Fundamentals cross-check** — 1-2 sentences on whether the news sentiment is consistent with or contradicts the snapshot data above (e.g. elevated valuation vs. negative news).
6. **Preliminary lean** — a directional lean purely as a summary of what the public sentiment signal above shows, not a prediction or recommendation. This section MUST end with a line in exactly this format, with no other text on that line:
   \`LEAN: <BULLISH|BEARISH|NEUTRAL|MIXED> · CONFIDENCE: <LOW|MEDIUM|HIGH>\`
   (choose exactly one word per placeholder, in that exact casing, based on source agreement and volume)

End with this exact disclaimer on its own line: "This is an automated summary of public news sentiment for informational purposes only. It is not financial advice — do your own research before making investment decisions."`
}

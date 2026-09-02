import type { NewsArticle } from './types'

/**
 * Finnhub's `/company-news` feed is scoped to a symbol but still includes
 * market round-ups and "N stocks to buy" listicles where the company is one
 * mention among many. We drop those — everything else about the company stays,
 * including wire copy that says "the iPhone maker" rather than naming it.
 *
 * This is deliberately a *noise* filter, not a "must name the company" gate:
 * the strict version threw out too much genuine single-company coverage
 * (especially non-Yahoo wire items with an empty `summary`) and left the grid
 * dominated by one source.
 */

const ROUNDUP_PATTERNS: RegExp[] = [
  /\b\d+\s+(?:best|top|great|cheap|hot|safe|high[- ]yield|dividend|growth|value|ai|tech|blue[- ]chip)\b[^.]*\bstocks?\b/i,
  /\bstocks?\s+to\s+(?:buy|watch|sell|avoid|consider)\b/i,
  /\b(?:best|top|worst)\s+(?:performing\s+)?stocks?\s+(?:to|of|for|this|right now)\b/i,
  /\bstock\s+market\s+(?:today|news|wrap|round-?up|recap|close|open|live)\b/i,
  /\b(?:dow|s&p\s*500|s&p|nasdaq|russell)\s+(?:jones\s+)?(?:futures|today|closes?|ends?|rallies|falls?|slips?|gains?|drops?|jumps?|sinks?)\b/i,
  /\b(?:futures|markets?|stocks?|shares?|indexes?|indices)\s+(?:rise|fall|climb|drop|slip|gain|jump|tumble|edge|mixed|higher|lower|rally|slide)\b/i,
  /\b(?:premarket|pre-market|after-?hours)\s+(?:movers|gainers|losers|trading|action)\b/i,
  /\b(?:biggest|top|notable)\s+(?:movers|gainers|losers)\b/i,
  /\bwhat\s+to\s+watch\b/i,
  /\b(?:the\s+)?(?:week|day|month)\s+ahead\b/i,
  /\bmagnificent\s+seven\b/i,
  /\bmega-?cap\s+(?:tech|stocks?|names?)\b/i,
  /\bmarket\s+(?:snapshot|recap|update|briefing)\b/i,
]

/** More than this many tickers on Finnhub's `related` tag ⇒ treat as a market piece. */
const MAX_RELATED_TICKERS = 5

function relatedCount(related: string | undefined): number {
  return (related ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean).length
}

function looksLikeRoundup(a: NewsArticle): boolean {
  const text = `${a.headline} ${a.summary}`
  if (ROUNDUP_PATTERNS.some((re) => re.test(text))) return true
  return relatedCount(a.related) > MAX_RELATED_TICKERS
}

/**
 * Drops market round-ups / listicles. Fails open: if the filter would remove
 * everything, the original list is returned rather than blanking the panel.
 */
export function filterCompanyNews(articles: NewsArticle[]): NewsArticle[] {
  const kept = articles.filter((a) => !looksLikeRoundup(a))
  return kept.length === 0 ? articles : kept
}

export interface CompanyRef {
  symbol: string
  companyName?: string
}

const CORP_SUFFIXES =
  /\b(?:inc|incorporated|corp|corporation|co|company|companies|ltd|limited|plc|holdings?|group|partners|trust)\b\.?/gi

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Does the article actually name the company, rather than just being tagged to
 * it? Used only as a ranking tie-breaker for the grid — not a filter. Accepts
 * anything with a headline (and optionally a summary), so it works on both
 * `NewsArticle` and the trimmed-down sentiment records.
 */
export function namesCompany(
  article: { headline: string; summary?: string },
  ref: CompanyRef,
): boolean {
  const needles: string[] = []

  const sym = ref.symbol.trim()
  if (sym.length >= 2) needles.push(escapeRegExp(sym))

  const name = (ref.companyName ?? '')
    .replace(CORP_SUFFIXES, '')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (name.length >= 3) needles.push(escapeRegExp(name))

  if (needles.length === 0) return true
  const re = new RegExp(`\\b(?:${needles.join('|')})\\b`, 'i')
  return re.test(`${article.headline} ${article.summary ?? ''}`)
}

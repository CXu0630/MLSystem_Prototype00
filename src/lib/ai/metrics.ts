/**
 * The scored dimensions the LLM fills in for each analysis. Kept here (not in
 * the prompt) so the prompt text, the JSON schema, and the UI all read from one
 * list. Every score is 0–100 on the axis described by `low`/`high`.
 */
export interface MetricDef {
  key: string
  label: string
  /** What a score near 0 means. */
  low: string
  /** What a score near 100 means. */
  high: string
  /** Is a high score good news for the stock? (drives the bar colour) */
  favorableHigh: boolean
  /** Static description shown in the hover card, above the model's note. */
  about: string
}

export const ANALYSIS_METRICS: MetricDef[] = [
  {
    key: 'mediaOutlook',
    label: 'Media outlook',
    low: 'overwhelmingly negative coverage',
    high: 'overwhelmingly positive coverage',
    favorableHigh: true,
    about:
      'Overall tone of the recent coverage — how positive or negative the headlines and summaries read as a whole.',
  },
  {
    key: 'riskLevel',
    label: 'Risk level',
    low: 'few concerns raised',
    high: 'many serious concerns',
    favorableHigh: false,
    about:
      'How much downside the coverage flags — litigation, regulation, execution stumbles, demand or margin pressure, guidance cuts.',
  },
  {
    key: 'catalystMomentum',
    label: 'Catalyst momentum',
    low: 'quiet, no near-term events',
    high: 'imminent, market-moving catalysts',
    favorableHigh: true,
    about:
      'Whether the news points to concrete near-term events — earnings, product launches, regulatory rulings, deals — that could move the stock soon.',
  },
  {
    key: 'sourceConsensus',
    label: 'Source consensus',
    low: 'outlets sharply conflict',
    high: 'outlets strongly agree',
    favorableHigh: true,
    about:
      'How consistent the take is across outlets, and whether the key claims are corroborated by several sources or rest on one.',
  },
  {
    key: 'fundamentalsAlignment',
    label: 'Fundamentals fit',
    low: 'news contradicts the fundamentals',
    high: 'news matches the fundamentals',
    favorableHigh: true,
    about:
      'Whether the news sentiment lines up with the valuation and fundamentals in the snapshot, or clashes with them (e.g. euphoric coverage on a stretched multiple).',
  },
  {
    key: 'substanceVsHype',
    label: 'Substance vs hype',
    low: 'mostly speculation and noise',
    high: 'mostly concrete developments',
    favorableHigh: true,
    about:
      'How much of the coverage is grounded in real, verifiable events versus rumour, promotion, or a recycled narrative.',
  },
]

export const METRIC_KEYS = ANALYSIS_METRICS.map((m) => m.key)

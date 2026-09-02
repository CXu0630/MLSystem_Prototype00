import type { ArticleSentiment, SentimentAggregate, SentimentLabel } from '../lib/nlp/types'

const LABEL_META: Record<SentimentLabel, { text: string; emoji: string; cls: string }> = {
  positive: { text: 'Positive', emoji: '🟢', cls: 'sent-positive' },
  negative: { text: 'Negative', emoji: '🔴', cls: 'sent-negative' },
  neutral: { text: 'Neutral', emoji: '⚪', cls: 'sent-neutral' },
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

function signed(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}`
}

function fmtDate(dt: number): string {
  return dt
    ? new Date(dt * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '—'
}

function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return `${n}`
}

function ProbBar({ p }: { p: ArticleSentiment['probabilities'] }) {
  return (
    <div
      className="prob-bar"
      role="img"
      aria-label={`positive ${pct(p.positive)}, neutral ${pct(p.neutral)}, negative ${pct(p.negative)}`}
    >
      <span className="prob-seg prob-pos" style={{ width: `${p.positive * 100}%` }} />
      <span className="prob-seg prob-neu" style={{ width: `${p.neutral * 100}%` }} />
      <span className="prob-seg prob-neg" style={{ width: `${p.negative * 100}%` }} />
    </div>
  )
}

function SentimentCard({ item }: { item: ArticleSentiment }) {
  const meta = LABEL_META[item.label]
  return (
    <article className={`sent-card ${meta.cls}`}>
      <div className="sent-card-head">
        <span className="sent-tag">
          <span aria-hidden="true">{meta.emoji}</span> {meta.text}
        </span>
        <span className="sent-score">{pct(item.confidence)}</span>
      </div>
      <a className="sent-headline" href={item.url} target="_blank" rel="noreferrer">
        {item.headline}
      </a>
      <ProbBar p={item.probabilities} />
      <div className="prob-legend">
        <span>pos {pct(item.probabilities.positive)}</span>
        <span>neu {pct(item.probabilities.neutral)}</span>
        <span>neg {pct(item.probabilities.negative)}</span>
      </div>
      <div className="sent-card-foot">
        <span>{item.source}</span>
        <span>{fmtDate(item.datetime)}</span>
        {typeof item.views === 'number' && (
          <span>
            <span aria-hidden="true">👁 </span>
            {fmtViews(item.views)}
          </span>
        )}
        <span className="sent-signed">signal {signed(item.signed)}</span>
      </div>
    </article>
  )
}

interface SentimentGridProps {
  items: ArticleSentiment[]
  aggregate: SentimentAggregate
}

export function SentimentGrid({ items, aggregate }: SentimentGridProps) {
  const netMeta = LABEL_META[aggregate.net]
  return (
    <div className="sentiment-block">
      <div className="sentiment-summary">
        <div className="sent-summary-net-wrap">
          <span className="sent-summary-label">FinBERT net signal</span>
          <span className={`sent-summary-net ${netMeta.cls}`}>
            <span aria-hidden="true">{netMeta.emoji}</span> {netMeta.text}
          </span>
          <span className="sent-summary-conf">{aggregate.confidence} confidence</span>
        </div>
        <div className="sent-summary-nums">
          <span>
            {aggregate.distribution.positive} pos / {aggregate.distribution.neutral} neu /{' '}
            {aggregate.distribution.negative} neg
          </span>
          <span>mean {signed(aggregate.meanSigned)}</span>
          <span>recency-wtd {signed(aggregate.recencyWeightedSigned)}</span>
          <span>{aggregate.articleCount} articles · {aggregate.sourceCount} sources</span>
        </div>
      </div>

      <div className="sentiment-grid">
        {items.map((it) => (
          <SentimentCard key={it.id || it.url} item={it} />
        ))}
      </div>

      <p className="hint">
        Six articles, spread across outlets (max two per source), favouring ones that name the
        company and ranked by view count where the feed reports it, otherwise by how decisive the
        model's read is. Each box is FinBERT — a BERT model fine-tuned on financial text — run
        locally in your browser on that article's headline + summary. No server, no API call,
        nothing leaves the tab. The bar is the model's positive / neutral / negative probability
        split; “signal” is positive minus negative on a −1…+1 scale.
      </p>
    </div>
  )
}

import type { AnalysisResult, MetricScore } from '../lib/ai/analysis'

/** Score on the "is this good for the stock?" axis, 0–100. */
function favorableScore(m: MetricScore): number {
  return m.def.favorableHigh ? m.score : 100 - m.score
}

function toneClass(m: MetricScore): string {
  const g = favorableScore(m)
  if (g >= 60) return 'tone-good'
  if (g <= 40) return 'tone-bad'
  return 'tone-mid'
}

function MetricRow({ m }: { m: MetricScore }) {
  return (
    <div className={`metric-row ${toneClass(m)}`} tabIndex={0}>
      <div className="metric-head">
        <span className="metric-label">{m.def.label}</span>
        <span className="metric-score">{m.score}</span>
      </div>
      <div className="metric-bar" role="img" aria-label={`${m.def.label}: ${m.score} out of 100`}>
        <span className="metric-fill" style={{ width: `${m.score}%` }} />
      </div>
      <div className="metric-tip" role="tooltip">
        <span className="metric-tip-scale">
          <span>0 · {m.def.low}</span>
          <span>{m.def.high} · 100</span>
        </span>
        <p className="metric-about">{m.def.about}</p>
        <p className="metric-note">{m.note}</p>
      </div>
    </div>
  )
}

export function AnalysisMetrics({ result }: { result: AnalysisResult }) {
  return (
    <div className="analysis-metrics">
      <div className="metrics-col">
        <div className="metric-list">
          {result.metrics.map((m) => (
            <MetricRow key={m.def.key} m={m} />
          ))}
        </div>
        <p className="hint metric-hint">
          Hover or focus a row for what it measures and why it scored that way.
        </p>
      </div>
      <p className="synthesis">{result.synthesis}</p>
    </div>
  )
}

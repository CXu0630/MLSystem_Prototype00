export type Lean = 'bullish' | 'bearish' | 'neutral'
export type Confidence = 'low' | 'medium' | 'high'

export interface ParsedLean {
  lean: Lean | null
  confidence: Confidence | null
}

/**
 * Pulls the machine-readable `LEAN: X · CONFIDENCE: Y` tag that the prompt
 * in prompts.ts instructs the model to end its report with. Falls back to
 * null (no badge shown) if the model didn't follow the format — the flowing
 * report text is the source of truth either way, this is just a UI extra.
 */
export function parseLean(report: string): ParsedLean {
  const match = report.match(/LEAN:\s*(BULLISH|BEARISH|NEUTRAL|MIXED)\s*.\s*CONFIDENCE:\s*(LOW|MEDIUM|HIGH)/i)
  if (!match) return { lean: null, confidence: null }

  const leanWord = match[1].toUpperCase()
  const lean: Lean = leanWord === 'BULLISH' ? 'bullish' : leanWord === 'BEARISH' ? 'bearish' : 'neutral'
  const confidence = match[2].toLowerCase() as Confidence

  return { lean, confidence }
}

/** Removes the raw `LEAN: ... · CONFIDENCE: ...` tag line from the report
 * text before rendering it as prose — it's surfaced separately as the big
 * BUY/SELL/HOLD badge instead of appearing twice. */
export function stripLeanTag(report: string): string {
  return report
    .replace(/^.*LEAN:\s*(BULLISH|BEARISH|NEUTRAL|MIXED)\s*.\s*CONFIDENCE:\s*(LOW|MEDIUM|HIGH).*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

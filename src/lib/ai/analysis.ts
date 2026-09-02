import { type LanguageModel, generateObject, jsonSchema } from 'ai'
import type { CompanySnapshot, NewsArticle } from '../marketdata/types'
import type { SentimentAggregate } from '../nlp/types'
import { ANALYSIS_METRICS, METRIC_KEYS, type MetricDef } from './metrics'
import { buildAnalysisPrompt } from './prompts'

export type Lean = 'bullish' | 'bearish' | 'neutral' | 'mixed'
export type Confidence = 'low' | 'medium' | 'high'

/** One scored dimension, resolved against its {@link MetricDef}. */
export interface MetricScore {
  def: MetricDef
  /** 0–100, clamped. */
  score: number
  /** The model's 1–2 sentence rationale. */
  note: string
}

export interface AnalysisResult {
  synthesis: string
  lean: Lean
  confidence: Confidence
  metrics: MetricScore[]
}

interface RawAnalysis {
  synthesis: string
  lean: Lean
  confidence: Confidence
  metrics: { key: string; score: number; note: string }[]
}

const analysisSchema = jsonSchema<RawAnalysis>({
  type: 'object',
  required: ['synthesis', 'lean', 'confidence', 'metrics'],
  properties: {
    synthesis: {
      type: 'string',
      description:
        'ONE paragraph, 3-5 sentences, plain prose (no markdown), giving a general read on the recent news and the stock outlook. Hedged and informational.',
    },
    lean: {
      type: 'string',
      enum: ['bullish', 'bearish', 'neutral', 'mixed'],
      description: 'Directional lean of the public news signal — a summary, not a prediction.',
    },
    confidence: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
      description: 'Confidence in that lean given source agreement and volume.',
    },
    metrics: {
      type: 'array',
      description: 'Exactly one entry per metric key, in any order.',
      items: {
        type: 'object',
        required: ['key', 'score', 'note'],
        properties: {
          key: { type: 'string', enum: METRIC_KEYS },
          score: { type: 'number', minimum: 0, maximum: 100 },
          note: {
            type: 'string',
            description:
              '1-2 sentences explaining this score, citing dates/sources from the news provided.',
          },
        },
      },
    },
  },
})

function clampScore(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 50
  return Math.max(0, Math.min(100, Math.round(v)))
}

const VALID_LEAN: Lean[] = ['bullish', 'bearish', 'neutral', 'mixed']
const VALID_CONFIDENCE: Confidence[] = ['low', 'medium', 'high']

/** Maps the raw model output onto {@link ANALYSIS_METRICS}, filling any gaps. */
function normalize(raw: RawAnalysis): AnalysisResult {
  const byKey = new Map((raw.metrics ?? []).map((m) => [m.key, m]))

  const metrics: MetricScore[] = ANALYSIS_METRICS.map((def) => {
    const hit = byKey.get(def.key)
    return {
      def,
      score: clampScore(hit?.score),
      note: hit?.note?.trim() || 'The model did not return a rationale for this dimension.',
    }
  })

  return {
    synthesis: raw.synthesis?.trim() || 'No synthesis was returned.',
    lean: VALID_LEAN.includes(raw.lean) ? raw.lean : 'neutral',
    confidence: VALID_CONFIDENCE.includes(raw.confidence) ? raw.confidence : 'low',
    metrics,
  }
}

export interface AnalysisRequest {
  model: LanguageModel
  symbol: string
  snapshot: CompanySnapshot
  articles: NewsArticle[]
  sentiment?: SentimentAggregate
}

export async function generateAnalysis({
  model,
  symbol,
  snapshot,
  articles,
  sentiment,
}: AnalysisRequest): Promise<AnalysisResult> {
  const prompt = buildAnalysisPrompt(symbol, snapshot, articles, sentiment)
  const { object } = await generateObject({ model, schema: analysisSchema, prompt })
  return normalize(object)
}

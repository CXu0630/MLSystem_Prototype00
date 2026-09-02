import type { TextClassificationPipeline } from '@huggingface/transformers'
import type { NewsArticle } from '../marketdata/types'
import type { ArticleSentiment, SentimentLabel, SentimentProbabilities } from './types'

/**
 * FinBERT (`Xenova/finbert`) run entirely in the browser via Transformers.js —
 * no backend, no API call, the article text never leaves the tab. Weights are
 * downloaded once from the Hugging Face CDN (~110 MB at int8) and then cached
 * by the browser.
 *
 * Transformers.js (tokenizers + the ONNX WASM runtime) is a heavy dependency,
 * so it's pulled in with a dynamic `import()` on first use rather than shipped
 * in the initial page bundle.
 */

const MODEL_ID = 'Xenova/finbert'

export interface LoadProgress {
  /** 0–100 across all model shards, on the first-ever load. */
  pct: number
  file?: string
}

export type ProgressHandler = (p: LoadProgress) => void

let pipePromise: Promise<TextClassificationPipeline> | null = null

/** True once the weights are resident in this tab (subsequent runs are fast). */
export function isModelReady(): boolean {
  return pipePromise !== null
}

function getPipeline(onProgress?: ProgressHandler): Promise<TextClassificationPipeline> {
  if (!pipePromise) {
    pipePromise = import('@huggingface/transformers').then(({ env, pipeline }) => {
      // Browser-only settings:
      // - don't probe the dev server for a local `/models/` copy that isn't there.
      // - pin ONNX WASM to a single thread. Multi-threaded WASM needs COOP/COEP
      //   cross-origin-isolation headers, which GitHub Pages does not send.
      env.allowLocalModels = false
      const onnxWasm = env.backends?.onnx?.wasm
      if (onnxWasm) onnxWasm.numThreads = 1

      return pipeline('text-classification', MODEL_ID, {
        // int8 weights — ~110 MB vs ~440 MB for fp32, negligible accuracy loss
        // on 3-class headline sentiment.
        dtype: 'q8',
        progress_callback: (e) => {
          if (!onProgress) return
          if (e.status === 'progress_total') onProgress({ pct: Math.round(e.progress) })
          else if (e.status === 'progress') onProgress({ pct: Math.round(e.progress), file: e.file })
        },
      })
    })
    // A failed download shouldn't wedge every later attempt.
    pipePromise.catch(() => {
      pipePromise = null
    })
  }
  return pipePromise
}

function toProbabilities(scores: Array<{ label: string; score: number }>): SentimentProbabilities {
  const p: SentimentProbabilities = { positive: 0, negative: 0, neutral: 0 }
  for (const s of scores) {
    const key = s.label.toLowerCase()
    if (key === 'positive' || key === 'negative' || key === 'neutral') {
      p[key] = s.score
    }
  }
  return p
}

function winner(p: SentimentProbabilities): { label: SentimentLabel; confidence: number } {
  let label: SentimentLabel = 'neutral'
  let confidence = p.neutral
  if (p.positive > confidence) {
    label = 'positive'
    confidence = p.positive
  }
  if (p.negative > confidence) {
    label = 'negative'
    confidence = p.negative
  }
  return { label, confidence }
}

/**
 * Classifies each article's headline + summary and returns one sentiment
 * record per input, in the same order. Loads (and, on first use, downloads)
 * the model lazily — `onProgress` fires during that download only.
 */
export async function classifyArticles(
  articles: NewsArticle[],
  onProgress?: ProgressHandler,
): Promise<ArticleSentiment[]> {
  if (articles.length === 0) return []

  const classifier = await getPipeline(onProgress)

  const texts = articles.map((a) => `${a.headline}. ${a.summary}`.slice(0, 2000).trim())

  // top_k: null → full softmax over {positive, negative, neutral} for each input.
  const raw = (await classifier(texts, { top_k: null })) as Array<
    Array<{ label: string; score: number }>
  >

  return articles.map((a, i) => {
    const probabilities = toProbabilities(raw[i])
    const { label, confidence } = winner(probabilities)
    return {
      id: a.id,
      headline: a.headline,
      url: a.url,
      source: a.source,
      datetime: a.datetime,
      views: a.views,
      label,
      confidence,
      probabilities,
      signed: probabilities.positive - probabilities.negative,
    }
  })
}

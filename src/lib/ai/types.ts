import type { LanguageModel } from 'ai'

/**
 * Add a new id here (e.g. 'anthropic' | 'openai') and a matching entry in
 * providers.ts to support another AI backend. Everything else in the app
 * (settings UI, analysis calls) is written against this abstraction and
 * doesn't need to change.
 */
export type ProviderId = 'google'

export interface ModelOption {
  id: string
  label: string
}

export interface ProviderDefinition {
  id: ProviderId
  label: string
  /** Where a user can go to create/manage an API key for this provider. */
  apiKeyUrl: string
  /** Shown as autocomplete suggestions; users may type any model id. */
  suggestedModels: ModelOption[]
  defaultModel: string
  /** Builds an AI SDK LanguageModel from a user-supplied API key. */
  createModel: (apiKey: string, modelId: string) => LanguageModel
}

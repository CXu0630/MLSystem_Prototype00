import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { ProviderDefinition, ProviderId } from './types'

/**
 * Registry of supported AI backends. To add another provider (Anthropic,
 * OpenAI, ...):
 *   1. `npm install @ai-sdk/<provider>`
 *   2. add its id to ProviderId in types.ts
 *   3. add an entry below using that package's `create<Provider>()` factory
 * No other file needs to change — the settings UI and analysis calls read
 * from this registry.
 */
export const providers: Record<ProviderId, ProviderDefinition> = {
  google: {
    id: 'google',
    label: 'Google Gemini',
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    suggestedModels: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — fast, cheap' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro — higher quality' },
    ],
    defaultModel: 'gemini-2.5-flash',
    createModel: (apiKey, modelId) => {
      const google = createGoogleGenerativeAI({ apiKey })
      return google(modelId)
    },
  },
}

export const providerList: ProviderDefinition[] = Object.values(providers)

export function getProvider(id: ProviderId): ProviderDefinition {
  return providers[id]
}

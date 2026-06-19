import { getApiKey } from '../config/loadProviders'
import { testGeminiKey, testOpenAICompatibleKey } from '../providers'
import { PROVIDERS } from '../providers/registry'
import type { ProviderHealth, ProviderHealthStatus } from '../types'

function statusFromError(message: string): ProviderHealthStatus {
  const lower = message.toLowerCase()
  if (lower.includes('rate limit') || lower.includes('429')) return 'rate_limited'
  if (lower.includes('invalid') || lower.includes('401') || lower.includes('403')) return 'invalid_key'
  return 'error'
}

export async function checkProviderHealth(providerId: string): Promise<ProviderHealth> {
  const apiKey = getApiKey(providerId)
  if (!apiKey) {
    return { status: 'error', message: 'No API key configured', checkedAt: Date.now() }
  }

  const result =
    providerId === 'gemini'
      ? await testGeminiKey(apiKey)
      : await testOpenAICompatibleKey(providerId, apiKey)

  if (result.ok) {
    return { status: 'working', checkedAt: Date.now() }
  }

  return {
    status: statusFromError(result.error ?? ''),
    message: result.error,
    checkedAt: Date.now(),
  }
}

export async function checkAllProviders(): Promise<Record<string, ProviderHealth>> {
  const results: Record<string, ProviderHealth> = {}

  await Promise.all(
    PROVIDERS.filter((p) => p.enabled).map(async (provider) => {
      results[provider.id] = await checkProviderHealth(provider.id)
    }),
  )

  return results
}

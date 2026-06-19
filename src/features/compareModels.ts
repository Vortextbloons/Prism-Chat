import type { ChatRequest, RouteMode } from '../types'
import { getApiKey } from '../config/loadProviders'
import { sendChat } from '../providers'
import { getProvider, getProviderModels } from '../providers/registry'
import { getProviderOrder } from '../config/loadProviders'

export type CompareResult = {
  provider: string
  providerName: string
  model: string
  modelName: string
  content: string
  error?: string
}

function pickModel(providerId: string): string {
  const config = getProvider(providerId)
  return config?.defaultModel ?? getProviderModels(providerId)[0]?.id ?? 'default'
}

export async function compareModels(
  request: ChatRequest,
  routeMode: RouteMode,
  maxProviders = 4,
): Promise<CompareResult[]> {
  const order = getProviderOrder(routeMode).slice(0, maxProviders)
  const tasks = order.map(async (providerId): Promise<CompareResult> => {
    const config = getProvider(providerId)
    const apiKey = getApiKey(providerId)
    const providerName = config?.name ?? providerId
    const model = pickModel(providerId)
    const modelName = config?.models.find((m) => m.id === model)?.name ?? model

    if (!apiKey || !config) {
      return { provider: providerId, providerName, model, modelName, content: '', error: 'Not configured' }
    }

    try {
      const content = await sendChat(apiKey, {
        ...request,
        provider: providerId,
        model,
        stream: false,
      })
      return { provider: providerId, providerName, model, modelName, content }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed'
      return { provider: providerId, providerName, model, modelName, content: '', error: message }
    }
  })

  return Promise.all(tasks)
}

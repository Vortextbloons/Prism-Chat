import type { ChatRequest, RouteMode } from '../types'
import { ProviderError } from '../types'
import { getApiKey, getProviderOrder } from '../config/loadProviders'
import { collectStream } from '../features/streaming'
import { sendChat, streamChat } from '../providers'
import { getProvider } from '../providers/registry'

export type FallbackAttempt = {
  provider: string
  error: string
  kind: ProviderError['kind']
}

export type FallbackResult = {
  content: string
  provider: string
  model: string
  attempts: FallbackAttempt[]
}

function resolveModel(providerId: string, preferredModel?: string): string {
  const config = getProvider(providerId)
  if (!config) return preferredModel ?? ''
  if (preferredModel && config.models.some((m) => m.id === preferredModel)) {
    return preferredModel
  }
  return config.defaultModel
}

function getProviderOrderList(
  routeMode: RouteMode,
  preferredProvider?: string,
): string[] {
  const order = getProviderOrder(routeMode)
  if (!preferredProvider) return order
  return [preferredProvider, ...order.filter((p) => p !== preferredProvider)]
}

function isRetryable(err: unknown): boolean {
  return err instanceof ProviderError && (err.kind === 'rate_limit' || err.kind === 'invalid_key')
}

export async function sendWithFallback(
  request: ChatRequest,
  routeMode: RouteMode,
  preferredProvider?: string,
): Promise<FallbackResult> {
  const attempts: FallbackAttempt[] = []

  for (const providerId of getProviderOrderList(routeMode, preferredProvider)) {
    const apiKey = getApiKey(providerId)
    if (!apiKey) continue

    const config = getProvider(providerId)
    if (!config) continue

    const model = resolveModel(providerId, request.model)

    try {
      const content = await sendChat(apiKey, {
        ...request,
        provider: providerId,
        model,
        stream: false,
      })
      return { content, provider: providerId, model, attempts }
    } catch (err) {
      if (err instanceof ProviderError) {
        attempts.push({ provider: providerId, error: err.message, kind: err.kind })
        if (isRetryable(err)) continue
      }
      throw err
    }
  }

  throw new ProviderError(
    attempts.length
      ? `All providers failed. Last: ${attempts[attempts.length - 1].error}`
      : 'No configured providers available for this route',
    'unknown',
  )
}

export async function streamWithFallback(
  request: ChatRequest,
  routeMode: RouteMode,
  preferredProvider?: string,
  onChunk?: (content: string) => void,
): Promise<FallbackResult> {
  const attempts: FallbackAttempt[] = []

  for (const providerId of getProviderOrderList(routeMode, preferredProvider)) {
    const apiKey = getApiKey(providerId)
    if (!apiKey) continue

    const config = getProvider(providerId)
    if (!config) continue

    const model = resolveModel(providerId, request.model)

    try {
      const stream = streamChat(apiKey, { ...request, provider: providerId, model, stream: true })
      const content = await collectStream(stream, onChunk)
      return { content, provider: providerId, model, attempts }
    } catch (err) {
      if (err instanceof ProviderError) {
        attempts.push({ provider: providerId, error: err.message, kind: err.kind })
        if (isRetryable(err)) continue
      }
      throw err
    }
  }

  return sendWithFallback(request, routeMode, preferredProvider)
}

export async function tryStreamThenFallback(
  request: ChatRequest,
  routeMode: RouteMode,
  preferredProvider: string,
  onChunk?: (content: string) => void,
): Promise<FallbackResult> {
  const apiKey = getApiKey(preferredProvider)
  const model = resolveModel(preferredProvider, request.model)

  if (apiKey) {
    try {
      const stream = streamChat(apiKey, { ...request, provider: preferredProvider, model, stream: true })
      const content = await collectStream(stream, onChunk)
      return { content, provider: preferredProvider, model, attempts: [] }
    } catch (err) {
      if (err instanceof ProviderError && err.kind !== 'rate_limit' && err.kind !== 'invalid_key') {
        throw err
      }
      try {
        const content = await sendChat(apiKey, {
          ...request,
          provider: preferredProvider,
          model,
          stream: false,
        })
        return { content, provider: preferredProvider, model, attempts: [] }
      } catch {
        // fall through
      }
    }
  }

  return streamWithFallback(request, routeMode, preferredProvider, onChunk)
}

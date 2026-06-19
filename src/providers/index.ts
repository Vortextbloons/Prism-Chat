import type { ChatRequest, StreamChunk, ToolCall } from '../types'
import { ProviderError } from '../types'
import { completeGemini, streamGemini } from './geminiProvider'
import {
  completeOpenAICompatible,
  streamOpenAICompatible,
  extractOpenAIChunk,
} from './openaiCompatibleProvider'
import { chatCloudflare } from './cloudflareProvider'
import { getProvider } from './registry'
import { chatViaProxy, resolveProxyBaseUrl } from './proxyClient'

export type ChatCompletion = {
  content: string
  reasoning?: string
  toolCalls?: ToolCall[]
}

async function completeChatDirect(apiKey: string, request: ChatRequest): Promise<ChatCompletion> {
  const config = getProvider(request.provider)
  if (!config) throw new ProviderError(`Unknown provider: ${request.provider}`, 'unknown')

  if (config.type === 'gemini') {
    return completeGemini(apiKey, request)
  }
  if (config.type === 'openai-compatible') {
    return completeOpenAICompatible(request.provider, apiKey, request)
  }
  if (config.type === 'cloudflare') {
    const content = await chatCloudflare(request.provider, apiKey, request)
    return { content }
  }
  throw new ProviderError(`Provider not implemented: ${request.provider}`, 'unknown')
}

export async function completeChat(apiKey: string, request: ChatRequest): Promise<ChatCompletion> {
  const proxy = await resolveProxyBaseUrl()
  if (proxy) {
    const response = await chatViaProxy(proxy, apiKey, request, false)
    if (!response.ok) {
      const text = await response.text()
      throw new ProviderError(text || 'Proxy request failed', 'unknown', response.status)
    }
    const data = await response.json()
    const chunk = extractOpenAIChunk(data)
    const content = chunk?.content ?? ''
    if (!content) throw new ProviderError('Empty proxy response', 'unknown')
    return { content, reasoning: chunk?.reasoning }
  }

  return completeChatDirect(apiKey, request)
}

export async function sendChat(
  apiKey: string,
  request: ChatRequest,
): Promise<string> {
  const result = await completeChat(apiKey, request)
  return result.content
}

export async function* streamChat(
  apiKey: string,
  request: ChatRequest,
): AsyncGenerator<StreamChunk> {
  const config = getProvider(request.provider)
  if (!config) throw new ProviderError(`Unknown provider: ${request.provider}`, 'unknown')

  if (config.type === 'gemini') {
    yield* streamGemini(apiKey, request)
    return
  }
  if (config.type === 'openai-compatible') {
    yield* streamOpenAICompatible(request.provider, apiKey, request)
    return
  }
  throw new ProviderError(`Provider not implemented: ${request.provider}`, 'unknown')
}

export { testGeminiKey } from './geminiProvider'
export { testOpenAICompatibleKey } from './openaiCompatibleProvider'
export { testCloudflareKey } from './cloudflareProvider'

import type { ChatRequest, StreamChunk } from '../types'
import { ProviderError } from '../types'
import { chatGemini, streamGemini } from './geminiProvider'
import { chatOpenAICompatible, streamOpenAICompatible } from './openaiCompatibleProvider'
import { getProvider } from './registry'

export async function sendChat(
  apiKey: string,
  request: ChatRequest,
): Promise<string> {
  const config = getProvider(request.provider)
  if (!config) throw new ProviderError(`Unknown provider: ${request.provider}`, 'unknown')

  if (config.type === 'gemini') {
    return chatGemini(apiKey, request)
  }
  if (config.type === 'openai-compatible') {
    return chatOpenAICompatible(request.provider, apiKey, request)
  }
  throw new ProviderError(`Provider not implemented: ${request.provider}`, 'unknown')
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

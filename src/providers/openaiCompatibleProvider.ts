import type { ChatRequest, StreamChunk } from '../types'
import { ProviderError } from '../types'
import { readSSEStream } from '../features/streaming'
import { getProvider } from './registry'

type OpenAIMessage = { role: string; content: string }

function buildOpenAIBody(request: ChatRequest) {
  const messages: OpenAIMessage[] = request.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  return {
    model: request.model,
    messages,
    temperature: request.temperature ?? 0.7,
    max_tokens: request.maxTokens ?? 4096,
    stream: request.stream ?? false,
  }
}

function classifyOpenAIError(status: number, body: string): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError('Invalid API key', 'invalid_key', status)
  }
  if (status === 429) {
    return new ProviderError('Rate limit reached', 'rate_limit', status)
  }
  if (status === 0) {
    return new ProviderError('Network or CORS error', 'cors', status)
  }
  return new ProviderError(body || `Request failed (${status})`, 'unknown', status)
}

function extractOpenAIText(data: unknown): string | null {
  const response = data as {
    choices?: { delta?: { content?: string }; message?: { content?: string } }[]
  }
  const choice = response.choices?.[0]
  return choice?.delta?.content ?? choice?.message?.content ?? null
}

export async function chatOpenAICompatible(
  providerId: string,
  apiKey: string,
  request: ChatRequest,
): Promise<string> {
  const config = getProvider(providerId)
  if (!config || config.type !== 'openai-compatible') {
    throw new ProviderError(`Unknown OpenAI-compatible provider: ${providerId}`, 'unknown')
  }

  const url = `${config.baseUrl}${config.chatPath ?? '/chat/completions'}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }

  if (providerId === 'openrouter') {
    headers['HTTP-Referer'] = window.location.origin
    headers['X-Title'] = 'Prism Chat'
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...buildOpenAIBody(request), stream: false }),
    })
  } catch {
    throw classifyOpenAIError(0, 'Failed to reach provider')
  }

  if (!response.ok) {
    const text = await response.text()
    throw classifyOpenAIError(response.status, text)
  }

  const data = await response.json()
  const text = extractOpenAIText(data)
  if (!text) throw new ProviderError('Empty response from provider', 'unknown')
  return text
}

export async function* streamOpenAICompatible(
  providerId: string,
  apiKey: string,
  request: ChatRequest,
): AsyncGenerator<StreamChunk> {
  const config = getProvider(providerId)
  if (!config || config.type !== 'openai-compatible') {
    throw new ProviderError(`Unknown OpenAI-compatible provider: ${providerId}`, 'unknown')
  }

  const url = `${config.baseUrl}${config.chatPath ?? '/chat/completions'}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }

  if (providerId === 'openrouter') {
    headers['HTTP-Referer'] = window.location.origin
    headers['X-Title'] = 'Prism Chat'
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...buildOpenAIBody(request), stream: true }),
    })
  } catch {
    throw classifyOpenAIError(0, 'Failed to reach provider')
  }

  if (!response.ok) {
    const text = await response.text()
    throw classifyOpenAIError(response.status, text)
  }

  yield* readSSEStream(response, extractOpenAIText)
}

export async function testOpenAICompatibleKey(
  providerId: string,
  apiKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const config = getProvider(providerId)
  if (!config) return { ok: false, error: 'Unknown provider' }

  try {
    await chatOpenAICompatible(providerId, apiKey, {
      provider: providerId,
      model: config.defaultModel ?? config.models?.[0] ?? 'default',
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 16,
      stream: false,
    })
    return { ok: true }
  } catch (err) {
    const message = err instanceof ProviderError ? err.message : 'Unknown error'
    return { ok: false, error: message }
  }
}

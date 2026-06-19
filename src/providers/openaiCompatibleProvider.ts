import type { ChatRequest, StreamChunk, ToolCall } from '../types'
import { ProviderError } from '../types'
import { readSSEStream } from '../features/streaming'
import { coerceMessageText, coerceReasoningText } from '../features/messageText'
import { getProvider } from './registry'
import { toolsToOpenAI, extractToolCallsFromResponse } from '../features/agentTools'

type OpenAIMessage =
  | { role: string; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: unknown[] }
  | { role: 'tool'; tool_call_id: string; content: string }

function buildOpenAIMessages(request: ChatRequest): OpenAIMessage[] {
  const messages: OpenAIMessage[] = request.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  for (const tr of request.toolResults ?? []) {
    messages.push({
      role: 'tool',
      tool_call_id: tr.toolCallId,
      content: tr.content,
    })
  }

  return messages
}

function buildOpenAIBody(request: ChatRequest) {
  const body: Record<string, unknown> = {
    model: request.model,
    messages: buildOpenAIMessages(request),
    temperature: request.temperature ?? 0.7,
    max_tokens: request.maxTokens ?? 4096,
    stream: request.stream ?? false,
  }

  if (request.jsonMode) {
    body.response_format = { type: 'json_object' }
  }

  if (request.tools?.length) {
    body.tools = toolsToOpenAI(request.tools)
    body.tool_choice = 'auto'
  }

  return body
}

export type CompletionResult = {
  content: string
  reasoning?: string
  toolCalls?: ToolCall[]
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

type OpenAIChoicePart = {
  content?: string | null
  reasoning?: string | null
  reasoning_content?: string | null
  reasoning_details?: { type?: string; text?: string; content?: string }[]
}

export function extractOpenAIChunk(data: unknown): { content?: string; reasoning?: string } | null {
  const response = data as {
    choices?: { delta?: OpenAIChoicePart; message?: OpenAIChoicePart }[]
  }
  const choice = response.choices?.[0]
  const part = choice?.delta ?? choice?.message
  if (!part) return null

  let reasoningText =
    part.reasoning ??
    part.reasoning_content ??
    undefined

  if (!reasoningText && Array.isArray(part.reasoning_details)) {
    reasoningText = part.reasoning_details
      .map((d) => d.text ?? d.content ?? '')
      .join('')
      || undefined
  }

  const content = coerceMessageText(part.content)
  const reasoning = coerceReasoningText(reasoningText)

  if (!content && !reasoning) return null
  return { content: content || undefined, reasoning }
}

export function extractOpenAIText(data: unknown): string | null {
  return extractOpenAIChunk(data)?.content ?? null
}

export function extractOpenAIReasoning(data: unknown): string | undefined {
  return extractOpenAIChunk(data)?.reasoning
}

export async function completeOpenAICompatible(
  providerId: string,
  apiKey: string,
  request: ChatRequest,
): Promise<CompletionResult> {
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
  const chunk = extractOpenAIChunk(data)
  const content = chunk?.content ?? ''
  const reasoning = chunk?.reasoning
  const toolCalls = extractToolCallsFromResponse(data)
  if (!content && !toolCalls.length && !reasoning) {
    throw new ProviderError('Empty response from provider', 'unknown')
  }
  return { content, reasoning, toolCalls: toolCalls.length ? toolCalls : undefined }
}

export async function chatOpenAICompatible(
  providerId: string,
  apiKey: string,
  request: ChatRequest,
): Promise<string> {
  const result = await completeOpenAICompatible(providerId, apiKey, request)
  return result.content
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

  yield* readSSEStream(response, extractOpenAIChunk)
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

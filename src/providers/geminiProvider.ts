import type { ChatMessage, ChatRequest, StreamChunk, ToolCall } from '../types'
import { ProviderError } from '../types'
import { readSSEStream } from '../features/streaming'
import { toolsToGemini, extractGeminiToolCalls } from '../features/agentTools'

export type GeminiCompletionResult = {
  content: string
  reasoning?: string
  toolCalls?: ToolCall[]
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }

type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] }

function toGeminiRole(role: ChatMessage['role']): 'user' | 'model' {
  return role === 'assistant' ? 'model' : 'user'
}

function messageToParts(msg: ChatMessage): GeminiPart[] {
  const parts: GeminiPart[] = []
  if (msg.content) parts.push({ text: msg.content })
  for (const img of msg.images ?? []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } })
  }
  if (parts.length === 0) parts.push({ text: '' })
  return parts
}

function buildGeminiBody(request: ChatRequest) {
  const systemMessage = request.messages.find((m) => m.role === 'system')
  const conversation = request.messages.filter((m) => m.role !== 'system')

  const contents: GeminiContent[] = conversation.map((msg) => ({
    role: toGeminiRole(msg.role),
    parts: messageToParts(msg),
  }))

  const generationConfig: Record<string, unknown> = {
    temperature: request.temperature ?? 0.7,
    maxOutputTokens: request.maxTokens ?? 4096,
  }

  if (request.jsonMode) {
    generationConfig.responseMimeType = 'application/json'
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig,
  }

  if (systemMessage) {
    body.systemInstruction = { parts: [{ text: systemMessage.content }] }
  }

  if (request.tools?.length) {
    body.tools = [{ functionDeclarations: toolsToGemini(request.tools) }]
  }

  return body
}

function classifyGeminiError(status: number, body: string): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError('Invalid Gemini API key', 'invalid_key', status)
  }
  if (status === 429) {
    return new ProviderError('Gemini rate limit reached', 'rate_limit', status)
  }
  if (status === 0) {
    return new ProviderError('Network or CORS error', 'cors', status)
  }
  return new ProviderError(body || `Gemini request failed (${status})`, 'unknown', status)
}

function extractGeminiChunk(data: unknown): { content?: string; reasoning?: string } | null {
  const response = data as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]
  }
  const parts = response.candidates?.[0]?.content?.parts
  if (!parts?.length) return null

  let content = ''
  let reasoning = ''
  for (const part of parts) {
    const text = part.text ?? ''
    if (part.thought) reasoning += text
    else content += text
  }

  if (!content && !reasoning) return null
  return { content: content || undefined, reasoning: reasoning || undefined }
}

export async function completeGemini(
  apiKey: string,
  request: ChatRequest,
): Promise<GeminiCompletionResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${encodeURIComponent(apiKey)}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildGeminiBody(request)),
    })
  } catch {
    throw classifyGeminiError(0, 'Failed to reach Gemini API')
  }

  if (!response.ok) {
    const text = await response.text()
    throw classifyGeminiError(response.status, text)
  }

  const data = await response.json()
  const chunk = extractGeminiChunk(data)
  const text = chunk?.content ?? ''
  const reasoning = chunk?.reasoning
  const toolCalls = extractGeminiToolCalls(data)
  if (!text && !toolCalls.length && !reasoning) {
    throw new ProviderError('Empty response from Gemini', 'unknown')
  }
  return { content: text, reasoning, toolCalls: toolCalls.length ? toolCalls : undefined }
}

export async function chatGemini(
  apiKey: string,
  request: ChatRequest,
): Promise<string> {
  const result = await completeGemini(apiKey, request)
  return result.content
}

export async function* streamGemini(
  apiKey: string,
  request: ChatRequest,
): AsyncGenerator<StreamChunk> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildGeminiBody(request)),
    })
  } catch {
    throw classifyGeminiError(0, 'Failed to reach Gemini API')
  }

  if (!response.ok) {
    const text = await response.text()
    throw classifyGeminiError(response.status, text)
  }

  let previousContent = ''
  let previousReasoning = ''
  for await (const chunk of readSSEStream(response, extractGeminiChunk)) {
    if (chunk.done) {
      yield chunk
      continue
    }

    const content = chunk.content ?? ''
    const reasoning = chunk.reasoning ?? ''

    const contentDelta = content.startsWith(previousContent)
      ? content.slice(previousContent.length)
      : content
    const reasoningDelta = reasoning.startsWith(previousReasoning)
      ? reasoning.slice(previousReasoning.length)
      : reasoning

    previousContent = content
    previousReasoning = reasoning

    if (contentDelta || reasoningDelta) {
      yield { content: contentDelta, reasoning: reasoningDelta || undefined }
    }
  }
}

export async function testGeminiKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await chatGemini(apiKey, {
      provider: 'gemini',
      model: 'gemini-2.0-flash-lite',
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

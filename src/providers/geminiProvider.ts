import type { ChatMessage, ChatRequest, StreamChunk } from '../types'
import { ProviderError } from '../types'
import { readSSEStream } from '../features/streaming'

type GeminiPart = { text: string }
type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] }

function toGeminiRole(role: ChatMessage['role']): 'user' | 'model' {
  return role === 'assistant' ? 'model' : 'user'
}

function buildGeminiBody(request: ChatRequest) {
  const systemMessage = request.messages.find((m) => m.role === 'system')
  const conversation = request.messages.filter((m) => m.role !== 'system')

  const contents: GeminiContent[] = conversation.map((msg) => ({
    role: toGeminiRole(msg.role),
    parts: [{ text: msg.content }],
  }))

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: request.temperature ?? 0.7,
      maxOutputTokens: request.maxTokens ?? 4096,
    },
  }

  if (systemMessage) {
    body.systemInstruction = { parts: [{ text: systemMessage.content }] }
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

function extractGeminiText(data: unknown): string | null {
  const response = data as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const parts = response.candidates?.[0]?.content?.parts
  if (!parts) return null
  return parts.map((p) => p.text ?? '').join('')
}

export async function chatGemini(
  apiKey: string,
  request: ChatRequest,
): Promise<string> {
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
  const text = extractGeminiText(data)
  if (!text) throw new ProviderError('Empty response from Gemini', 'unknown')
  return text
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

  let previous = ''
  for await (const chunk of readSSEStream(response, extractGeminiText)) {
    if (chunk.done) {
      yield chunk
      continue
    }

    const delta = chunk.content.startsWith(previous)
      ? chunk.content.slice(previous.length)
      : chunk.content
    previous = chunk.content

    if (delta) yield { content: delta }
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

import type { ChatRequest } from '../types'
import { ProviderError } from '../types'
import { getProvider } from './registry'

type CloudflareMessage = { role: string; content: string }

function buildCloudflareBody(request: ChatRequest) {
  const messages: CloudflareMessage[] = request.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }))

  const systemMessage = request.messages.find((m) => m.role === 'system')

  const body: Record<string, unknown> = {
    messages,
    max_tokens: request.maxTokens ?? 4096,
    temperature: request.temperature ?? 0.7,
  }

  if (systemMessage) {
    body.messages = [{ role: 'system', content: systemMessage.content }, ...messages]
  }

  return body
}

function classifyCloudflareError(status: number, body: string): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError('Invalid Cloudflare API token', 'invalid_key', status)
  }
  if (status === 429) {
    return new ProviderError('Cloudflare rate limit reached', 'rate_limit', status)
  }
  if (status === 0) {
    return new ProviderError('Network or CORS error', 'cors', status)
  }
  return new ProviderError(body || `Cloudflare request failed (${status})`, 'unknown', status)
}

function extractCloudflareText(data: unknown): string | null {
  const response = data as {
    result?: { response?: string }
    choices?: { message?: { content?: string } }[]
  }
  if (response.result?.response) return response.result.response
  return response.choices?.[0]?.message?.content ?? null
}

export async function chatCloudflare(
  providerId: string,
  apiKey: string,
  request: ChatRequest,
): Promise<string> {
  const config = getProvider(providerId)
  if (!config?.accountId) {
    throw new ProviderError('Cloudflare accountId not configured', 'unknown')
  }

  const url = `${config.baseUrl}/accounts/${config.accountId}/ai/run/${request.model}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildCloudflareBody(request)),
    })
  } catch {
    throw classifyCloudflareError(0, 'Failed to reach Cloudflare Workers AI')
  }

  if (!response.ok) {
    const text = await response.text()
    throw classifyCloudflareError(response.status, text)
  }

  const data = await response.json()
  const text = extractCloudflareText(data)
  if (!text) throw new ProviderError('Empty response from Cloudflare', 'unknown')
  return text
}

export async function testCloudflareKey(
  providerId: string,
  apiKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const config = getProvider(providerId)
  if (!config) return { ok: false, error: 'Unknown provider' }

  try {
    await chatCloudflare(providerId, apiKey, {
      provider: providerId,
      model: config.defaultModel,
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

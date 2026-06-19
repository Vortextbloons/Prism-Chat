import type { ChatRequest } from '../types'
import { getSettings } from '../storage/settingsStore'

export function getProxyBaseUrl(): string | null {
  const fromEnv = import.meta.env.VITE_PROXY_BASE_URL as string | undefined
  if (fromEnv?.trim()) return fromEnv.trim().replace(/\/$/, '')
  return null
}

export async function resolveProxyBaseUrl(): Promise<string | null> {
  const settings = await getSettings()
  if (settings.proxyBaseUrl?.trim()) {
    return settings.proxyBaseUrl.trim().replace(/\/$/, '')
  }
  return getProxyBaseUrl()
}

export async function chatViaProxy(
  proxyBaseUrl: string,
  apiKey: string | null,
  request: ChatRequest,
  stream: boolean,
): Promise<Response> {
  return fetch(`${proxyBaseUrl}/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...request,
      stream,
      clientApiKey: apiKey,
    }),
  })
}

export async function embedViaProxy(
  proxyBaseUrl: string,
  provider: string,
  text: string,
): Promise<number[]> {
  const response = await fetch(`${proxyBaseUrl}/v1/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, text }),
  })

  if (!response.ok) {
    throw new Error('Proxy embedding failed')
  }

  const data = (await response.json()) as { embedding?: number[] }
  if (!data.embedding?.length) throw new Error('Empty proxy embedding')
  return data.embedding
}

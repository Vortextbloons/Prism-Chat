import { getApiKey, getProvider } from '../config/loadProviders'
import { ProviderError } from '../types'
import { embedViaProxy, resolveProxyBaseUrl } from '../providers/proxyClient'
import { embedTextLocal } from './localEmbeddings'

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

export async function embedText(
  text: string,
  providerId = 'gemini',
  useLocalEmbeddings = false,
): Promise<number[]> {
  if (useLocalEmbeddings) {
    try {
      return await embedTextLocal(text)
    } catch {
      return hashEmbed(text)
    }
  }

  const proxy = await resolveProxyBaseUrl()
  if (proxy && providerId === 'gemini') {
    try {
      return await embedViaProxy(proxy, providerId, text)
    } catch {
      // fall through
    }
  }

  const provider = getProvider(providerId)
  const apiKey = getApiKey(providerId)
  if (!provider || !apiKey) {
    try {
      return await embedTextLocal(text)
    } catch {
      return hashEmbed(text)
    }
  }

  if (provider.type === 'gemini') {
    return embedGemini(apiKey, text, provider.embeddingModel ?? 'text-embedding-004')
  }

  if (provider.type === 'openai-compatible' && providerId === 'huggingface') {
    return embedHuggingFace(apiKey, text, provider.embeddingModel ?? 'sentence-transformers/all-MiniLM-L6-v2')
  }

  try {
    return await embedTextLocal(text)
  } catch {
    return hashEmbed(text)
  }
}

async function embedGemini(apiKey: string, text: string, model: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${encodeURIComponent(apiKey)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${model}`,
      content: { parts: [{ text }] },
    }),
  })

  if (!response.ok) {
    throw new ProviderError('Embedding request failed', 'unknown', response.status)
  }

  const data = (await response.json()) as { embedding?: { values?: number[] } }
  const values = data.embedding?.values
  if (!values?.length) throw new ProviderError('Empty embedding response', 'unknown')
  return values
}

async function embedHuggingFace(apiKey: string, text: string, model: string): Promise<number[]> {
  const response = await fetch(`https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
  })

  if (!response.ok) {
    throw new ProviderError('Hugging Face embedding failed', 'unknown', response.status)
  }

  const data = (await response.json()) as number[] | number[][]
  const flat = Array.isArray(data[0]) ? (data as number[][])[0] : (data as number[])
  if (!flat?.length) throw new ProviderError('Empty HF embedding', 'unknown')
  return flat
}

function hashEmbed(text: string): number[] {
  const dims = 128
  const vec = new Array(dims).fill(0)
  const tokens = text.toLowerCase().split(/\W+/).filter(Boolean)

  for (const token of tokens) {
    let hash = 0
    for (let i = 0; i < token.length; i++) {
      hash = (hash * 31 + token.charCodeAt(i)) | 0
    }
    const idx = Math.abs(hash) % dims
    vec[idx] += 1
  }

  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map((v) => v / norm)
}

export function rankBySimilarity(
  queryEmbedding: number[],
  chunks: { id: string; text: string; embedding?: number[] }[],
  topK = 4,
): { id: string; text: string; score: number }[] {
  const scored = chunks
    .filter((c) => c.embedding?.length)
    .map((c) => ({
      id: c.id,
      text: c.text,
      score: cosineSimilarity(queryEmbedding, c.embedding!),
    }))
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, topK)
}

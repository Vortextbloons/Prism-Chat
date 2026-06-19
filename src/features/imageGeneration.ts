import { getApiKey, getProvider } from '../config/loadProviders'
import { ProviderError } from '../types'

export type GeneratedImage = {
  mimeType: string
  data: string
  source: 'pollinations' | 'huggingface' | 'gemini'
}

async function urlToBase64(url: string): Promise<GeneratedImage> {
  const response = await fetch(url)
  if (!response.ok) throw new ProviderError('Image generation failed', 'unknown', response.status)
  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const mimeType = response.headers.get('content-type') ?? 'image/jpeg'
  return { mimeType, data: btoa(binary), source: 'pollinations' }
}

async function generatePollinations(prompt: string): Promise<GeneratedImage> {
  const encoded = encodeURIComponent(prompt.slice(0, 500))
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=768&nologo=true`
  return urlToBase64(url)
}

async function generateHuggingFace(prompt: string, apiKey: string, model: string): Promise<GeneratedImage> {
  const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: prompt }),
  })

  if (!response.ok) {
    throw new ProviderError('Hugging Face image generation failed', 'unknown', response.status)
  }

  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const mimeType = response.headers.get('content-type') ?? 'image/png'
  return { mimeType, data: btoa(binary), source: 'huggingface' }
}

export async function generateImage(
  prompt: string,
  providerId = 'huggingface',
): Promise<GeneratedImage> {
  const provider = getProvider(providerId)
  const apiKey = getApiKey(providerId)

  if (providerId === 'huggingface' && apiKey && provider?.type === 'openai-compatible') {
    try {
      return await generateHuggingFace(
        prompt,
        apiKey,
        provider.embeddingModel ? 'stabilityai/stable-diffusion-2-1' : 'stabilityai/stable-diffusion-2-1',
      )
    } catch {
      // fall through to pollinations
    }
  }

  return generatePollinations(prompt)
}

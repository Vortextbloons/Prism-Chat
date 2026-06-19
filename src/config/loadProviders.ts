import providersData from './providers.json'
import type { ModelConfig, ProviderConfig, ProvidersFile, RouteMode } from '../types'

const config = providersData as ProvidersFile

const PROVIDER_ENV_KEYS: Record<string, keyof ImportMetaEnv> = {
  gemini: 'VITE_GEMINI_API_KEY',
  openrouter: 'VITE_OPENROUTER_API_KEY',
  groq: 'VITE_GROQ_API_KEY',
  mistral: 'VITE_MISTRAL_API_KEY',
  cerebras: 'VITE_CEREBRAS_API_KEY',
  huggingface: 'VITE_HUGGINGFACE_API_KEY',
  cloudflare: 'VITE_CLOUDFLARE_API_KEY',
  'github-models': 'VITE_GITHUB_MODELS_API_KEY',
  'nvidia-nim': 'VITE_NVIDIA_NIM_API_KEY',
  deepinfra: 'VITE_DEEPINFRA_API_KEY',
  together: 'VITE_TOGETHER_API_KEY',
}

function getEnvApiKey(providerId: string): string | null {
  const envName = PROVIDER_ENV_KEYS[providerId]
  if (!envName) return null
  const value = import.meta.env[envName]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export const PROVIDERS_CONFIG = config

export const PROVIDERS: ProviderConfig[] = config.providers

export function getProvider(id: string): ProviderConfig | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

export function getApiKey(providerId: string): string | null {
  const provider = getProvider(providerId)
  if (!provider?.enabled) return null
  const key = provider.apiKey?.trim() || getEnvApiKey(providerId)
  return key || null
}

export function isProviderAvailable(providerId: string): boolean {
  const provider = getProvider(providerId)
  if (!provider?.enabled) return false
  return Boolean(getApiKey(providerId))
}

export function getEffectiveApiKey(providerId: string): string {
  return getApiKey(providerId) ?? ''
}

export function getEnabledProviders(): ProviderConfig[] {
  return PROVIDERS.filter((p) => p.enabled && isProviderAvailable(p.id))
}

export function getProviderModels(providerId: string): ModelConfig[] {
  return getProvider(providerId)?.models ?? []
}

export function getModel(providerId: string, modelId: string): ModelConfig | undefined {
  return getProviderModels(providerId).find((m) => m.id === modelId)
}

export function isProviderConfigured(provider: ProviderConfig): boolean {
  return isProviderAvailable(provider.id)
}

export function getProviderOrder(mode: RouteMode): string[] {
  return config.routes[mode] ?? config.routes.default
}

export function getDefaultProvider(): ProviderConfig | undefined {
  return getEnabledProviders()[0] ?? PROVIDERS.find((p) => p.enabled)
}

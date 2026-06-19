import providersData from './providers.json'
import type { ModelConfig, ProviderConfig, ProvidersFile, RouteMode } from '../types'

const config = providersData as ProvidersFile

export const PROVIDERS_CONFIG = config

export const PROVIDERS: ProviderConfig[] = config.providers

export function getProvider(id: string): ProviderConfig | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

export function getApiKey(providerId: string): string | null {
  const provider = getProvider(providerId)
  if (!provider?.enabled) return null
  const key = provider.apiKey?.trim()
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

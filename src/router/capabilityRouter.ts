import type { ModelCapability } from '../types'
import { getModel, getProviderModels } from '../config/loadProviders'

export function modelSupports(
  providerId: string,
  modelId: string,
  capability: ModelCapability,
): boolean {
  const model = getModel(providerId, modelId)
  return model?.capabilities?.includes(capability) ?? false
}

export function findCapableModel(
  providerId: string,
  capability: ModelCapability,
): string | undefined {
  return getProviderModels(providerId).find((m) => m.capabilities?.includes(capability))?.id
}

export function supportsStreaming(providerId: string, modelId: string): boolean {
  return modelSupports(providerId, modelId, 'streaming')
}

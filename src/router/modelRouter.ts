import { getProviderOrder } from '../config/loadProviders'
import type { RouteMode } from '../types'

export function getProviderOrderForMode(mode: RouteMode): string[] {
  return getProviderOrder(mode)
}

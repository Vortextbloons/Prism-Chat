import type { AppSettings, UsageStats } from '../types'
import { getDB } from './db'

const SETTINGS_KEY = 'app'
const USAGE_KEY = 'usage'

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  defaultProvider: 'gemini',
  defaultModel: 'gemini-2.0-flash',
  temperature: 0.7,
  maxTokens: 4096,
  streamResponses: true,
  routeMode: 'default',
  autoFallback: true,
  maxContextTokens: 12000,
}

export const DEFAULT_USAGE: UsageStats = {
  inputTokens: 0,
  outputTokens: 0,
  requests: 0,
  failures: 0,
  byProvider: {},
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDB()
  const record = await db.get('settings', SETTINGS_KEY)
  if (!record) return { ...DEFAULT_SETTINGS }
  const { key: _key, ...settings } = record
  return { ...DEFAULT_SETTINGS, ...settings } as AppSettings
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDB()
  await db.put('settings', { key: SETTINGS_KEY, ...settings })
}

export async function getUsageStats(): Promise<UsageStats> {
  const db = await getDB()
  const record = await db.get('settings', USAGE_KEY)
  if (!record) return { ...DEFAULT_USAGE, byProvider: {} }
  const { key: _key, ...stats } = record
  return stats as UsageStats
}

export async function recordUsage(
  provider: string,
  inputTokens: number,
  outputTokens: number,
  failed = false,
): Promise<void> {
  const stats = await getUsageStats()
  stats.inputTokens += inputTokens
  stats.outputTokens += outputTokens
  stats.requests += 1
  if (failed) stats.failures += 1

  if (!stats.byProvider[provider]) {
    stats.byProvider[provider] = { requests: 0, failures: 0 }
  }
  stats.byProvider[provider].requests += 1
  if (failed) stats.byProvider[provider].failures += 1

  const db = await getDB()
  await db.put('settings', { key: USAGE_KEY, ...stats })
}

export async function resetUsageStats(): Promise<void> {
  const db = await getDB()
  await db.put('settings', { key: USAGE_KEY, ...DEFAULT_USAGE, byProvider: {} })
}

import type { ChatMessage } from '../types'
import { estimateTokens } from './tokenCounter'

export type ContextTrimResult = {
  messages: ChatMessage[]
  droppedCount: number
  estimatedTokens: number
}

export function trimToContextLimit(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number,
): ContextTrimResult {
  const nonSystem = messages.filter((m) => m.role !== 'system')
  const systemTokens = estimateTokens(systemPrompt) + 8
  const budget = maxTokens - systemTokens

  if (budget <= 0 || nonSystem.length === 0) {
    return { messages: nonSystem.slice(-2), droppedCount: Math.max(0, nonSystem.length - 2), estimatedTokens: systemTokens }
  }

  const kept: ChatMessage[] = []
  let used = 0
  let droppedCount = 0

  for (let i = nonSystem.length - 1; i >= 0; i--) {
    const msg = nonSystem[i]
    const cost = estimateTokens(msg.content) + 4
    if (used + cost > budget && kept.length >= 2) {
      droppedCount = i + 1
      break
    }
    kept.unshift(msg)
    used += cost
  }

  if (droppedCount > 0) {
    kept.unshift({
      role: 'system',
      content: `[${droppedCount} earlier message(s) omitted to stay within context limit]`,
    })
  }

  return {
    messages: kept,
    droppedCount,
    estimatedTokens: systemTokens + used,
  }
}

export function buildContextMessages(
  systemPrompt: string,
  history: ChatMessage[],
  maxContextTokens: number,
): ChatMessage[] {
  const trimmed = trimToContextLimit(systemPrompt, history, maxContextTokens)
  const result: ChatMessage[] = []

  if (systemPrompt.trim()) {
    result.push({ role: 'system', content: systemPrompt.trim() })
  }

  result.push(...trimmed.messages.filter((m) => m.role !== 'system' || m.content.startsWith('[')))
  return result
}

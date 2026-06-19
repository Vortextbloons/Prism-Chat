import type { ChatMessage } from '../types'
import { estimateTokens } from './tokenCounter'

export type ContextTrimResult = {
  messages: ChatMessage[]
  droppedMessages: ChatMessage[]
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
    const kept = nonSystem.slice(-2)
    const dropped = nonSystem.slice(0, Math.max(0, nonSystem.length - 2))
    return {
      messages: kept,
      droppedMessages: dropped,
      droppedCount: dropped.length,
      estimatedTokens: systemTokens,
    }
  }

  const kept: ChatMessage[] = []
  let used = 0
  let dropIndex = nonSystem.length

  for (let i = nonSystem.length - 1; i >= 0; i--) {
    const msg = nonSystem[i]
    const cost = estimateTokens(msg.content) + 4
    if (used + cost > budget && kept.length >= 2) {
      dropIndex = i + 1
      break
    }
    kept.unshift(msg)
    used += cost
  }

  const droppedMessages = dropIndex > 0 ? nonSystem.slice(0, dropIndex) : []

  return {
    messages: kept,
    droppedMessages,
    droppedCount: droppedMessages.length,
    estimatedTokens: systemTokens + used,
  }
}

export function buildContextMessages(
  systemPrompt: string,
  history: ChatMessage[],
  maxContextTokens: number,
  summary?: string | null,
): ChatMessage[] {
  const trimmed = trimToContextLimit(systemPrompt, history, maxContextTokens)
  const result: ChatMessage[] = []

  if (systemPrompt.trim()) {
    result.push({ role: 'system', content: systemPrompt.trim() })
  }

  if (summary?.trim()) {
    result.push({
      role: 'system',
      content: `Summary of earlier conversation:\n${summary.trim()}`,
    })
  } else if (trimmed.droppedCount > 0) {
    result.push({
      role: 'system',
      content: `[${trimmed.droppedCount} earlier message(s) omitted to stay within context limit]`,
    })
  }

  result.push(...trimmed.messages.filter((m) => m.role !== 'system'))
  return result
}

export async function buildContextMessagesAsync(
  systemPrompt: string,
  history: ChatMessage[],
  maxContextTokens: number,
  summarize?: (dropped: ChatMessage[]) => Promise<string | null>,
): Promise<ChatMessage[]> {
  const trimmed = trimToContextLimit(systemPrompt, history, maxContextTokens)
  let summary: string | null = null

  if (trimmed.droppedCount > 0 && summarize) {
    try {
      summary = await summarize(trimmed.droppedMessages)
    } catch {
      summary = null
    }
  }

  return buildContextMessages(systemPrompt, history, maxContextTokens, summary)
}

export function formatMessagesForSummary(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role === 'assistant' ? 'Assistant' : m.role === 'user' ? 'User' : 'System'}: ${m.content}`)
    .join('\n\n')
}

import type { ChatMessage } from '../types'

export function buildMessages(
  systemPrompt: string,
  history: ChatMessage[],
): ChatMessage[] {
  const messages: ChatMessage[] = []

  if (systemPrompt.trim()) {
    messages.push({ role: 'system', content: systemPrompt.trim() })
  }

  messages.push(...history.filter((m) => m.role !== 'system'))
  return messages
}

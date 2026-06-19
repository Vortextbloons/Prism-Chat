export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

export function estimateMessagesTokens(
  messages: { role: string; content: string }[],
): number {
  return messages.reduce((sum, msg) => sum + estimateTokens(msg.content) + 4, 0)
}

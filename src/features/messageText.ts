/** Coerce API / storage values into plain message text. */
export function coerceMessageText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.content === 'string') return record.content
    if (Array.isArray(record.content)) {
      return record.content
        .map((part) => {
          if (typeof part === 'string') return part
          if (part && typeof part === 'object' && typeof (part as { text?: string }).text === 'string') {
            return (part as { text: string }).text
          }
          return ''
        })
        .join('')
    }
    if (typeof record.text === 'string') return record.text
  }
  return ''
}

export function coerceReasoningText(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() ? value : undefined
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.reasoning === 'string' && record.reasoning.trim()) {
      return record.reasoning
    }
    if (typeof record.reasoning_content === 'string' && record.reasoning_content.trim()) {
      return record.reasoning_content
    }
  }
  return undefined
}

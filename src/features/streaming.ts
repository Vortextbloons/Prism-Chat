import type { StreamChunk } from '../types'

export async function* readSSEStream(
  response: Response,
  extractText: (data: unknown) => string | null,
): AsyncGenerator<StreamChunk> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body is not readable')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith(':')) continue

      if (trimmed.startsWith('data: ')) {
        const payload = trimmed.slice(6)
        if (payload === '[DONE]') {
          yield { content: '', done: true }
          return
        }

        try {
          const parsed = JSON.parse(payload)
          const text = extractText(parsed)
          if (text) yield { content: text }
        } catch {
          // skip malformed chunks
        }
      }
    }
  }

  yield { content: '', done: true }
}

export async function collectStream(
  stream: AsyncGenerator<StreamChunk>,
  onChunk?: (content: string) => void,
): Promise<string> {
  let full = ''
  for await (const chunk of stream) {
    if (chunk.content) {
      full += chunk.content
      onChunk?.(chunk.content)
    }
  }
  return full
}

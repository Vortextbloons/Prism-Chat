import type { StreamChunk } from '../types'
import { coerceMessageText, coerceReasoningText } from './messageText'

export type StreamExtract = {
  content?: string
  reasoning?: string
}

export type CollectedStream = {
  content: string
  reasoning?: string
}

export async function* readSSEStream(
  response: Response,
  extract: (data: unknown) => StreamExtract | null,
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
          const part = extract(parsed)
          if (part?.content || part?.reasoning) {
            yield {
              content: coerceMessageText(part.content),
              reasoning: coerceReasoningText(part.reasoning),
            }
          }
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
  onChunk?: (chunk: StreamChunk) => void,
): Promise<CollectedStream> {
  let content = ''
  let reasoning = ''
  for await (const chunk of stream) {
    if (chunk.done) continue
    if (chunk.content) content += chunk.content
    if (chunk.reasoning) reasoning += chunk.reasoning
    if (chunk.content || chunk.reasoning) onChunk?.(chunk)
  }
  return { content, reasoning: reasoning || undefined }
}

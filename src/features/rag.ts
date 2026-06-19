import type { DocumentChunk } from '../types'
import { embedText, rankBySimilarity } from './embeddings'
import { getChunksForChat, saveChunks } from '../storage/documentStore'

const CHUNK_SIZE = 800
const CHUNK_OVERLAP = 100

function createId() {
  return crypto.randomUUID()
}

export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const chunks: string[] = []
  let start = 0

  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length)
    chunks.push(normalized.slice(start, end))
    if (end >= normalized.length) break
    start = end - CHUNK_OVERLAP
  }

  return chunks
}

export async function indexDocument(
  chatId: string,
  documentId: string,
  text: string,
  providerId = 'gemini',
  useLocalEmbeddings = false,
): Promise<DocumentChunk[]> {
  const pieces = chunkText(text)
  const chunks: DocumentChunk[] = []

  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i]
    let embedding: number[] | undefined
    try {
      embedding = await embedText(piece, providerId, useLocalEmbeddings)
    } catch {
      embedding = undefined
    }

    chunks.push({
      id: createId(),
      documentId,
      chatId,
      index: i,
      text: piece,
      embedding,
    })
  }

  await saveChunks(chunks)
  return chunks
}

export async function searchRelevantChunks(
  chatId: string,
  query: string,
  topK = 4,
  providerId = 'gemini',
  useLocalEmbeddings = false,
): Promise<{ text: string; score: number }[]> {
  const chunks = await getChunksForChat(chatId)
  if (chunks.length === 0) return []

  const queryEmbedding = await embedText(query, providerId, useLocalEmbeddings)
  const ranked = rankBySimilarity(queryEmbedding, chunks, topK)
  return ranked.map((r) => ({ text: r.text, score: r.score }))
}

export function formatRagContext(results: { text: string; score: number }[]): string {
  if (results.length === 0) return ''
  const blocks = results.map((r, i) => `[${i + 1}] ${r.text}`)
  return `Relevant document excerpts:\n\n${blocks.join('\n\n')}`
}

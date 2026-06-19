import type { DocumentChunk, StoredDocument } from '../types'
import { getDB } from './db'

function createId() {
  return crypto.randomUUID()
}

export async function listDocuments(chatId: string): Promise<StoredDocument[]> {
  const db = await getDB()
  return db.getAllFromIndex('documents', 'by-chat', chatId)
}

export async function getDocument(id: string): Promise<StoredDocument | undefined> {
  const db = await getDB()
  return db.get('documents', id)
}

export async function saveDocument(
  chatId: string,
  name: string,
  mimeType: string,
  size: number,
  text: string,
): Promise<StoredDocument> {
  const doc: StoredDocument = {
    id: createId(),
    chatId,
    name,
    mimeType,
    size,
    text,
    createdAt: Date.now(),
  }
  const db = await getDB()
  await db.put('documents', doc)
  return doc
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDB()
  const chunks = await db.getAllFromIndex('chunks', 'by-document', id)
  const tx = db.transaction(['documents', 'chunks'], 'readwrite')
  await tx.objectStore('documents').delete(id)
  for (const chunk of chunks) {
    await tx.objectStore('chunks').delete(chunk.id)
  }
  await tx.done
}

export async function saveChunks(chunks: DocumentChunk[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('chunks', 'readwrite')
  for (const chunk of chunks) {
    await tx.store.put(chunk)
  }
  await tx.done
}

export async function getChunksForChat(chatId: string): Promise<DocumentChunk[]> {
  const db = await getDB()
  return db.getAllFromIndex('chunks', 'by-chat', chatId)
}

export async function deleteChunksForDocument(documentId: string): Promise<void> {
  const db = await getDB()
  const chunks = await db.getAllFromIndex('chunks', 'by-document', documentId)
  const tx = db.transaction('chunks', 'readwrite')
  for (const chunk of chunks) {
    await tx.store.delete(chunk.id)
  }
  await tx.done
}

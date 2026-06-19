import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { AppSettings, ChatSession, DocumentChunk, StoredDocument, UsageStats } from '../types'

interface ChatDB extends DBSchema {
  chats: {
    key: string
    value: ChatSession
    indexes: { 'by-updated': number }
  }
  settings: {
    key: string
    value: (AppSettings | UsageStats) & { key: string }
  }
  documents: {
    key: string
    value: StoredDocument
    indexes: { 'by-chat': string }
  }
  chunks: {
    key: string
    value: DocumentChunk
    indexes: { 'by-chat': string; 'by-document': string }
  }
}

const DB_NAME = 'freerouter-chat'
const DB_VERSION = 2

let dbPromise: Promise<IDBPDatabase<ChatDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ChatDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const chatStore = db.createObjectStore('chats', { keyPath: 'id' })
          chatStore.createIndex('by-updated', 'updatedAt')
          db.createObjectStore('settings', { keyPath: 'key' })
        }
        if (oldVersion < 2) {
          const docStore = db.createObjectStore('documents', { keyPath: 'id' })
          docStore.createIndex('by-chat', 'chatId')
          const chunkStore = db.createObjectStore('chunks', { keyPath: 'id' })
          chunkStore.createIndex('by-chat', 'chatId')
          chunkStore.createIndex('by-document', 'documentId')
        }
      },
    })
  }
  return dbPromise
}

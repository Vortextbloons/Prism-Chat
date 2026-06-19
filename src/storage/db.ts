import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { AppSettings, ChatSession, UsageStats } from '../types'

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
}

const DB_NAME = 'freerouter-chat'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<ChatDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ChatDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const chatStore = db.createObjectStore('chats', { keyPath: 'id' })
        chatStore.createIndex('by-updated', 'updatedAt')

        db.createObjectStore('settings', { keyPath: 'key' })
      },
    })
  }
  return dbPromise
}

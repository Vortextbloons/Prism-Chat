import type { ChatSession, StoredMessage } from '../types'
import { getDB } from './db'

function createId() {
  return crypto.randomUUID()
}

export async function listChats(): Promise<ChatSession[]> {
  const db = await getDB()
  const chats = await db.getAllFromIndex('chats', 'by-updated')
  return chats.reverse()
}

export async function getChat(id: string): Promise<ChatSession | undefined> {
  const db = await getDB()
  return db.get('chats', id)
}

export async function createChat(
  partial?: Partial<Pick<ChatSession, 'title' | 'systemPrompt' | 'provider' | 'model'>>,
): Promise<ChatSession> {
  const now = Date.now()
  const chat: ChatSession = {
    id: createId(),
    title: partial?.title ?? 'New chat',
    messages: [],
    systemPrompt: partial?.systemPrompt ?? 'You are a helpful assistant.',
    provider: partial?.provider ?? 'gemini',
    model: partial?.model ?? 'gemini-2.0-flash',
    createdAt: now,
    updatedAt: now,
  }
  const db = await getDB()
  await db.put('chats', chat)
  return chat
}

export async function saveChat(chat: ChatSession): Promise<void> {
  const db = await getDB()
  await db.put('chats', { ...chat, updatedAt: Date.now() })
}

export async function deleteChat(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('chats', id)
}

export async function addMessage(
  chatId: string,
  message: Omit<StoredMessage, 'id' | 'createdAt'>,
): Promise<StoredMessage> {
  const chat = await getChat(chatId)
  if (!chat) throw new Error('Chat not found')

  const stored: StoredMessage = {
    ...message,
    id: createId(),
    createdAt: Date.now(),
  }
  chat.messages.push(stored)

  if (message.role === 'user' && chat.messages.filter((m) => m.role === 'user').length === 1) {
    chat.title = message.content.slice(0, 48) || 'New chat'
  }

  await saveChat(chat)
  return stored
}

export async function updateMessage(
  chatId: string,
  messageId: string,
  content: string,
): Promise<void> {
  const chat = await getChat(chatId)
  if (!chat) throw new Error('Chat not found')

  const msg = chat.messages.find((m) => m.id === messageId)
  if (!msg) throw new Error('Message not found')

  msg.content = content
  await saveChat(chat)
}

export async function exportChatAsJson(chat: ChatSession): Promise<string> {
  return JSON.stringify(chat, null, 2)
}

export async function exportChatAsMarkdown(chat: ChatSession): Promise<string> {
  const lines = [`# ${chat.title}`, '', `Provider: ${chat.provider} / ${chat.model}`, '']
  for (const msg of chat.messages) {
    const label = msg.role === 'assistant' ? 'Assistant' : msg.role === 'system' ? 'System' : 'You'
    lines.push(`## ${label}`, '', msg.content, '')
  }
  return lines.join('\n')
}

export async function importChatFromJson(json: string): Promise<ChatSession> {
  const parsed = JSON.parse(json) as ChatSession
  if (!parsed.id || !Array.isArray(parsed.messages)) {
    throw new Error('Invalid chat export')
  }
  const chat: ChatSession = {
    ...parsed,
    id: createId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await saveChat(chat)
  return chat
}

import type { ChatSession, StoredMessage } from '../types'
import { coerceMessageText, coerceReasoningText } from '../features/messageText'
import { getDB } from './db'

function createId() {
  return crypto.randomUUID()
}

function normalizeMessage(message: StoredMessage): StoredMessage {
  const content = coerceMessageText(message.content)
  const reasoning = coerceReasoningText(message.reasoning)
  if (content === message.content && reasoning === message.reasoning) return message
  return {
    ...message,
    content,
    ...(reasoning ? { reasoning } : {}),
  }
}

function normalizeChat(chat: ChatSession): ChatSession {
  const messages = chat.messages.map(normalizeMessage)
  const changed = messages.some((m, i) => m !== chat.messages[i])
  return changed ? { ...chat, messages } : chat
}

export async function listChats(): Promise<ChatSession[]> {
  const db = await getDB()
  const chats = await db.getAllFromIndex('chats', 'by-updated')
  return chats.reverse().map(normalizeChat)
}

export async function getChat(id: string): Promise<ChatSession | undefined> {
  const db = await getDB()
  const chat = await db.get('chats', id)
  return chat ? normalizeChat(chat) : undefined
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
    model: partial?.model ?? 'gemini-2.5-flash',
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
  reasoning?: string,
): Promise<void> {
  const chat = await getChat(chatId)
  if (!chat) throw new Error('Chat not found')

  const msg = chat.messages.find((m) => m.id === messageId)
  if (!msg) throw new Error('Message not found')

  msg.content = coerceMessageText(content)
  if (reasoning !== undefined) {
    const normalized = coerceReasoningText(reasoning)
    if (normalized) msg.reasoning = normalized
    else delete msg.reasoning
  }
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

function isValidMessage(value: unknown): value is Omit<StoredMessage, 'id' | 'createdAt'> {
  if (!value || typeof value !== 'object') return false
  const msg = value as Record<string, unknown>
  return (
    (msg.role === 'system' || msg.role === 'user' || msg.role === 'assistant') &&
    typeof msg.content === 'string'
  )
}

export async function importChatFromJson(json: string): Promise<ChatSession> {
  const parsed = JSON.parse(json) as Partial<ChatSession>
  if (!parsed.id || !Array.isArray(parsed.messages)) {
    throw new Error('Invalid chat export')
  }
  if (!parsed.messages.every(isValidMessage)) {
    throw new Error('Invalid chat export: messages must have role and content')
  }

  const now = Date.now()
  const chat: ChatSession = {
    id: createId(),
    title: typeof parsed.title === 'string' && parsed.title ? parsed.title : 'New chat',
    messages: parsed.messages.map((msg) => ({
      ...msg,
      id: createId(),
      createdAt: now,
    })),
    systemPrompt:
      typeof parsed.systemPrompt === 'string' && parsed.systemPrompt
        ? parsed.systemPrompt
        : 'You are a helpful assistant.',
    provider: typeof parsed.provider === 'string' && parsed.provider ? parsed.provider : 'gemini',
    model: typeof parsed.model === 'string' && parsed.model ? parsed.model : 'gemini-2.5-flash',
    createdAt: now,
    updatedAt: now,
  }
  await saveChat(chat)
  return chat
}

import { useEffect, useRef, useState } from 'react'
import type { AppSettings, ChatSession } from '../types'
import { ProviderError } from '../types'
import {
  addMessage,
  exportChatAsJson,
  exportChatAsMarkdown,
  saveChat,
  updateMessage,
} from '../storage/chatStore'
import { recordUsage } from '../storage/settingsStore'
import { buildContextMessages } from '../features/contextManager'
import { getToolPrompt, type ChatToolId } from '../features/chatTools'
import { estimateMessagesTokens, estimateTokens } from '../features/tokenCounter'
import { collectStream } from '../features/streaming'
import { sendChat, streamChat } from '../providers'
import { getApiKey } from '../config/loadProviders'
import { getEnabledProviders, getProvider, getProviderModels } from '../providers/registry'
import {
  sendWithFallback,
  tryStreamThenFallback,
  type FallbackAttempt,
} from '../router/fallbackRouter'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { SelectDropdown } from './SelectDropdown'
import { ChatToolbar } from './ChatToolbar'
import { SystemPromptPanel } from './SystemPromptPanel'

type ChatViewProps = {
  chat: ChatSession
  settings: AppSettings
  sidebarCollapsed?: boolean
  onToggleSidebar?: () => void
  onChatUpdated: (chat: ChatSession) => void
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function formatFallbackNotice(attempts: FallbackAttempt[], provider: string): string | null {
  if (attempts.length === 0) return null
  const failed = attempts.map((a) => getProvider(a.provider)?.name ?? a.provider).join(', ')
  const used = getProvider(provider)?.name ?? provider
  return `Routed to ${used} after ${failed} failed.`
}

export function ChatView({ chat, settings, sidebarCollapsed, onToggleSidebar, onChatUpdated }: ChatViewProps) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)
  const [systemPromptDraft, setSystemPromptDraft] = useState(chat.systemPrompt)
  const [streamPreview, setStreamPreview] = useState<{ id: string; content: string } | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)
  const streamTextRef = useRef('')
  const streamRafRef = useRef<number | null>(null)
  const enabledProviders = getEnabledProviders()

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    const el = scrollRef.current
    if (!el || !autoScrollRef.current) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      autoScrollRef.current = distance < 100
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    scrollToBottom('auto')
  }, [chat.id])

  useEffect(() => {
    setSystemPromptDraft(chat.systemPrompt)
  }, [chat.systemPrompt])

  useEffect(() => {
    return () => {
      if (streamRafRef.current !== null) {
        cancelAnimationFrame(streamRafRef.current)
      }
    }
  }, [])

  const scheduleStreamPreview = (messageId: string) => {
    if (streamRafRef.current !== null) return
    streamRafRef.current = requestAnimationFrame(() => {
      streamRafRef.current = null
      setStreamPreview({ id: messageId, content: streamTextRef.current })
      scrollToBottom('auto')
    })
  }

  const flushStreamPreview = (messageId: string) => {
    if (streamRafRef.current !== null) {
      cancelAnimationFrame(streamRafRef.current)
      streamRafRef.current = null
    }
    setStreamPreview({ id: messageId, content: streamTextRef.current })
    scrollToBottom('auto')
  }

  const updateProvider = async (provider: string) => {
    const config = getProvider(provider)
    const updated = {
      ...chat,
      provider,
      model: config?.defaultModel ?? chat.model,
    }
    await saveChat(updated)
    onChatUpdated(updated)
  }

  const updateModel = async (model: string) => {
    const updated = { ...chat, model }
    await saveChat(updated)
    onChatUpdated(updated)
  }

  const saveSystemPrompt = async () => {
    const updated = {
      ...chat,
      systemPrompt: systemPromptDraft.trim() || 'You are a helpful assistant.',
    }
    await saveChat(updated)
    onChatUpdated(updated)
    setShowSystemPrompt(false)
  }

  const runCompletion = async (userText: string) => {
    const apiKey = getApiKey(chat.provider)
    if (!apiKey && !settings.autoFallback) {
      setError(
        `${getProvider(chat.provider)?.name ?? chat.provider} is not configured. Add its API key in src/config/providers.json`,
      )
      return
    }

    setError(null)
    setNotice(null)
    setSending(true)
    autoScrollRef.current = true

    const userMsg = await addMessage(chat.id, { role: 'user', content: userText })
    let currentChat: ChatSession = {
      ...chat,
      messages: [...chat.messages, userMsg],
      updatedAt: Date.now(),
    }
    onChatUpdated(currentChat)
    scrollToBottom('smooth')

    const requestMessages = buildContextMessages(
      chat.systemPrompt,
      currentChat.messages.map((m) => ({ role: m.role, content: m.content })),
      settings.maxContextTokens,
    )

    const request = {
      provider: chat.provider,
      model: chat.model,
      messages: requestMessages,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      stream: settings.streamResponses,
    }

    const inputTokens = estimateMessagesTokens(requestMessages)
    let assistantContent = ''
    let assistantId = ''
    let usedProvider = chat.provider

    try {
      const placeholder = await addMessage(chat.id, { role: 'assistant', content: '' })
      assistantId = placeholder.id
      streamTextRef.current = ''

      currentChat = {
        ...currentChat,
        messages: [...currentChat.messages, placeholder],
      }
      onChatUpdated(currentChat)
      scrollToBottom('smooth')

      const onChunk = (chunk: string) => {
        streamTextRef.current += chunk
        scheduleStreamPreview(assistantId)
      }

      let result
      if (settings.autoFallback) {
        if (settings.streamResponses) {
          result = await tryStreamThenFallback(
            request,
            settings.routeMode,
            chat.provider,
            onChunk,
          )
        } else {
          result = await sendWithFallback(request, settings.routeMode, chat.provider)
          streamTextRef.current = result.content
          flushStreamPreview(assistantId)
        }
      } else if (settings.streamResponses && apiKey) {
        const stream = streamChat(apiKey, request)
        assistantContent = await collectStream(stream, onChunk)
        result = { content: assistantContent, provider: chat.provider, model: chat.model, attempts: [] }
      } else if (apiKey) {
        assistantContent = await sendChat(apiKey, { ...request, stream: false })
        result = { content: assistantContent, provider: chat.provider, model: chat.model, attempts: [] }
        streamTextRef.current = assistantContent
        flushStreamPreview(assistantId)
      } else {
        throw new ProviderError('No API key for selected provider', 'unknown')
      }

      assistantContent = result.content
      usedProvider = result.provider
      flushStreamPreview(assistantId)

      currentChat = {
        ...currentChat,
        messages: currentChat.messages.map((m) =>
          m.id === assistantId ? { ...m, content: assistantContent } : m,
        ),
      }

      if (result.provider !== chat.provider || result.model !== chat.model) {
        currentChat = { ...currentChat, provider: result.provider, model: result.model }
      }

      onChatUpdated(currentChat)
      await updateMessage(chat.id, assistantId, assistantContent)

      const noticeText = formatFallbackNotice(result.attempts, result.provider)
      if (noticeText) setNotice(noticeText)

      await recordUsage(usedProvider, inputTokens, estimateTokens(assistantContent))
    } catch (err) {
      const message =
        err instanceof ProviderError
          ? `${getProvider(usedProvider)?.name ?? usedProvider}: ${err.message}`
          : err instanceof Error
            ? err.message
            : 'Something went wrong'

      setError(message)
      await recordUsage(usedProvider, inputTokens, 0, true)

      if (assistantId) {
        const failedContent = streamTextRef.current || '[Response failed]'
        await updateMessage(chat.id, assistantId, failedContent)
        onChatUpdated({
          ...currentChat,
          messages: currentChat.messages.map((m) =>
            m.id === assistantId ? { ...m, content: failedContent } : m,
          ),
        })
      }
    } finally {
      setStreamPreview(null)
      setSending(false)
      await saveChat(currentChat)
      scrollToBottom('auto')
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    await runCompletion(text)
  }

  const handleTool = async (toolId: ChatToolId) => {
    if (sending || chat.messages.length === 0) return
    await runCompletion(getToolPrompt(toolId))
  }

  const handleExportJson = async () => {
    const json = await exportChatAsJson(chat)
    downloadFile(json, `${chat.title.slice(0, 32)}.json`, 'application/json')
  }

  const handleExportMarkdown = async () => {
    const md = await exportChatAsMarkdown(chat)
    downloadFile(md, `${chat.title.slice(0, 32)}.md`, 'text/markdown')
  }

  return (
    <main className="chat-view">
      <header className="chat-header">
        {sidebarCollapsed && onToggleSidebar && (
          <button type="button" className="btn-icon sidebar-open-btn" onClick={onToggleSidebar} title="Show sidebar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        )}
        <h2 className="chat-title">{chat.title}</h2>
        <div className="chat-controls">
          <SelectDropdown
            value={chat.provider}
            options={enabledProviders.map((p) => ({ value: p.id, label: p.name }))}
            onChange={(id) => void updateProvider(id)}
            disabled={sending}
          />
          <SelectDropdown
            value={chat.model}
            options={getProviderModels(chat.provider).map((m) => ({
              value: m.id,
              label: m.name,
            }))}
            onChange={(id) => void updateModel(id)}
            disabled={sending}
          />
        </div>
        {settings.autoFallback && (
          <span className="route-badge" title={`Route mode: ${settings.routeMode}`}>
            Auto-route
          </span>
        )}
      </header>

      <ChatToolbar
        onTool={(id) => void handleTool(id)}
        onExportJson={() => void handleExportJson()}
        onExportMarkdown={() => void handleExportMarkdown()}
        onEditSystemPrompt={() => setShowSystemPrompt(true)}
        disabled={sending}
      />

      {showSystemPrompt && (
        <SystemPromptPanel
          value={systemPromptDraft}
          onChange={setSystemPromptDraft}
          onSave={() => void saveSystemPrompt()}
          onClose={() => setShowSystemPrompt(false)}
        />
      )}

      {(notice || error) && (
        <div className="chat-banners">
          {notice && (
            <div className="notice-banner" role="status">
              {notice}
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
        </div>
      )}

      <div className="chat-scroll-region" ref={scrollRef}>
        <MessageList
          messages={chat.messages}
          sending={sending}
          streamPreview={streamPreview}
        />
      </div>

      <ChatInput
        value={input}
        onChange={setInput}
        onSend={() => void handleSend()}
        disabled={sending}
        placeholder={sending ? 'Prism is thinking…' : 'Message Prism…'}
      />
    </main>
  )
}

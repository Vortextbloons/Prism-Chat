import { useEffect, useRef, useState } from 'react'
import type { AppSettings, ChatMessage, ChatSession, ImageAttachment, StreamChunk } from '../types'
import { ProviderError } from '../types'
import {
  addMessage,
  exportChatAsJson,
  exportChatAsMarkdown,
  saveChat,
  updateMessage,
} from '../storage/chatStore'
import { recordUsage, saveSettings } from '../storage/settingsStore'
import {
  buildContextMessagesAsync,
  formatMessagesForSummary,
} from '../features/contextManager'
import {
  getToolPrompt,
  getRewritePrompt,
  ROUTE_MODE_PRESETS,
  type ChatToolId,
} from '../features/chatTools'
import { compareModels, type CompareResult } from '../features/compareModels'
import { runChatWithTools } from '../features/toolRunner'
import { estimateMessagesTokens, estimateTokens } from '../features/tokenCounter'
import { collectStream } from '../features/streaming'
import { coerceMessageText, coerceReasoningText } from '../features/messageText'
import { completeChat, sendChat, streamChat } from '../providers'
import {
  getEffectiveApiKey,
  getEnabledProviders,
  getProvider,
  getProviderModels,
  isProviderAvailable,
} from '../config/loadProviders'
import { modelSupports } from '../router/capabilityRouter'
import {
  sendWithFallback,
  tryStreamThenFallback,
  type FallbackAttempt,
} from '../router/fallbackRouter'
import { formatRagContext, indexDocument, searchRelevantChunks } from '../features/rag'
import { isSupportedDocument, extractDocumentText } from '../features/documentParser'
import { saveDocument } from '../storage/documentStore'
import { buildContextMessages } from '../features/contextManager'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ChatTopBar } from './ChatTopBar'
import { SystemPromptPanel } from './SystemPromptPanel'
import { DocumentPanel } from './DocumentPanel'
import { CompareModelsPanel } from './CompareModelsPanel'
import { ImageGenPanel } from './ImageGenPanel'

type ChatViewProps = {
  chat: ChatSession
  settings: AppSettings
  isMobile?: boolean
  sidebarCollapsed?: boolean
  onToggleSidebar?: () => void
  onChatUpdated: (chat: ChatSession) => void
  onSettingsChange?: (settings: AppSettings) => void
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

export function ChatView({ chat, settings, isMobile, sidebarCollapsed, onToggleSidebar, onChatUpdated, onSettingsChange }: ChatViewProps) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)
  const [showDocuments, setShowDocuments] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [showImageGen, setShowImageGen] = useState(false)
  const [compareResults, setCompareResults] = useState<CompareResult[] | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [systemPromptDraft, setSystemPromptDraft] = useState(chat.systemPrompt)
  const [streamPreview, setStreamPreview] = useState<{
    id: string
    content: string
    reasoning?: string
  } | null>(null)
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([])
  const [hasDocuments, setHasDocuments] = useState(Boolean(chat.documentIds?.length))

  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)
  const streamTextRef = useRef('')
  const streamReasoningRef = useRef('')
  const streamRafRef = useRef<number | null>(null)
  const enabledProviders = getEnabledProviders()
  const routeMode = chat.routeModeOverride ?? settings.routeMode
  const supportsImages = modelSupports(chat.provider, chat.model, 'image')
  const supportsTools = modelSupports(chat.provider, chat.model, 'tools')
  const supportsImageGen = true

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
      setStreamPreview({
        id: messageId,
        content: coerceMessageText(streamTextRef.current),
        reasoning: coerceReasoningText(streamReasoningRef.current),
      })
      scrollToBottom('auto')
    })
  }

  const flushStreamPreview = (messageId: string) => {
    if (streamRafRef.current !== null) {
      cancelAnimationFrame(streamRafRef.current)
      streamRafRef.current = null
    }
    setStreamPreview({
      id: messageId,
      content: coerceMessageText(streamTextRef.current),
      reasoning: coerceReasoningText(streamReasoningRef.current),
    })
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

  const applyModePreset = async (mode: 'coding' | 'best-free' | 'default') => {
    if (mode === 'default') {
      const updated = {
        ...chat,
        routeModeOverride: undefined,
        systemPrompt: 'You are a helpful assistant.',
      }
      setSystemPromptDraft(updated.systemPrompt)
      await saveChat(updated)
      onChatUpdated(updated)
      setNotice('Chat mode restored')
      return
    }

    const preset = ROUTE_MODE_PRESETS[mode]
    const updated = {
      ...chat,
      routeModeOverride: preset.routeMode,
      systemPrompt: preset.systemPrompt,
    }
    setSystemPromptDraft(preset.systemPrompt)
    await saveChat(updated)
    onChatUpdated(updated)
    setNotice(`${preset.label} mode active`)
  }

  const handleDocumentUpload = async (files: FileList) => {
    setShowDocuments(true)
    for (const file of Array.from(files)) {
      if (!isSupportedDocument(file)) continue
      const text = await extractDocumentText(file)
      const doc = await saveDocument(chat.id, file.name, file.type, file.size, text)
      await indexDocument(chat.id, doc.id, text, chat.provider, settings.useLocalEmbeddings)
    }
    setHasDocuments(true)
    const updated = {
      ...chat,
      documentIds: [...(chat.documentIds ?? []), 'updated'],
    }
    onChatUpdated(updated)
  }

  const summarizeDropped = async (dropped: ChatMessage[]) => {
    if (!isProviderAvailable(chat.provider)) return null

    const apiKey = getEffectiveApiKey(chat.provider)

    const text = formatMessagesForSummary(dropped)
    const summary = await sendChat(apiKey, {
      provider: chat.provider,
      model: chat.model,
      messages: [
        {
          role: 'user',
          content: `Summarize this conversation history concisely for context. Keep key facts, decisions, and names.\n\n${text}`,
        },
      ],
      maxTokens: 512,
      stream: false,
    })
    return summary
  }

  const runCompletion = async (userText: string, images?: ImageAttachment[]) => {
    if (!isProviderAvailable(chat.provider) && !settings.autoFallback) {
      setError(
        `${getProvider(chat.provider)?.name ?? chat.provider} is not available. Try another provider or enable auto-fallback.`,
      )
      return
    }

    const apiKey = getEffectiveApiKey(chat.provider)

    setError(null)
    setNotice(null)
    setSending(true)
    autoScrollRef.current = true

    const userMsg = await addMessage(chat.id, {
      role: 'user',
      content: userText,
      ...(images?.length ? { images } : {}),
    })
    let currentChat: ChatSession = {
      ...chat,
      messages: [...chat.messages, userMsg],
      updatedAt: Date.now(),
    }
    onChatUpdated(currentChat)
    scrollToBottom('smooth')

    let history = currentChat.messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.images ? { images: m.images } : {}),
    }))

    if (hasDocuments) {
      try {
        const chunks = await searchRelevantChunks(
          chat.id,
          userText,
          4,
          chat.provider,
          settings.useLocalEmbeddings,
        )
        const ragContext = formatRagContext(chunks)
        if (ragContext) {
          history = [{ role: 'system' as const, content: ragContext }, ...history]
        }
      } catch {
        // RAG is best-effort
      }
    }

    const requestMessages = settings.summarizeContext
      ? await buildContextMessagesAsync(
          chat.systemPrompt,
          history,
          settings.maxContextTokens,
          summarizeDropped,
        )
      : buildContextMessages(chat.systemPrompt, history, settings.maxContextTokens)

    const request = {
      provider: chat.provider,
      model: chat.model,
      messages: requestMessages,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      stream: settings.streamResponses,
      jsonMode: settings.jsonMode,
    }

    const inputTokens = estimateMessagesTokens(requestMessages)
    let assistantContent = ''
    let assistantId = ''
    let usedProvider = chat.provider

    try {
      const placeholder = await addMessage(chat.id, { role: 'assistant', content: '' })
      assistantId = placeholder.id
      streamTextRef.current = ''
      streamReasoningRef.current = ''

      currentChat = {
        ...currentChat,
        messages: [...currentChat.messages, placeholder],
      }
      onChatUpdated(currentChat)
      scrollToBottom('smooth')

      const onChunk = (chunk: StreamChunk | string) => {
        if (typeof chunk === 'string') {
          streamTextRef.current += chunk
        } else {
          if (chunk.content) streamTextRef.current += coerceMessageText(chunk.content)
          if (chunk.reasoning) {
            streamReasoningRef.current += coerceReasoningText(chunk.reasoning) ?? ''
          }
        }
        scheduleStreamPreview(assistantId)
      }

      const useTools = settings.enableTools && supportsTools && apiKey

      let result: {
        content: string
        reasoning?: string
        provider: string
        model: string
        attempts: FallbackAttempt[]
      } | undefined

      if (useTools) {
        const toolResult = await runChatWithTools(apiKey, { ...request, stream: false })
        assistantContent = toolResult.content
        streamTextRef.current = assistantContent
        flushStreamPreview(assistantId)
        result = {
          content: assistantContent,
          provider: chat.provider,
          model: chat.model,
          attempts: [] as FallbackAttempt[],
        }
        currentChat = {
          ...currentChat,
          messages: currentChat.messages.map((m) =>
            m.id === assistantId
              ? { ...m, content: assistantContent, toolCalls: toolResult.toolCalls }
              : m,
          ),
        }
        onChatUpdated(currentChat)
      } else if (settings.autoFallback) {
        if (settings.streamResponses) {
          result = await tryStreamThenFallback(
            request,
            routeMode,
            chat.provider,
            onChunk,
          )
        } else {
          result = await sendWithFallback(request, routeMode, chat.provider)
          streamTextRef.current = result.content
          flushStreamPreview(assistantId)
        }
      } else if (settings.streamResponses && apiKey) {
        const stream = streamChat(apiKey, request)
        const collected = await collectStream(stream, onChunk)
        assistantContent = collected.content
        result = {
          content: collected.content,
          reasoning: collected.reasoning,
          provider: chat.provider,
          model: chat.model,
          attempts: [],
        }
      } else if (apiKey) {
        const completed = await completeChat(apiKey, { ...request, stream: false })
        assistantContent = completed.content
        streamTextRef.current = assistantContent
        streamReasoningRef.current = completed.reasoning ?? ''
        flushStreamPreview(assistantId)
        result = {
          content: completed.content,
          reasoning: completed.reasoning,
          provider: chat.provider,
          model: chat.model,
          attempts: [],
        }
      } else {
        throw new ProviderError('No API key for selected provider', 'unknown')
      }

      assistantContent = coerceMessageText(result!.content)
      const assistantReasoning = coerceReasoningText(result!.reasoning)
      usedProvider = result!.provider
      if (assistantReasoning) streamReasoningRef.current = assistantReasoning
      flushStreamPreview(assistantId)

      if (!useTools) {
        currentChat = {
          ...currentChat,
          messages: currentChat.messages.map((m) =>
            m.id === assistantId
              ? { ...m, content: assistantContent, reasoning: assistantReasoning }
              : m,
          ),
        }
      }

      if (result!.provider !== chat.provider || result!.model !== chat.model) {
        currentChat = { ...currentChat, provider: result!.provider, model: result!.model }
      }

      onChatUpdated(currentChat)
      if (!useTools) {
        await updateMessage(chat.id, assistantId, assistantContent, assistantReasoning)
      }

      const noticeText = formatFallbackNotice(result!.attempts, result!.provider)
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
    if ((!text && pendingImages.length === 0) || sending) return
    const images = pendingImages.length ? [...pendingImages] : undefined
    setInput('')
    setPendingImages([])
    await runCompletion(text || 'Describe this image.', images)
  }

  const handleTool = async (toolId: ChatToolId) => {
    if (sending || chat.messages.length === 0) return
    await runCompletion(getToolPrompt(toolId))
  }

  const handleRewrite = async (messageId: string, content: string) => {
    if (sending) return
    await runCompletion(getRewritePrompt(content))
    void messageId
  }

  const handleCompare = async () => {
    const lastUser = [...chat.messages].reverse().find((m) => m.role === 'user')
    if (!lastUser || sending) return

    setShowCompare(true)
    setCompareLoading(true)
    setCompareResults(null)

    const results = await compareModels(
      {
        provider: chat.provider,
        model: chat.model,
        messages: [
          { role: 'system', content: chat.systemPrompt },
          { role: 'user', content: lastUser.content },
        ],
        temperature: settings.temperature,
        maxTokens: Math.min(settings.maxTokens, 1024),
        stream: false,
      },
      routeMode,
    )

    setCompareResults(results)
    setCompareLoading(false)
  }

  const handleImageGenerated = async (
    prompt: string,
    image: { mimeType: string; data: string },
  ) => {
    const userMsg = await addMessage(chat.id, {
      role: 'user',
      content: `Generate an image: ${prompt}`,
    })
    const assistantMsg = await addMessage(chat.id, {
      role: 'assistant',
      content: `Here's your generated image for "${prompt}":`,
      generatedImage: image,
    })
    const updated: ChatSession = {
      ...chat,
      messages: [...chat.messages, userMsg, assistantMsg],
      updatedAt: Date.now(),
    }
    await saveChat(updated)
    onChatUpdated(updated)
  }

  const handleExportJson = async () => {
    const json = await exportChatAsJson(chat)
    downloadFile(json, `${chat.title.slice(0, 32)}.json`, 'application/json')
  }

  const handleExportMarkdown = async () => {
    const md = await exportChatAsMarkdown(chat)
    downloadFile(md, `${chat.title.slice(0, 32)}.md`, 'text/markdown')
  }

  const toggleShowReasoning = async () => {
    const next = { ...settings, showReasoning: !settings.showReasoning }
    await saveSettings(next)
    onSettingsChange?.(next)
  }

  return (
    <main className="chat-view">
      <ChatTopBar
        isMobile={isMobile}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={onToggleSidebar}
        providers={enabledProviders.map((p) => ({ id: p.id, name: p.name }))}
        models={getProviderModels(chat.provider).map((m) => ({ id: m.id, name: m.name }))}
        provider={chat.provider}
        model={chat.model}
        onProviderChange={(id) => void updateProvider(id)}
        onModelChange={(id) => void updateModel(id)}
        activeRouteMode={routeMode}
        routeModeOverride={chat.routeModeOverride}
        autoFallback={settings.autoFallback}
        onModePreset={(mode) => void applyModePreset(mode)}
        onTool={(id) => void handleTool(id)}
        onToggleDocuments={() => setShowDocuments((v) => !v)}
        onCompareModels={() => void handleCompare()}
        onEditSystemPrompt={() => setShowSystemPrompt(true)}
        onExportJson={() => void handleExportJson()}
        onExportMarkdown={() => void handleExportMarkdown()}
        hasDocuments={hasDocuments}
        showReasoning={settings.showReasoning}
        onToggleShowReasoning={() => void toggleShowReasoning()}
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

      {showDocuments && (
        <DocumentPanel
          chatId={chat.id}
          provider={chat.provider}
          useLocalEmbeddings={settings.useLocalEmbeddings}
          onClose={() => setShowDocuments(false)}
          onDocumentsChange={(ids) => {
            setHasDocuments(ids.length > 0)
            onChatUpdated({ ...chat, documentIds: ids })
          }}
        />
      )}

      {showCompare && (
        <CompareModelsPanel
          results={compareResults}
          loading={compareLoading}
          onClose={() => setShowCompare(false)}
        />
      )}

      {showImageGen && (
        <ImageGenPanel
          provider={chat.provider}
          onClose={() => setShowImageGen(false)}
          onGenerated={(prompt, image) => void handleImageGenerated(prompt, image)}
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
          showReasoning={settings.showReasoning}
          streamPreview={streamPreview}
          onRewrite={(id, content) => void handleRewrite(id, content)}
        />
      </div>

      <ChatInput
        value={input}
        onChange={setInput}
        onSend={() => void handleSend()}
        onAttachImages={(imgs) => setPendingImages((prev) => [...prev, ...imgs])}
        onAttachDocuments={(files) => void handleDocumentUpload(files)}
        onOpenImageGen={() => setShowImageGen(true)}
        pendingImages={pendingImages}
        onRemoveImage={(i) => setPendingImages((prev) => prev.filter((_, idx) => idx !== i))}
        disabled={sending}
        supportsImages={supportsImages}
        supportsImageGen={supportsImageGen}
        supportsSpeech
        placeholder={sending ? 'Prism is thinking…' : 'Message Prism…'}
      />
    </main>
  )
}

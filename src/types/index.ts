export type MessageRole = 'system' | 'user' | 'assistant'

export type ImageAttachment = {
  mimeType: string
  data: string
}

export type ChatMessage = {
  role: MessageRole
  content: string
  images?: ImageAttachment[]
}

export type ChatRequest = {
  provider: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
  jsonMode?: boolean
  tools?: ToolDefinition[]
  toolResults?: ToolResultMessage[]
}

export type ToolDefinition = {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description?: string }>
    required?: string[]
  }
}

export type ToolCall = {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export type ToolResultMessage = {
  role: 'tool'
  toolCallId: string
  name: string
  content: string
}

export type StoredMessage = ChatMessage & {
  id: string
  createdAt: number
  images?: ImageAttachment[]
  toolCalls?: ToolCall[]
  generatedImage?: ImageAttachment
  reasoning?: string
}

export type ProviderErrorKind =
  | 'invalid_key'
  | 'rate_limit'
  | 'cors'
  | 'network'
  | 'unknown'

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind
  readonly status?: number

  constructor(message: string, kind: ProviderErrorKind, status?: number) {
    super(message)
    this.name = 'ProviderError'
    this.kind = kind
    this.status = status
  }
}

export type StreamChunk = {
  content: string
  reasoning?: string
  done?: boolean
}

export type ModelCapability =
  | 'text'
  | 'streaming'
  | 'image'
  | 'tools'
  | 'json'
  | 'long-context'
  | 'embeddings'
  | 'speech'
  | 'image-gen'

export type ModelConfig = {
  id: string
  name: string
  capabilities?: ModelCapability[]
}

export type ProviderConfig = {
  id: string
  name: string
  enabled: boolean
  apiKey: string
  baseUrl: string
  chatPath?: string
  accountId?: string
  authHeader: 'Bearer' | 'x-api-key' | 'query'
  type: 'openai-compatible' | 'gemini' | 'huggingface' | 'cloudflare'
  defaultModel: string
  models: ModelConfig[]
  embeddingModel?: string
}

export type RouteMode =
  | 'default'
  | 'fast'
  | 'long-context'
  | 'open-source'
  | 'coding'
  | 'best-free'

export type ProvidersFile = {
  routes: Record<RouteMode, string[]>
  providers: ProviderConfig[]
}

export type ChatSession = {
  id: string
  title: string
  messages: StoredMessage[]
  systemPrompt: string
  provider: string
  model: string
  routeModeOverride?: RouteMode
  documentIds?: string[]
  createdAt: number
  updatedAt: number
}

export type StoredDocument = {
  id: string
  chatId: string
  name: string
  mimeType: string
  size: number
  text: string
  createdAt: number
}

export type DocumentChunk = {
  id: string
  documentId: string
  chatId: string
  index: number
  text: string
  embedding?: number[]
}

export type AppSettings = {
  theme: 'light' | 'dark' | 'system'
  defaultProvider: string
  defaultModel: string
  temperature: number
  maxTokens: number
  streamResponses: boolean
  routeMode: RouteMode
  autoFallback: boolean
  maxContextTokens: number
  summarizeContext: boolean
  jsonMode: boolean
  enableTools: boolean
  useLocalEmbeddings: boolean
  proxyBaseUrl: string
  showReasoning: boolean
}

export type ProviderHealthStatus =
  | 'unknown'
  | 'checking'
  | 'working'
  | 'rate_limited'
  | 'invalid_key'
  | 'error'

export type ProviderHealth = {
  status: ProviderHealthStatus
  message?: string
  checkedAt?: number
}

export type UsageStats = {
  inputTokens: number
  outputTokens: number
  requests: number
  failures: number
  byProvider: Record<string, { requests: number; failures: number }>
}

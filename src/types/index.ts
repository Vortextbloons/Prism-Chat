export type MessageRole = 'system' | 'user' | 'assistant'

export type ChatMessage = {
  role: MessageRole
  content: string
}

export type ChatRequest = {
  provider: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
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
  authHeader: 'Bearer' | 'x-api-key' | 'query'
  type: 'openai-compatible' | 'gemini' | 'huggingface' | 'cloudflare'
  defaultModel: string
  models: ModelConfig[]
}

export type RouteMode = 'default' | 'fast' | 'long-context' | 'open-source'

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
  createdAt: number
  updatedAt: number
}

export type StoredMessage = ChatMessage & {
  id: string
  createdAt: number
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

import type { ChatMessage, ChatRequest, ToolCall, ToolResultMessage } from '../types'
import { BUILTIN_TOOLS, executeTool } from './agentTools'
import { completeGemini } from '../providers/geminiProvider'
import { completeOpenAICompatible } from '../providers/openaiCompatibleProvider'
import { getProvider } from '../providers/registry'

const MAX_TOOL_ROUNDS = 4

export type ToolRunResult = {
  content: string
  toolCalls: ToolCall[]
}

async function completeOnce(
  apiKey: string,
  request: ChatRequest,
): Promise<{ content: string; toolCalls?: ToolCall[] }> {
  const config = getProvider(request.provider)
  if (!config) throw new Error(`Unknown provider: ${request.provider}`)

  if (config.type === 'gemini') {
    return completeGemini(apiKey, request)
  }
  if (config.type === 'openai-compatible') {
    return completeOpenAICompatible(request.provider, apiKey, request)
  }
  throw new Error(`Tools not supported for provider: ${request.provider}`)
}

export async function runChatWithTools(
  apiKey: string,
  request: ChatRequest,
): Promise<ToolRunResult> {
  const tools = request.tools ?? BUILTIN_TOOLS
  const allToolCalls: ToolCall[] = []
  const messages: ChatMessage[] = [...request.messages]
  const toolResults: ToolResultMessage[] = []

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await completeOnce(apiKey, {
      ...request,
      messages,
      tools,
      toolResults,
      stream: false,
    })

    if (!result.toolCalls?.length) {
      return { content: result.content, toolCalls: allToolCalls }
    }

    allToolCalls.push(...result.toolCalls)

    for (const call of result.toolCalls) {
      const output = executeTool(call.name, call.arguments)
      toolResults.push({
        role: 'tool',
        toolCallId: call.id,
        name: call.name,
        content: output,
      })
      messages.push({
        role: 'user',
        content: `Tool ${call.name} returned: ${output}`,
      })
    }
  }

  return {
    content: 'Tool loop limit reached. Please try a simpler request.',
    toolCalls: allToolCalls,
  }
}

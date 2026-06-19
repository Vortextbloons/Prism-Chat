import type { ToolCall, ToolDefinition } from '../types'

export const BUILTIN_TOOLS: ToolDefinition[] = [
  {
    name: 'get_current_time',
    description: 'Get the current date and time in the user local timezone.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'calculate',
    description: 'Evaluate a basic math expression (numbers, +, -, *, /, parentheses).',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'Math expression e.g. (2 + 3) * 4' },
      },
      required: ['expression'],
    },
  },
  {
    name: 'word_count',
    description: 'Count words and characters in a text string.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to analyze' },
      },
      required: ['text'],
    },
  },
]

function safeCalculate(expression: string): number {
  const cleaned = expression.replace(/[^0-9+\-*/().%\s]/g, '')
  if (!cleaned.trim()) throw new Error('Invalid expression')
  // eslint-disable-next-line no-new-func
  const result = Function(`"use strict"; return (${cleaned})`)()
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error('Expression did not evaluate to a number')
  }
  return result
}

export function executeTool(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'get_current_time':
      return new Date().toLocaleString()
    case 'calculate':
      return String(safeCalculate(String(args.expression ?? '')))
    case 'word_count': {
      const text = String(args.text ?? '')
      const words = text.trim() ? text.trim().split(/\s+/).length : 0
      return JSON.stringify({ words, characters: text.length })
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}

export function toolsToOpenAI(tools: ToolDefinition[]) {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

export function toolsToGemini(tools: ToolDefinition[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }))
}

export function extractToolCallsFromResponse(data: unknown): ToolCall[] {
  const response = data as {
    choices?: {
      message?: {
        tool_calls?: { id: string; function: { name: string; arguments: string } }[]
      }
    }[]
  }

  const raw = response.choices?.[0]?.message?.tool_calls
  if (!raw?.length) return []

  return raw.map((tc) => {
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(tc.function.arguments) as Record<string, unknown>
    } catch {
      args = {}
    }
    return {
      id: tc.id,
      name: tc.function.name,
      arguments: args,
    }
  })
}

export function extractGeminiToolCalls(data: unknown): ToolCall[] {
  const response = data as {
    candidates?: {
      content?: {
        parts?: { functionCall?: { name: string; args?: Record<string, unknown> } }[]
      }
    }[]
  }

  const parts = response.candidates?.[0]?.content?.parts ?? []
  const calls: ToolCall[] = []

  for (const part of parts) {
    if (part.functionCall) {
      calls.push({
        id: crypto.randomUUID(),
        name: part.functionCall.name,
        arguments: part.functionCall.args ?? {},
      })
    }
  }

  return calls
}

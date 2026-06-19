export const CHAT_TOOLS = {
  summarize: {
    label: 'Summarize',
    prompt: 'Summarize this entire conversation in clear bullet points.',
  },
  actionItems: {
    label: 'Action items',
    prompt: 'Extract all action items from this conversation as a numbered checklist.',
  },
  spec: {
    label: 'To spec',
    prompt: 'Turn this conversation into a structured technical spec with goals, requirements, and next steps.',
  },
  explain: {
    label: 'Explain',
    prompt: 'Explain the main ideas from this conversation in simple terms for a beginner.',
  },
  explainCode: {
    label: 'Explain code',
    prompt: 'Find any code in this conversation and explain what it does line by line for a beginner.',
  },
  markdown: {
    label: 'To markdown',
    prompt: 'Reformat the key content from this conversation as clean markdown documentation.',
  },
  rewrite: {
    label: 'Rewrite',
    prompt: 'Rewrite the last assistant message to be clearer, more concise, and better structured. Keep the same meaning.',
  },
} as const

export type ChatToolId = keyof typeof CHAT_TOOLS

export const ROUTE_MODE_PRESETS: Record<
  'coding' | 'best-free',
  { routeMode: 'coding' | 'best-free'; systemPrompt: string; label: string }
> = {
  coding: {
    label: 'Coding',
    routeMode: 'coding',
    systemPrompt:
      'You are an expert software engineer. Write clean, production-ready code with brief explanations. Prefer typed, tested solutions and mention edge cases.',
  },
  'best-free': {
    label: 'Best free',
    routeMode: 'best-free',
    systemPrompt:
      'You are a helpful assistant optimized for free-tier APIs. Be concise but thorough. Prefer practical, actionable answers.',
  },
}

export function getToolPrompt(toolId: ChatToolId): string {
  return CHAT_TOOLS[toolId].prompt
}

export function getRewritePrompt(content: string): string {
  return `Rewrite the following assistant message to be clearer and more concise. Keep the same meaning.\n\n---\n${content}\n---`
}

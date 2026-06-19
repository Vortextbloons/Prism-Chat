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
  markdown: {
    label: 'To markdown',
    prompt: 'Reformat the key content from this conversation as clean markdown documentation.',
  },
} as const

export type ChatToolId = keyof typeof CHAT_TOOLS

export function getToolPrompt(toolId: ChatToolId): string {
  return CHAT_TOOLS[toolId].prompt
}

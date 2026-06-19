/**
 * Cloudflare Worker proxy for Prism Chat.
 * Keeps API keys server-side; static frontend calls this worker.
 *
 * Deploy: npx wrangler deploy
 * Secrets: wrangler secret put GEMINI_API_KEY
 */

const UPSTREAM = {
  gemini: {
    base: 'https://generativelanguage.googleapis.com/v1beta',
    key: (env) => env.GEMINI_API_KEY,
    chat: async (env, body) => {
      const key = env.GEMINI_API_KEY
      const url = `${UPSTREAM.gemini.base}/models/${body.model}:generateContent?key=${encodeURIComponent(key)}`
      const messages = body.messages ?? []
      const system = messages.find((m) => m.role === 'system')
      const conversation = messages.filter((m) => m.role !== 'system')
      const payload = {
        contents: conversation.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: body.temperature ?? 0.7,
          maxOutputTokens: body.maxTokens ?? 4096,
        },
        ...(system ? { systemInstruction: { parts: [{ text: system.content }] } } : {}),
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) return { status: res.status, data }
      const text =
        data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
      return {
        status: 200,
        data: { choices: [{ message: { content: text } }] },
      }
    },
    embed: async (env, text) => {
      const model = 'text-embedding-004'
      const url = `${UPSTREAM.gemini.base}/models/${model}:embedContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${model}`,
          content: { parts: [{ text }] },
        }),
      })
      const data = await res.json()
      if (!res.ok) return { status: res.status, data }
      return { status: 200, data: { embedding: data.embedding?.values ?? [] } }
    },
  },
  openrouter: openAIUpstream('https://openrouter.ai/api/v1', (env) => env.OPENROUTER_API_KEY, {
    'HTTP-Referer': 'https://prism-chat.pages.dev',
    'X-Title': 'Prism Chat',
  }),
  groq: openAIUpstream('https://api.groq.com/openai/v1', (env) => env.GROQ_API_KEY),
  mistral: openAIUpstream('https://api.mistral.ai/v1', (env) => env.MISTRAL_API_KEY),
  cerebras: openAIUpstream('https://api.cerebras.ai/v1', (env) => env.CEREBRAS_API_KEY),
  huggingface: openAIUpstream('https://router.huggingface.co/v1', (env) => env.HUGGINGFACE_API_KEY),
}

function openAIUpstream(baseUrl, getKey, extraHeaders = {}) {
  return {
    base: baseUrl,
    key: getKey,
    chat: async (env, body) => {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getKey(env)}`,
          ...extraHeaders,
        },
        body: JSON.stringify({
          model: body.model,
          messages: body.messages,
          temperature: body.temperature ?? 0.7,
          max_tokens: body.maxTokens ?? 4096,
          stream: false,
        }),
      })
      const data = await res.json()
      return { status: res.status, data }
    },
  }
}

function corsHeaders(origin, allowed) {
  const allow = allowed.includes(origin) ? origin : allowed[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim())
    const origin = request.headers.get('Origin') ?? ''
    const headers = corsHeaders(origin, allowed)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers })
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers })
    }

    const url = new URL(request.url)
    const body = await request.json()

    if (url.pathname === '/v1/embed') {
      const provider = UPSTREAM[body.provider]
      if (!provider?.embed) {
        return Response.json({ error: 'Embedding not supported' }, { status: 400, headers })
      }
      if (!provider.key(env)) {
        return Response.json({ error: 'Provider not configured' }, { status: 503, headers })
      }
      const result = await provider.embed(env, body.text)
      return Response.json(result.data, { status: result.status, headers })
    }

    if (url.pathname !== '/v1/chat') {
      return new Response('Not found', { status: 404, headers })
    }

    const providerId = body.provider
    const provider = UPSTREAM[providerId]
    if (!provider) {
      return Response.json({ error: 'Unknown provider' }, { status: 400, headers })
    }

    const apiKey = provider.key(env) || body.clientApiKey
    if (!apiKey) {
      return Response.json({ error: 'Provider not configured' }, { status: 503, headers })
    }

    const result = await provider.chat(env, body)
    return Response.json(result.data, { status: result.status, headers })
  },
}

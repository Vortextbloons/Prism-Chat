# Cloudflare Worker Proxy

Keeps API keys off the public GitHub Pages bundle.

## Deploy

```bash
cd workers
npm i -g wrangler
wrangler login
wrangler secret put GEMINI_API_KEY
wrangler secret put OPENROUTER_API_KEY
# optional: GROQ_API_KEY, MISTRAL_API_KEY, CEREBRAS_API_KEY, HUGGINGFACE_API_KEY
wrangler deploy
```

Edit `wrangler.toml` → set `ALLOWED_ORIGINS` to your GitHub Pages URL.

## App configuration

In Prism **Settings**, set **Proxy base URL** to your worker URL (e.g. `https://prism-chat-proxy.your-subdomain.workers.dev`).

Or set `VITE_PROXY_BASE_URL` at build time.

## Endpoints

| Path | Description |
|------|-------------|
| `POST /v1/chat` | Forward chat completions |
| `POST /v1/embed` | Gemini embeddings (`{ provider, text }`) |

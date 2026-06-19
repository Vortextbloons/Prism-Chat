/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string
  readonly VITE_OPENROUTER_API_KEY?: string
  readonly VITE_GROQ_API_KEY?: string
  readonly VITE_MISTRAL_API_KEY?: string
  readonly VITE_CEREBRAS_API_KEY?: string
  readonly VITE_HUGGINGFACE_API_KEY?: string
  readonly VITE_CLOUDFLARE_API_KEY?: string
  readonly VITE_GITHUB_MODELS_API_KEY?: string
  readonly VITE_NVIDIA_NIM_API_KEY?: string
  readonly VITE_DEEPINFRA_API_KEY?: string
  readonly VITE_TOGETHER_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

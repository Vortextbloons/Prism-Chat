type FeaturePipeline = Awaited<ReturnType<typeof loadPipeline>>

let embedder: FeaturePipeline | null = null
let loading: Promise<FeaturePipeline> | null = null

async function loadPipeline() {
  const { pipeline } = await import('@xenova/transformers')
  return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true })
}

export async function getLocalEmbedder(): Promise<FeaturePipeline> {
  if (embedder) return embedder
  if (!loading) {
    loading = loadPipeline().then((model) => {
      embedder = model
      return model
    })
  }
  return loading
}

export async function embedTextLocal(text: string): Promise<number[]> {
  const model = await getLocalEmbedder()
  const output = await model(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data as Float32Array)
}

export function isLocalEmbedderReady(): boolean {
  return embedder !== null
}

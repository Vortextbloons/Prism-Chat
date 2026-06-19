import { useState } from 'react'
import { generateImage } from '../features/imageGeneration'

type ImageGenPanelProps = {
  provider: string
  onClose: () => void
  onGenerated: (prompt: string, image: { mimeType: string; data: string }) => void
}

export function ImageGenPanel({ provider, onClose, onGenerated }: ImageGenPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ mimeType: string; data: string } | null>(null)

  const handleGenerate = async () => {
    const text = prompt.trim()
    if (!text || loading) return
    setLoading(true)
    setError(null)

    try {
      const image = await generateImage(text, provider)
      setPreview({ mimeType: image.mimeType, data: image.data })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed')
    } finally {
      setLoading(false)
    }
  }

  const handleUse = () => {
    if (!preview || !prompt.trim()) return
    onGenerated(prompt.trim(), preview)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal image-gen-panel" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Generate image</h2>
          <button type="button" className="btn-icon" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="field">
          <label htmlFor="imagePrompt">Prompt</label>
          <textarea
            id="imagePrompt"
            className="system-prompt-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image you want…"
            rows={3}
          />
        </div>

        {error && <div className="error-banner">{error}</div>}

        {preview && (
          <div className="image-gen-preview">
            <img src={`data:${preview.mimeType};base64,${preview.data}`} alt={prompt} />
          </div>
        )}

        <footer className="modal-footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="toolbar-btn" onClick={() => void handleGenerate()} disabled={loading || !prompt.trim()}>
            {loading ? 'Generating…' : 'Generate'}
          </button>
          {preview && (
            <button type="button" className="btn-primary" onClick={handleUse}>
              Add to chat
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

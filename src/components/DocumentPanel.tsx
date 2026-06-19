import { useEffect, useRef, useState } from 'react'
import type { StoredDocument } from '../types'
import { isSupportedDocument, extractDocumentText } from '../features/documentParser'
import { indexDocument } from '../features/rag'
import { deleteDocument, listDocuments, saveDocument } from '../storage/documentStore'

type DocumentPanelProps = {
  chatId: string
  provider: string
  useLocalEmbeddings?: boolean
  onClose: () => void
  onDocumentsChange?: (ids: string[]) => void
}

export function DocumentPanel({ chatId, provider, useLocalEmbeddings, onClose, onDocumentsChange }: DocumentPanelProps) {
  const [documents, setDocuments] = useState<StoredDocument[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = async () => {
    const docs = await listDocuments(chatId)
    setDocuments(docs)
    onDocumentsChange?.(docs.map((d) => d.id))
  }

  useEffect(() => {
    void refresh()
  }, [chatId])

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    setError(null)

    try {
      for (const file of Array.from(files)) {
        if (!isSupportedDocument(file)) {
          setError(`Unsupported: ${file.name}. Use .txt, .md, .json, .csv, or .pdf`)
          continue
        }
        const text = await extractDocumentText(file)
        const doc = await saveDocument(chatId, file.name, file.type, file.size, text)
        await indexDocument(chatId, doc.id, text, provider, useLocalEmbeddings)
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDelete = async (id: string) => {
    await deleteDocument(id)
    await refresh()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal document-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>Documents</h2>
            <p className="modal-subtitle">Upload files — relevant excerpts are added to your prompts.</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="document-upload-zone">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".txt,.md,.json,.csv,.pdf,text/*,application/pdf"
            onChange={(e) => void handleFiles(e.target.files)}
            disabled={uploading}
            hidden
          />
          <button
            type="button"
            className="upload-zone-btn"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Indexing…' : 'Choose files or drop here'}
          </button>
          <p className="upload-hint">.txt · .md · .json · .csv · .pdf</p>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <ul className="document-list">
          {documents.length === 0 && (
            <li className="document-empty">No documents yet — upload to enable document chat.</li>
          )}
          {documents.map((doc) => (
            <li key={doc.id} className="document-item">
              <span className="document-name">{doc.name}</span>
              <span className="document-meta">{(doc.size / 1024).toFixed(1)} KB</span>
              <button type="button" className="topbar-btn" onClick={() => void handleDelete(doc.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

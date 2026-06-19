import { useRef, useState, type KeyboardEvent } from 'react'
import type { ImageAttachment } from '../types'
import { isSpeechRecognitionSupported, startSpeechRecognition } from '../features/speechToText'

type ChatInputProps = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onAttachImages?: (images: ImageAttachment[]) => void
  onAttachDocuments?: (files: FileList) => void
  onOpenImageGen?: () => void
  pendingImages?: ImageAttachment[]
  onRemoveImage?: (index: number) => void
  disabled?: boolean
  placeholder?: string
  supportsImages?: boolean
  supportsImageGen?: boolean
  supportsSpeech?: boolean
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onAttachImages,
  onAttachDocuments,
  onOpenImageGen,
  pendingImages = [],
  onRemoveImage,
  disabled,
  placeholder,
  supportsImages,
  supportsImageGen,
  supportsSpeech,
}: ChatInputProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const stopSpeechRef = useRef<(() => void) | null>(null)
  const [listening, setListening] = useState(false)
  const speechSupported = supportsSpeech && isSpeechRecognitionSupported()

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  const handleImageFiles = async (files: FileList | null) => {
    if (!files?.length || !onAttachImages) return
    const { fileToImageAttachment } = await import('../features/imageInput')
    const images: ImageAttachment[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      images.push(await fileToImageAttachment(file))
    }
    if (images.length) onAttachImages(images)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const toggleSpeech = () => {
    if (listening) {
      stopSpeechRef.current?.()
      stopSpeechRef.current = null
      setListening(false)
      return
    }

    stopSpeechRef.current = startSpeechRecognition({
      onResult: (text, isFinal) => {
        if (text) onChange(value ? `${value} ${text}` : text)
        if (isFinal) {
          setListening(false)
          stopSpeechRef.current = null
        }
      },
      onError: () => {
        setListening(false)
        stopSpeechRef.current = null
      },
      onEnd: () => setListening(false),
    })
    setListening(true)
  }

  return (
    <div className="chat-input-wrapper">
      <div className="chat-input-inner">
        {pendingImages.length > 0 && (
          <div className="pending-images">
            {pendingImages.map((img, i) => (
              <div key={i} className="pending-image">
                <img src={`data:${img.mimeType};base64,${img.data}`} alt="" />
                {onRemoveImage && (
                  <button
                    type="button"
                    className="pending-image-remove"
                    onClick={() => onRemoveImage(i)}
                    aria-label="Remove image"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className={`chat-input-card ${disabled ? 'disabled' : ''}`}>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            rows={1}
          />

          <div className="chat-input-footer">
            <div className="chat-input-tools">
              {speechSupported && (
                <button
                  type="button"
                  className={`chat-input-tool ${listening ? 'active' : ''}`}
                  onClick={toggleSpeech}
                  disabled={disabled}
                  title="Voice input"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                    <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
                  </svg>
                  <span>{listening ? 'Listening' : 'Voice'}</span>
                </button>
              )}
              {supportsImageGen && onOpenImageGen && (
                <button
                  type="button"
                  className="chat-input-tool"
                  onClick={onOpenImageGen}
                  disabled={disabled}
                  title="Generate image"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
                    <path d="M5 19h14" />
                  </svg>
                  <span>Create</span>
                </button>
              )}
              {onAttachDocuments && (
                <>
                  <button
                    type="button"
                    className="chat-input-tool"
                    onClick={() => docInputRef.current?.click()}
                    disabled={disabled}
                    title="Upload document"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <path d="M14 2v6h6" />
                      <path d="M12 11v6M9 14l3-3 3 3" />
                    </svg>
                    <span>Doc</span>
                  </button>
                  <input
                    ref={docInputRef}
                    type="file"
                    multiple
                    accept=".txt,.md,.json,.csv,.pdf"
                    hidden
                    onChange={(e) => {
                      if (e.target.files?.length) onAttachDocuments(e.target.files)
                      if (docInputRef.current) docInputRef.current.value = ''
                    }}
                  />
                </>
              )}
              {supportsImages && onAttachImages && (
                <>
                  <button
                    type="button"
                    className="chat-input-tool"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={disabled}
                    title="Attach image"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                    <span>Image</span>
                  </button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => void handleImageFiles(e.target.files)}
                  />
                </>
              )}
            </div>

            <button
              type="button"
              className="btn-send"
              onClick={onSend}
              disabled={disabled || (!value.trim() && pendingImages.length === 0)}
              title="Send message"
              aria-label="Send message"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>

        <p className="input-hint">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}

import type { StoredMessage } from '../types'
import { coerceMessageText, coerceReasoningText } from '../features/messageText'
import { MessageMarkdown } from './MessageMarkdown'

type MessageListProps = {
  messages: StoredMessage[]
  sending: boolean
  showReasoning?: boolean
  streamPreview?: { id: string; content: string; reasoning?: string } | null
  onRewrite?: (messageId: string, content: string) => void
}

function PrismIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 19h20L12 2z" />
      <path d="M12 2v17" opacity="0.4" />
    </svg>
  )
}

export function MessageList({ messages, sending, showReasoning, streamPreview, onRewrite }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="message-list empty">
        <div className="welcome-orb">
          <PrismIcon />
        </div>
        <h3>What can I help with?</h3>
        <p>Choose a provider and model above, then start chatting. Prism routes across Gemini, Groq, OpenRouter, and more.</p>
        <div className="feature-cards">
          <div className="feature-card">
            <strong>Multi-provider</strong>
            <span>Switch between AI backends instantly</span>
          </div>
          <div className="feature-card">
            <strong>Tools & RAG</strong>
            <span>Agent tools, documents, voice, and image gen</span>
          </div>
          <div className="feature-card">
            <strong>Private</strong>
            <span>Chat history stays in your browser</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="message-list has-messages">
      {messages.map((msg) => {
        const isStreaming = streamPreview?.id === msg.id && sending
        const displayContent = coerceMessageText(
          streamPreview?.id === msg.id ? streamPreview.content : msg.content,
        )
        const displayReasoning = coerceReasoningText(
          streamPreview?.id === msg.id ? streamPreview.reasoning : msg.reasoning,
        )
        const reasoningText = displayReasoning

        return (
        <article key={msg.id} className={`message message-${msg.role}`}>
          {msg.role !== 'system' && (
            <div className="message-avatar">
              {msg.role === 'user' ? 'Y' : '✦'}
            </div>
          )}
          <div className="message-body">
            {msg.role === 'system' && (
              <div className="message-role">System</div>
            )}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="tool-calls-badge">
                Used tools: {msg.toolCalls.map((t) => t.name).join(', ')}
              </div>
            )}
            {showReasoning && msg.role === 'assistant' && reasoningText && (
              <details className="message-reasoning" open={isStreaming}>
                <summary>Reasoning</summary>
                <div className="message-reasoning-body">{reasoningText}</div>
              </details>
            )}
            <div className="message-content">
              {displayContent ? (
                msg.role === 'assistant' ? (
                  <MessageMarkdown content={displayContent} />
                ) : (
                  displayContent
                )
              ) : (
                isStreaming && !reasoningText ? '…' : null
              )}
            </div>
            {msg.images && msg.images.length > 0 && (
              <div className="message-images">
                {msg.images.map((img, i) => (
                  <img
                    key={i}
                    src={`data:${img.mimeType};base64,${img.data}`}
                    alt="Attached"
                    className="message-image"
                  />
                ))}
              </div>
            )}
            {msg.generatedImage && (
              <div className="message-images">
                <img
                  src={`data:${msg.generatedImage.mimeType};base64,${msg.generatedImage.data}`}
                  alt="Generated"
                  className="message-image generated"
                />
              </div>
            )}
            {msg.role === 'assistant' && displayContent && onRewrite && !isStreaming && (
              <button
                type="button"
                className="message-action"
                onClick={() => onRewrite(msg.id, displayContent)}
                disabled={sending}
              >
                Rewrite
              </button>
            )}
          </div>
        </article>
        )
      })}
      {sending && messages[messages.length - 1]?.role === 'user' && (
        <div className="typing-indicator">
          <div className="message-avatar">✦</div>
          <div className="typing-dots">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
    </div>
  )
}

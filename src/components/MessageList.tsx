import type { StoredMessage } from '../types'

type MessageListProps = {
  messages: StoredMessage[]
  sending: boolean
  streamPreview?: { id: string; content: string } | null
}

function PrismIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 19h20L12 2z" />
      <path d="M12 2v17" opacity="0.4" />
    </svg>
  )
}

export function MessageList({ messages, sending, streamPreview }: MessageListProps) {
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
            <span>Switch between 6 AI backends instantly</span>
          </div>
          <div className="feature-card">
            <strong>Auto-fallback</strong>
            <span>Routes to the next provider on rate limits</span>
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
        const displayContent =
          streamPreview?.id === msg.id ? streamPreview.content : msg.content
        const isStreaming = streamPreview?.id === msg.id && sending

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
            <div className="message-content">
              {displayContent || (isStreaming ? '…' : '')}
            </div>
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

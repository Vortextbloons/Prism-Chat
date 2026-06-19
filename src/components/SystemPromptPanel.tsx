type SystemPromptPanelProps = {
  value: string
  onChange: (value: string) => void
  onSave: () => void
  onClose: () => void
}

export function SystemPromptPanel({ value, onChange, onSave, onClose }: SystemPromptPanelProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal system-prompt-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>System prompt</h2>
            <p className="modal-subtitle">Instructions the AI follows for this chat only.</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}>
            ×
          </button>
        </header>
        <textarea
          className="system-prompt-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="You are a helpful assistant…"
          rows={6}
        />
        <footer className="modal-footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={onSave}>
            Save
          </button>
        </footer>
      </div>
    </div>
  )
}

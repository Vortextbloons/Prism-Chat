type SystemPromptPanelProps = {
  value: string
  onChange: (value: string) => void
  onSave: () => void
  onClose: () => void
}

export function SystemPromptPanel({ value, onChange, onSave, onClose }: SystemPromptPanelProps) {
  return (
    <div className="system-prompt-panel">
      <div className="system-prompt-header">
        <h3>System prompt</h3>
        <button type="button" className="btn-icon" onClick={onClose}>
          ×
        </button>
      </div>
      <textarea
        className="system-prompt-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Instructions for the AI in this chat…"
        rows={4}
      />
      <div className="system-prompt-footer">
        <button type="button" className="toolbar-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn-primary" onClick={onSave}>
          Save
        </button>
      </div>
    </div>
  )
}

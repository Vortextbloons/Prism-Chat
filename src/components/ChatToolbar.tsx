import { CHAT_TOOLS, type ChatToolId } from '../features/chatTools'

type ChatToolbarProps = {
  onTool: (toolId: ChatToolId) => void
  onExportJson: () => void
  onExportMarkdown: () => void
  onEditSystemPrompt: () => void
  disabled?: boolean
}

export function ChatToolbar({
  onTool,
  onExportJson,
  onExportMarkdown,
  onEditSystemPrompt,
  disabled,
}: ChatToolbarProps) {
  return (
    <div className="chat-toolbar">
      <div className="toolbar-group">
        {Object.entries(CHAT_TOOLS).map(([id, tool]) => (
          <button
            key={id}
            type="button"
            className="toolbar-btn"
            onClick={() => onTool(id as ChatToolId)}
            disabled={disabled}
            title={tool.prompt}
          >
            {tool.label}
          </button>
        ))}
        <span className="toolbar-divider" />
        <button type="button" className="toolbar-btn" onClick={onEditSystemPrompt} disabled={disabled}>
          Prompt
        </button>
        <button type="button" className="toolbar-btn" onClick={onExportJson} disabled={disabled}>
          JSON
        </button>
        <button type="button" className="toolbar-btn" onClick={onExportMarkdown} disabled={disabled}>
          MD
        </button>
      </div>
    </div>
  )
}

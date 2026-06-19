import type { ChatSession } from '../types'
import { useRef, type ChangeEvent } from 'react'
import { getProvider } from '../providers/registry'

type SidebarProps = {
  chats: ChatSession[]
  activeChatId: string | null
  collapsed: boolean
  onToggleCollapse: () => void
  onSelectChat: (id: string) => void
  onNewChat: () => void
  onDeleteChat: (id: string) => void
  onOpenSettings: () => void
  onImportChat: (json: string) => void
}

function PrismIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 19h20L12 2z" />
      <path d="M12 2v17" opacity="0.5" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: collapsed ? 'rotate(180deg)' : undefined }}
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

export function Sidebar({
  chats,
  activeChatId,
  collapsed,
  onToggleCollapse,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onOpenSettings,
  onImportChat,
}: SidebarProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') onImportChat(reader.result)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  if (collapsed) {
    return (
      <aside className="sidebar collapsed">
        <div className="sidebar-rail">
          <button type="button" className="rail-btn brand-rail" onClick={onToggleCollapse} title="Expand sidebar">
            <PrismIcon />
          </button>
          <button type="button" className="rail-btn" onClick={onNewChat} title="New chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button type="button" className="rail-btn" onClick={onOpenSettings} title="Settings">
            <SettingsIcon />
          </button>
          <button type="button" className="rail-btn rail-expand" onClick={onToggleCollapse} title="Expand sidebar">
            <CollapseIcon collapsed={collapsed} />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div className="brand">
          <div className="brand-icon">
            <PrismIcon />
          </div>
          <div className="brand-text">
            <h1>Prism</h1>
            <span>Multi-AI Router</span>
          </div>
        </div>
        <div className="sidebar-header-actions">
          <button type="button" className="btn-icon" onClick={onOpenSettings} title="Settings">
            <SettingsIcon />
          </button>
          <button type="button" className="btn-icon" onClick={onToggleCollapse} title="Collapse sidebar">
            <CollapseIcon collapsed={collapsed} />
          </button>
        </div>
      </header>

      <button type="button" className="btn-new-chat" onClick={onNewChat}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New chat
      </button>

      <nav className="chat-list">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}
          >
            <button type="button" className="chat-item-btn" onClick={() => onSelectChat(chat.id)}>
              <span className="chat-title">{chat.title}</span>
              <span className="chat-meta">{getProvider(chat.provider)?.name ?? chat.provider}</span>
            </button>
            <button
              type="button"
              className="btn-delete"
              onClick={() => onDeleteChat(chat.id)}
              title="Delete chat"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={handleImport}
        />
        <button type="button" className="sidebar-import-btn" onClick={() => fileRef.current?.click()}>
          Import chat
        </button>
        <span>Powered by 6 AI providers</span>
      </div>
    </aside>
  )
}

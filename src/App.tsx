import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppSettings, ChatSession } from './types'
import { createChat, deleteChat, importChatFromJson, listChats } from './storage/chatStore'
import { getSettings } from './storage/settingsStore'
import { ChatView } from './components/ChatView'
import { Sidebar } from './components/Sidebar'
import { SettingsPanel } from './components/SettingsPanel'
import { useMediaQuery } from './hooks/useMediaQuery'

const SIDEBAR_KEY = 'prism-sidebar-collapsed'

export function App() {
  const [chats, setChats] = useState<ChatSession[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(true)
  const isMobile = useMediaQuery('(max-width: 768px)')
  const wasMobileRef = useRef(isMobile)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
      return true
    }
    return localStorage.getItem(SIDEBAR_KEY) === 'true'
  })

  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed))
    }
  }, [sidebarCollapsed, isMobile])

  useEffect(() => {
    if (isMobile && !wasMobileRef.current) {
      setSidebarCollapsed(true)
    }
    wasMobileRef.current = isMobile
  }, [isMobile])

  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev)
  const closeSidebar = () => setSidebarCollapsed(true)

  const handleSelectChat = (id: string) => {
    setActiveChatId(id)
    if (isMobile) closeSidebar()
  }

  const refreshChats = useCallback(async () => {
    const items = await listChats()
    setChats(items)
    return items
  }, [])

  useEffect(() => {
    async function init() {
      const [items, appSettings] = await Promise.all([listChats(), getSettings()])
      setSettings(appSettings)
      setChats(items)

      if (items.length > 0) {
        setActiveChatId(items[0].id)
      } else {
        const chat = await createChat({
          provider: appSettings.defaultProvider,
          model: appSettings.defaultModel,
        })
        setChats([chat])
        setActiveChatId(chat.id)
      }
      setLoading(false)
    }
    void init()
  }, [])

  const handleNewChat = async () => {
    if (!settings) return
    const chat = await createChat({
      provider: settings.defaultProvider,
      model: settings.defaultModel,
    })
    await refreshChats()
    setActiveChatId(chat.id)
  }

  const handleDeleteChat = async (id: string) => {
    await deleteChat(id)
    const items = await refreshChats()
    if (activeChatId === id) {
      if (items.length > 0) {
        setActiveChatId(items[0].id)
      } else {
        const chat = await createChat()
        setChats([chat])
        setActiveChatId(chat.id)
      }
    }
  }

  const handleImportChat = async (json: string) => {
    try {
      const chat = await importChatFromJson(json)
      await refreshChats()
      setActiveChatId(chat.id)
    } catch {
      alert('Invalid chat file. Please import a Prism JSON export.')
    }
  }

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null

  if (loading || !settings) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>Loading Prism…</p>
      </div>
    )
  }

  const sidebarOpen = isMobile && !sidebarCollapsed

  return (
    <div
      className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${isMobile ? 'is-mobile' : ''} ${sidebarOpen ? 'sidebar-drawer-open' : ''}`}
    >
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={closeSidebar}
        />
      )}
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        onSelectChat={handleSelectChat}
        onNewChat={() => {
          void handleNewChat()
          if (isMobile) closeSidebar()
        }}
        onDeleteChat={(id) => void handleDeleteChat(id)}
        onOpenSettings={() => {
          setShowSettings(true)
          if (isMobile) closeSidebar()
        }}
        onImportChat={(json) => void handleImportChat(json)}
      />
      <div className="chat-main">
      {activeChat ? (
        <ChatView
          key={activeChat.id}
          chat={activeChat}
          settings={settings}
          isMobile={isMobile}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
          onChatUpdated={(updated) => {
            setChats((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
          }}
          onSettingsChange={setSettings}
        />
      ) : (
        <div className="empty-state">Select or create a chat</div>
      )}
      </div>
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSettingsChange={setSettings}
        />
      )}
    </div>
  )
}

import { CHAT_TOOLS, ROUTE_MODE_PRESETS, type ChatToolId } from '../features/chatTools'
import type { RouteMode } from '../types'
import { MenuDropdown } from './MenuDropdown'
import { SelectDropdown } from './SelectDropdown'

type ProviderOption = { id: string; name: string }
type ModelOption = { id: string; name: string }

type ChatTopBarProps = {
  isMobile?: boolean
  sidebarCollapsed?: boolean
  onToggleSidebar?: () => void
  providers: ProviderOption[]
  models: ModelOption[]
  provider: string
  model: string
  onProviderChange: (id: string) => void
  onModelChange: (id: string) => void
  activeRouteMode?: RouteMode
  routeModeOverride?: RouteMode
  autoFallback?: boolean
  onModePreset: (mode: 'coding' | 'best-free' | 'default') => void
  onTool: (toolId: ChatToolId) => void
  onToggleDocuments: () => void
  onCompareModels: () => void
  onEditSystemPrompt: () => void
  onExportJson: () => void
  onExportMarkdown: () => void
  hasDocuments?: boolean
  showReasoning?: boolean
  onToggleShowReasoning?: () => void
  disabled?: boolean
}

const MODE_SEGMENTS: { id: 'default' | 'coding' | 'best-free'; label: string }[] = [
  { id: 'default', label: 'Chat' },
  { id: 'coding', label: 'Code' },
  { id: 'best-free', label: 'Free' },
]

export function ChatTopBar({
  isMobile,
  sidebarCollapsed,
  onToggleSidebar,
  providers,
  models,
  provider,
  model,
  onProviderChange,
  onModelChange,
  activeRouteMode,
  routeModeOverride,
  autoFallback,
  onModePreset,
  onTool,
  onToggleDocuments,
  onCompareModels,
  onEditSystemPrompt,
  onExportJson,
  onExportMarkdown,
  hasDocuments,
  showReasoning,
  onToggleShowReasoning,
  disabled,
}: ChatTopBarProps) {
  const activeMode = routeModeOverride ?? 'default'

  const toolItems = (Object.keys(CHAT_TOOLS) as ChatToolId[]).map((id) => ({
    id,
    label: CHAT_TOOLS[id].label,
    onClick: () => onTool(id),
  }))

  const moreItems = [
    {
      id: 'reasoning',
      label: showReasoning ? 'Hide reasoning' : 'Show reasoning',
      onClick: () => onToggleShowReasoning?.(),
      active: showReasoning,
    },
    { id: 'docs', label: hasDocuments ? 'Documents ●' : 'Documents', onClick: onToggleDocuments },
    { id: 'compare', label: 'Compare models', onClick: onCompareModels },
    { id: 'prompt', label: 'System prompt', onClick: onEditSystemPrompt },
    { id: 'json', label: 'Export JSON', onClick: onExportJson },
    { id: 'md', label: 'Export Markdown', onClick: onExportMarkdown },
  ]

  return (
    <header className="chat-topbar">
      <div className="topbar-inner">
        {(isMobile || sidebarCollapsed) && onToggleSidebar && (
          <button
            type="button"
            className="btn-icon topbar-menu-btn"
            onClick={onToggleSidebar}
            title={isMobile && !sidebarCollapsed ? 'Close sidebar' : 'Show sidebar'}
            aria-label={isMobile && !sidebarCollapsed ? 'Close sidebar' : 'Open sidebar'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        )}

        <div className="topbar-model" title={autoFallback ? `Auto-routing (${activeRouteMode})` : undefined}>
          {autoFallback && <span className="topbar-route-dot" title="Auto-route enabled" />}
          <SelectDropdown
            value={provider}
            options={providers.map((p) => ({ value: p.id, label: p.name }))}
            onChange={onProviderChange}
            disabled={disabled}
            className="model-select"
          />
          <span className="topbar-sep">/</span>
          <SelectDropdown
            value={model}
            options={models.map((m) => ({ value: m.id, label: m.name }))}
            onChange={onModelChange}
            disabled={disabled}
            className="model-select model-select-wide"
          />
        </div>

        <div className="topbar-modes" role="group" aria-label="Chat mode">
          {MODE_SEGMENTS.map((seg) => (
            <button
              key={seg.id}
              type="button"
              className={`mode-segment ${activeMode === seg.id ? 'active' : ''}`}
              onClick={() => onModePreset(seg.id)}
              disabled={disabled}
              title={
                seg.id === 'coding'
                  ? ROUTE_MODE_PRESETS.coding.systemPrompt
                  : seg.id === 'best-free'
                    ? ROUTE_MODE_PRESETS['best-free'].systemPrompt
                    : 'Standard chat'
              }
            >
              {seg.label}
            </button>
          ))}
        </div>

        <div className="topbar-actions">
          <MenuDropdown label="Tools" items={toolItems} disabled={disabled} />
          <MenuDropdown label="Menu" items={moreItems} disabled={disabled} active={hasDocuments} />
        </div>
      </div>
    </header>
  )
}

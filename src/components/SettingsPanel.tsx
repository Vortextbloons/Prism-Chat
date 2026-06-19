import { useEffect, useState } from 'react'
import type { AppSettings, ProviderHealth } from '../types'
import {
  DEFAULT_SETTINGS,
  getSettings,
  getUsageStats,
  resetUsageStats,
  saveSettings,
} from '../storage/settingsStore'
import {
  getEnabledProviders,
  getProviderModels,
  isProviderConfigured,
  PROVIDERS,
} from '../providers/registry'
import { PROVIDERS_CONFIG } from '../config/loadProviders'
import { checkAllProviders } from '../features/providerHealth'
import { SelectDropdown } from './SelectDropdown'

type SettingsPanelProps = {
  settings: AppSettings
  onClose: () => void
  onSettingsChange: (settings: AppSettings) => void
}

const ROUTE_LABELS: Record<string, string> = {
  default: 'Default (balanced)',
  fast: 'Fast (Groq / Cerebras)',
  'long-context': 'Long context',
  'open-source': 'Open source',
}

function healthLabel(health?: ProviderHealth): string {
  if (!health) return 'Unknown'
  switch (health.status) {
    case 'working':
      return 'Working'
    case 'rate_limited':
      return 'Rate limited'
    case 'invalid_key':
      return 'Invalid key'
    case 'checking':
      return 'Checking…'
    case 'error':
      return health.message ?? 'Error'
    default:
      return isProviderConfigured(PROVIDERS[0]) ? 'Ready' : 'Not tested'
  }
}

export function SettingsPanel({ settings, onClose, onSettingsChange }: SettingsPanelProps) {
  const [local, setLocal] = useState<AppSettings>(settings)
  const [usage, setUsage] = useState({ inputTokens: 0, outputTokens: 0, requests: 0, failures: 0 })
  const [health, setHealth] = useState<Record<string, ProviderHealth>>({})
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    void getUsageStats().then(setUsage)
  }, [])

  const handleSaveSettings = async () => {
    await saveSettings(local)
    onSettingsChange(local)
    document.documentElement.dataset.theme = local.theme === 'system' ? '' : local.theme
  }

  const handleCheckProviders = async () => {
    setChecking(true)
    const checkingState: Record<string, ProviderHealth> = {}
    for (const p of PROVIDERS.filter((x) => x.enabled)) {
      checkingState[p.id] = { status: 'checking' }
    }
    setHealth(checkingState)
    const results = await checkAllProviders()
    setHealth(results)
    setChecking(false)
  }

  const enabledProviders = getEnabledProviders()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-panel" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Settings</h2>
          <button type="button" className="btn-icon" onClick={onClose}>
            ×
          </button>
        </header>

        <section>
          <h3>Providers</h3>
          <p className="hint">
            Keys are in <code>src/config/providers.json</code>. Test connectivity below.
          </p>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => void handleCheckProviders()}
            disabled={checking}
          >
            {checking ? 'Testing…' : 'Test all providers'}
          </button>
          <ul className="provider-status-list">
            {PROVIDERS.map((provider) => {
              const h = health[provider.id]
              const configured = isProviderConfigured(provider)
              const statusClass =
                h?.status === 'working'
                  ? 'ok'
                  : h?.status === 'rate_limited' || h?.status === 'invalid_key' || h?.status === 'error'
                    ? 'error'
                    : configured
                      ? 'ok'
                      : 'error'
              return (
                <li key={provider.id} className="provider-status-item">
                  <span>{provider.name}</span>
                  <span className={`status ${statusClass}`}>
                    {h ? healthLabel(h) : !provider.enabled ? 'Disabled' : configured ? 'Ready' : 'Missing key'}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <section>
          <h3>Routing</h3>
          <div className="field">
            <label>Route mode</label>
            <SelectDropdown
              value={local.routeMode}
              options={Object.keys(PROVIDERS_CONFIG.routes).map((mode) => ({
                value: mode,
                label: ROUTE_LABELS[mode] ?? mode,
              }))}
              onChange={(mode) => setLocal({ ...local, routeMode: mode as AppSettings['routeMode'] })}
            />
          </div>
          <div className="field checkbox">
            <label>
              <input
                type="checkbox"
                checked={local.autoFallback}
                onChange={(e) => setLocal({ ...local, autoFallback: e.target.checked })}
              />
              Auto-fallback when a provider fails or rate-limits
            </label>
          </div>
          <div className="field">
            <label htmlFor="maxContext">Max context tokens ({local.maxContextTokens.toLocaleString()})</label>
            <input
              id="maxContext"
              type="range"
              min={4000}
              max={32000}
              step={1000}
              value={local.maxContextTokens}
              onChange={(e) => setLocal({ ...local, maxContextTokens: Number(e.target.value) })}
            />
          </div>
        </section>

        <section>
          <h3>Defaults</h3>
          <div className="field">
            <label>Default provider</label>
            <SelectDropdown
              value={local.defaultProvider}
              options={enabledProviders.map((p) => ({ value: p.id, label: p.name }))}
              onChange={(id) => {
                const provider = PROVIDERS.find((p) => p.id === id)
                setLocal({
                  ...local,
                  defaultProvider: id,
                  defaultModel: provider?.defaultModel ?? local.defaultModel,
                })
              }}
            />
          </div>
          <div className="field">
            <label>Default model</label>
            <SelectDropdown
              value={local.defaultModel}
              options={getProviderModels(local.defaultProvider).map((m) => ({
                value: m.id,
                label: m.name,
              }))}
              onChange={(id) => setLocal({ ...local, defaultModel: id })}
            />
          </div>
          <div className="field">
            <label htmlFor="temperature">Temperature ({local.temperature})</label>
            <input
              id="temperature"
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={local.temperature}
              onChange={(e) => setLocal({ ...local, temperature: Number(e.target.value) })}
            />
          </div>
          <div className="field checkbox">
            <label>
              <input
                type="checkbox"
                checked={local.streamResponses}
                onChange={(e) => setLocal({ ...local, streamResponses: e.target.checked })}
              />
              Stream responses
            </label>
          </div>
          <div className="field">
            <label>Theme</label>
            <SelectDropdown
              value={local.theme}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
                { value: 'system', label: 'System' },
              ]}
              onChange={(theme) =>
                setLocal({ ...local, theme: theme as AppSettings['theme'] })
              }
            />
          </div>
        </section>

        <section>
          <h3>Usage (estimated)</h3>
          <p className="usage-stats">
            {usage.requests} requests · ~{usage.inputTokens.toLocaleString()} input · ~
            {usage.outputTokens.toLocaleString()} output · {usage.failures} failures
          </p>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => void resetUsageStats().then(() => getUsageStats().then(setUsage))}
          >
            Reset stats
          </button>
        </section>

        <footer className="modal-footer">
          <button
            type="button"
            onClick={() => void getSettings().then((s) => setLocal(s ?? DEFAULT_SETTINGS))}
          >
            Reset
          </button>
          <button type="button" className="btn-primary" onClick={() => void handleSaveSettings()}>
            Save settings
          </button>
        </footer>
      </div>
    </div>
  )
}

import { useState } from 'react'
import type { CompareResult } from '../features/compareModels'

type CompareModelsPanelProps = {
  results: CompareResult[] | null
  loading: boolean
  onClose: () => void
}

export function CompareModelsPanel({ results, loading, onClose }: CompareModelsPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal compare-panel" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Compare models</h2>
          <button type="button" className="btn-icon" onClick={onClose}>
            ×
          </button>
        </header>

        {loading && (
          <div className="compare-loading">
            <div className="spinner" />
            <p>Querying providers…</p>
          </div>
        )}

        {!loading && results && (
          <div className="compare-grid">
            {results.map((r) => (
              <article
                key={r.provider}
                className={`compare-card ${r.error ? 'compare-error' : ''}`}
              >
                <header>
                  <strong>{r.providerName}</strong>
                  <span>{r.modelName}</span>
                </header>
                {r.error ? (
                  <p className="compare-error-text">{r.error}</p>
                ) : (
                  <div
                    className={`compare-content ${expanded === r.provider ? 'expanded' : ''}`}
                    onClick={() => setExpanded(expanded === r.provider ? null : r.provider)}
                  >
                    {r.content}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

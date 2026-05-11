import { useRef, useState } from 'react'
import type { DocumentSearchResult } from '../stores/document'

interface SearchPanelProps {
  results: DocumentSearchResult | null
  isSearching: boolean
  onSearch: (query: string) => void
  onClear: () => void
  onNavigate: (partPath: string) => void
  onClose: () => void
}

export function SearchPanel({
  results,
  isSearching,
  onSearch,
  onClear,
  onNavigate,
  onClose,
}: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) onSearch(query.trim())
  }

  const handleClear = () => {
    setQuery('')
    setExpandedParts(new Set())
    onClear()
    inputRef.current?.focus()
  }

  const toggleExpanded = (partPath: string) => {
    setExpandedParts((prev) => {
      const next = new Set(prev)
      if (next.has(partPath)) next.delete(partPath)
      else next.add(partPath)
      return next
    })
  }

  return (
    <div className="search-panel">
      <div className="search-panel-header">
        <h3>Search in Document</h3>
        <button onClick={onClose} className="close-btn" aria-label="Close search panel">
          x
        </button>
      </div>

      <form onSubmit={handleSubmit} className="search-panel-form">
        <input
          ref={inputRef}
          className="search-panel-input"
          type="text"
          placeholder="Search text..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <button type="submit" className="search-panel-btn" disabled={isSearching || !query.trim()}>
          {isSearching ? '...' : 'Search'}
        </button>
        {results !== null && (
          <button type="button" className="search-panel-clear-btn" onClick={handleClear}>
            Clear
          </button>
        )}
      </form>

      {results !== null && (
        <div className="search-panel-results">
          <div className="search-panel-summary">
            {results.totalMatches === 0
              ? 'No matches found'
              : `${results.totalMatches} match${results.totalMatches !== 1 ? 'es' : ''} in ${results.results.length} part${results.results.length !== 1 ? 's' : ''}`}
          </div>

          <div className="search-panel-list">
            {results.results.map((partResult) => {
              const isExpanded = expandedParts.has(partResult.partPath)
              return (
                <div key={partResult.partPath} className="search-part-item">
                  <div
                    className="search-part-header"
                    onClick={() => toggleExpanded(partResult.partPath)}
                  >
                    <span className="search-part-expand">{isExpanded ? '▾' : '▸'}</span>
                    <span className="search-part-path">{partResult.partPath}</span>
                    <span className="search-part-count">{partResult.matches.length}</span>
                    <button
                      className="navigate-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        onNavigate(partResult.partPath)
                      }}
                      title="Go to part"
                    >
                      Go
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="search-matches">
                      {partResult.matches.map((match, idx) => (
                        <div
                          key={idx}
                          className="search-match-item"
                          onClick={() => onNavigate(partResult.partPath)}
                          title={`Line ${match.line}`}
                        >
                          <span className="search-match-line">L{match.line}</span>
                          <span className="search-match-content">{match.lineContent}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

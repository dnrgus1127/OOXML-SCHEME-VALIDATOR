import type { RecentFileEntry } from '../../../shared/recent-files'
import { useRecentFilesPanel } from './useRecentFilesPanel'

interface RecentFilesPanelProps {
  recentFiles: RecentFileEntry[]
  recentError: string | null
  onDismissRecentError: () => void
  onOpenRecent: (entry: RecentFileEntry) => void
  onRemoveRecent: (filePath: string) => void
  onClearRecent: () => void
}

function toolLabel(lastTool: RecentFileEntry['lastTool']): string {
  return lastTool === 'xml-editor' ? 'XML Editor' : 'Batch Validator'
}

function formatRelativeTime(isoString: string): string {
  const timestamp = Date.parse(isoString)
  if (Number.isNaN(timestamp)) return 'Unknown'
  const diffMs = Date.now() - timestamp
  const absSeconds = Math.floor(Math.abs(diffMs) / 1000)

  if (absSeconds < 60) return 'Just now'
  const absMinutes = Math.floor(absSeconds / 60)
  if (absMinutes < 60) return `${absMinutes}m ago`
  const absHours = Math.floor(absMinutes / 60)
  if (absHours < 24) return `${absHours}h ago`
  const absDays = Math.floor(absHours / 24)
  return `${absDays}d ago`
}

function RecentFileItem({
  entry,
  onOpenRecent,
  onRemoveRecent,
}: {
  entry: RecentFileEntry
  onOpenRecent: (entry: RecentFileEntry) => void
  onRemoveRecent: (filePath: string) => void
}) {
  return (
    <li
      key={entry.filePath}
      className="home-recent-item"
      role="button"
      tabIndex={0}
      onClick={() => onOpenRecent(entry)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpenRecent(entry)
        }
      }}
    >
      <div className="home-recent-item-main">
        <div className="home-recent-item-name" title={entry.filePath}>
          {entry.fileName}
        </div>
        <div className="home-recent-item-path" title={entry.filePath}>
          {entry.filePath}
        </div>
      </div>
      <div className="home-recent-item-meta">
        <span className="home-tool-badge">{toolLabel(entry.lastTool)}</span>
        <span className="home-recent-time">{formatRelativeTime(entry.lastOpenedAt)}</span>
        <button
          className="home-recent-remove-btn"
          onClick={(event) => {
            event.stopPropagation()
            onRemoveRecent(entry.filePath)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            event.stopPropagation()
            onRemoveRecent(entry.filePath)
          }}
          aria-label={`Remove ${entry.fileName} from recent files`}
        >
          ×
        </button>
      </div>
    </li>
  )
}

export function RecentFilesPanel({
  recentFiles,
  recentError,
  onDismissRecentError,
  onOpenRecent,
  onRemoveRecent,
  onClearRecent,
}: RecentFilesPanelProps) {
  const { isOpen, toggle, contentId } = useRecentFilesPanel()

  return (
    <aside className={`home-recent-panel ${isOpen ? 'is-open' : 'is-collapsed'}`}>
      <div className="home-recent-header">
        <button
          type="button"
          className="recent-toggle-btn"
          onClick={toggle}
          aria-expanded={isOpen}
          aria-controls={contentId}
        >
          <span className="recent-toggle-icon" aria-hidden>
            {isOpen ? '▾' : '▸'}
          </span>
          <span className="home-recent-title">Recent Files</span>
        </button>

        {isOpen && (
          <button
            onClick={onClearRecent}
            disabled={recentFiles.length === 0}
            className="recent-clear-btn"
          >
            Clear
          </button>
        )}
      </div>

      {isOpen && (
        <div id={contentId} className="home-recent-content">
          {recentError && (
            <div className="home-recent-error">
              <span>{recentError}</span>
              <button onClick={onDismissRecentError} aria-label="Dismiss recent error">
                ×
              </button>
            </div>
          )}

          {recentFiles.length === 0 && (
            <div className="home-recent-empty">
              <p>No recently opened files</p>
              <p>Files you open in XML Editor or Batch Validator appear here.</p>
            </div>
          )}

          {recentFiles.length > 0 && (
            <ul className="home-recent-list">
              {recentFiles.map((entry) => (
                <RecentFileItem
                  key={entry.filePath}
                  entry={entry}
                  onOpenRecent={onOpenRecent}
                  onRemoveRecent={onRemoveRecent}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  )
}

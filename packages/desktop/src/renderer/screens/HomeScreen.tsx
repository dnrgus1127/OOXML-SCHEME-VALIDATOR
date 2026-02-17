import type { RecentFileEntry } from '../../shared/recent-files'

interface ToolCardProps {
  icon: string
  title: string
  description: string
  actionLabel: string
  onAction: () => void | Promise<void>
}

function ToolCard({ icon, title, description, actionLabel, onAction }: ToolCardProps) {
  return (
    <div className="tool-card" onClick={onAction}>
      <div className="tool-icon">{icon}</div>
      <div className="tool-title">{title}</div>
      <div className="tool-description">{description}</div>
      <button
        className="tool-action"
        onClick={(e) => {
          e.stopPropagation()
          onAction()
        }}
      >
        {actionLabel}
      </button>
    </div>
  )
}

interface HomeScreenProps {
  onOpenXmlFromHome: () => void | Promise<void>
  onOpenBatchFromHome: () => void | Promise<void>
  onOpenSettingsFromHome: () => void | Promise<void>
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

export function HomeScreen({
  onOpenXmlFromHome,
  onOpenBatchFromHome,
  onOpenSettingsFromHome,
  recentFiles,
  recentError,
  onDismissRecentError,
  onOpenRecent,
  onRemoveRecent,
  onClearRecent,
}: HomeScreenProps) {
  return (
    <div className="home-screen">
      <aside className="home-recent-panel">
        <div className="home-recent-header">
          <h2>Recent Files</h2>
          <button
            onClick={onClearRecent}
            disabled={recentFiles.length === 0}
            className="recent-clear-btn"
          >
            Clear
          </button>
        </div>

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
            ))}
          </ul>
        )}
      </aside>

      <div className="home-main">
        <button
          type="button"
          className="home-settings-btn"
          onClick={onOpenSettingsFromHome}
          aria-label="Open settings"
          title="Settings"
        >
          ⚙
        </button>

        <div className="home-header">
          <h1 className="home-title">OOXML Validator</h1>
          <p className="home-subtitle">Choose a tool to get started</p>
        </div>

        <div className="tools-grid">
          <ToolCard
            icon="📝"
            title="XML Editor"
            description="단일 OOXML 파일을 열어 XML 파트를 편집하고 검증합니다"
            actionLabel="Open File"
            onAction={onOpenXmlFromHome}
          />

          <ToolCard
            icon="📊"
            title="Batch Validator"
            description="여러 파일을 한번에 검증하고 결과를 보고서로 내보냅니다"
            actionLabel="Select Files"
            onAction={onOpenBatchFromHome}
          />
        </div>
      </div>
    </div>
  )
}

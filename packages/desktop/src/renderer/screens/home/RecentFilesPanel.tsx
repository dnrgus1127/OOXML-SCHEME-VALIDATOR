import type { RecentFileEntry, OpenTool } from '../../../shared/recent-files'

export interface RecentFilesPanelProps {
  recentFiles: RecentFileEntry[]
  recentError: string | null
  onDismissRecentError: () => void
  onOpenRecent: (entry: RecentFileEntry) => void
  onRemoveRecent: (filePath: string) => void
}

type ValidationStatus = 'valid' | 'invalid' | 'warning'

const STATUS_LABEL: Record<ValidationStatus, string> = {
  valid: 'Valid',
  invalid: 'Errors',
  warning: 'Warnings',
}

function toolLabel(lastTool: OpenTool): string {
  return lastTool === 'xml-editor' ? 'XML Editor' : 'Batch'
}

function fileGlyph(entry: RecentFileEntry): string {
  const lower = entry.fileName.toLowerCase()
  if (lower.endsWith('.xlsx') || lower.endsWith('.ods')) return '📊'
  if (lower.endsWith('.docx') || lower.endsWith('.odt')) return '📝'
  if (lower.endsWith('.pptx') || lower.endsWith('.odp')) return '🎨'
  if (lower.endsWith('/') || lower.endsWith('\\')) return '📁'
  return '📄'
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

function getValidationStatus(_entry: RecentFileEntry): ValidationStatus {
  // 검증 결과 캐시가 연결되기 전까지는 항상 valid 로 표시
  return 'valid'
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
  const status = getValidationStatus(entry)

  return (
    <li>
      <div
        className="bold-recent-item"
        role="button"
        tabIndex={0}
        onClick={() => onOpenRecent(entry)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onOpenRecent(entry)
        }}
        title={entry.filePath}
      >
        <div className="bold-recent-glyph" aria-hidden>
          {fileGlyph(entry)}
        </div>
        <div className="bold-recent-info">
          <div className="bold-recent-name">{entry.fileName}</div>
          <div className="bold-recent-meta">
            <span>{toolLabel(entry.lastTool)}</span>
            <span className="sep">/</span>
            <span>{formatRelativeTime(entry.lastOpenedAt)}</span>
            <span className="sep">/</span>
            <span className="bold-recent-meta-path">{entry.filePath}</span>
          </div>
        </div>
        <div className="bold-recent-trailing">
          <span className={`bold-recent-status ${status}`}>
            <span className="dot" aria-hidden />
            {STATUS_LABEL[status]}
          </span>
          <button
            type="button"
            className="bold-recent-remove-btn"
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
}: RecentFilesPanelProps) {
  return (
    <>
      {recentError && (
        <div className="bold-recent-error">
          <span>{recentError}</span>
          <button
            type="button"
            onClick={onDismissRecentError}
            aria-label="Dismiss recent error"
          >
            ×
          </button>
        </div>
      )}

      {recentFiles.length === 0 ? (
        <div className="bold-recent-empty">
          <p>No recently opened files</p>
          <p>Files you open in XML Editor or Batch Validator appear here.</p>
        </div>
      ) : (
        <ul className="bold-recent-list">
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
    </>
  )
}

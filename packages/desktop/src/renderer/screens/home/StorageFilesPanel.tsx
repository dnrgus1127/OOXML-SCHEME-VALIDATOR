import { useCallback, useEffect, useState } from 'react'

export interface StorageFileEntry {
  fileName: string
  filePath: string
  modifiedAt: number
  size: number
  folderPath: string
}

export interface StorageFilesPanelProps {
  downloadFolders: string[]
  onOpenStorageFile: (filePath: string) => void
  onOpenSettings: () => void
}

function fileGlyph(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.xlsx') || lower.endsWith('.ods')) return '📊'
  if (lower.endsWith('.docx') || lower.endsWith('.odt')) return '📝'
  if (lower.endsWith('.pptx') || lower.endsWith('.odp')) return '🎨'
  return '📄'
}

function getFolderLabel(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean)
  return segments[segments.length - 1] ?? path
}

function formatRelativeTime(ms: number): string {
  const diffMs = Date.now() - ms
  const absSeconds = Math.floor(Math.abs(diffMs) / 1000)

  if (absSeconds < 60) return 'Just now'
  const absMinutes = Math.floor(absSeconds / 60)
  if (absMinutes < 60) return `${absMinutes}m ago`
  const absHours = Math.floor(absMinutes / 60)
  if (absHours < 24) return `${absHours}h ago`
  const absDays = Math.floor(absHours / 24)
  return `${absDays}d ago`
}

function StorageFileItem({
  entry,
  onOpenStorageFile,
}: {
  entry: StorageFileEntry
  onOpenStorageFile: (filePath: string) => void
}) {
  return (
    <li>
      <div
        className="bold-recent-item"
        role="button"
        tabIndex={0}
        onClick={() => onOpenStorageFile(entry.filePath)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onOpenStorageFile(entry.filePath)
        }}
        title={entry.filePath}
      >
        <div className="bold-recent-glyph" aria-hidden>
          {fileGlyph(entry.fileName)}
        </div>
        <div className="bold-recent-info">
          <div className="bold-recent-name">{entry.fileName}</div>
          <div className="bold-recent-meta">
            <span>{getFolderLabel(entry.folderPath)}</span>
            <span className="sep">/</span>
            <span>{formatRelativeTime(entry.modifiedAt)}</span>
            <span className="sep">/</span>
            <span className="bold-recent-meta-path">{entry.folderPath}</span>
          </div>
        </div>
      </div>
    </li>
  )
}

export function StorageFilesPanel({
  downloadFolders,
  onOpenStorageFile,
  onOpenSettings,
}: StorageFilesPanelProps) {
  const [files, setFiles] = useState<StorageFileEntry[]>([])
  const [missingFolders, setMissingFolders] = useState<string[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (downloadFolders.length === 0) {
      setFiles([])
      setMissingFolders([])
      setLoadError(null)
      return
    }

    setIsLoading(true)
    setLoadError(null)
    try {
      const result = await window.electronAPI.listFolders(downloadFolders)
      if (result.success && Array.isArray(result.data)) {
        setFiles(result.data)
        setMissingFolders(Array.isArray(result.missingFolders) ? result.missingFolders : [])
      } else {
        setFiles([])
        setMissingFolders([])
        setLoadError(result.error ?? '폴더 목록을 불러오지 못했습니다.')
      }
    } catch (error) {
      setFiles([])
      setMissingFolders([])
      setLoadError(String(error))
    } finally {
      setIsLoading(false)
    }
  }, [downloadFolders])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (downloadFolders.length === 0) {
    return (
      <div className="bold-recent-empty">
        <p>등록된 폴더가 없습니다</p>
        <p>설정에서 다운로드 폴더를 등록하면 이곳에 파일이 표시됩니다.</p>
        <button
          type="button"
          className="bold-storage-empty-btn"
          onClick={onOpenSettings}
        >
          설정 열기
        </button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bold-recent-empty">
        <p>폴더 목록을 불러오는 중…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="bold-recent-empty">
        <p>{loadError}</p>
        <button
          type="button"
          className="bold-storage-empty-btn"
          onClick={() => void refresh()}
        >
          다시 시도
        </button>
      </div>
    )
  }

  return (
    <>
      {missingFolders.length > 0 && (
        <div className="bold-recent-error">
          <span>일부 폴더에 접근하지 못했습니다: {missingFolders.join(', ')}</span>
        </div>
      )}

      {files.length === 0 ? (
        <div className="bold-recent-empty">
          <p>폴더에 열 수 있는 파일이 없습니다</p>
          <p>지원 포맷: .xlsx, .docx, .pptx, .odt, .ods, .odp</p>
        </div>
      ) : (
        <ul className="bold-recent-list">
          {files.map((entry) => (
            <StorageFileItem
              key={entry.filePath}
              entry={entry}
              onOpenStorageFile={onOpenStorageFile}
            />
          ))}
        </ul>
      )}
    </>
  )
}

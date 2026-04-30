import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface QuickOpenFileEntry {
  fileName: string
  filePath: string
  modifiedAt: number
  size: number
  folderPath: string
}

interface QuickOpenPaletteProps {
  isOpen: boolean
  folders: string[]
  onClose: () => void
  onSelect: (filePath: string) => void
  onOpenSettings?: () => void
}

function fuzzyMatch(query: string, target: string): { score: number; matches: number[] } | null {
  if (!query) return { score: 0, matches: [] }

  const q = query.toLowerCase()
  const t = target.toLowerCase()
  const matches: number[] = []

  let qIdx = 0
  let prevMatch = -2
  let score = 0

  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) {
      matches.push(i)
      score += i === prevMatch + 1 ? 5 : 1
      if (i === 0 || /[\s\-_./\\]/.test(t[i - 1] ?? '')) score += 3
      prevMatch = i
      qIdx++
    }
  }

  if (qIdx < q.length) return null
  return { score, matches }
}

function formatModified(ms: number): string {
  const date = new Date(ms)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function getFolderLabel(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean)
  return segments[segments.length - 1] ?? path
}

function highlight(name: string, indices: number[]) {
  if (indices.length === 0) return <>{name}</>
  const set = new Set(indices)
  return (
    <>
      {name.split('').map((ch, i) =>
        set.has(i) ? (
          <mark key={i} className="quick-open-highlight">
            {ch}
          </mark>
        ) : (
          <span key={i}>{ch}</span>
        )
      )}
    </>
  )
}

const RESULT_LIMIT = 200

export function QuickOpenPalette({
  isOpen,
  folders,
  onClose,
  onSelect,
  onOpenSettings,
}: QuickOpenPaletteProps) {
  const [query, setQuery] = useState('')
  const [files, setFiles] = useState<QuickOpenFileEntry[]>([])
  const [missingFolders, setMissingFolders] = useState<string[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const refresh = useCallback(async () => {
    if (folders.length === 0) {
      setFiles([])
      setMissingFolders([])
      return
    }

    setIsLoading(true)
    setLoadError(null)
    try {
      const result = await window.electronAPI.listFolders(folders)
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
  }, [folders])

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setActiveIndex(0)
    void refresh()

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
    return () => window.clearTimeout(focusTimer)
  }, [isOpen, refresh])

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return files
        .slice(0, RESULT_LIMIT)
        .map((file) => ({ file, matches: [] as number[], score: 0 }))
    }

    return files
      .map((file) => {
        const nameMatch = fuzzyMatch(query, file.fileName)
        if (nameMatch) {
          return { file, matches: nameMatch.matches, score: nameMatch.score + 10 }
        }
        const folderMatch = fuzzyMatch(query, getFolderLabel(file.folderPath))
        if (folderMatch) {
          return { file, matches: [] as number[], score: folderMatch.score }
        }
        return null
      })
      .filter((item): item is { file: QuickOpenFileEntry; matches: number[]; score: number } => item !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, RESULT_LIMIT)
  }, [files, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, files])

  useEffect(() => {
    if (!isOpen) return
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-quick-open-index="${activeIndex}"]`
    )
    node?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, isOpen])

  if (!isOpen) return null

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((prev) => Math.min(prev + 1, Math.max(0, filtered.length - 1)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const item = filtered[activeIndex]
      if (item) {
        onSelect(item.file.filePath)
      }
    }
  }

  return (
    <div
      className="quick-open-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="quick-open-panel"
        role="dialog"
        aria-label="Quick Open"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="quick-open-header">
          <input
            ref={inputRef}
            type="text"
            className="quick-open-input"
            placeholder={
              folders.length > 0
                ? '파일명 또는 폴더명을 입력하세요'
                : '먼저 다운로드 폴더를 등록하세요'
            }
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={folders.length === 0}
            spellCheck={false}
            autoComplete="off"
          />
          <span className="quick-open-folder-label">
            {folders.length === 0
              ? '폴더 미등록'
              : folders.length === 1
                ? getFolderLabel(folders[0]!)
                : `${folders.length}개 폴더`}
          </span>
        </div>

        {missingFolders.length > 0 && (
          <div className="quick-open-warning">
            <span>일부 폴더에 접근하지 못했습니다:</span>
            <ul>
              {missingFolders.map((path) => (
                <li key={path}>
                  <code>{path}</code>
                </li>
              ))}
            </ul>
          </div>
        )}

        {folders.length === 0 ? (
          <div className="quick-open-empty">
            <p>설정 → 기본에서 다운로드 폴더를 먼저 등록해주세요.</p>
            {onOpenSettings && (
              <button
                type="button"
                className="quick-open-empty-btn"
                onClick={() => {
                  onOpenSettings()
                  onClose()
                }}
              >
                설정 열기
              </button>
            )}
          </div>
        ) : isLoading ? (
          <div className="quick-open-empty">
            <p>폴더 목록을 불러오는 중…</p>
          </div>
        ) : loadError ? (
          <div className="quick-open-empty quick-open-empty--error">
            <p>{loadError}</p>
            <button type="button" className="quick-open-empty-btn" onClick={refresh}>
              다시 시도
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="quick-open-empty">
            <p>
              {files.length === 0
                ? '폴더에 열 수 있는 파일이 없습니다.'
                : '검색 결과가 없습니다.'}
            </p>
          </div>
        ) : (
          <ul ref={listRef} className="quick-open-list" role="listbox">
            {filtered.map(({ file, matches }, index) => {
              const isActive = index === activeIndex
              const folderLabel = getFolderLabel(file.folderPath)
              return (
                <li
                  key={`${file.folderPath}::${file.fileName}`}
                  data-quick-open-index={index}
                  role="option"
                  aria-selected={isActive}
                  className={`quick-open-item${isActive ? ' is-active' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => onSelect(file.filePath)}
                >
                  <span className="quick-open-item-name">
                    {highlight(file.fileName, matches)}
                  </span>
                  <span className="quick-open-item-meta">
                    <span className="quick-open-item-folder" title={file.folderPath}>
                      {folderLabel}
                    </span>
                    <span className="quick-open-item-meta-sep">·</span>
                    <span>{formatModified(file.modifiedAt)}</span>
                    <span className="quick-open-item-meta-sep">·</span>
                    <span>{formatSize(file.size)}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        <div className="quick-open-footer">
          <span>↑↓ 이동</span>
          <span>Enter 열기</span>
          <span>Esc 닫기</span>
          {files.length > RESULT_LIMIT && (
            <span className="quick-open-footer-note">
              상위 {RESULT_LIMIT}개만 표시 (검색어로 좁히세요)
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

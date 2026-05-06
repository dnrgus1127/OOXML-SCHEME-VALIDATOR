import { useState, type DragEvent, type KeyboardEvent } from 'react'
import type { RecentFileEntry } from '../../shared/recent-files'
import { HomeRightPanel } from './home/HomeRightPanel'

interface HomeScreenProps {
  onOpenXmlFromHome: () => void | Promise<void>
  onOpenBatchFromHome: () => void | Promise<void>
  onOpenSchemasFromHome: () => void | Promise<void>
  onOpenSettingsFromHome: () => void | Promise<void>
  recentFiles: RecentFileEntry[]
  recentError: string | null
  onDismissRecentError: () => void
  onOpenRecent: (entry: RecentFileEntry) => void
  onRemoveRecent: (filePath: string) => void
  onClearRecent: () => void
  downloadFolders: string[]
  onOpenStorageFile: (filePath: string) => void
}

export function HomeScreen({
  onOpenXmlFromHome,
  onOpenBatchFromHome,
  onOpenSchemasFromHome,
  onOpenSettingsFromHome,
  recentFiles,
  recentError,
  onDismissRecentError,
  onOpenRecent,
  onRemoveRecent,
  onClearRecent,
  downloadFolders,
  onOpenStorageFile,
}: HomeScreenProps) {
  const [isDropOver, setIsDropOver] = useState(false)

  const handleDropzoneClick = () => {
    void onOpenXmlFromHome()
  }

  const handleDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    void onOpenXmlFromHome()
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    const types = Array.from(event.dataTransfer.types ?? [])
    if (!types.includes('Files')) return
    event.preventDefault()
    setIsDropOver(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return
    setIsDropOver(false)
  }

  const handleDrop = () => {
    // 실제 파일 처리는 App.tsx의 전역 drop 핸들러가 담당
    setIsDropOver(false)
  }

  return (
    <div className="home-screen">
      <div className="home--bold">
        <div className="bold-left">
          <button
            type="button"
            className="bold-settings-btn"
            onClick={onOpenSettingsFromHome}
            aria-label="Open settings"
            title="Settings"
          >
            ⚙
          </button>

          <div className="bold-eyebrow">
            <span className="dot" aria-hidden />
            <span>OOXML Validator</span>
          </div>

          <h1 className="bold-title">
            Validate.
            <br />
            Edit. <em>Ship clean XML.</em>
          </h1>

          <p className="bold-tagline">
            ECMA-376 OOXML schema validator for .xlsx, .docx and .pptx —
            <br />
            built for engineers who care about specification compliance.
          </p>

          <div
            className={`bold-dropzone${isDropOver ? ' is-over' : ''}`}
            role="button"
            tabIndex={0}
            onClick={handleDropzoneClick}
            onKeyDown={handleDropzoneKeyDown}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="bold-dropzone-glyph" aria-hidden>
              📝
            </div>
            <div className="bold-dropzone-title">Drop a document to begin</div>
            <div className="bold-dropzone-sub">
              <span>Drag &amp; drop</span>
              <span className="divider">·</span>
              <span>
                or press <span className="kbd">⌘</span> <span className="kbd">O</span>
              </span>
            </div>
            <div className="bold-formats">
              <span className="bold-format-chip">.xlsx</span>
              <span className="bold-format-chip">.docx</span>
              <span className="bold-format-chip">.pptx</span>
            </div>
          </div>

          <div className="bold-secondary">
            <button
              type="button"
              className="bold-action"
              onClick={() => void onOpenBatchFromHome()}
            >
              <span className="bold-action-icon" aria-hidden>
                📊
              </span>
              <span className="bold-action-text">
                <span className="bold-action-title">Batch Validator</span>
                <span className="bold-action-desc">Validate multiple files</span>
              </span>
            </button>
            <button
              type="button"
              className="bold-action"
              onClick={() => void onOpenSchemasFromHome()}
            >
              <span className="bold-action-icon" aria-hidden>
                📚
              </span>
              <span className="bold-action-text">
                <span className="bold-action-title">지원 스키마</span>
                <span className="bold-action-desc">Browse supported schemas</span>
              </span>
            </button>
          </div>
        </div>

        <HomeRightPanel
          recentFiles={recentFiles}
          recentError={recentError}
          onDismissRecentError={onDismissRecentError}
          onOpenRecent={onOpenRecent}
          onRemoveRecent={onRemoveRecent}
          onClearRecent={onClearRecent}
          downloadFolders={downloadFolders}
          onOpenStorageFile={onOpenStorageFile}
          onOpenSettings={onOpenSettingsFromHome}
        />
      </div>

      <div className="statusbar">
        <div className="sb-item">
          <span className="dot ok" aria-hidden />
          <span>Engine ready</span>
        </div>
        <div className="sb-spacer" />
        <div className="sb-item">
          <span>READY</span>
        </div>
        <div className="sb-item">
          <span>ECMA-376 · ISO/IEC 29500</span>
        </div>
      </div>
    </div>
  )
}

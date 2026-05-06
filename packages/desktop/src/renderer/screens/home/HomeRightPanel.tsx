import { useState } from 'react'
import type { RecentFileEntry } from '../../../shared/recent-files'
import { RecentFilesPanel } from './RecentFilesPanel'
import { StorageFilesPanel } from './StorageFilesPanel'

type HomeRightTab = 'storage' | 'recent'

interface HomeRightPanelProps {
  recentFiles: RecentFileEntry[]
  recentError: string | null
  onDismissRecentError: () => void
  onOpenRecent: (entry: RecentFileEntry) => void
  onRemoveRecent: (filePath: string) => void
  onClearRecent: () => void
  downloadFolders: string[]
  onOpenStorageFile: (filePath: string) => void
  onOpenSettings: () => void
}

export function HomeRightPanel({
  recentFiles,
  recentError,
  onDismissRecentError,
  onOpenRecent,
  onRemoveRecent,
  onClearRecent,
  downloadFolders,
  onOpenStorageFile,
  onOpenSettings,
}: HomeRightPanelProps) {
  const [activeTab, setActiveTab] = useState<HomeRightTab>('storage')

  return (
    <aside className="bold-right">
      <div className="bold-right-header">
        <div className="bold-right-tabs" role="tablist" aria-label="홈 사이드 패널">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'storage'}
            className={`bold-right-tab${activeTab === 'storage' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('storage')}
          >
            Storage
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'recent'}
            className={`bold-right-tab${activeTab === 'recent' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('recent')}
          >
            Recent · {recentFiles.length}
          </button>
        </div>
        <div className="bold-right-actions">
          {activeTab === 'recent' && (
            <button
              type="button"
              className="bold-right-clear-btn"
              onClick={onClearRecent}
              disabled={recentFiles.length === 0}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {activeTab === 'storage' ? (
        <StorageFilesPanel
          downloadFolders={downloadFolders}
          onOpenStorageFile={onOpenStorageFile}
          onOpenSettings={onOpenSettings}
        />
      ) : (
        <RecentFilesPanel
          recentFiles={recentFiles}
          recentError={recentError}
          onDismissRecentError={onDismissRecentError}
          onOpenRecent={onOpenRecent}
          onRemoveRecent={onRemoveRecent}
        />
      )}
    </aside>
  )
}

import type { RecentFileEntry } from '../../shared/recent-files'
import { RecentFilesPanel } from './home/RecentFilesPanel'

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
      <RecentFilesPanel
        recentFiles={recentFiles}
        recentError={recentError}
        onDismissRecentError={onDismissRecentError}
        onOpenRecent={onOpenRecent}
        onRemoveRecent={onRemoveRecent}
        onClearRecent={onClearRecent}
      />

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

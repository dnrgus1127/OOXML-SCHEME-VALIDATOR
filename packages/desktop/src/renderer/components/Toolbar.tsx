import { WindowTopBar } from './layout/WindowTopBar'

interface ToolbarProps {
  onOpenFile: () => void
  onSave: () => void
  onSaveAs: () => void
  onValidate: () => void
  onOpenSettings?: () => void
  openLabel?: string
  hasDocument: boolean
  filePath: string | null
  isDirty: boolean
  onNavigateHome?: () => void
}

export function Toolbar({
  onOpenFile,
  onSave,
  onSaveAs,
  onValidate,
  onOpenSettings,
  openLabel = 'Open',
  hasDocument,
  filePath,
  isDirty,
  onNavigateHome,
}: ToolbarProps) {
  const fileName = filePath ? filePath.split(/[\\/]/).pop() : null

  return (
    <WindowTopBar
      className="toolbar"
      leading={
        <>
          {onNavigateHome && (
            <button onClick={onNavigateHome} className="toolbar-btn">
              🏠 Home
            </button>
          )}
          <button onClick={onOpenFile} className="toolbar-btn">
            📂 {openLabel}
          </button>
          {onOpenSettings && (
            <button onClick={onOpenSettings} className="toolbar-btn">
              ⚙ Settings
            </button>
          )}
          <button
            onClick={onSave}
            className={`toolbar-btn${isDirty ? ' toolbar-btn--dirty' : ''}`}
            disabled={!hasDocument}
          >
            💾 Save
          </button>
          <button onClick={onSaveAs} className="toolbar-btn" disabled={!hasDocument}>
            💾 Save As
          </button>
          <button onClick={onValidate} className="toolbar-btn" disabled={!hasDocument}>
            ✓ Validate
          </button>
        </>
      }
      center={
        fileName && (
          <span className={`file-name${isDirty ? ' file-name--dirty' : ''}`}>
            {isDirty && '● '}
            {fileName}
          </span>
        )
      }
      trailing={<span className="app-title">OOXML Validator</span>}
    />
  )
}

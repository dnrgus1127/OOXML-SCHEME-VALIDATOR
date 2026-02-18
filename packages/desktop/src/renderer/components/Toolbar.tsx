import { HomeNavigationButton } from './HomeNavigationButton'

interface ToolbarProps {
  onOpenFile: () => void
  onSave: () => void
  onSaveAs: () => void
  onValidate: () => void
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
  openLabel = 'Open',
  hasDocument,
  filePath,
  isDirty,
  onNavigateHome,
}: ToolbarProps) {
  const fileName = filePath ? filePath.split(/[\\/]/).pop() : null

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        {onNavigateHome && <HomeNavigationButton onNavigateHome={onNavigateHome} />}
        <button onClick={onOpenFile} className="toolbar-btn">
          📂 {openLabel}
        </button>
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
      </div>

      <div className="toolbar-center">
        {fileName && (
          <span className={`file-name${isDirty ? ' file-name--dirty' : ''}`}>
            {isDirty && '● '}
            {fileName}
          </span>
        )}
      </div>

      <div className="toolbar-right">
        <span className="app-title">OOXML Validator</span>
      </div>
    </header>
  )
}

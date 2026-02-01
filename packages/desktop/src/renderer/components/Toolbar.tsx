interface ToolbarProps {
  onOpenFile: () => void
  onSave: () => void
  onValidate: () => void
  hasDocument: boolean
  filePath: string | null
}

export function Toolbar({ onOpenFile, onSave, onValidate, hasDocument, filePath }: ToolbarProps) {
  const fileName = filePath ? filePath.split('/').pop() : null

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <button onClick={onOpenFile} className="toolbar-btn">
          📂 Open
        </button>
        <button onClick={onSave} className="toolbar-btn" disabled={!hasDocument}>
          💾 Save
        </button>
        <button onClick={onValidate} className="toolbar-btn" disabled={!hasDocument}>
          ✓ Validate
        </button>
      </div>

      <div className="toolbar-center">
        {fileName && <span className="file-name">{fileName}</span>}
      </div>

      <div className="toolbar-right">
        <span className="app-title">OOXML Validator</span>
      </div>
    </header>
  )
}

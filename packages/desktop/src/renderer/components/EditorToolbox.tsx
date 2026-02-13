interface ToolboxAction {
  label: string
  onClick: () => void
  disabled?: boolean
}

interface EditorToolboxProps {
  title: string
  actions: ToolboxAction[]
  className?: string
}

export function EditorToolbox({ title, actions, className }: EditorToolboxProps) {
  return (
    <div className={`editor-toolbox ${className ?? ''}`.trim()} role="toolbar" aria-label={title}>
      <span className="toolbox-title">{title}</span>
      <div className="toolbox-actions">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className="editor-btn"
            disabled={action.disabled}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}

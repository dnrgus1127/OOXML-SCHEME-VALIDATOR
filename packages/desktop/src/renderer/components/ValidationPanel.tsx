interface ValidationResult {
  valid: boolean
  results: { path: string; valid: boolean; error?: string }[]
}

interface ValidationPanelProps {
  results: ValidationResult | null
  onClose: () => void
  onNavigate: (partPath: string) => void
  onRevalidate: () => void
  autoValidateEnabled: boolean
  isAutoValidating: boolean
}

export function ValidationPanel({
  results,
  onClose,
  onNavigate,
  onRevalidate,
  autoValidateEnabled,
  isAutoValidating,
}: ValidationPanelProps) {
  if (!results) {
    return (
      <div className="validation-results">
        <div className="validation-header">
          <h3>Validation Results</h3>
          <button onClick={onRevalidate} className="revalidate-btn">Re-validate</button>
          {autoValidateEnabled && (
            <span className={`auto-validate-status${isAutoValidating ? ' active' : ''}`}>
              {isAutoValidating ? '자동 검증 중...' : '자동 검증 대기'}
            </span>
          )}
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        <div className="validation-empty">
          No validation results. Click "Validate" to check the document.
        </div>
      </div>
    )
  }

  const validCount = results.results.filter((r) => r.valid).length
  const invalidCount = results.results.filter((r) => !r.valid).length

  return (
    <div className="validation-results">
      <div className="validation-header">
        <h3>Validation Results</h3>
        <button onClick={onRevalidate} className="revalidate-btn">Re-validate</button>
        {autoValidateEnabled && (
          <span className={`auto-validate-status${isAutoValidating ? ' active' : ''}`}>
            {isAutoValidating ? '자동 검증 중...' : '자동 검증 대기'}
          </span>
        )}
        <button onClick={onClose} className="close-btn">×</button>
      </div>

      <div className={`validation-summary ${results.valid ? 'valid' : 'invalid'}`}>
        <span className="status-icon">{results.valid ? '✓' : '✗'}</span>
        <span className="status-text">
          {results.valid ? 'Document is valid' : 'Document has errors'}
        </span>
        <span className="counts">
          {validCount} valid, {invalidCount} invalid
        </span>
      </div>

      <div className="validation-list">
        {results.results.map((result) => (
          <div
            key={result.path}
            className={`validation-item ${result.valid ? 'valid' : 'invalid'}`}
            onClick={() => onNavigate(result.path)}
          >
            <span className="item-icon">{result.valid ? '✓' : '✗'}</span>
            <span className="item-path">{result.path}</span>
            {result.error && (
              <span className="item-error">{result.error}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

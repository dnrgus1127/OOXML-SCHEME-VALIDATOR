import { useState } from 'react'

interface ValidationError {
  code: string
  message: string
  path: string
  value?: string
  line?: number
  column?: number
}

interface PartValidationResult {
  path: string
  valid: boolean
  error?: string // For backward compatibility (XML parse errors)
  errors?: ValidationError[] // Schema validation errors
}

interface ValidationSummary {
  totalParts: number
  validParts: number
  invalidParts: number
  totalErrors: number
}

interface ValidationResult {
  valid: boolean
  results: PartValidationResult[]
  summary?: ValidationSummary
}

interface ValidationPanelProps {
  results: ValidationResult | null
  onClose: () => void
  onNavigate: (partPath: string) => void
  onRevalidate: () => void
}

export function ValidationPanel({
  results,
  onClose,
  onNavigate,
  onRevalidate,
}: ValidationPanelProps) {
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set())

  const toggleExpanded = (path: string) => {
    setExpandedParts((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  if (!results) {
    return (
      <div className="validation-results">
        <div className="validation-header">
          <h3>Validation Results</h3>
          <button onClick={onRevalidate} className="revalidate-btn">
            Re-validate
          </button>
          <button onClick={onClose} className="close-btn">
            ×
          </button>
        </div>
        <div className="validation-empty">
          No validation results. Click "Validate" to check the document.
        </div>
      </div>
    )
  }

  const validCount = results.summary?.validParts ?? results.results.filter((r) => r.valid).length
  const invalidCount =
    results.summary?.invalidParts ?? results.results.filter((r) => !r.valid).length
  const totalErrors =
    results.summary?.totalErrors ??
    results.results.reduce((sum, r) => sum + (r.errors?.length || (r.error ? 1 : 0)), 0)

  return (
    <div className="validation-results">
      <div className="validation-header">
        <h3>Validation Results</h3>
        <button onClick={onRevalidate} className="revalidate-btn">
          Re-validate
        </button>
        <button onClick={onClose} className="close-btn">
          ×
        </button>
      </div>

      <div className={`validation-summary ${results.valid ? 'valid' : 'invalid'}`}>
        <span className="status-icon">{results.valid ? '✓' : '✗'}</span>
        <span className="status-text">
          {results.valid ? 'Document is valid' : 'Document has errors'}
        </span>
        <span className="counts">
          {validCount} valid, {invalidCount} invalid
          {totalErrors > 0 && ` (${totalErrors} errors)`}
        </span>
      </div>

      <div className="validation-list">
        {results.results.map((result) => {
          const hasErrors = (result.errors && result.errors.length > 0) || result.error
          const isExpanded = expandedParts.has(result.path)
          const errorCount = result.errors?.length || (result.error ? 1 : 0)

          return (
            <div
              key={result.path}
              className={`validation-item-container ${result.valid ? 'valid' : 'invalid'}`}
            >
              <div
                className="validation-item"
                onClick={() => {
                  if (hasErrors) {
                    toggleExpanded(result.path)
                  } else {
                    onNavigate(result.path)
                  }
                }}
              >
                <span className="item-icon">{result.valid ? '✓' : '✗'}</span>
                <span className="item-path">{result.path}</span>
                {hasErrors && (
                  <span className="item-error-count">
                    {errorCount} error{errorCount !== 1 ? 's' : ''}
                    <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                  </span>
                )}
                <button
                  className="navigate-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onNavigate(result.path)
                  }}
                  title="Go to part"
                >
                  →
                </button>
              </div>

              {isExpanded && hasErrors && (
                <div className="validation-errors">
                  {/* Legacy error format */}
                  {result.error && !result.errors && (
                    <div className="validation-error">
                      <span className="error-code">XML_PARSE_ERROR</span>
                      <span className="error-message">{result.error}</span>
                    </div>
                  )}

                  {/* New schema validation errors */}
                  {result.errors?.map((error, index) => (
                    <div key={index} className="validation-error">
                      <div className="error-header">
                        <span className="error-code">{error.code}</span>
                        {error.line !== undefined && (
                          <span className="error-location">
                            Line {error.line}
                            {error.column !== undefined && `:${error.column}`}
                          </span>
                        )}
                      </div>
                      <div className="error-message">{error.message}</div>
                      <div className="error-path">{error.path}</div>
                      {error.value && (
                        <div className="error-value">
                          Value: <code>{error.value}</code>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { useState } from 'react'

interface ValidationError {
  code: string
  message: string
  path: string
  value?: string
  line?: number
  column?: number
}

interface PartResult {
  path: string
  valid: boolean
  errors?: ValidationError[]
}

interface FileValidationResult {
  filePath: string
  fileName: string
  success: boolean
  documentType?: string
  validation?: {
    valid: boolean
    results: PartResult[]
    summary: {
      totalParts: number
      validParts: number
      invalidParts: number
      totalErrors: number
    }
  }
  error?: string
}

interface ValidationResultTreeProps {
  results: FileValidationResult[]
  expandedFiles: Set<string>
  onToggleFile: (filePath: string) => void
}

export function ValidationResultTree({
  results,
  expandedFiles,
  onToggleFile,
}: ValidationResultTreeProps) {
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set())

  const togglePart = (partKey: string) => {
    const newExpanded = new Set(expandedParts)
    if (newExpanded.has(partKey)) {
      newExpanded.delete(partKey)
    } else {
      newExpanded.add(partKey)
    }
    setExpandedParts(newExpanded)
  }

  return (
    <div className="validation-tree">
      {results.map((file) => {
        const isExpanded = expandedFiles.has(file.filePath)
        const isValid = file.success && file.validation?.valid

        return (
          <div key={file.filePath} className="tree-file">
            <div
              className={`tree-file-header ${isValid ? 'valid' : 'invalid'}`}
              onClick={() => onToggleFile(file.filePath)}
            >
              <span className="tree-icon">{isExpanded ? '▼' : '▶'}</span>
              <span className="tree-file-name">{file.fileName}</span>
              <span className={`tree-status ${isValid ? 'valid' : 'invalid'}`}>
                {file.success ? (isValid ? '✓ VALID' : '✗ INVALID') : '✗ ERROR'}
              </span>
              {file.validation && (
                <span className="tree-stats">
                  {file.validation.summary.invalidParts > 0 && (
                    <>
                      {file.validation.summary.invalidParts} invalid part
                      {file.validation.summary.invalidParts > 1 ? 's' : ''} ·{' '}
                      {file.validation.summary.totalErrors} error
                      {file.validation.summary.totalErrors > 1 ? 's' : ''}
                    </>
                  )}
                </span>
              )}
            </div>

            {isExpanded && (
              <div className="tree-file-content">
                {file.success ? (
                  file.validation ? (
                    <div className="tree-parts">
                      {file.validation.results
                        .filter((p) => !p.valid)
                        .map((part) => {
                          const partKey = `${file.filePath}:${part.path}`
                          const isPartExpanded = expandedParts.has(partKey)

                          return (
                            <div key={partKey} className="tree-part">
                              <div
                                className="tree-part-header"
                                onClick={() => togglePart(partKey)}
                              >
                                <span className="tree-icon">
                                  {isPartExpanded ? '▼' : '▶'}
                                </span>
                                <span className="tree-part-name">{part.path}</span>
                                <span className="tree-part-errors">
                                  {part.errors?.length || 0} error
                                  {part.errors && part.errors.length > 1 ? 's' : ''}
                                </span>
                              </div>

                              {isPartExpanded && part.errors && (
                                <div className="tree-errors">
                                  {part.errors.map((error, idx) => (
                                    <div key={idx} className="tree-error">
                                      <div className="error-header">
                                        <span className="error-code">{error.code}</span>
                                        {error.line && (
                                          <span className="error-location">
                                            Line {error.line}
                                            {error.column && `, Col ${error.column}`}
                                          </span>
                                        )}
                                      </div>
                                      <div className="error-message">{error.message}</div>
                                      <div className="error-path">{error.path}</div>
                                      {error.value && (
                                        <div className="error-value">Value: {error.value}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      {file.validation.results.every((p) => p.valid) && (
                        <div className="tree-no-errors">All parts are valid</div>
                      )}
                    </div>
                  ) : (
                    <div className="tree-error-message">No validation data available</div>
                  )
                ) : (
                  <div className="tree-error-message">{file.error}</div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

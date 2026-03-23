import { useState } from 'react'

interface ValidationError {
  code: string
  message: string
  path: string
  value?: string
  line?: number
  column?: number
}

interface ValidationWarning {
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
  warnings?: ValidationWarning[]
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
      totalWarnings: number
    }
  }
  error?: string
}

interface ValidationResultTreeProps {
  results: FileValidationResult[]
  expandedFiles: Set<string>
  onToggleFile: (filePath: string) => void
}

function formatIssueCount(errorCount: number, warningCount: number): string {
  const parts: string[] = []

  if (errorCount > 0) {
    parts.push(`${errorCount} error${errorCount !== 1 ? 's' : ''}`)
  }

  if (warningCount > 0) {
    parts.push(`${warningCount} warning${warningCount !== 1 ? 's' : ''}`)
  }

  return parts.join(', ')
}

export function ValidationResultTree({
  results,
  expandedFiles,
  onToggleFile,
}: ValidationResultTreeProps) {
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set())

  const togglePart = (partKey: string) => {
    const next = new Set(expandedParts)
    if (next.has(partKey)) {
      next.delete(partKey)
    } else {
      next.add(partKey)
    }
    setExpandedParts(next)
  }

  return (
    <div className="validation-tree">
      {results.map((file) => {
        const isExpanded = expandedFiles.has(file.filePath)
        const warningCount = file.validation?.summary.totalWarnings ?? 0
        const tone = !file.success ? 'invalid' : !file.validation?.valid ? 'invalid' : warningCount > 0 ? 'warning' : 'valid'
        const statusText = !file.success ? 'ERROR' : tone === 'invalid' ? 'INVALID' : tone === 'warning' ? 'WARNINGS' : 'VALID'

        return (
          <div key={file.filePath} className="tree-file">
            <div className={`tree-file-header ${tone}`} onClick={() => onToggleFile(file.filePath)}>
              <span className="tree-icon">{isExpanded ? '-' : '+'}</span>
              <span className="tree-file-name">{file.fileName}</span>
              <span className={`tree-status ${tone}`}>{statusText}</span>
              {file.validation && (
                <span className="tree-stats">
                  {file.validation.summary.invalidParts > 0 &&
                    `${file.validation.summary.invalidParts} invalid part${file.validation.summary.invalidParts > 1 ? 's' : ''}`}
                  {file.validation.summary.totalErrors > 0 &&
                    `${file.validation.summary.invalidParts > 0 ? ', ' : ''}${file.validation.summary.totalErrors} error${file.validation.summary.totalErrors > 1 ? 's' : ''}`}
                  {warningCount > 0 &&
                    `${file.validation.summary.invalidParts > 0 || file.validation.summary.totalErrors > 0 ? ', ' : ''}${warningCount} warning${warningCount > 1 ? 's' : ''}`}
                </span>
              )}
            </div>

            {isExpanded && (
              <div className="tree-file-content">
                {file.success ? (
                  file.validation ? (
                    <div className="tree-parts">
                      {file.validation.results
                        .filter(
                          (part) => !part.valid || (part.warnings?.length ?? 0) > 0 || (part.errors?.length ?? 0) > 0
                        )
                        .map((part) => {
                          const partKey = `${file.filePath}:${part.path}`
                          const isPartExpanded = expandedParts.has(partKey)
                          const errorCount = part.errors?.length ?? 0
                          const partWarningCount = part.warnings?.length ?? 0
                          const partTone = part.valid ? (partWarningCount > 0 ? 'warning' : 'valid') : 'invalid'

                          return (
                            <div key={partKey} className="tree-part">
                              <div
                                className={`tree-part-header ${partTone}`}
                                onClick={() => togglePart(partKey)}
                              >
                                <span className="tree-icon">{isPartExpanded ? '-' : '+'}</span>
                                <span className="tree-part-name">{part.path}</span>
                                <span
                                  className={`tree-part-issues${errorCount === 0 && partWarningCount > 0 ? ' warning-only' : ''}`}
                                >
                                  {formatIssueCount(errorCount, partWarningCount)}
                                </span>
                              </div>

                              {isPartExpanded && (
                                <div className="tree-errors">
                                  {part.errors?.map((error, index) => (
                                    <div key={`error-${index}`} className="tree-error">
                                      <div className="error-header">
                                        <span className="error-code">{error.code}</span>
                                        {error.line !== undefined && (
                                          <span className="error-location">
                                            Line {error.line}
                                            {error.column !== undefined && `, Col ${error.column}`}
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

                                  {part.warnings?.map((warning, index) => (
                                    <div key={`warning-${index}`} className="tree-warning">
                                      <div className="error-header">
                                        <span className="warning-code">{warning.code}</span>
                                        {warning.line !== undefined && (
                                          <span className="error-location">
                                            Line {warning.line}
                                            {warning.column !== undefined && `, Col ${warning.column}`}
                                          </span>
                                        )}
                                      </div>
                                      <div className="error-message">{warning.message}</div>
                                      <div className="error-path">{warning.path}</div>
                                      {warning.value && (
                                        <div className="error-value">Value: {warning.value}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      {file.validation.results.every(
                        (part) =>
                          part.valid &&
                          (part.errors?.length ?? 0) === 0 &&
                          (part.warnings?.length ?? 0) === 0
                      ) && <div className="tree-no-errors">All parts are valid</div>}
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

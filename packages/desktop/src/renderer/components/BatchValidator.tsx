import { useState, useEffect, useCallback, useRef } from 'react'
import { ValidationResultTree } from './ValidationResultTree'
import { HomeNavigationButton } from './HomeNavigationButton'

interface FileValidationResult {
  filePath: string
  fileName: string
  success: boolean
  documentType?: string
  validation?: {
    valid: boolean
    results: Array<{
      path: string
      valid: boolean
      errors?: Array<{
        code: string
        message: string
        path: string
        value?: string
        line?: number
        column?: number
      }>
    }>
    summary: {
      totalParts: number
      validParts: number
      invalidParts: number
      totalErrors: number
    }
  }
  error?: string
}

interface BatchValidatorProps {
  onClose?: () => void
  initialFilePaths?: string[] | null
  onRecentRecord?: () => Promise<void> | void
}

function getFileName(filePath: string): string {
  const segments = filePath.split(/[\\/]/)
  return segments[segments.length - 1] || filePath
}

export function BatchValidator({ onClose, initialFilePaths, onRecentRecord }: BatchValidatorProps) {
  const [results, setResults] = useState<FileValidationResult[]>([])
  const [isValidating, setIsValidating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const lastInitialFilesKeyRef = useRef<string | null>(null)

  // Listen for batch progress updates
  useEffect(() => {
    const cleanup = window.electronAPI.onBatchProgress((progressData) => {
      setProgress(progressData)
    })
    return cleanup
  }, [])

  const persistRecentFiles = useCallback(
    async (fileResults: FileValidationResult[]) => {
      const succeeded = fileResults.filter((item) => item.success)
      if (succeeded.length === 0) return

      await window.electronAPI.addRecentFiles(
        succeeded.map((item) => ({
          filePath: item.filePath,
          fileName: item.fileName || getFileName(item.filePath),
          lastTool: 'batch-validator' as const,
        }))
      )
      await onRecentRecord?.()
    },
    [onRecentRecord]
  )

  const validateFiles = useCallback(
    async (filePaths: string[], append: boolean): Promise<boolean> => {
      if (isValidating || filePaths.length === 0) return false

      setErrorMessage(null)
      setStatusMessage(null)
      setIsValidating(true)
      setProgress({ current: 0, total: filePaths.length })
      if (!append) {
        setResults([])
        setExpandedFiles(new Set())
      }

      try {
        const result = await window.electronAPI.batchValidate(filePaths)

        if (!result.success || !result.data) {
          setErrorMessage(result.error ?? 'Batch validation failed')
          return false
        }

        const newResults = result.data as FileValidationResult[]
        if (append) {
          setResults((prev) => {
            const merged = new Map(prev.map((item) => [item.filePath, item]))
            for (const item of newResults) {
              merged.set(item.filePath, item)
            }
            return Array.from(merged.values())
          })
          setExpandedFiles((prev) => {
            const next = new Set(prev)
            for (const item of newResults) {
              next.add(item.filePath)
            }
            return next
          })
          setStatusMessage(
            `Added ${newResults.length} file${newResults.length > 1 ? 's' : ''} from menu`
          )
        } else {
          setResults(newResults)
          setExpandedFiles(new Set(newResults.map((item) => item.filePath)))
        }
        await persistRecentFiles(newResults)
        return true
      } catch (error) {
        setErrorMessage(`Batch validation failed: ${String(error)}`)
        return false
      } finally {
        setIsValidating(false)
      }
    },
    [isValidating, persistRecentFiles]
  )

  useEffect(() => {
    const cleanup = window.electronAPI.onFileOpened(async (filePath) => {
      await validateFiles([filePath], true)
    })
    return cleanup
  }, [validateFiles])

  useEffect(() => {
    if (!initialFilePaths || initialFilePaths.length === 0) return

    const key = initialFilePaths.join('\u0000')
    if (lastInitialFilesKeyRef.current === key) return
    lastInitialFilesKeyRef.current = key

    void validateFiles(initialFilePaths, false)
  }, [initialFilePaths, validateFiles])

  const handleSelectFiles = async () => {
    const filePaths = await window.electronAPI.openFiles()
    if (!filePaths || filePaths.length === 0) return
    await validateFiles(filePaths, false)
  }

  const handleExport = async (format: 'json' | 'csv' | 'html' | 'pdf') => {
    if (results.length === 0) return

    setErrorMessage(null)
    setStatusMessage(null)

    try {
      const result = await window.electronAPI.exportResults(format, results)
      if (result.success) {
        setStatusMessage(`Exported ${format.toUpperCase()} to ${result.filePath}`)
      } else {
        setErrorMessage(result.error ?? 'Export failed')
      }
    } catch (error) {
      setErrorMessage(`Export failed: ${String(error)}`)
    }
  }

  const toggleFile = (filePath: string) => {
    const newExpanded = new Set(expandedFiles)
    if (newExpanded.has(filePath)) {
      newExpanded.delete(filePath)
    } else {
      newExpanded.add(filePath)
    }
    setExpandedFiles(newExpanded)
  }

  const totalFiles = results.length
  const validFiles = results.filter((r) => r.success && r.validation?.valid).length
  const invalidFiles = results.filter((r) => !r.success || !r.validation?.valid).length
  const totalErrors = results.reduce((sum, r) => sum + (r.validation?.summary?.totalErrors || 0), 0)

  return (
    <div className="batch-validator">
      <div className="batch-header">
        <div className="batch-header-left">
          {onClose && <HomeNavigationButton onNavigateHome={onClose} />}
          <h2>Batch Validation</h2>
        </div>
      </div>

      <div className="batch-toolbar">
        <button onClick={handleSelectFiles} disabled={isValidating}>
          {isValidating ? 'Validating...' : results.length > 0 ? 'Change Files' : 'Select Files'}
        </button>

        {results.length > 0 && (
          <div className="export-buttons">
            <button onClick={() => handleExport('json')}>Export JSON</button>
            <button onClick={() => handleExport('csv')}>Export CSV</button>
            <button onClick={() => handleExport('html')}>Export HTML</button>
            <button onClick={() => handleExport('pdf')} disabled>
              Export PDF (Coming Soon)
            </button>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="error-banner">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)}>×</button>
        </div>
      )}

      {statusMessage && <div className="batch-status-banner">{statusMessage}</div>}

      {isValidating && (
        <div className="progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="progress-text">
            Validating {progress.current} of {progress.total} files...
          </div>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="batch-summary">
            <h3>Summary</h3>
            <div className="summary-stats">
              <div className="stat">
                <span className="stat-label">Total Files:</span>
                <span className="stat-value">{totalFiles}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Valid:</span>
                <span className="stat-value valid">{validFiles}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Invalid:</span>
                <span className="stat-value invalid">{invalidFiles}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Total Errors:</span>
                <span className="stat-value">{totalErrors}</span>
              </div>
            </div>
          </div>

          <div className="batch-results">
            <ValidationResultTree
              results={results}
              expandedFiles={expandedFiles}
              onToggleFile={toggleFile}
            />
          </div>
        </>
      )}

      {!isValidating && results.length === 0 && (
        <div className="batch-empty">
          <p>No files validated yet.</p>
          <p>Click "Select Files" to start batch validation.</p>
        </div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useDocumentStore } from '../stores/document'
import { DocumentTree } from '../components/DocumentTree'
import { XmlEditor } from '../components/XmlEditor'
import { ValidationPanel } from '../components/ValidationPanel'
import {
  SchemaReferencePanel,
  type OoxmlSchemaReferenceSummary,
} from '../components/SchemaReferencePanel'
import { Toolbar } from '../components/Toolbar'
import { useSettingsStore } from '../stores/settings'
import { matchesShortcut } from '../utils/shortcuts'

interface XmlEditorScreenProps {
  onNavigateHome: () => void
  onOpenSettings: () => void
  isSettingsOpen: boolean
  onRecentRecord?: () => Promise<void> | void
}

function getFileName(filePath: string): string {
  const segments = filePath.split(/[\\/]/)
  return segments[segments.length - 1] || filePath
}

export function XmlEditorScreen({
  onNavigateHome,
  onOpenSettings,
  isSettingsOpen,
  onRecentRecord,
}: XmlEditorScreenProps) {
  const {
    filePath,
    fileData,
    documentData,
    selectedPart,
    partContent,
    validationResults,
    isLoading,
    error,
    setFilePath,
    loadDocument,
    selectPart,
    updatePartContent,
    modifiedContent,
    saveDocument,
    saveDocumentAs,
    validate,
    clearError,
  } = useDocumentStore()
  const validateOnOpen = useSettingsStore((state) => state.xmlEditor.validateOnOpen)
  const revalidateShortcut = useSettingsStore((state) => state.xmlEditor.revalidateShortcut)

  const [showValidation, setShowValidation] = useState(true)

  const [schemaReferenceSummary, setSchemaReferenceSummary] =
    useState<OoxmlSchemaReferenceSummary | null>(null)
  const [isSchemaReferenceLoading, setIsSchemaReferenceLoading] = useState(false)
  const [schemaReferenceError, setSchemaReferenceError] = useState<string | null>(null)

  const isDirty = modifiedContent !== null && modifiedContent !== partContent

  const confirmFileChangeIfNeeded = useCallback(async () => {
    if (!isDirty) return true

    const choice = await window.electronAPI.confirmFileChange()
    if (choice === 'cancel') return false
    if (choice === 'discard') return true
    if (!filePath) return false

    return saveDocument(filePath)
  }, [filePath, isDirty, saveDocument])

  const loadFileAtPath = useCallback(
    async (path: string) => {
      setFilePath(path)
      const loaded = await loadDocument(path)
      if (!loaded) return false

      await window.electronAPI.addRecentFile({
        filePath: path,
        fileName: getFileName(path),
        lastTool: 'xml-editor',
      })
      await onRecentRecord?.()

      if (validateOnOpen) {
        await validate()
        setShowValidation(true)
      }

      return true
    },
    [loadDocument, onRecentRecord, setFilePath, validate, validateOnOpen]
  )

  const handleChangeFile = useCallback(
    async (nextPath?: string) => {
      const canChangeFile = await confirmFileChangeIfNeeded()
      if (!canChangeFile) return

      const path = nextPath ?? (await window.electronAPI.openFile())
      if (!path) return

      await loadFileAtPath(path)
    },
    [confirmFileChangeIfNeeded, loadFileAtPath]
  )

  // Handle file open from menu
  useEffect(() => {
    const cleanup = window.electronAPI.onFileOpened(async (path) => {
      await handleChangeFile(path)
    })
    return cleanup
  }, [handleChangeFile])

  // Handle save from menu
  useEffect(() => {
    const cleanup = window.electronAPI.onMenuSave(async () => {
      if (filePath) {
        const saved = await saveDocument(filePath)
        if (saved) {
          await validate()
          setShowValidation(true)
        }
      }
    })
    return cleanup
  }, [filePath, saveDocument, validate])

  // Handle save-as from menu
  useEffect(() => {
    const cleanup = window.electronAPI.onMenuSaveAs(async () => {
      const newPath = await window.electronAPI.saveFile(filePath ?? undefined)
      if (newPath) {
        const saved = await saveDocumentAs(newPath)
        if (saved) {
          await validate()
          setShowValidation(true)
        }
      }
    })
    return cleanup
  }, [filePath, saveDocumentAs, validate])

  // Handle validate from menu
  useEffect(() => {
    const cleanup = window.electronAPI.onMenuValidate(async () => {
      await validate()
      setShowValidation(true)
    })
    return cleanup
  }, [validate])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!documentData) return
      if (isSettingsOpen) return
      if (event.repeat) return
      if (!matchesShortcut(event, revalidateShortcut)) return

      event.preventDefault()
      void (async () => {
        await validate()
        setShowValidation(true)
      })()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [documentData, isSettingsOpen, revalidateShortcut, validate])

  const handleSave = async () => {
    if (!filePath) return
    const saved = await saveDocument(filePath)
    if (saved) {
      await validate()
      setShowValidation(true)
    }
  }

  const handleSaveAs = async () => {
    const newPath = await window.electronAPI.saveFile(filePath ?? undefined)
    if (newPath) {
      const saved = await saveDocumentAs(newPath)
      if (saved) {
        await validate()
        setShowValidation(true)
      }
    }
  }

  const handleSelectPart = async (partPath: string) => {
    await selectPart(partPath)
  }

  const handleContentChange = (content: string) => {
    updatePartContent(content)
  }

  const handleValidate = async () => {
    await validate()
    setShowValidation(true)
  }

  useEffect(() => {
    if (!fileData) {
      setSchemaReferenceSummary(null)
      setSchemaReferenceError(null)
      setIsSchemaReferenceLoading(false)
      return
    }

    let cancelled = false
    setIsSchemaReferenceLoading(true)

    const timeout = window.setTimeout(async () => {
      try {
        let base64Data = fileData

        if (modifiedContent !== null && selectedPart) {
          const updated = await window.electronAPI.updatePart(
            fileData,
            selectedPart,
            modifiedContent
          )
          if (updated.success && updated.data) {
            base64Data = updated.data
          }
        }

        const result = await window.electronAPI.analyzeSchemaReferences(base64Data)
        if (cancelled) return

        if (!result.success) {
          setSchemaReferenceSummary(null)
          setSchemaReferenceError(result.error || '문서 스키마 참조 분석에 실패했습니다.')
          return
        }

        setSchemaReferenceSummary(result.data ?? null)
        setSchemaReferenceError(null)
      } catch {
        if (cancelled) return

        setSchemaReferenceSummary(null)
        setSchemaReferenceError('문서 스키마 참조 분석 중 오류가 발생했습니다.')
      } finally {
        if (!cancelled) {
          setIsSchemaReferenceLoading(false)
        }
      }
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [fileData, selectedPart])

  return (
    <>
      <Toolbar
        onOpenFile={() => void handleChangeFile()}
        openLabel={documentData ? 'Change File' : 'Open File'}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onValidate={handleValidate}
        onOpenSettings={onOpenSettings}
        hasDocument={!!documentData}
        filePath={filePath}
        isDirty={isDirty}
        onNavigateHome={onNavigateHome}
      />

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={clearError}>×</button>
        </div>
      )}

      <div className="main-content">
        {!documentData ? (
          <div className="welcome">
            <h1>OOXML Validator</h1>
            <p>Open an Office document (xlsx, docx, pptx) to start</p>
            <button onClick={() => void handleChangeFile()}>Open File</button>
          </div>
        ) : (
          <>
            <aside className="sidebar">
              <DocumentTree
                documentType={documentData.documentType}
                parts={documentData.parts}
                selectedPart={selectedPart}
                onSelectPart={handleSelectPart}
              />
            </aside>

            <main className="editor-container">
              {selectedPart && partContent !== null ? (
                <XmlEditor
                  content={partContent}
                  partPath={selectedPart}
                  onChange={handleContentChange}
                />
              ) : isLoading ? (
                <div className="loading">Loading...</div>
              ) : (
                <div className="placeholder">Select a part from the tree to view its content</div>
              )}
            </main>

            <aside className="right-panels">
              {showValidation ? (
                <div className="validation-panel">
                  <ValidationPanel
                    results={validationResults}
                    onClose={() => setShowValidation(false)}
                    onNavigate={handleSelectPart}
                    onRevalidate={handleValidate}
                  />
                </div>
              ) : null}

              <SchemaReferencePanel
                summary={schemaReferenceSummary}
                isLoading={isSchemaReferenceLoading}
                error={schemaReferenceError}
              />
            </aside>
          </>
        )}
      </div>
    </>
  )
}

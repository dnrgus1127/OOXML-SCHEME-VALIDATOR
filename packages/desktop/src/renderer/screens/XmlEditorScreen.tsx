import { useCallback, useEffect, useState } from 'react'
import { useDocumentStore } from '../stores/document'
import { DocumentTree } from '../components/DocumentTree'
import { XmlEditor } from '../components/XmlEditor'
import { ValidationPanel } from '../components/ValidationPanel'
import { Toolbar } from '../components/Toolbar'
import { useSettingsStore } from '../stores/settings'

interface XmlEditorScreenProps {
  onNavigateHome: () => void
  onOpenSettings: () => void
}

export function XmlEditorScreen({ onNavigateHome, onOpenSettings }: XmlEditorScreenProps) {
  const {
    filePath,
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

  const [showValidation, setShowValidation] = useState(true)

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
      await loadDocument(path)
      if (validateOnOpen) {
        await validate()
        setShowValidation(true)
      }
    },
    [loadDocument, setFilePath, validate, validateOnOpen]
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

            {showValidation && (
              <aside className="validation-panel">
                <ValidationPanel
                  results={validationResults}
                  onClose={() => setShowValidation(false)}
                  onNavigate={handleSelectPart}
                  onRevalidate={handleValidate}
                />
              </aside>
            )}
          </>
        )}
      </div>
    </>
  )
}

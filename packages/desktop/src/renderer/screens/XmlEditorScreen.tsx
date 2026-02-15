import { useEffect, useState } from 'react'
import { useDocumentStore } from '../stores/document'
import { DocumentTree } from '../components/DocumentTree'
import { XmlEditor } from '../components/XmlEditor'
import { ValidationPanel } from '../components/ValidationPanel'
import { Toolbar } from '../components/Toolbar'

interface XmlEditorScreenProps {
  onNavigateHome: () => void
}

export function XmlEditorScreen({ onNavigateHome }: XmlEditorScreenProps) {
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

  const [showValidation, setShowValidation] = useState(true)

  const isDirty = modifiedContent !== null && modifiedContent !== partContent

  // Handle file open from menu
  useEffect(() => {
    const cleanup = window.electronAPI.onFileOpened(async (path) => {
      setFilePath(path)
      await loadDocument(path)
    })
    return cleanup
  }, [setFilePath, loadDocument])

  // Handle save from menu
  useEffect(() => {
    const cleanup = window.electronAPI.onMenuSave(async () => {
      if (filePath) {
        await saveDocument(filePath)
        await validate()
        setShowValidation(true)
      }
    })
    return cleanup
  }, [filePath, saveDocument, validate])

  // Handle save-as from menu
  useEffect(() => {
    const cleanup = window.electronAPI.onMenuSaveAs(async () => {
      const newPath = await window.electronAPI.saveFile(filePath ?? undefined)
      if (newPath) {
        await saveDocumentAs(newPath)
        await validate()
        setShowValidation(true)
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

  const handleOpenFile = async () => {
    const path = await window.electronAPI.openFile()
    if (path) {
      setFilePath(path)
      await loadDocument(path)
    }
  }

  const handleSave = async () => {
    if (!filePath) return
    await saveDocument(filePath)
    await validate()
    setShowValidation(true)
  }

  const handleSaveAs = async () => {
    const newPath = await window.electronAPI.saveFile(filePath ?? undefined)
    if (newPath) {
      await saveDocumentAs(newPath)
      await validate()
      setShowValidation(true)
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
        onOpenFile={handleOpenFile}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onValidate={handleValidate}
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
            <button onClick={handleOpenFile}>Open File</button>
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

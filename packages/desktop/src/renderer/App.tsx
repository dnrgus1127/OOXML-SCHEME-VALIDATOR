import { useEffect, useState } from 'react'
import { useDocumentStore } from './stores/document'
import { DocumentTree } from './components/DocumentTree'
import { XmlEditor } from './components/XmlEditor'
import { ValidationPanel } from './components/ValidationPanel'
import { Toolbar } from './components/Toolbar'

declare global {
  interface Window {
    electronAPI: {
      openFile: () => Promise<string | null>
      saveFile: (defaultPath?: string) => Promise<string | null>
      readFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>
      writeFile: (filePath: string, data: string) => Promise<{ success: boolean; error?: string }>
      parseDocument: (base64Data: string) => Promise<{ success: boolean; data?: any; error?: string }>
      getPart: (base64Data: string, partPath: string) => Promise<{ success: boolean; data?: string; error?: string }>
      updatePart: (base64Data: string, partPath: string, content: string) => Promise<{ success: boolean; data?: string; error?: string }>
      validate: (base64Data: string) => Promise<{ success: boolean; data?: any; error?: string }>
      onFileOpened: (callback: (filePath: string) => void) => () => void
      onMenuSave: (callback: () => void) => () => void
      onMenuSaveAs: (callback: () => void) => () => void
      onMenuValidate: (callback: () => void) => () => void
    }
  }
}

export default function App() {
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
    saveDocument,
    validate,
    clearError,
  } = useDocumentStore()

  const [showValidation, setShowValidation] = useState(false)

  // Handle file open from menu
  useEffect(() => {
    const cleanup = window.electronAPI.onFileOpened(async (path) => {
      setFilePath(path)
      await loadDocument(path)
    })
    return cleanup
  }, [])

  // Handle save from menu
  useEffect(() => {
    const cleanup = window.electronAPI.onMenuSave(async () => {
      if (filePath) {
        await saveDocument(filePath)
      }
    })
    return cleanup
  }, [filePath])

  // Handle validate from menu
  useEffect(() => {
    const cleanup = window.electronAPI.onMenuValidate(async () => {
      await validate()
      setShowValidation(true)
    })
    return cleanup
  }, [])

  const handleOpenFile = async () => {
    const path = await window.electronAPI.openFile()
    if (path) {
      setFilePath(path)
      await loadDocument(path)
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
    <div className="app">
      <Toolbar
        onOpenFile={handleOpenFile}
        onSave={() => filePath && saveDocument(filePath)}
        onValidate={handleValidate}
        hasDocument={!!documentData}
        filePath={filePath}
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
              {isLoading ? (
                <div className="loading">Loading...</div>
              ) : selectedPart && partContent !== null ? (
                <XmlEditor
                  content={partContent}
                  partPath={selectedPart}
                  onChange={handleContentChange}
                />
              ) : (
                <div className="placeholder">
                  Select a part from the tree to view its content
                </div>
              )}
            </main>

            {showValidation && (
              <aside className="validation-panel">
                <ValidationPanel
                  results={validationResults}
                  onClose={() => setShowValidation(false)}
                  onNavigate={handleSelectPart}
                />
              </aside>
            )}
          </>
        )}
      </div>
    </div>
  )
}

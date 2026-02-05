import { useEffect, useRef, useState } from 'react'
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
    modifiedContent,
    saveDocument,
    saveDocumentAs,
    validate,
    clearError,
  } = useDocumentStore()

  const [showValidation, setShowValidation] = useState(true)
  const [autoFormatOnLoad, setAutoFormatOnLoad] = useState(true)
  const [autoValidate, setAutoValidate] = useState(true)
  const [isAutoValidating, setIsAutoValidating] = useState(false)
  const autoValidateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoValidateInFlight = useRef(false)

  const isDirty = modifiedContent !== null && modifiedContent !== partContent

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
        await validate()
        setShowValidation(true)
      }
    })
    return cleanup
  }, [filePath])

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
  }, [filePath, saveDocumentAs])

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

  useEffect(() => {
    if (autoValidateTimeout.current) {
      clearTimeout(autoValidateTimeout.current)
    }

    if (!autoValidate || !documentData || modifiedContent === null) {
      setIsAutoValidating(false)
      autoValidateInFlight.current = false
      return
    }

    autoValidateTimeout.current = setTimeout(async () => {
      if (autoValidateInFlight.current) return
      autoValidateInFlight.current = true
      setIsAutoValidating(true)
      await validate()
      setShowValidation(true)
      setIsAutoValidating(false)
      autoValidateInFlight.current = false
    }, 800)

    return () => {
      if (autoValidateTimeout.current) {
        clearTimeout(autoValidateTimeout.current)
      }
    }
  }, [autoValidate, documentData, modifiedContent, validate])

  return (
    <div className="app">
      <Toolbar
        onOpenFile={handleOpenFile}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onValidate={handleValidate}
        onToggleAutoFormat={() => setAutoFormatOnLoad((prev) => !prev)}
        onToggleAutoValidate={() => setAutoValidate((prev) => !prev)}
        hasDocument={!!documentData}
        filePath={filePath}
        isDirty={isDirty}
        autoFormatEnabled={autoFormatOnLoad}
        autoValidateEnabled={autoValidate}
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
                  autoFormatOnLoad={autoFormatOnLoad}
                />
              ) : isLoading ? (
                <div className="loading">Loading...</div>
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
                  onRevalidate={handleValidate}
                  autoValidateEnabled={autoValidate}
                  isAutoValidating={isAutoValidating}
                />
              </aside>
            )}
          </>
        )}
      </div>
    </div>
  )
}

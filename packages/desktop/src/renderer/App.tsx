import { useEffect, useState } from 'react'
import { HomeScreen } from './screens/HomeScreen'
import { XmlEditorScreen } from './screens/XmlEditorScreen'
import { BatchValidator } from './components/BatchValidator'
import { useDocumentStore } from './stores/document'

declare global {
  interface Window {
    electronAPI: {
      openFile: () => Promise<string | null>
      saveFile: (defaultPath?: string) => Promise<string | null>
      confirmFileChange: () => Promise<'save' | 'discard' | 'cancel'>
      readFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>
      writeFile: (filePath: string, data: string) => Promise<{ success: boolean; error?: string }>
      parseDocument: (
        base64Data: string
      ) => Promise<{ success: boolean; data?: any; error?: string }>
      getPart: (
        base64Data: string,
        partPath: string
      ) => Promise<{ success: boolean; data?: string; error?: string }>
      updatePart: (
        base64Data: string,
        partPath: string,
        content: string
      ) => Promise<{ success: boolean; data?: string; error?: string }>
      validate: (base64Data: string) => Promise<{ success: boolean; data?: any; error?: string }>
      openFiles: () => Promise<string[] | null>
      batchValidate: (
        filePaths: string[]
      ) => Promise<{ success: boolean; data?: any; error?: string }>
      exportResults: (
        format: 'json' | 'csv' | 'html' | 'pdf',
        data: any
      ) => Promise<{ success: boolean; filePath?: string; error?: string }>
      onBatchProgress: (callback: (progress: { current: number; total: number }) => void) => () => void
      onFileOpened: (callback: (filePath: string) => void) => () => void
      onMenuSave: (callback: () => void) => () => void
      onMenuSaveAs: (callback: () => void) => () => void
      onMenuValidate: (callback: () => void) => () => void
    }
  }
}

type Screen = 'home' | 'xml-editor' | 'batch-validator'

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  const [batchInitialFilePaths, setBatchInitialFilePaths] = useState<string[] | null>(null)
  const setFilePath = useDocumentStore((state) => state.setFilePath)
  const loadDocument = useDocumentStore((state) => state.loadDocument)
  const isMac = navigator.platform.includes('Mac')

  // Keep the global Open menu path working when app starts on the home screen.
  useEffect(() => {
    const cleanup = window.electronAPI.onFileOpened(async (path) => {
      if (currentScreen !== 'home') return
      setBatchInitialFilePaths(null)
      setCurrentScreen('xml-editor')
      setFilePath(path)
      await loadDocument(path)
    })
    return cleanup
  }, [currentScreen, setFilePath, loadDocument])

  const handleNavigateToHome = () => {
    setBatchInitialFilePaths(null)
    setCurrentScreen('home')
  }

  const handleOpenXmlFromHome = async () => {
    const path = await window.electronAPI.openFile()
    if (!path) return
    setBatchInitialFilePaths(null)
    setCurrentScreen('xml-editor')
    setFilePath(path)
    await loadDocument(path)
  }

  const handleOpenBatchFromHome = async () => {
    const filePaths = await window.electronAPI.openFiles()
    if (!filePaths || filePaths.length === 0) return
    setBatchInitialFilePaths(filePaths)
    setCurrentScreen('batch-validator')
  }

  return (
    <div className={`app${isMac ? ' app--mac' : ''}`}>
      {currentScreen === 'home' && (
        <HomeScreen
          onOpenXmlFromHome={handleOpenXmlFromHome}
          onOpenBatchFromHome={handleOpenBatchFromHome}
        />
      )}

      {currentScreen === 'xml-editor' && (
        <XmlEditorScreen onNavigateHome={handleNavigateToHome} />
      )}

      {currentScreen === 'batch-validator' && (
        <BatchValidator
          onClose={handleNavigateToHome}
          initialFilePaths={batchInitialFilePaths}
        />
      )}
    </div>
  )
}

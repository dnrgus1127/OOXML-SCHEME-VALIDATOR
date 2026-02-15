import { useState } from 'react'
import { HomeScreen } from './screens/HomeScreen'
import { XmlEditorScreen } from './screens/XmlEditorScreen'
import { BatchValidator } from './components/BatchValidator'

declare global {
  interface Window {
    electronAPI: {
      openFile: () => Promise<string | null>
      saveFile: (defaultPath?: string) => Promise<string | null>
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

  const handleNavigateToHome = () => {
    setCurrentScreen('home')
  }

  const handleNavigateToXmlEditor = () => {
    setCurrentScreen('xml-editor')
  }

  const handleNavigateToBatchValidator = () => {
    setCurrentScreen('batch-validator')
  }

  return (
    <div className="app">
      {currentScreen === 'home' && (
        <HomeScreen
          onNavigateToXmlEditor={handleNavigateToXmlEditor}
          onNavigateToBatchValidator={handleNavigateToBatchValidator}
        />
      )}

      {currentScreen === 'xml-editor' && (
        <XmlEditorScreen onNavigateHome={handleNavigateToHome} />
      )}

      {currentScreen === 'batch-validator' && (
        <BatchValidator onClose={handleNavigateToHome} />
      )}
    </div>
  )
}

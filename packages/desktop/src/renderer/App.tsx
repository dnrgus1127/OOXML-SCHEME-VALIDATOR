import { useCallback, useEffect, useState } from 'react'
import { HomeScreen } from './screens/HomeScreen'
import { XmlEditorScreen } from './screens/XmlEditorScreen'
import { BatchValidator } from './components/BatchValidator'
import { SettingsScreen } from './screens/SettingsScreen'
import { SupportedSchemasScreen } from './screens/SupportedSchemasScreen'
import { useDocumentStore } from './stores/document'
import { useSettingsStore } from './stores/settings'
import type { OpenTool, RecentFileEntry } from '../shared/recent-files'

declare global {
  interface Window {
    electronAPI: {
      openFile: () => Promise<string | null>
      saveFile: (defaultPath?: string) => Promise<string | null>
      confirmFileChange: () => Promise<'save' | 'discard' | 'cancel'>
      readFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>
      writeFile: (filePath: string, data: string) => Promise<{ success: boolean; error?: string }>
      fileExists: (filePath: string) => Promise<boolean>
      getRecentFiles: () => Promise<RecentFileEntry[]>
      addRecentFile: (input: {
        filePath: string
        fileName?: string
        lastTool: OpenTool
      }) => Promise<RecentFileEntry[]>
      addRecentFiles: (
        inputs: Array<{
          filePath: string
          fileName?: string
          lastTool: OpenTool
        }>
      ) => Promise<RecentFileEntry[]>
      removeRecentFile: (filePath: string) => Promise<RecentFileEntry[]>
      clearRecentFiles: () => Promise<RecentFileEntry[]>
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
      onBatchProgress: (
        callback: (progress: { current: number; total: number }) => void
      ) => () => void
      onFileOpened: (callback: (filePath: string) => void) => () => void
      onMenuSave: (callback: () => void) => () => void
      onMenuSaveAs: (callback: () => void) => () => void
      onMenuValidate: (callback: () => void) => () => void
    }
  }
}

type Screen = 'home' | 'xml-editor' | 'batch-validator' | 'supported-schemas'

function getFileName(filePath: string): string {
  const segments = filePath.split(/[\\/]/)
  return segments[segments.length - 1] || filePath
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>([])
  const [recentError, setRecentError] = useState<string | null>(null)
  const [batchInitialFilePaths, setBatchInitialFilePaths] = useState<string[] | null>(null)

  const setFilePath = useDocumentStore((state) => state.setFilePath)
  const loadDocument = useDocumentStore((state) => state.loadDocument)
  const validateDocument = useDocumentStore((state) => state.validate)
  const validateOnOpen = useSettingsStore((state) => state.xmlEditor.validateOnOpen)
  const isMac = navigator.platform.includes('Mac')

  const openSettings = useCallback(() => {
    setIsSettingsOpen(true)
  }, [])

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false)
  }, [])

  const refreshRecentFiles = useCallback(async () => {
    try {
      const items = await window.electronAPI.getRecentFiles()
      setRecentFiles(Array.isArray(items) ? items : [])
    } catch {
      setRecentFiles([])
    }
  }, [])

  const recordRecentFile = useCallback(
    async (filePath: string, lastTool: OpenTool) => {
      await window.electronAPI.addRecentFile({
        filePath,
        fileName: getFileName(filePath),
        lastTool,
      })
      await refreshRecentFiles()
    },
    [refreshRecentFiles]
  )

  useEffect(() => {
    void refreshRecentFiles()
  }, [refreshRecentFiles])

  // Keep the global Open menu path working when app starts on the home screen.
  useEffect(() => {
    const cleanup = window.electronAPI.onFileOpened(async (path) => {
      if (isSettingsOpen) {
        closeSettings()
      }
      if (currentScreen !== 'home') return

      setRecentError(null)
      setBatchInitialFilePaths(null)
      setCurrentScreen('xml-editor')
      setFilePath(path)

      const loaded = await loadDocument(path)
      if (!loaded) return

      if (validateOnOpen) {
        await validateDocument()
      }
      await recordRecentFile(path, 'xml-editor')
    })

    return cleanup
  }, [
    currentScreen,
    closeSettings,
    isSettingsOpen,
    loadDocument,
    recordRecentFile,
    setFilePath,
    validateDocument,
    validateOnOpen,
  ])

  const handleOpenRecent = useCallback(
    async (entry: RecentFileEntry) => {
      setRecentError(null)
      const exists = await window.electronAPI.fileExists(entry.filePath)
      if (!exists) {
        setRecentError(`File no longer exists: ${entry.filePath}`)
        await window.electronAPI.removeRecentFile(entry.filePath)
        await refreshRecentFiles()
        return
      }

      if (entry.lastTool === 'xml-editor') {
        setBatchInitialFilePaths(null)
        setCurrentScreen('xml-editor')
        setFilePath(entry.filePath)

        const loaded = await loadDocument(entry.filePath)
        if (!loaded) return

        if (validateOnOpen) {
          await validateDocument()
        }
        await recordRecentFile(entry.filePath, 'xml-editor')
        return
      }

      setBatchInitialFilePaths([entry.filePath])
      setCurrentScreen('batch-validator')
    },
    [
      loadDocument,
      recordRecentFile,
      refreshRecentFiles,
      setFilePath,
      validateDocument,
      validateOnOpen,
    ]
  )

  const handleRemoveRecent = useCallback(
    async (filePath: string) => {
      await window.electronAPI.removeRecentFile(filePath)
      await refreshRecentFiles()
    },
    [refreshRecentFiles]
  )

  const handleClearRecent = useCallback(async () => {
    await window.electronAPI.clearRecentFiles()
    setRecentFiles([])
  }, [])

  const handleNavigateToHome = () => {
    setBatchInitialFilePaths(null)
    setCurrentScreen('home')
    void refreshRecentFiles()
  }

  useEffect(() => {
    if (!isSettingsOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeSettings()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeSettings, isSettingsOpen])

  const handleOpenXmlFromHome = async () => {
    const path = await window.electronAPI.openFile()
    if (!path) return

    setRecentError(null)
    setBatchInitialFilePaths(null)
    setCurrentScreen('xml-editor')
    setFilePath(path)

    const loaded = await loadDocument(path)
    if (!loaded) return

    if (validateOnOpen) {
      await validateDocument()
    }
    await recordRecentFile(path, 'xml-editor')
  }

  const handleOpenBatchFromHome = async () => {
    const filePaths = await window.electronAPI.openFiles()
    if (!filePaths || filePaths.length === 0) return

    setRecentError(null)
    setBatchInitialFilePaths(filePaths)
    setCurrentScreen('batch-validator')
  }

  const handleOpenSchemasFromHome = () => {
    setBatchInitialFilePaths(null)
    setCurrentScreen('supported-schemas')
  }

  return (
    <div className={`app${isMac ? ' app--mac' : ''}`}>
      {currentScreen === 'home' && (
        <HomeScreen
          onOpenXmlFromHome={handleOpenXmlFromHome}
          onOpenBatchFromHome={handleOpenBatchFromHome}
          onOpenSchemasFromHome={handleOpenSchemasFromHome}
          onOpenSettingsFromHome={openSettings}
          recentFiles={recentFiles}
          recentError={recentError}
          onDismissRecentError={() => setRecentError(null)}
          onOpenRecent={handleOpenRecent}
          onRemoveRecent={handleRemoveRecent}
          onClearRecent={handleClearRecent}
        />
      )}

      {currentScreen === 'xml-editor' && (
        <XmlEditorScreen
          onNavigateHome={handleNavigateToHome}
          onOpenSettings={openSettings}
          isSettingsOpen={isSettingsOpen}
          onRecentRecord={refreshRecentFiles}
        />
      )}

      {currentScreen === 'batch-validator' && (
        <BatchValidator
          onNavigateHome={handleNavigateToHome}
          initialFilePaths={batchInitialFilePaths}
          onOpenSettings={openSettings}
          onRecentRecord={refreshRecentFiles}
        />
      )}

      {currentScreen === 'supported-schemas' && (
        <SupportedSchemasScreen onNavigateHome={handleNavigateToHome} />
      )}

      {isSettingsOpen && (
        <div className="settings-modal-backdrop" onClick={closeSettings}>
          <div className="settings-modal" onClick={(event) => event.stopPropagation()}>
            <SettingsScreen onClose={closeSettings} />
          </div>
        </div>
      )}
    </div>
  )
}

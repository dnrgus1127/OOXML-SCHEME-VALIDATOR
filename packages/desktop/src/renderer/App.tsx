import { useCallback, useEffect, useMemo, useState } from 'react'
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
      openDroppedFiles: (filePaths: string[]) => Promise<string[]>
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
      getSupportedSchemaList: () => Promise<
        Array<{
          category: string
          schemaName: string
          namespaceUri: string
          specType: 'Strict' | 'Transitional' | 'Other'
        }>
      >
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
      analyzeSchemaReferences: (
        base64Data: string
      ) => Promise<{ success: boolean; data?: any; error?: string }>
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
      onFilesOpened: (callback: (filePaths: string[]) => void) => () => void
      onMenuSave: (callback: () => void) => () => void
      onMenuSaveAs: (callback: () => void) => () => void
      onMenuValidate: (callback: () => void) => () => void
    }
  }
}

type Screen = 'home' | 'xml-editor' | 'batch-validator' | 'supported-schemas'

type FileWithPath = File & { path?: string }

const SUPPORTED_EXTENSIONS = ['.xlsx', '.docx', '.pptx']

function getFileName(filePath: string): string {
  const segments = filePath.split(/[\\/]/)
  return segments[segments.length - 1] || filePath
}

function isSupportedOfficePath(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  return SUPPORTED_EXTENSIONS.some((extension) => lower.endsWith(extension))
}

function getDroppedFilePaths(dataTransfer: DataTransfer): string[] {
  const uniquePaths = new Set<string>()

  for (const item of Array.from(dataTransfer.files)) {
    const file = item as FileWithPath
    const path = typeof file.path === 'string' ? file.path.trim() : ''
    if (!path) continue
    if (!isSupportedOfficePath(path)) continue
    uniquePaths.add(path)
  }

  return Array.from(uniquePaths)
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>([])
  const [recentError, setRecentError] = useState<string | null>(null)
  const [batchInitialFilePaths, setBatchInitialFilePaths] = useState<string[] | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)

  const filePath = useDocumentStore((state) => state.filePath)
  const modifiedContent = useDocumentStore((state) => state.modifiedContent)
  const partContent = useDocumentStore((state) => state.partContent)
  const setFilePath = useDocumentStore((state) => state.setFilePath)
  const loadDocument = useDocumentStore((state) => state.loadDocument)
  const saveDocument = useDocumentStore((state) => state.saveDocument)
  const validateDocument = useDocumentStore((state) => state.validate)
  const validateOnOpen = useSettingsStore((state) => state.xmlEditor.validateOnOpen)
  const isMac = navigator.platform.includes('Mac')

  const isDirty = useMemo(
    () => modifiedContent !== null && modifiedContent !== partContent,
    [modifiedContent, partContent]
  )

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
    async (path: string, lastTool: OpenTool) => {
      await window.electronAPI.addRecentFile({
        filePath: path,
        fileName: getFileName(path),
        lastTool,
      })
      await refreshRecentFiles()
    },
    [refreshRecentFiles]
  )

  const confirmFileChangeIfNeeded = useCallback(async () => {
    if (!isDirty) return true

    const choice = await window.electronAPI.confirmFileChange()
    if (choice === 'cancel') return false
    if (choice === 'discard') return true
    if (!filePath) return false

    return saveDocument(filePath)
  }, [filePath, isDirty, saveDocument])

  useEffect(() => {
    void refreshRecentFiles()
  }, [refreshRecentFiles])

  // Keep the global Open menu path working on non-editor screens.
  useEffect(() => {
    const cleanup = window.electronAPI.onFileOpened(async (path) => {
      if (isSettingsOpen) {
        closeSettings()
      }
      if (currentScreen !== 'home' && currentScreen !== 'supported-schemas') return

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
    closeSettings,
    currentScreen,
    isSettingsOpen,
    loadDocument,
    recordRecentFile,
    setFilePath,
    validateDocument,
    validateOnOpen,
  ])

  useEffect(() => {
    const cleanup = window.electronAPI.onFilesOpened(async (filePaths) => {
      if (!Array.isArray(filePaths) || filePaths.length === 0) return

      if (isSettingsOpen) {
        closeSettings()
      }

      if (currentScreen === 'xml-editor') {
        const canChangeFile = await confirmFileChangeIfNeeded()
        if (!canChangeFile) return
      }

      setRecentError(null)
      setBatchInitialFilePaths(filePaths)
      setCurrentScreen('batch-validator')
    })

    return cleanup
  }, [closeSettings, confirmFileChangeIfNeeded, currentScreen, isSettingsOpen])

  useEffect(() => {
    const onDragEnter = (event: DragEvent) => {
      const types = Array.from(event.dataTransfer?.types ?? [])
      if (!types.includes('Files')) return

      event.preventDefault()
      setIsDragActive(true)
    }

    const onDragOver = (event: DragEvent) => {
      const types = Array.from(event.dataTransfer?.types ?? [])
      if (!types.includes('Files')) return

      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }
      setIsDragActive(true)
    }

    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget) return
      setIsDragActive(false)
    }

    const onDrop = async (event: DragEvent) => {
      const dataTransfer = event.dataTransfer
      if (!dataTransfer) return

      event.preventDefault()
      setIsDragActive(false)

      const droppedPaths = getDroppedFilePaths(dataTransfer)
      if (droppedPaths.length === 0) {
        setRecentError('지원되는 OOXML 파일(.xlsx, .docx, .pptx)을 드롭해 주세요.')
        return
      }

      const openedPaths = await window.electronAPI.openDroppedFiles(droppedPaths)
      if (!openedPaths || openedPaths.length === 0) {
        setRecentError('드롭한 파일을 열 수 없습니다. 파일 존재 여부를 확인해 주세요.')
      }
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)

    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

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
    async (path: string) => {
      await window.electronAPI.removeRecentFile(path)
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

      {isDragActive && (
        <div className="file-drop-overlay" role="status" aria-live="polite">
          <div className="file-drop-overlay__content">
            <strong>파일을 놓아 즉시 열기</strong>
            <span>지원 형식: .xlsx, .docx, .pptx</span>
          </div>
        </div>
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

import { create } from 'zustand'

interface DocumentData {
  documentType: string
  contentTypes: any[]
  parts: Record<string, { contentType: string; size: number }>
}

interface ValidationError {
  code: string
  message: string
  path: string
  value?: string
  line?: number
  column?: number
}

interface PartValidationResult {
  path: string
  valid: boolean
  error?: string // For backward compatibility (XML parse errors)
  errors?: ValidationError[] // Schema validation errors
}

interface ValidationSummary {
  totalParts: number
  validParts: number
  invalidParts: number
  totalErrors: number
}

interface ValidationResult {
  valid: boolean
  results: PartValidationResult[]
  summary?: ValidationSummary
}

interface DocumentState {
  // State
  filePath: string | null
  fileData: string | null // base64
  documentData: DocumentData | null
  selectedPart: string | null
  partContent: string | null
  modifiedContent: string | null
  validationResults: ValidationResult | null
  isLoading: boolean
  error: string | null

  // Actions
  setFilePath: (path: string | null) => void
  loadDocument: (path: string) => Promise<void>
  selectPart: (partPath: string) => Promise<void>
  updatePartContent: (content: string) => void
  saveDocument: (path: string) => Promise<boolean>
  saveDocumentAs: (path: string) => Promise<boolean>
  validate: () => Promise<void>
  clearError: () => void
  reset: () => void
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  filePath: null,
  fileData: null,
  documentData: null,
  selectedPart: null,
  partContent: null,
  modifiedContent: null,
  validationResults: null,
  isLoading: false,
  error: null,

  setFilePath: (path) => set({ filePath: path }),

  loadDocument: async (path) => {
    set({ isLoading: true, error: null })

    try {
      // Read file
      const readResult = await window.electronAPI.readFile(path)
      if (!readResult.success) {
        throw new Error(readResult.error || 'Failed to read file')
      }

      const fileData = readResult.data!

      // Parse document
      const parseResult = await window.electronAPI.parseDocument(fileData)
      if (!parseResult.success) {
        throw new Error(parseResult.error || 'Failed to parse document')
      }

      set({
        filePath: path,
        fileData,
        documentData: parseResult.data,
        selectedPart: null,
        partContent: null,
        modifiedContent: null,
        validationResults: null,
        isLoading: false,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      })
    }
  },

  selectPart: async (partPath) => {
    const { fileData, modifiedContent, selectedPart } = get()
    if (!fileData) return

    // Save modified content before switching
    if (modifiedContent !== null && selectedPart) {
      const updateResult = await window.electronAPI.updatePart(
        fileData,
        selectedPart,
        modifiedContent
      )
      if (updateResult.success) {
        set({ fileData: updateResult.data! })
      }
    }

    set({ isLoading: true, error: null })

    try {
      const currentFileData = get().fileData!
      const result = await window.electronAPI.getPart(currentFileData, partPath)

      if (!result.success) {
        throw new Error(result.error || 'Failed to get part content')
      }

      set({
        selectedPart: partPath,
        partContent: result.data!,
        modifiedContent: null,
        isLoading: false,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      })
    }
  },

  updatePartContent: (content) => {
    set({ modifiedContent: content })
  },

  saveDocument: async (path) => {
    const { fileData, modifiedContent, selectedPart } = get()
    if (!fileData) return false

    set({ error: null })

    try {
      let currentFileData = fileData

      // Apply pending modifications
      if (modifiedContent !== null && selectedPart) {
        const updateResult = await window.electronAPI.updatePart(
          currentFileData,
          selectedPart,
          modifiedContent
        )
        if (updateResult.success) {
          currentFileData = updateResult.data!
        }
      }

      // Write to file
      const writeResult = await window.electronAPI.writeFile(path, currentFileData)
      if (!writeResult.success) {
        throw new Error(writeResult.error || 'Failed to write file')
      }

      set({
        fileData: currentFileData,
        modifiedContent: null,
      })
      return true
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  },

  saveDocumentAs: async (path) => {
    const { fileData, modifiedContent, selectedPart } = get()
    if (!fileData) return false

    set({ error: null })

    try {
      let currentFileData = fileData

      if (modifiedContent !== null && selectedPart) {
        const updateResult = await window.electronAPI.updatePart(
          currentFileData,
          selectedPart,
          modifiedContent
        )
        if (updateResult.success) {
          currentFileData = updateResult.data!
        }
      }

      const writeResult = await window.electronAPI.writeFile(path, currentFileData)
      if (!writeResult.success) {
        throw new Error(writeResult.error || 'Failed to write file')
      }

      set({
        filePath: path,
        fileData: currentFileData,
        modifiedContent: null,
      })
      return true
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  },

  validate: async () => {
    const { fileData, modifiedContent, selectedPart } = get()
    if (!fileData) return

    set({ error: null })

    try {
      let currentFileData = fileData

      // Apply pending modifications before validation
      if (modifiedContent !== null && selectedPart) {
        const updateResult = await window.electronAPI.updatePart(
          currentFileData,
          selectedPart,
          modifiedContent
        )
        if (updateResult.success) {
          currentFileData = updateResult.data!
        }
      }

      const result = await window.electronAPI.validate(currentFileData)
      if (!result.success) {
        throw new Error(result.error || 'Validation failed')
      }

      set({
        validationResults: result.data,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },

  clearError: () => set({ error: null }),

  reset: () =>
    set({
      filePath: null,
      fileData: null,
      documentData: null,
      selectedPart: null,
      partContent: null,
      modifiedContent: null,
      validationResults: null,
      isLoading: false,
      error: null,
    }),
}))

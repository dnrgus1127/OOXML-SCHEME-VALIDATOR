import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { EditorThemeId } from '../constants/editorTheme'

export interface XmlEditorSettings {
  validateOnOpen: boolean
  revalidateShortcut: string
  editorTheme: EditorThemeId
}

export interface GeneralSettings {
  startupTool: 'home'
}

export interface BatchValidatorSettings {
  autoExpandResults: boolean
}

export interface PluginsSettings {
  enabled: Record<string, boolean>
}

export interface SettingsData {
  general: GeneralSettings
  xmlEditor: XmlEditorSettings
  batchValidator: BatchValidatorSettings
  plugins: PluginsSettings
}

export interface PersistedSettingsData {
  general?: Partial<GeneralSettings>
  xmlEditor?: Partial<XmlEditorSettings>
  batchValidator?: Partial<BatchValidatorSettings>
  plugins?: { enabled?: Record<string, boolean> }
}

interface SettingsState extends SettingsData {
  previewEditorTheme: EditorThemeId | null
  effectiveEditorTheme: EditorThemeId
  updateXmlEditorSettings: (updates: Partial<XmlEditorSettings>) => void
  setPreviewEditorTheme: (theme: EditorThemeId | null) => void
  clearPreviewEditorTheme: () => void
  updatePluginEnabled: (id: string, enabled: boolean) => void
  resetSettings: () => void
}

const defaultSettings: SettingsData = {
  general: {
    startupTool: 'home',
  },
  xmlEditor: {
    validateOnOpen: true,
    revalidateShortcut: 'CmdOrCtrl+Shift+V',
    editorTheme: 'vs-dark',
  },
  batchValidator: {
    autoExpandResults: true,
  },
  plugins: {
    enabled: {
      'odf-chart-style-resolver': true,
    },
  },
}

export function mergeSettingsData(
  persistedState: PersistedSettingsData | undefined,
  currentState: SettingsState
) {
  const persisted = persistedState ?? {}
  const xmlEditor = {
    ...currentState.xmlEditor,
    ...persisted.xmlEditor,
  }

  return {
    ...currentState,
    ...persisted,
    general: {
      ...currentState.general,
      ...persisted.general,
    },
    xmlEditor,
    batchValidator: {
      ...currentState.batchValidator,
      ...persisted.batchValidator,
    },
    plugins: {
      enabled: {
        ...currentState.plugins.enabled,
        ...(persisted.plugins?.enabled ?? {}),
      },
    },
    effectiveEditorTheme: currentState.previewEditorTheme ?? xmlEditor.editorTheme,
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      previewEditorTheme: null,
      effectiveEditorTheme: defaultSettings.xmlEditor.editorTheme,

      updateXmlEditorSettings: (updates) =>
        set((state) => {
          const xmlEditor = {
            ...state.xmlEditor,
            ...updates,
          }

          return {
            xmlEditor,
            effectiveEditorTheme: state.previewEditorTheme ?? xmlEditor.editorTheme,
          }
        }),

      setPreviewEditorTheme: (theme) =>
        set((state) => ({
          previewEditorTheme: theme,
          effectiveEditorTheme: theme ?? state.xmlEditor.editorTheme,
        })),

      clearPreviewEditorTheme: () =>
        set((state) => ({
          previewEditorTheme: null,
          effectiveEditorTheme: state.xmlEditor.editorTheme,
        })),

      updatePluginEnabled: (id, enabled) =>
        set((state) => ({
          plugins: {
            enabled: {
              ...state.plugins.enabled,
              [id]: enabled,
            },
          },
        })),

      resetSettings: () =>
        set({
          ...defaultSettings,
          previewEditorTheme: null,
          effectiveEditorTheme: defaultSettings.xmlEditor.editorTheme,
        }),
    }),
    {
      name: 'ooxml-validator-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        general: state.general,
        xmlEditor: state.xmlEditor,
        batchValidator: state.batchValidator,
        plugins: state.plugins,
      }),
      merge: (persistedState, currentState) =>
        mergeSettingsData(persistedState as PersistedSettingsData | undefined, currentState),
    }
  )
)

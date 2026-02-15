import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface XmlEditorSettings {
  validateOnOpen: boolean
}

export interface GeneralSettings {
  startupTool: 'home'
}

export interface BatchValidatorSettings {
  autoExpandResults: boolean
}

export interface SettingsData {
  general: GeneralSettings
  xmlEditor: XmlEditorSettings
  batchValidator: BatchValidatorSettings
}

interface SettingsState extends SettingsData {
  updateXmlEditorSettings: (updates: Partial<XmlEditorSettings>) => void
  resetSettings: () => void
}

const defaultSettings: SettingsData = {
  general: {
    startupTool: 'home',
  },
  xmlEditor: {
    validateOnOpen: true,
  },
  batchValidator: {
    autoExpandResults: true,
  },
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      updateXmlEditorSettings: (updates) =>
        set((state) => ({
          xmlEditor: {
            ...state.xmlEditor,
            ...updates,
          },
        })),

      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'ooxml-validator-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        general: state.general,
        xmlEditor: state.xmlEditor,
        batchValidator: state.batchValidator,
      }),
    }
  )
)

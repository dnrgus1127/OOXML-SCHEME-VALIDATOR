import { describe, expect, it } from 'vitest'
import { mergeSettingsData } from './settings'

describe('mergeSettingsData', () => {
  it('keeps the default editor theme when older persisted settings do not include it', () => {
    const currentState = {
      general: {
        startupTool: 'home' as const,
      },
      xmlEditor: {
        validateOnOpen: true,
        revalidateShortcut: 'CmdOrCtrl+Shift+V',
        editorTheme: 'vs-dark' as const,
      },
      batchValidator: {
        autoExpandResults: true,
      },
      plugins: {
        enabled: {
          'odf-chart-style-resolver': true,
        },
      },
      previewEditorTheme: null,
      effectiveEditorTheme: 'vs-dark' as const,
      updateXmlEditorSettings: () => undefined,
      setPreviewEditorTheme: () => undefined,
      clearPreviewEditorTheme: () => undefined,
      updatePluginEnabled: () => undefined,
      resetSettings: () => undefined,
    }

    const merged = mergeSettingsData(
      {
        xmlEditor: {
          validateOnOpen: false,
          revalidateShortcut: 'CmdOrCtrl+R',
        },
      },
      currentState
    )

    expect(merged.xmlEditor.validateOnOpen).toBe(false)
    expect(merged.xmlEditor.revalidateShortcut).toBe('CmdOrCtrl+R')
    expect(merged.xmlEditor.editorTheme).toBe('vs-dark')
    expect(merged.effectiveEditorTheme).toBe('vs-dark')
  })
})

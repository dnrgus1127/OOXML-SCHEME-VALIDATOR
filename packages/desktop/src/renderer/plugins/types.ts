import type * as monaco from 'monaco-editor'

export interface PluginContext {
  filePath: string
  partPath: string
  containerFormat: 'ooxml' | 'odf'
  documentType: string
  parts: Record<string, { contentType: string; size: number }>
  getPart(partPath: string): Promise<string | null>
}

export interface MonacoHoverContribution {
  contents: string[]
  range?: {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
  }
}

export interface MonacoHoverHookParams {
  monaco: typeof monaco
  model: monaco.editor.ITextModel
  position: monaco.Position
  token: monaco.CancellationToken
}

export interface OoxmlPluginHooks {
  provideMonacoHover?(
    ctx: PluginContext,
    params: MonacoHoverHookParams
  ): Promise<MonacoHoverContribution | null> | MonacoHoverContribution | null
}

export interface PluginPreviewSample {
  label?: string
  language?: string
  body: string
}

export interface PluginPreview {
  inputLabel?: string
  outputLabel?: string
  input: PluginPreviewSample
  output: PluginPreviewSample
}

export interface OoxmlPlugin {
  id: string
  name: string
  description: string
  version: string
  author: string
  detailedDescription?: string
  preview?: PluginPreview
  appliesTo(ctx: PluginContext): boolean
  hooks: OoxmlPluginHooks
}

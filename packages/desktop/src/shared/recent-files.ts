export const RECENT_FILES_STORE_VERSION = 1
export const MAX_RECENT_FILES = 15

export type OpenTool = 'xml-editor' | 'batch-validator'

export interface RecentFileEntry {
  filePath: string
  fileName: string
  lastTool: OpenTool
  lastOpenedAt: string
  openCount: number
}

export interface RecentFilesStoreData {
  version: number
  items: RecentFileEntry[]
}

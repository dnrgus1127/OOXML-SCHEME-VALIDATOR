import { app } from 'electron'
import { basename, join } from 'path'
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import {
  MAX_RECENT_FILES,
  RECENT_FILES_STORE_VERSION,
  type OpenTool,
  type RecentFileEntry,
  type RecentFilesStoreData,
} from '../shared/recent-files'

const STORE_FILE_NAME = 'recent-files.json'

interface AddRecentFileInput {
  filePath: string
  fileName?: string
  lastTool: OpenTool
}

function getStoreFilePath(): string {
  return join(app.getPath('userData'), STORE_FILE_NAME)
}

function defaultStoreData(): RecentFilesStoreData {
  return {
    version: RECENT_FILES_STORE_VERSION,
    items: [],
  }
}

function isValidTool(value: unknown): value is OpenTool {
  return value === 'xml-editor' || value === 'batch-validator'
}

function normalizeEntry(value: unknown): RecentFileEntry | null {
  if (!value || typeof value !== 'object') return null

  const raw = value as Partial<RecentFileEntry>
  if (typeof raw.filePath !== 'string' || raw.filePath.length === 0) return null
  if (typeof raw.fileName !== 'string' || raw.fileName.length === 0) return null
  if (!isValidTool(raw.lastTool)) return null
  if (typeof raw.lastOpenedAt !== 'string' || Number.isNaN(Date.parse(raw.lastOpenedAt)))
    return null
  if (typeof raw.openCount !== 'number' || raw.openCount < 1 || !Number.isFinite(raw.openCount)) {
    return null
  }

  return {
    filePath: raw.filePath,
    fileName: raw.fileName,
    lastTool: raw.lastTool,
    lastOpenedAt: raw.lastOpenedAt,
    openCount: Math.floor(raw.openCount),
  }
}

function sortByRecent(items: RecentFileEntry[]): RecentFileEntry[] {
  return [...items].sort((a, b) => {
    return Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt)
  })
}

function normalizeStore(raw: unknown): RecentFilesStoreData {
  if (!raw || typeof raw !== 'object') return defaultStoreData()
  const data = raw as Partial<RecentFilesStoreData>
  const items = Array.isArray(data.items)
    ? data.items
        .map((item) => normalizeEntry(item))
        .filter((item): item is RecentFileEntry => !!item)
    : []

  return {
    version: RECENT_FILES_STORE_VERSION,
    items: sortByRecent(items).slice(0, MAX_RECENT_FILES),
  }
}

function readStore(): RecentFilesStoreData {
  try {
    const filePath = getStoreFilePath()
    if (!existsSync(filePath)) return defaultStoreData()
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown
    return normalizeStore(parsed)
  } catch {
    return defaultStoreData()
  }
}

function writeStore(nextData: RecentFilesStoreData): boolean {
  const filePath = getStoreFilePath()
  const tempPath = `${filePath}.tmp`

  try {
    writeFileSync(tempPath, JSON.stringify(nextData, null, 2), 'utf-8')
    renameSync(tempPath, filePath)
    return true
  } catch {
    try {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath)
      }
    } catch {
      // ignore cleanup errors
    }
    return false
  }
}

export function listRecentFiles(): RecentFileEntry[] {
  return readStore().items
}

function normalizeInput(input: AddRecentFileInput): AddRecentFileInput {
  return {
    filePath: input.filePath,
    fileName: input.fileName ?? (basename(input.filePath) || input.filePath),
    lastTool: input.lastTool,
  }
}

export function addRecentFiles(inputs: AddRecentFileInput[]): RecentFileEntry[] {
  if (inputs.length === 0) return listRecentFiles()

  const current = readStore()
  const mergedByPath = new Map(current.items.map((item) => [item.filePath, item]))
  const dedupedInputs = new Map<string, AddRecentFileInput>()

  for (const rawInput of inputs) {
    const input = normalizeInput(rawInput)
    dedupedInputs.set(input.filePath, input)
  }

  for (const input of dedupedInputs.values()) {
    const previous = mergedByPath.get(input.filePath)
    const fileName = input.fileName ?? (basename(input.filePath) || input.filePath)
    mergedByPath.set(input.filePath, {
      filePath: input.filePath,
      fileName,
      lastTool: input.lastTool,
      lastOpenedAt: new Date().toISOString(),
      openCount: (previous?.openCount ?? 0) + 1,
    })
  }

  const nextItems = sortByRecent(Array.from(mergedByPath.values())).slice(0, MAX_RECENT_FILES)
  const nextStore: RecentFilesStoreData = {
    version: RECENT_FILES_STORE_VERSION,
    items: nextItems,
  }

  if (!writeStore(nextStore)) return current.items
  return nextItems
}

export function addRecentFile(input: AddRecentFileInput): RecentFileEntry[] {
  return addRecentFiles([input])
}

export function removeRecentFile(filePath: string): RecentFileEntry[] {
  const current = readStore()
  const nextItems = current.items.filter((item) => item.filePath !== filePath)
  const nextStore: RecentFilesStoreData = {
    version: RECENT_FILES_STORE_VERSION,
    items: nextItems,
  }

  if (!writeStore(nextStore)) {
    return current.items
  }

  return nextItems
}

export function clearRecentFiles(): RecentFileEntry[] {
  const nextStore = defaultStoreData()
  if (!writeStore(nextStore)) {
    return readStore().items
  }
  return []
}

/**
 * Preload Script
 *
 * Exposes safe IPC methods to the renderer process.
 */

import { contextBridge, ipcRenderer } from 'electron'

// API exposed to renderer
const api = {
  // Dialog
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (defaultPath?: string) => ipcRenderer.invoke('dialog:saveFile', defaultPath),

  // File system
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath: string, data: string) => ipcRenderer.invoke('fs:writeFile', filePath, data),

  // OOXML operations
  parseDocument: (base64Data: string) => ipcRenderer.invoke('ooxml:parse', base64Data),
  getPart: (base64Data: string, partPath: string) =>
    ipcRenderer.invoke('ooxml:getPart', base64Data, partPath),
  updatePart: (base64Data: string, partPath: string, content: string) =>
    ipcRenderer.invoke('ooxml:updatePart', base64Data, partPath, content),
  validate: (base64Data: string) => ipcRenderer.invoke('ooxml:validate', base64Data),

  // Batch operations
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  batchValidate: (filePaths: string[]) =>
    ipcRenderer.invoke('ooxml:batchValidate', filePaths),
  exportResults: (format: 'json' | 'csv' | 'html' | 'pdf', data: any) =>
    ipcRenderer.invoke('export:results', format, data),
  onBatchProgress: (callback: (progress: { current: number; total: number }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, progress: { current: number; total: number }) =>
      callback(progress)
    ipcRenderer.on('batch:progress', listener)
    return () => ipcRenderer.removeListener('batch:progress', listener)
  },

  // Menu events
  onFileOpened: (callback: (filePath: string) => void) => {
    const listener = (_: Electron.IpcRendererEvent, filePath: string) => callback(filePath)
    ipcRenderer.on('file:opened', listener)
    return () => ipcRenderer.removeListener('file:opened', listener)
  },
  onMenuSave: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('menu:save', listener)
    return () => ipcRenderer.removeListener('menu:save', listener)
  },
  onMenuSaveAs: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('menu:save-as', listener)
    return () => ipcRenderer.removeListener('menu:save-as', listener)
  },
  onMenuValidate: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('menu:validate', listener)
    return () => ipcRenderer.removeListener('menu:validate', listener)
  },
}

// Expose API to renderer
contextBridge.exposeInMainWorld('electronAPI', api)

// Type declaration for renderer
export type ElectronAPI = typeof api

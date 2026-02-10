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

  // Menu events
  onFileOpened: (callback: (filePath: string) => void) => {
    ipcRenderer.on('file:opened', (_, filePath) => callback(filePath))
    return () => ipcRenderer.removeAllListeners('file:opened')
  },
  onMenuSave: (callback: () => void) => {
    ipcRenderer.on('menu:save', () => callback())
    return () => ipcRenderer.removeAllListeners('menu:save')
  },
  onMenuSaveAs: (callback: () => void) => {
    ipcRenderer.on('menu:save-as', () => callback())
    return () => ipcRenderer.removeAllListeners('menu:save-as')
  },
  onMenuValidate: (callback: () => void) => {
    ipcRenderer.on('menu:validate', () => callback())
    return () => ipcRenderer.removeAllListeners('menu:validate')
  },
}

// Expose API to renderer
contextBridge.exposeInMainWorld('electronAPI', api)

// Type declaration for renderer
export type ElectronAPI = typeof api

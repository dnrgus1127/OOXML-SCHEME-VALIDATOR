/**
 * @ooxml/desktop - Main Process
 *
 * Electron main process entry point
 */

import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { OoxmlParser, OoxmlBuilder, parseXmlToEventArray } from '@ooxml/parser'
import { lookupSchemaElement } from './schema-registry'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  })

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// App menu
function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => handleOpenFile(),
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save'),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow?.webContents.send('menu:save-as'),
        },
        { type: 'separator' },
        {
          label: 'Validate',
          accelerator: 'CmdOrCtrl+Shift+V',
          click: () => mainWindow?.webContents.send('menu:validate'),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

async function handleOpenFile(): Promise<void> {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'Office Documents', extensions: ['xlsx', 'docx', 'pptx'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })

  if (!result.canceled && result.filePaths.length > 0) {
    mainWindow?.webContents.send('file:opened', result.filePaths[0])
  }
}

// IPC Handlers
function setupIpcHandlers(): void {
  // Open file dialog
  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [
        { name: 'Office Documents', extensions: ['xlsx', 'docx', 'pptx'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })

    if (result.canceled) return null
    return result.filePaths[0]
  })

  // Save file dialog
  ipcMain.handle('dialog:saveFile', async (_, defaultPath?: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath,
      filters: [
        { name: 'Office Documents', extensions: ['xlsx', 'docx', 'pptx'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })

    if (result.canceled) return null
    return result.filePath
  })

  // Read file
  ipcMain.handle('fs:readFile', async (_, filePath: string) => {
    try {
      const buffer = readFileSync(filePath)
      return { success: true, data: buffer.toString('base64') }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Write file
  ipcMain.handle('fs:writeFile', async (_, filePath: string, base64Data: string) => {
    try {
      const buffer = Buffer.from(base64Data, 'base64')
      writeFileSync(filePath, buffer)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Parse OOXML document
  ipcMain.handle('ooxml:parse', async (_, base64Data: string) => {
    try {
      const buffer = Buffer.from(base64Data, 'base64')
      const doc = await OoxmlParser.fromBuffer(buffer)

      // Convert to serializable format
      const parts: Record<string, { contentType: string; size: number }> = {}
      for (const [path, part] of doc.parts) {
        parts[path] = {
          contentType: part.contentType,
          size: part.content.length,
        }
      }

      return {
        success: true,
        data: {
          documentType: doc.documentType,
          contentTypes: doc.contentTypes,
          parts,
        },
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Get part content
  ipcMain.handle('ooxml:getPart', async (_, base64Data: string, partPath: string) => {
    try {
      const buffer = Buffer.from(base64Data, 'base64')
      const doc = await OoxmlParser.fromBuffer(buffer)
      const content = doc.getPartAsXml(partPath)

      if (!content) {
        return { success: false, error: 'Part not found' }
      }

      return { success: true, data: content }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Update part content
  ipcMain.handle('ooxml:updatePart', async (_, base64Data: string, partPath: string, content: string) => {
    try {
      const buffer = Buffer.from(base64Data, 'base64')
      const builder = OoxmlBuilder.fromBuffer(buffer)
      builder.setPart(partPath, content)
      const newBuffer = builder.toBuffer()

      return { success: true, data: newBuffer.toString('base64') }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Validate document
  ipcMain.handle('ooxml:validate', async (_, base64Data: string) => {
    try {
      const buffer = Buffer.from(base64Data, 'base64')
      const doc = await OoxmlParser.fromBuffer(buffer)

      // Basic validation - check all XML parts are parseable
      const results: { path: string; valid: boolean; error?: string }[] = []

      for (const [path, part] of doc.parts) {
        if (!part.contentType.includes('xml')) continue
        if (path.includes('_rels/')) continue

        try {
          const xmlContent = part.content.toString('utf-8')
          parseXmlToEventArray(xmlContent)
          results.push({ path, valid: true })
        } catch (err) {
          results.push({ path, valid: false, error: String(err) })
        }
      }

      const valid = results.every((r) => r.valid)
      return { success: true, data: { valid, results } }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Get schema info for element
  ipcMain.handle('ooxml:getSchemaInfo', async (_, elementName: string, namespaceUri?: string | null) => {
    try {
      const info = await lookupSchemaElement(elementName, namespaceUri ?? undefined)
      if (!info) {
        return { success: true, data: null }
      }

      return {
        success: true,
        data: {
          elementName: info.elementName,
          namespaceUri: info.namespaceUri,
          typeName: info.typeName,
          typeNamespaceUri: info.typeNamespaceUri,
          typeKind: info.schemaType?.kind,
          occurs: info.element.occurs,
          nillable: info.element.nillable,
          abstract: info.element.abstract,
        },
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}

// App lifecycle
app.whenReady().then(() => {
  createMenu()
  createWindow()
  setupIpcHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

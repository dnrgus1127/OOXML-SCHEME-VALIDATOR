/**
 * @ooxml/desktop - Main Process
 *
 * Electron main process entry point
 */

import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { OoxmlParser, OoxmlBuilder, parseXmlToEventArray } from '@ooxml/parser'
import {
  ValidationEngine,
  loadSchemaRegistry,
  type OoxmlDocumentType,
  type ValidationError,
  type SchemaRegistry,
} from '@ooxml/core'

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
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }],
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
  ipcMain.handle(
    'ooxml:updatePart',
    async (_, base64Data: string, partPath: string, content: string) => {
      try {
        const buffer = Buffer.from(base64Data, 'base64')
        const builder = OoxmlBuilder.fromBuffer(buffer)
        builder.setPart(partPath, content)
        const newBuffer = builder.toBuffer()

        return { success: true, data: newBuffer.toString('base64') }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  // Validate document with XSD schema validation
  ipcMain.handle('ooxml:validate', async (_, base64Data: string) => {
    try {
      const buffer = Buffer.from(base64Data, 'base64')
      const doc = await OoxmlParser.fromBuffer(buffer)

      // Load schema registry based on document type
      const documentType = doc.documentType as OoxmlDocumentType
      let registry: SchemaRegistry
      try {
        registry = loadSchemaRegistry(documentType)
      } catch (schemaError) {
        // Fallback to basic validation if schema loading fails
        console.warn('Schema loading failed, using basic validation:', schemaError)
        return basicValidation(doc)
      }

      // Validate each XML part
      const results: {
        path: string
        valid: boolean
        errors?: Array<{
          code: string
          message: string
          path: string
          value?: string
          line?: number
          column?: number
        }>
      }[] = []

      for (const [path, part] of doc.parts) {
        // Skip non-XML parts
        if (!part.contentType.includes('xml')) continue
        // Skip relationship parts
        if (path.includes('_rels/')) continue
        // Skip content types
        if (path === '[Content_Types].xml') continue
        // Skip docProps - uses Dublin Core and extended properties namespaces not in our schema set
        if (path.startsWith('docProps/')) continue
        // Skip customXml root - custom XML data isn't validated against OOXML schemas
        if (path.startsWith('customXml/') && !path.includes('itemProps')) continue

        try {
          const xmlContent = part.content.toString('utf-8')
          const events = parseXmlToEventArray(xmlContent)

          // Create validation engine for this part
          const engine = new ValidationEngine(registry, {
            maxErrors: 100,
            allowWhitespace: true,
          })

          // Process validation events
          for (const event of events) {
            switch (event.type) {
              case 'startDocument':
                engine.startDocument()
                break
              case 'startElement':
                engine.startElement(event.element)
                break
              case 'text':
                engine.text(event.text)
                break
              case 'endElement':
                engine.endElement(event.element)
                break
              case 'endDocument':
                // Get validation result
                const result = engine.endDocument()
                if (result.valid) {
                  results.push({ path, valid: true })
                } else {
                  results.push({
                    path,
                    valid: false,
                    errors: result.errors.map((err) => ({
                      code: err.code,
                      message: err.message,
                      path: err.path,
                      value: err.value,
                      line: err.line,
                      column: err.column,
                    })),
                  })
                }
                break
            }
          }
        } catch (err) {
          // XML parsing error
          results.push({
            path,
            valid: false,
            errors: [
              {
                code: 'XML_PARSE_ERROR',
                message: String(err),
                path: '/',
              },
            ],
          })
        }
      }

      const valid = results.every((r) => r.valid)
      const totalErrors = results.reduce((sum, r) => sum + (r.errors?.length || 0), 0)

      return {
        success: true,
        data: {
          valid,
          results,
          summary: {
            totalParts: results.length,
            validParts: results.filter((r) => r.valid).length,
            invalidParts: results.filter((r) => !r.valid).length,
            totalErrors,
          },
        },
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}

/**
 * Basic validation fallback (XML parsing only)
 */
async function basicValidation(doc: Awaited<ReturnType<typeof OoxmlParser.fromBuffer>>) {
  const results: { path: string; valid: boolean; error?: string }[] = []

  for (const [path, part] of doc.parts) {
    if (!part.contentType.includes('xml')) continue
    if (path.includes('_rels/')) continue
    if (path === '[Content_Types].xml') continue
    if (path.startsWith('docProps/')) continue
    if (path.startsWith('customXml/') && !path.includes('itemProps')) continue

    try {
      const xmlContent = part.content.toString('utf-8')
      parseXmlToEventArray(xmlContent)
      results.push({ path, valid: true })
    } catch (err) {
      results.push({ path, valid: false, error: String(err) })
    }
  }

  const valid = results.every((r) => r.valid)
  return {
    success: true,
    data: {
      valid,
      results,
      summary: {
        totalParts: results.length,
        validParts: results.filter((r) => r.valid).length,
        invalidParts: results.filter((r) => !r.valid).length,
        totalErrors: results.filter((r) => !r.valid).length,
      },
    },
  }
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

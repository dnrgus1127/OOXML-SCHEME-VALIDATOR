/**
 * @ooxml/desktop - Main Process
 *
 * Electron main process entry point
 */

import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { basename, join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { readFile as readFileAsync } from 'fs/promises'
import { OoxmlParser, OoxmlBuilder, parseXmlToEventArray } from '@ooxml/parser'
import {
  ValidationEngine,
  loadSchemaRegistry,
  type OoxmlDocumentType,
  type ValidationError,
  type SchemaRegistry,
} from '@ooxml/core'
import {
  addRecentFile,
  addRecentFiles,
  clearRecentFiles,
  listRecentFiles,
  removeRecentFile,
} from './recent-files-store'
import type { OpenTool } from '../shared/recent-files'

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

  ipcMain.handle('dialog:confirmFileChange', async () => {
    const result = await dialog.showMessageBox(mainWindow!, {
      type: 'warning',
      buttons: ['Save', 'Discard', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
      message: 'You have unsaved changes.',
      detail: 'Save changes before opening another file?',
    })

    if (result.response === 0) return 'save'
    if (result.response === 1) return 'discard'
    return 'cancel'
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

  // Check file existence
  ipcMain.handle('fs:exists', async (_, filePath: string) => {
    try {
      return existsSync(filePath)
    } catch {
      return false
    }
  })

  // Recent files
  ipcMain.handle('recent-files:list', async () => {
    return listRecentFiles()
  })

  const isValidRecentFileInput = (
    input: unknown
  ): input is {
    filePath: string
    fileName?: string
    lastTool: OpenTool
  } => {
    if (!input || typeof input !== 'object') return false
    const value = input as { filePath?: unknown; fileName?: unknown; lastTool?: unknown }
    if (typeof value.filePath !== 'string' || value.filePath.length === 0) return false
    if (value.fileName != null && typeof value.fileName !== 'string') return false
    return value.lastTool === 'xml-editor' || value.lastTool === 'batch-validator'
  }

  ipcMain.handle(
    'recent-files:add',
    async (_, input: { filePath: string; fileName?: string; lastTool: OpenTool }) => {
      if (!isValidRecentFileInput(input)) return listRecentFiles()
      return addRecentFile(input)
    }
  )

  ipcMain.handle('recent-files:add-many', async (_, inputs: unknown[]) => {
    if (!Array.isArray(inputs) || inputs.length === 0) return listRecentFiles()
    const validInputs = inputs.filter(isValidRecentFileInput)
    if (validInputs.length === 0) return listRecentFiles()
    return addRecentFiles(validInputs)
  })

  ipcMain.handle('recent-files:remove', async (_, filePath: string) => {
    if (typeof filePath !== 'string' || !filePath) return listRecentFiles()
    return removeRecentFile(filePath)
  })

  ipcMain.handle('recent-files:clear', async () => {
    return clearRecentFiles()
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

  // Open multiple files dialog
  ipcMain.handle('dialog:openFiles', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Office Documents', extensions: ['xlsx', 'docx', 'pptx'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })

    if (result.canceled) return null
    return result.filePaths
  })

  // Batch validate multiple files
  ipcMain.handle('ooxml:batchValidate', async (_, filePaths: string[]) => {
    try {
      const fileResults: Array<{
        filePath: string
        fileName: string
        success: boolean
        documentType?: string
        validation?: {
          valid: boolean
          results: Array<{
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
          }>
          summary: {
            totalParts: number
            validParts: number
            invalidParts: number
            totalErrors: number
          }
        }
        error?: string
      }> = []

      for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i]
        if (!filePath) continue

        // Send progress update
        mainWindow?.webContents.send('batch:progress', { current: i + 1, total: filePaths.length })
        await new Promise<void>((resolve) => setImmediate(resolve))
        try {
          const buffer = await readFileAsync(filePath)
          const doc = await OoxmlParser.fromBuffer(buffer)
          const documentType = doc.documentType as OoxmlDocumentType

          let registry: SchemaRegistry
          try {
            registry = loadSchemaRegistry(documentType)
          } catch (schemaError) {
            fileResults.push({
              filePath,
              fileName: basename(filePath) || filePath,
              success: false,
              error: `Schema loading failed: ${String(schemaError)}`,
            })
            continue
          }

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
            if (!part.contentType.includes('xml')) continue
            if (path.includes('_rels/')) continue
            if (path === '[Content_Types].xml') continue
            if (path.startsWith('docProps/')) continue
            if (path.startsWith('customXml/') && !path.includes('itemProps')) continue

            try {
              const xmlContent = part.content.toString('utf-8')
              const events = parseXmlToEventArray(xmlContent)
              const engine = new ValidationEngine(registry, {
                maxErrors: 100,
                allowWhitespace: true,
              })

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

          fileResults.push({
            filePath,
            fileName: basename(filePath) || filePath,
            success: true,
            documentType,
            validation: {
              valid,
              results,
              summary: {
                totalParts: results.length,
                validParts: results.filter((r) => r.valid).length,
                invalidParts: results.filter((r) => !r.valid).length,
                totalErrors,
              },
            },
          })
        } catch (error) {
          fileResults.push({
            filePath,
            fileName: basename(filePath) || filePath,
            success: false,
            error: String(error),
          })
        }
      }

      return { success: true, data: fileResults }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Export validation results
  ipcMain.handle(
    'export:results',
    async (_, format: 'json' | 'csv' | 'html' | 'pdf', data: any) => {
      try {
        const result = await dialog.showSaveDialog(mainWindow!, {
          defaultPath: `validation-results.${format}`,
          filters: [
            format === 'json' && { name: 'JSON', extensions: ['json'] },
            format === 'csv' && { name: 'CSV', extensions: ['csv'] },
            format === 'html' && { name: 'HTML', extensions: ['html'] },
            format === 'pdf' && { name: 'PDF', extensions: ['pdf'] },
          ].filter(Boolean) as any,
        })

        if (result.canceled || !result.filePath) {
          return { success: false, error: 'Export cancelled' }
        }

        let content = ''

        switch (format) {
          case 'json':
            content = JSON.stringify(data, null, 2)
            break

          case 'csv':
            content = generateCSV(data)
            break

          case 'html':
            content = generateHTML(data)
            break

          case 'pdf':
            return { success: false, error: 'PDF export not yet implemented' }

          default:
            return { success: false, error: 'Unknown export format' }
        }

        writeFileSync(result.filePath, content, 'utf-8')
        return { success: true, filePath: result.filePath }
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
 * Generate CSV from validation results
 */
function generateCSV(data: any): string {
  const lines: string[] = []
  lines.push(
    buildCsvRow(['File', 'Part', 'Status', 'Error Code', 'Error Message', 'Path', 'Line', 'Column'])
  )

  for (const file of data) {
    if (!file.success) {
      lines.push(buildCsvRow([file.fileName, '', 'ERROR', '', file.error, '', '', '']))
      continue
    }

    if (!file.validation) continue

    for (const part of file.validation.results) {
      if (part.valid) {
        lines.push(buildCsvRow([file.fileName, part.path, 'VALID', '', '', '', '', '']))
      } else if (part.errors) {
        for (const error of part.errors) {
          lines.push(
            buildCsvRow([
              file.fileName,
              part.path,
              'INVALID',
              error.code,
              error.message,
              error.path,
              error.line ?? '',
              error.column ?? '',
            ])
          )
        }
      }
    }
  }

  // Add UTF-8 BOM for Excel compatibility
  return '\uFEFF' + lines.join('\n')
}

function buildCsvRow(values: unknown[]): string {
  return values.map(escapeCsvValue).join(',')
}

function escapeCsvValue(value: unknown): string {
  const raw = value == null ? '' : String(value)
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const formulaSafe = /^[\s]*[=+\-@]/.test(normalized) ? `'${normalized}` : normalized
  return `"${formulaSafe.replace(/"/g, '""')}"`
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Generate HTML report from validation results
 */
function generateHTML(data: any): string {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OOXML Validation Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .file { margin-bottom: 30px; border: 1px solid #ddd; border-radius: 5px; }
    .file-header { background: #f9f9f9; padding: 15px; border-bottom: 1px solid #ddd; }
    .file-header.valid { background: #e8f5e9; }
    .file-header.invalid { background: #ffebee; }
    .file-title { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
    .file-stats { font-size: 14px; color: #666; }
    .parts { padding: 15px; }
    .part { margin-bottom: 15px; }
    .part-header { font-weight: bold; margin-bottom: 5px; }
    .error { background: #fff3e0; padding: 10px; margin: 5px 0; border-left: 3px solid #ff9800; border-radius: 3px; }
    .error-code { font-weight: bold; color: #e65100; }
    .error-message { margin: 5px 0; }
    .error-path { font-size: 12px; color: #666; font-family: monospace; }
    .valid-badge { color: #4caf50; }
    .invalid-badge { color: #f44336; }
  </style>
</head>
<body>
  <h1>OOXML Validation Report</h1>
  <div class="summary">
    <div><strong>Total Files:</strong> ${data.length}</div>
    <div><strong>Valid Files:</strong> ${data.filter((f: any) => f.success && f.validation?.valid).length}</div>
    <div><strong>Invalid Files:</strong> ${data.filter((f: any) => !f.success || !f.validation?.valid).length}</div>
    <div><strong>Total Errors:</strong> ${data.reduce((sum: number, f: any) => sum + (f.validation?.summary?.totalErrors || 0), 0)}</div>
  </div>
`

  for (const file of data) {
    const isValid = file.success && file.validation?.valid
    html += `
  <div class="file">
    <div class="file-header ${isValid ? 'valid' : 'invalid'}">
      <div class="file-title">${escapeHtml(file.fileName)}</div>
      <div class="file-stats">
        ${
          file.success
            ? `
          <span class="${isValid ? 'valid-badge' : 'invalid-badge'}">${isValid ? '✓ VALID' : '✗ INVALID'}</span>
          ${
            file.validation
              ? `
            | Parts: ${file.validation.summary.totalParts}
            | Valid: ${file.validation.summary.validParts}
            | Invalid: ${file.validation.summary.invalidParts}
            | Errors: ${file.validation.summary.totalErrors}
          `
              : ''
          }
        `
            : `<span class="invalid-badge">✗ ERROR: ${escapeHtml(file.error ?? 'Unknown error')}</span>`
        }
      </div>
    </div>
`

    if (file.success && file.validation) {
      const invalidParts = file.validation.results.filter((p: any) => !p.valid)
      if (invalidParts.length > 0) {
        html += `    <div class="parts">\n`
        for (const part of invalidParts) {
          html += `      <div class="part">
        <div class="part-header">${escapeHtml(part.path)}</div>
`
          if (part.errors) {
            for (const error of part.errors) {
              html += `        <div class="error">
          <div class="error-code">${escapeHtml(error.code)}</div>
          <div class="error-message">${escapeHtml(error.message)}</div>
          <div class="error-path">Path: ${escapeHtml(error.path)}${error.line ? ` | Line: ${error.line}` : ''}${error.column ? `, Col: ${error.column}` : ''}</div>
        </div>
`
            }
          }
          html += `      </div>\n`
        }
        html += `    </div>\n`
      }
    }

    html += `  </div>\n`
  }

  html += `
</body>
</html>`

  return html
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

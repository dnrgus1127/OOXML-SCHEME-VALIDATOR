import { describe, expect, it } from 'vitest'
import { ZipWriter } from '@ooxml/parser'
import {
  detectDocumentFormatFromBuffer,
  getEditablePartText,
  parseEditableDocument,
  updateEditablePartText,
} from '../editable-document'

function createOdfBuffer(options?: { includeMimetype?: boolean }): Buffer {
  const writer = new ZipWriter()
  writer.addEntry('/content.xml', '<office:document-content />')
  writer.addEntry(
    '/META-INF/manifest.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`
  )

  if (options?.includeMimetype !== false) {
    writer.addEntry('/mimetype', 'application/vnd.oasis.opendocument.spreadsheet')
  }

  return writer.toBuffer()
}

describe('editable document ODF handling', () => {
  it('detects ODF from manifest fallback when mimetype entry is missing', () => {
    const buffer = createOdfBuffer({ includeMimetype: false })

    expect(detectDocumentFormatFromBuffer(buffer)).toBe('odf')
    expect(parseEditableDocument(buffer).documentType).toBe('odf-spreadsheet')
  })

  it('uses file path hints for ODF parsing and part access', () => {
    const buffer = createOdfBuffer({ includeMimetype: false })

    expect(parseEditableDocument(buffer, 'C:/docs/sample.ods').containerFormat).toBe('odf')
    expect(getEditablePartText(buffer, '/content.xml', 'C:/docs/sample.ods')).toContain(
      'office:document-content'
    )
  })

  it('updates ODF parts without requiring OOXML content types', () => {
    const buffer = createOdfBuffer({ includeMimetype: false })

    const updated = updateEditablePartText(
      buffer,
      '/content.xml',
      '<office:document-content>updated</office:document-content>',
      'C:/docs/sample.ods'
    )

    expect(getEditablePartText(updated, '/content.xml', 'C:/docs/sample.ods')).toContain('updated')
  })
})

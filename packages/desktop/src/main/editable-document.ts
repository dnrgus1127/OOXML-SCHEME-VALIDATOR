import { OoxmlBuilder, OoxmlParser, ZipReader, ZipWriter } from '@ooxml/parser'

export type EditableDocumentFormat = 'ooxml' | 'odf'
export type ValidationSupportStatus = 'supported' | 'unsupported'

export interface EditableDocumentPart {
  contentType: string
  size: number
}

export interface EditableDocumentData {
  containerFormat: EditableDocumentFormat
  validationSupport: ValidationSupportStatus
  documentType: string
  contentTypes: Array<{ key: string; contentType: string; isDefault: boolean }>
  parts: Record<string, EditableDocumentPart>
}

const OOXML_FILE_EXTENSIONS = new Set(['.xlsx', '.docx', '.pptx'])
const ODF_FILE_EXTENSIONS = new Set(['.odt', '.ods', '.odp'])
const ODF_MIMETYPE_PREFIX = 'application/vnd.oasis.opendocument.'

function getFileExtension(filePath: string): string {
  const lower = filePath.toLowerCase()
  const index = lower.lastIndexOf('.')
  return index >= 0 ? lower.slice(index) : ''
}

export function isSupportedEditorFile(filePath: string): boolean {
  const extension = getFileExtension(filePath)
  return OOXML_FILE_EXTENSIONS.has(extension) || ODF_FILE_EXTENSIONS.has(extension)
}

export function isSupportedBatchFile(filePath: string): boolean {
  return OOXML_FILE_EXTENSIONS.has(getFileExtension(filePath))
}

export function detectDocumentFormatFromPath(
  filePath: string
): EditableDocumentFormat | null {
  const extension = getFileExtension(filePath)
  if (OOXML_FILE_EXTENSIONS.has(extension)) return 'ooxml'
  if (ODF_FILE_EXTENSIONS.has(extension)) return 'odf'
  return null
}

function readOdfMimeType(buffer: Buffer): string | null {
  try {
    const zip = ZipReader.fromBuffer(buffer)
    const mimeType = zip.readEntryAsText('/mimetype')?.trim()
    if (mimeType?.startsWith(ODF_MIMETYPE_PREFIX)) {
      return mimeType
    }

    const manifestXml = zip.readEntryAsText('/META-INF/manifest.xml')
    const manifestMimeType = manifestXml ? readOdfMimeTypeFromManifest(manifestXml) : null
    if (manifestMimeType?.startsWith(ODF_MIMETYPE_PREFIX)) {
      return manifestMimeType
    }

    return null
  } catch {
    return null
  }
}

function readOdfMimeTypeFromManifest(manifestXml: string): string | null {
  const match = manifestXml.match(
    /manifest:media-type="([^"]+)"[^>]*manifest:full-path="\/"|manifest:full-path="\/"[^>]*manifest:media-type="([^"]+)"/
  )

  return match?.[1] ?? match?.[2] ?? null
}

function detectOdfDocumentType(mimeType: string | null, filePath?: string): string {
  if (mimeType?.includes('.text')) return 'odf-text'
  if (mimeType?.includes('.spreadsheet')) return 'odf-spreadsheet'
  if (mimeType?.includes('.presentation')) return 'odf-presentation'
  if (mimeType?.includes('.graphics')) return 'odf-graphics'

  const extension = filePath ? getFileExtension(filePath) : ''
  if (extension === '.odt') return 'odf-text'
  if (extension === '.ods') return 'odf-spreadsheet'
  if (extension === '.odp') return 'odf-presentation'

  return 'odf-package'
}

export function detectDocumentFormatFromBuffer(
  buffer: Buffer,
  filePath?: string
): EditableDocumentFormat | null {
  const hintedFormat = filePath ? detectDocumentFormatFromPath(filePath) : null
  if (hintedFormat === 'ooxml') return 'ooxml'
  if (hintedFormat === 'odf') return 'odf'

  if (OoxmlParser.isValidOoxml(buffer)) return 'ooxml'
  if (readOdfMimeType(buffer)) return 'odf'
  return null
}

function parseOdfDocument(buffer: Buffer, filePath?: string): EditableDocumentData {
  const zip = ZipReader.fromBuffer(buffer)
  const mimeType = readOdfMimeType(buffer)
  const partsMap = zip.readAllParts(new Map())
  const parts: Record<string, EditableDocumentPart> = {}

  for (const [path, part] of partsMap) {
    parts[path] = {
      contentType: part.contentType,
      size: part.content.length,
    }
  }

  return {
    containerFormat: 'odf',
    validationSupport: 'unsupported',
    documentType: detectOdfDocumentType(mimeType, filePath),
    contentTypes: mimeType
      ? [{ key: 'mimetype', contentType: mimeType, isDefault: false }]
      : [],
    parts,
  }
}

function parseOoxmlDocument(buffer: Buffer): EditableDocumentData {
  const doc = OoxmlParser.fromBufferSync(buffer)
  const parts: Record<string, EditableDocumentPart> = {}

  for (const [path, part] of doc.parts) {
    parts[path] = {
      contentType: part.contentType,
      size: part.content.length,
    }
  }

  return {
    containerFormat: 'ooxml',
    validationSupport: 'supported',
    documentType: doc.documentType,
    contentTypes: doc.contentTypes,
    parts,
  }
}

export function parseEditableDocument(buffer: Buffer, filePath?: string): EditableDocumentData {
  const format = detectDocumentFormatFromBuffer(buffer, filePath)

  if (format === 'ooxml') {
    return parseOoxmlDocument(buffer)
  }

  if (format === 'odf') {
    return parseOdfDocument(buffer, filePath)
  }

  throw new Error('Unsupported document format')
}

export function getEditablePartText(
  buffer: Buffer,
  partPath: string,
  filePath?: string
): string | undefined {
  const format = detectDocumentFormatFromBuffer(buffer, filePath)

  if (format === 'ooxml') {
    const doc = OoxmlParser.fromBufferSync(buffer)
    const xml = doc.getPartAsXml(partPath)
    if (xml != null) return xml

    const part = doc.getPart(partPath)
    return part?.content.toString('utf-8')
  }

  if (format === 'odf') {
    const zip = ZipReader.fromBuffer(buffer)
    const text = zip.readEntryAsText(partPath)
    if (text != null) return text

    const entry = zip.readEntry(partPath)
    return entry?.toString('utf-8')
  }

  return undefined
}

export function updateEditablePartText(
  buffer: Buffer,
  partPath: string,
  content: string,
  filePath?: string
): Buffer {
  const format = detectDocumentFormatFromBuffer(buffer, filePath)

  if (format === 'ooxml') {
    const builder = OoxmlBuilder.fromBuffer(buffer)
    builder.setPart(partPath, content)
    return builder.toBuffer()
  }

  if (format === 'odf') {
    const writer = ZipWriter.fromBuffer(buffer)
    writer.addEntry(partPath, content)
    return writer.toBuffer()
  }

  throw new Error('Unsupported document format')
}

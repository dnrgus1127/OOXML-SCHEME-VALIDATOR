/**
 * OOXML Document Parser
 *
 * Main entry point for parsing OOXML documents (xlsx, docx, pptx).
 */

import { readFileSync } from 'fs'
import type { OoxmlDocument, ParserOptions } from './types'
import { ZipReader } from './zip/reader'
import {
  parseContentTypes,
  buildContentTypeMap,
  detectDocumentType,
  CONTENT_TYPES_PATH,
} from './content-types'
import { OoxmlDocumentImpl } from './document'

const DEFAULT_OPTIONS: ParserOptions = {
  validateZip: false,
  maxFileSize: 100 * 1024 * 1024, // 100MB
  skipParts: [],
}

export class OoxmlParser {
  /**
   * Parse an OOXML document from file path
   */
  static async fromFile(filePath: string, options?: ParserOptions): Promise<OoxmlDocument> {
    const buffer = readFileSync(filePath)
    return OoxmlParser.fromBuffer(buffer, options)
  }

  /**
   * Parse an OOXML document from file path (sync)
   */
  static fromFileSync(filePath: string, options?: ParserOptions): OoxmlDocument {
    const buffer = readFileSync(filePath)
    return OoxmlParser.fromBufferSync(buffer, options)
  }

  /**
   * Parse an OOXML document from Buffer
   */
  static async fromBuffer(buffer: Buffer, options?: ParserOptions): Promise<OoxmlDocument> {
    return OoxmlParser.fromBufferSync(buffer, options)
  }

  /**
   * Parse an OOXML document from Buffer (sync)
   */
  static fromBufferSync(buffer: Buffer, options?: ParserOptions): OoxmlDocument {
    const opts = { ...DEFAULT_OPTIONS, ...options }

    // Check file size
    if (opts.maxFileSize && buffer.length > opts.maxFileSize) {
      throw new Error(
        `File size (${buffer.length} bytes) exceeds maximum allowed (${opts.maxFileSize} bytes)`
      )
    }

    // Open ZIP archive
    const zip = ZipReader.fromBuffer(buffer, {
      validateStructure: opts.validateZip,
    })

    // Read [Content_Types].xml
    const contentTypesXml = zip.readEntryAsText(CONTENT_TYPES_PATH)
    if (!contentTypesXml) {
      throw new Error('Invalid OOXML document: missing [Content_Types].xml')
    }

    // Parse content types
    const contentTypesResult = parseContentTypes(contentTypesXml)

    // Build content type map for all parts
    const entryPaths = zip.getEntryPaths()
    const contentTypeMap = buildContentTypeMap(contentTypesResult, entryPaths)

    // Detect document type
    const documentType = detectDocumentType(contentTypesResult)

    // Read all parts
    const parts = zip.readAllParts(contentTypeMap)

    // Filter out skipped parts
    if (opts.skipParts && opts.skipParts.length > 0) {
      for (const pattern of opts.skipParts) {
        for (const path of parts.keys()) {
          if (matchPattern(path, pattern)) {
            parts.delete(path)
          }
        }
      }
    }

    return new OoxmlDocumentImpl(documentType, contentTypesResult.entries, parts)
  }

  /**
   * Parse an OOXML document from base64 string
   */
  static async fromBase64(base64: string, options?: ParserOptions): Promise<OoxmlDocument> {
    const buffer = Buffer.from(base64, 'base64')
    return OoxmlParser.fromBuffer(buffer, options)
  }

  /**
   * Check if a buffer looks like a valid OOXML document
   */
  static isValidOoxml(buffer: Buffer): boolean {
    // Check for ZIP signature (PK)
    if (buffer.length < 4) return false
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) return false

    try {
      const zip = ZipReader.fromBuffer(buffer)
      return zip.hasEntry(CONTENT_TYPES_PATH)
    } catch {
      return false
    }
  }

  /**
   * Detect document type from file extension or content
   */
  static detectType(filenameOrBuffer: string | Buffer): 'xlsx' | 'docx' | 'pptx' | 'unknown' {
    if (typeof filenameOrBuffer === 'string') {
      const ext = filenameOrBuffer.split('.').pop()?.toLowerCase()
      if (ext === 'xlsx') return 'xlsx'
      if (ext === 'docx') return 'docx'
      if (ext === 'pptx') return 'pptx'
      return 'unknown'
    }

    // Detect from content
    try {
      const doc = OoxmlParser.fromBufferSync(filenameOrBuffer)
      switch (doc.documentType) {
        case 'spreadsheet':
          return 'xlsx'
        case 'document':
          return 'docx'
        case 'presentation':
          return 'pptx'
        default:
          return 'unknown'
      }
    } catch {
      return 'unknown'
    }
  }
}

/**
 * Simple glob pattern matching
 */
function matchPattern(path: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars
    .replace(/\*/g, '.*') // * -> .*
    .replace(/\?/g, '.') // ? -> .

  const regex = new RegExp(`^${regexStr}$`)
  return regex.test(path)
}

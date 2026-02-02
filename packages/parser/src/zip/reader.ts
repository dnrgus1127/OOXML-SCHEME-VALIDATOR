/**
 * ZIP Archive Reader for OOXML documents
 */

import AdmZip from 'adm-zip'
import type { OoxmlPart } from '../types'

export interface ZipReaderOptions {
  /** Maximum file size to read (bytes) */
  maxFileSize?: number
  /** Whether to validate ZIP structure */
  validateStructure?: boolean
}

export class ZipReader {
  private zip: AdmZip
  private options: ZipReaderOptions

  private constructor(zip: AdmZip, options: ZipReaderOptions = {}) {
    this.zip = zip
    this.options = options
  }

  /**
   * Create reader from file path
   */
  static fromFile(filePath: string, options?: ZipReaderOptions): ZipReader {
    const zip = new AdmZip(filePath)
    return new ZipReader(zip, options)
  }

  /**
   * Create reader from buffer
   */
  static fromBuffer(buffer: Buffer, options?: ZipReaderOptions): ZipReader {
    const zip = new AdmZip(buffer)
    return new ZipReader(zip, options)
  }

  /**
   * Get all entry paths in the archive
   */
  getEntryPaths(): string[] {
    return this.zip.getEntries().map((entry) => '/' + entry.entryName)
  }

  /**
   * Check if an entry exists
   */
  hasEntry(path: string): boolean {
    const entryName = path.startsWith('/') ? path.slice(1) : path
    return this.zip.getEntry(entryName) !== null
  }

  /**
   * Read entry content as Buffer
   */
  readEntry(path: string): Buffer | null {
    const entryName = path.startsWith('/') ? path.slice(1) : path
    const entry = this.zip.getEntry(entryName)

    if (!entry || entry.isDirectory) {
      return null
    }

    return entry.getData()
  }

  /**
   * Read entry content as string (UTF-8)
   */
  readEntryAsText(path: string): string | null {
    const buffer = this.readEntry(path)
    return buffer ? buffer.toString('utf-8') : null
  }

  /**
   * Read all entries as OoxmlPart objects
   */
  readAllParts(contentTypes: Map<string, string>): Map<string, OoxmlPart> {
    const parts = new Map<string, OoxmlPart>()

    for (const entry of this.zip.getEntries()) {
      if (entry.isDirectory) continue

      const path = '/' + entry.entryName
      const contentType = contentTypes.get(path) || this.guessContentType(path)

      parts.set(path, {
        path,
        contentType,
        content: entry.getData(),
      })
    }

    return parts
  }

  /**
   * Guess content type based on file extension
   */
  private guessContentType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || ''

    const contentTypeMap: Record<string, string> = {
      xml: 'application/xml',
      rels: 'application/vnd.openxmlformats-package.relationships+xml',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      emf: 'image/x-emf',
      wmf: 'image/x-wmf',
    }

    return contentTypeMap[ext] || 'application/octet-stream'
  }
}

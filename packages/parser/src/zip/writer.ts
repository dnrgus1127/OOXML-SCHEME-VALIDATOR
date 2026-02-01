/**
 * ZIP Archive Writer for OOXML documents
 */

import AdmZip from 'adm-zip'

export interface ZipWriterOptions {
  /** Compression level (0-9, default: 5) */
  compressionLevel?: number
}

export class ZipWriter {
  private zip: AdmZip
  private options: ZipWriterOptions

  constructor(options: ZipWriterOptions = {}) {
    this.zip = new AdmZip()
    this.options = {
      compressionLevel: options.compressionLevel ?? 5,
    }
  }

  /**
   * Add or replace an entry
   */
  addEntry(path: string, content: Buffer | string): void {
    const entryName = path.startsWith('/') ? path.slice(1) : path
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content

    // Remove existing entry if present
    const existing = this.zip.getEntry(entryName)
    if (existing) {
      this.zip.deleteFile(entryName)
    }

    this.zip.addFile(entryName, buffer)
  }

  /**
   * Remove an entry
   */
  removeEntry(path: string): boolean {
    const entryName = path.startsWith('/') ? path.slice(1) : path
    const entry = this.zip.getEntry(entryName)

    if (entry) {
      this.zip.deleteFile(entryName)
      return true
    }

    return false
  }

  /**
   * Get the archive as a Buffer
   */
  toBuffer(): Buffer {
    return this.zip.toBuffer()
  }

  /**
   * Write the archive to a file
   */
  toFile(filePath: string): void {
    this.zip.writeZip(filePath)
  }

  /**
   * Create a writer from an existing ZIP buffer
   */
  static fromBuffer(buffer: Buffer, options?: ZipWriterOptions): ZipWriter {
    const writer = new ZipWriter(options)
    const sourceZip = new AdmZip(buffer)

    // Copy all entries from source
    for (const entry of sourceZip.getEntries()) {
      if (!entry.isDirectory) {
        writer.addEntry('/' + entry.entryName, entry.getData())
      }
    }

    return writer
  }
}

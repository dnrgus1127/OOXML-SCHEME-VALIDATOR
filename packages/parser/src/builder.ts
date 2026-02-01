/**
 * OOXML Document Builder
 *
 * Allows modifying and rebuilding OOXML documents.
 */

import type { OoxmlDocument, BuilderOptions, JsonElement } from './types'
import { ZipWriter } from './zip/writer'
import { jsonToXml } from './xml/json-converter'

export class OoxmlBuilder {
  private writer: ZipWriter
  private modified = new Set<string>()

  private constructor(writer: ZipWriter) {
    this.writer = writer
  }

  /**
   * Create builder from an existing document
   */
  static fromDocument(doc: OoxmlDocument, options?: BuilderOptions): OoxmlBuilder {
    const writer = new ZipWriter({
      compressionLevel: options?.compressionLevel,
    })

    // Copy all parts from the document
    for (const [path, part] of doc.parts) {
      const entryPath = path.startsWith('/') ? path.slice(1) : path
      writer.addEntry(entryPath, part.content)
    }

    return new OoxmlBuilder(writer)
  }

  /**
   * Create builder from a buffer
   */
  static fromBuffer(buffer: Buffer, options?: BuilderOptions): OoxmlBuilder {
    const writer = ZipWriter.fromBuffer(buffer, {
      compressionLevel: options?.compressionLevel,
    })
    return new OoxmlBuilder(writer)
  }

  /**
   * Create empty builder
   */
  static create(options?: BuilderOptions): OoxmlBuilder {
    const writer = new ZipWriter({
      compressionLevel: options?.compressionLevel,
    })
    return new OoxmlBuilder(writer)
  }

  /**
   * Set a part's content
   */
  setPart(path: string, content: string | Buffer): this {
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path
    this.writer.addEntry(normalizedPath, content)
    this.modified.add(path)
    return this
  }

  /**
   * Set a part's content from JSON (converts to XML)
   */
  setPartFromJson(path: string, json: JsonElement): this {
    const xml = jsonToXml(json)
    return this.setPart(path, xml)
  }

  /**
   * Remove a part
   */
  removePart(path: string): this {
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path
    this.writer.removeEntry(normalizedPath)
    this.modified.add(path)
    return this
  }

  /**
   * Get the document as a Buffer
   */
  toBuffer(): Buffer {
    return this.writer.toBuffer()
  }

  /**
   * Write the document to a file
   */
  toFile(filePath: string): void {
    this.writer.toFile(filePath)
  }

  /**
   * Get list of modified parts
   */
  getModifiedParts(): string[] {
    return Array.from(this.modified)
  }
}

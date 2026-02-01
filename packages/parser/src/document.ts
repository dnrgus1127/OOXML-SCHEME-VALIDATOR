/**
 * OOXML Document Representation
 *
 * Provides access to parsed OOXML document structure.
 */

import type { OoxmlDocument, OoxmlPart, ContentTypeEntry, Relationship, JsonElement } from './types'
import { xmlToJson } from './xml/json-converter'
import { parseRelationships, getRelsPath } from './relationships'

export class OoxmlDocumentImpl implements OoxmlDocument {
  readonly documentType: 'spreadsheet' | 'document' | 'presentation' | 'unknown'
  readonly contentTypes: ContentTypeEntry[]
  readonly parts: Map<string, OoxmlPart>

  private relsCache = new Map<string, Relationship[]>()

  constructor(
    documentType: OoxmlDocument['documentType'],
    contentTypes: ContentTypeEntry[],
    parts: Map<string, OoxmlPart>
  ) {
    this.documentType = documentType
    this.contentTypes = contentTypes
    this.parts = parts
  }

  getPart(path: string): OoxmlPart | undefined {
    // Normalize path
    const normalizedPath = path.startsWith('/') ? path : '/' + path
    return this.parts.get(normalizedPath)
  }

  getPartAsJson<T = JsonElement>(path: string): T | undefined {
    const part = this.getPart(path)
    if (!part) return undefined

    const content = part.content.toString('utf-8')

    // Check if it's XML content
    if (
      part.contentType.includes('xml') ||
      content.trimStart().startsWith('<?xml') ||
      content.trimStart().startsWith('<')
    ) {
      return xmlToJson(content) as T
    }

    // Try to parse as JSON
    try {
      return JSON.parse(content) as T
    } catch {
      return undefined
    }
  }

  getPartAsXml(path: string): string | undefined {
    const part = this.getPart(path)
    if (!part) return undefined

    return part.content.toString('utf-8')
  }

  getRelationships(partPath: string): Relationship[] {
    const normalizedPath = partPath.startsWith('/') ? partPath : '/' + partPath

    // Check cache
    if (this.relsCache.has(normalizedPath)) {
      return this.relsCache.get(normalizedPath)!
    }

    // Find .rels file
    const relsPath = getRelsPath(normalizedPath)
    const relsPart = this.getPart(relsPath)

    if (!relsPart) {
      this.relsCache.set(normalizedPath, [])
      return []
    }

    // Parse relationships
    const relsXml = relsPart.content.toString('utf-8')

    // Determine base path for resolving relative targets
    const basePath = normalizedPath === '/'
      ? '/'
      : normalizedPath.slice(0, normalizedPath.lastIndexOf('/') + 1)

    const rels = parseRelationships(relsXml, basePath)
    this.relsCache.set(normalizedPath, rels)

    return rels
  }

  /**
   * Get all parts of a specific content type
   */
  getPartsByContentType(contentType: string): OoxmlPart[] {
    const results: OoxmlPart[] = []

    for (const part of this.parts.values()) {
      if (part.contentType === contentType || part.contentType.includes(contentType)) {
        results.push(part)
      }
    }

    return results
  }

  /**
   * Get all XML parts
   */
  getXmlParts(): OoxmlPart[] {
    return this.getPartsByContentType('xml')
  }

  /**
   * Get the main document part based on document type
   */
  getMainPart(): OoxmlPart | undefined {
    // Get relationships from root
    const rootRels = this.getRelationships('/')

    // Find office document relationship
    const officeDocRel = rootRels.find(
      (r) => r.type.includes('officeDocument')
    )

    if (officeDocRel) {
      return this.getPart(officeDocRel.target)
    }

    // Fallback based on document type
    const mainPaths: Record<string, string[]> = {
      spreadsheet: ['/xl/workbook.xml'],
      document: ['/word/document.xml'],
      presentation: ['/ppt/presentation.xml'],
      unknown: [],
    }

    for (const path of mainPaths[this.documentType]) {
      const part = this.getPart(path)
      if (part) return part
    }

    return undefined
  }

  /**
   * List all part paths
   */
  listParts(): string[] {
    return Array.from(this.parts.keys()).sort()
  }
}

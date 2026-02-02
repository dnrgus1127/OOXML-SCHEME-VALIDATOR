/**
 * Parser module type definitions
 */

import type { XmlValidationEvent } from '@ooxml/core'

/**
 * Represents a part within an OOXML document
 */
export interface OoxmlPart {
  /** Part path within the archive (e.g., "/xl/worksheets/sheet1.xml") */
  path: string
  /** Content type of the part */
  contentType: string
  /** Raw content as Buffer */
  content: Buffer
}

/**
 * Content type entry from [Content_Types].xml
 */
export interface ContentTypeEntry {
  /** File extension or part name */
  key: string
  /** MIME content type */
  contentType: string
  /** Whether this is a default (extension-based) or override (path-based) entry */
  isDefault: boolean
}

/**
 * Relationship entry from .rels files
 */
export interface Relationship {
  /** Relationship ID (e.g., "rId1") */
  id: string
  /** Relationship type URI */
  type: string
  /** Target path (relative or absolute) */
  target: string
  /** Target mode: Internal or External */
  targetMode: 'Internal' | 'External'
}

/**
 * Parsed OOXML document structure
 */
export interface OoxmlDocument {
  /** Document type based on main content type */
  readonly documentType: 'spreadsheet' | 'document' | 'presentation' | 'unknown'

  /** Content types from [Content_Types].xml */
  readonly contentTypes: ContentTypeEntry[]

  /** All parts in the document */
  readonly parts: Map<string, OoxmlPart>

  /** Get a specific part by path */
  getPart(path: string): OoxmlPart | undefined

  /** Get part content as parsed JSON */
  getPartAsJson<T = unknown>(path: string): T | undefined

  /** Get part content as XML string */
  getPartAsXml(path: string): string | undefined

  /** Get relationships for a part */
  getRelationships(partPath: string): Relationship[]

  /** Get the main document part */
  getMainPart(): OoxmlPart | undefined

  /** Get all XML parts */
  getXmlParts(): OoxmlPart[]
}

/**
 * Options for parsing OOXML documents
 */
export interface ParserOptions {
  /** Whether to validate ZIP structure */
  validateZip?: boolean
  /** Maximum file size to parse (bytes) */
  maxFileSize?: number
  /** Parts to skip during parsing (glob patterns) */
  skipParts?: string[]
}

/**
 * JSON representation of an XML element
 */
export interface JsonElement {
  /** Element local name */
  name: string
  /** Namespace URI */
  namespace?: string
  /** Namespace prefix */
  prefix?: string
  /** Element attributes */
  attributes: Record<string, string>
  /** Child elements */
  children: JsonElement[]
  /** Text content */
  text?: string
}

/**
 * Streaming XML parser interface
 */
export interface StreamingXmlParser {
  /** Parse XML and yield validation events */
  parse(xml: string | Buffer): AsyncIterable<XmlValidationEvent>
}

/**
 * Options for building OOXML documents
 */
export interface BuilderOptions {
  /** Compression level (0-9) */
  compressionLevel?: number
}

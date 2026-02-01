/**
 * @ooxml/parser
 *
 * OOXML document parsing and manipulation library.
 *
 * Features:
 * - Parse OOXML documents (xlsx, docx, pptx)
 * - Access and modify document parts
 * - XML ↔ JSON conversion
 * - Content Types and Relationships handling
 * - Streaming XML parser for validation events
 */

// Main classes
export { OoxmlParser } from './parser'
export { OoxmlBuilder } from './builder'
export { OoxmlDocumentImpl } from './document'

// ZIP handling
export { ZipReader, type ZipReaderOptions } from './zip'
export { ZipWriter, type ZipWriterOptions } from './zip'

// XML handling
export { xmlToJson, jsonToXml, formatXml } from './xml'
export {
  parseXmlToEvents,
  parseXmlToEventArray,
  parseXmlToEventsAsync,
  type XmlValidationEvent,
  type XmlElementInfo,
  type XmlAttribute,
} from './xml'

// Content Types
export {
  parseContentTypes,
  getContentType,
  buildContentTypeMap,
  detectDocumentType,
  CONTENT_TYPES_PATH,
} from './content-types'

// Relationships
export {
  parseRelationships,
  getRelsPath,
  RelationshipTypes,
} from './relationships'

// Types
export type {
  OoxmlDocument,
  OoxmlPart,
  ContentTypeEntry,
  Relationship,
  ParserOptions,
  BuilderOptions,
  JsonElement,
  StreamingXmlParser,
} from './types'

/**
 * Relationships Parser
 *
 * Parses .rels files to understand part relationships.
 */

import { XMLParser } from 'fast-xml-parser'
import type { Relationship } from './types'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
})

/**
 * Get the .rels path for a given part
 */
export function getRelsPath(partPath: string): string {
  if (partPath === '/') {
    return '/_rels/.rels'
  }

  const lastSlash = partPath.lastIndexOf('/')
  const dir = partPath.slice(0, lastSlash + 1)
  const filename = partPath.slice(lastSlash + 1)

  return `${dir}_rels/${filename}.rels`
}

/**
 * Parse a .rels file content
 */
export function parseRelationships(xml: string, basePath: string = '/'): Relationship[] {
  const parsed = parser.parse(xml)
  const rels = parsed.Relationships || {}
  const relationships: Relationship[] = []

  const entries = ensureArray(rels.Relationship || [])

  for (const entry of entries) {
    const id = entry['@_Id'] || ''
    const type = entry['@_Type'] || ''
    const target = entry['@_Target'] || ''
    const targetMode = (entry['@_TargetMode'] || 'Internal') as 'Internal' | 'External'

    if (id && type && target) {
      // Resolve relative target paths
      let resolvedTarget = target
      if (targetMode === 'Internal' && !target.startsWith('/')) {
        resolvedTarget = resolvePath(basePath, target)
      }

      relationships.push({
        id,
        type,
        target: resolvedTarget,
        targetMode,
      })
    }
  }

  return relationships
}

/**
 * Resolve a relative path against a base path
 */
function resolvePath(basePath: string, relativePath: string): string {
  // Get the directory of the base path
  const baseDir = basePath.endsWith('/')
    ? basePath
    : basePath.slice(0, basePath.lastIndexOf('/') + 1)

  // Handle .. and . in relative path
  const parts = (baseDir + relativePath).split('/')
  const resolved: string[] = []

  for (const part of parts) {
    if (part === '..') {
      resolved.pop()
    } else if (part !== '.' && part !== '') {
      resolved.push(part)
    }
  }

  return '/' + resolved.join('/')
}

/**
 * Common relationship types in OOXML
 */
export const RelationshipTypes = {
  // Core relationships
  CORE_PROPERTIES:
    'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
  EXTENDED_PROPERTIES:
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties',
  CUSTOM_PROPERTIES:
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties',
  THUMBNAIL: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail',

  // Office document relationships
  OFFICE_DOCUMENT:
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',

  // SpreadsheetML relationships
  WORKSHEET: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
  SHARED_STRINGS:
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings',
  STYLES: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
  THEME: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme',

  // WordprocessingML relationships
  STYLES_WML: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
  NUMBERING: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering',
  FOOTNOTES: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes',
  ENDNOTES: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes',
  COMMENTS: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments',
  HEADER: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header',
  FOOTER: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer',

  // PresentationML relationships
  SLIDE: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide',
  SLIDE_LAYOUT: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout',
  SLIDE_MASTER: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster',
  NOTES_SLIDE: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide',

  // DrawingML relationships
  IMAGE: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
  CHART: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart',
  DRAWING: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing',
  DIAGRAM_COLORS:
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramColors',
  DIAGRAM_DATA: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData',
  DIAGRAM_LAYOUT:
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramLayout',
  DIAGRAM_QUICK_STYLE:
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramQuickStyle',

  // Hyperlinks
  HYPERLINK: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
} as const

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

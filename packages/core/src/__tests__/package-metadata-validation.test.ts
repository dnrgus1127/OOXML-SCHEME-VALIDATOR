import { describe, expect, it } from 'vitest'
import { validateXmlEvents, type XmlValidationEvent } from '../mcp'
import { loadSchemaRegistry } from '../schema/schema-loader'
import type { XmlAttribute, XmlElementInfo } from '../runtime'

const CORE_PROPS_NS = 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties'
const CORE_PROPS_STRICT_NS = 'http://purl.oclc.org/ooxml/package/metadata/core-properties'
const CONTENT_TYPES_NS = 'http://schemas.openxmlformats.org/package/2006/content-types'
const CONTENT_TYPES_STRICT_NS = 'http://purl.oclc.org/ooxml/package/content-types'
const DC_NS = 'http://purl.org/dc/elements/1.1/'
const DCTERMS_NS = 'http://purl.org/dc/terms/'

function attrs(values: Record<string, string>): XmlAttribute[] {
  return Object.entries(values).map(([name, value]) => ({
    name,
    localName: name.includes(':') ? name.split(':')[1] : name,
    value,
  }))
}

function el(
  name: string,
  localName: string,
  namespaceUri: string,
  attributes: XmlAttribute[] = [],
  namespaceDeclarations?: Map<string, string>
): XmlElementInfo {
  return { name, localName, namespaceUri, attributes, namespaceDeclarations }
}

function validate(events: XmlValidationEvent[]) {
  const registry = loadSchemaRegistry('document')
  return validateXmlEvents(registry, events, { allowWhitespace: true, maxErrors: 100 })
}

describe('package metadata schema validation', () => {
  it('validates [Content_Types].xml with transitional namespace', () => {
    const root = el('Types', 'Types', CONTENT_TYPES_NS, [], new Map([['', CONTENT_TYPES_NS]]))
    const defaultEl = el(
      'Default',
      'Default',
      CONTENT_TYPES_NS,
      attrs({
        Extension: 'rels',
        ContentType: 'application/vnd.openxmlformats-package.relationships+xml',
      })
    )
    const result = validate([
      { type: 'startDocument' },
      { type: 'startElement', element: root },
      { type: 'startElement', element: defaultEl },
      { type: 'endElement', element: defaultEl },
      { type: 'endElement', element: root },
      { type: 'endDocument' },
    ])

    expect(result.valid).toBe(true)
  })

  it('rejects [Content_Types].xml when required attribute is missing', () => {
    const root = el('Types', 'Types', CONTENT_TYPES_NS, [], new Map([['', CONTENT_TYPES_NS]]))
    const defaultEl = el('Default', 'Default', CONTENT_TYPES_NS, attrs({ Extension: 'rels' }))

    const result = validate([
      { type: 'startDocument' },
      { type: 'startElement', element: root },
      { type: 'startElement', element: defaultEl },
      { type: 'endElement', element: defaultEl },
      { type: 'endElement', element: root },
      { type: 'endDocument' },
    ])

    expect(result.valid).toBe(false)
    expect(result.errors.some((err) => err.code === 'MISSING_REQUIRED_ATTR')).toBe(true)
  })

  it('validates core.xml with transitional namespace', () => {
    const root = el(
      'cp:coreProperties',
      'coreProperties',
      CORE_PROPS_NS,
      [],
      new Map([
        ['cp', CORE_PROPS_NS],
        ['dc', DC_NS],
        ['dcterms', DCTERMS_NS],
      ])
    )
    const titleEl = el('dc:title', 'title', DC_NS)
    const creatorEl = el('dc:creator', 'creator', DC_NS)
    const createdEl = el('dcterms:created', 'created', DCTERMS_NS)

    const result = validate([
      { type: 'startDocument' },
      { type: 'startElement', element: root },
      { type: 'startElement', element: titleEl },
      { type: 'text', text: 'Report' },
      { type: 'endElement', element: titleEl },
      { type: 'startElement', element: creatorEl },
      { type: 'text', text: 'Alice' },
      { type: 'endElement', element: creatorEl },
      { type: 'startElement', element: createdEl },
      { type: 'text', text: '2026-02-15T00:00:00Z' },
      { type: 'endElement', element: createdEl },
      { type: 'endElement', element: root },
      { type: 'endDocument' },
    ])

    expect(result.valid).toBe(true)
  })

  it('validates core.xml with strict package namespace alias', () => {
    const root = el(
      'cp:coreProperties',
      'coreProperties',
      CORE_PROPS_STRICT_NS,
      [],
      new Map([
        ['cp', CORE_PROPS_STRICT_NS],
        ['dc', DC_NS],
        ['dcterms', DCTERMS_NS],
      ])
    )
    const titleEl = el('dc:title', 'title', DC_NS)

    const result = validate([
      { type: 'startDocument' },
      { type: 'startElement', element: root },
      { type: 'startElement', element: titleEl },
      { type: 'text', text: 'Strict metadata' },
      { type: 'endElement', element: titleEl },
      { type: 'endElement', element: root },
      { type: 'endDocument' },
    ])

    expect(result.valid).toBe(true)
  })

  it('validates [Content_Types].xml with strict package namespace alias', () => {
    const root = el(
      'Types',
      'Types',
      CONTENT_TYPES_STRICT_NS,
      [],
      new Map([['', CONTENT_TYPES_STRICT_NS]])
    )
    const defaultEl = el(
      'Default',
      'Default',
      CONTENT_TYPES_STRICT_NS,
      attrs({
        Extension: 'xml',
        ContentType: 'application/xml',
      })
    )

    const result = validate([
      { type: 'startDocument' },
      { type: 'startElement', element: root },
      { type: 'startElement', element: defaultEl },
      { type: 'endElement', element: defaultEl },
      { type: 'endElement', element: root },
      { type: 'endDocument' },
    ])

    expect(result.valid).toBe(true)
  })

  it('rejects core.xml with unknown namespace', () => {
    const invalidNs = 'http://example.com/invalid/core-properties'
    const root = el(
      'cp:coreProperties',
      'coreProperties',
      invalidNs,
      [],
      new Map([['cp', invalidNs]])
    )

    const result = validate([
      { type: 'startDocument' },
      { type: 'startElement', element: root },
      { type: 'endElement', element: root },
      { type: 'endDocument' },
    ])

    expect(result.valid).toBe(false)
    expect(result.errors.some((err) => err.code === 'INVALID_ELEMENT')).toBe(true)
  })
})

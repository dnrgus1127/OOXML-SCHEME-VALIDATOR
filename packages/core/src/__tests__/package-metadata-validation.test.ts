import { describe, expect, it } from 'vitest'
import { validateXmlEvents, type XmlValidationEvent } from '../mcp'
import { loadSchemaRegistry } from '../schema/schema-loader'
import type { XmlAttribute, XmlElementInfo } from '../runtime'

const CORE_PROPS_NS = 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties'
const CORE_PROPS_STRICT_NS = 'http://purl.oclc.org/ooxml/package/metadata/core-properties'
const CONTENT_TYPES_NS = 'http://schemas.openxmlformats.org/package/2006/content-types'
const CONTENT_TYPES_STRICT_NS = 'http://purl.oclc.org/ooxml/package/content-types'
const CUSTOM_PROPS_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/custom-properties'
const DC_NS = 'http://purl.org/dc/elements/1.1/'
const DCTERMS_NS = 'http://purl.org/dc/terms/'
const VT_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes'
const XML_NS = 'http://www.w3.org/XML/1998/namespace'

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
  return validateXmlEvents(registry, events, {
    allowWhitespace: true,
    maxErrors: 100,
    includeWarnings: true,
  })
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
    const overrideEl = el(
      'Override',
      'Override',
      CONTENT_TYPES_NS,
      attrs({
        PartName: '/docProps/core.xml',
        ContentType: 'application/vnd.openxmlformats-package.core-properties+xml',
      })
    )
    const result = validate([
      { type: 'startDocument' },
      { type: 'startElement', element: root },
      { type: 'startElement', element: defaultEl },
      { type: 'endElement', element: defaultEl },
      { type: 'startElement', element: overrideEl },
      { type: 'endElement', element: overrideEl },
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

  it('accepts empty custom properties root when default namespace is missing', () => {
    const root = el(
      'Properties',
      'Properties',
      '',
      [],
      new Map([
        ['r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'],
        ['cfp', CUSTOM_PROPS_NS],
        ['vt', VT_NS],
      ])
    )

    const result = validate([
      { type: 'startDocument' },
      { type: 'startElement', element: root },
      { type: 'endElement', element: root },
      { type: 'endDocument' },
    ])

    expect(result.valid).toBe(true)
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'INFERRED_DEFAULT_NAMESPACE',
        path: '/Properties',
      }),
    ])
  })

  it('infers custom properties namespace when default namespace is missing', () => {
    const root = el(
      'Properties',
      'Properties',
      '',
      [],
      new Map([
        ['r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'],
        ['cfp', CUSTOM_PROPS_NS],
        ['vt', VT_NS],
      ])
    )
    const propertyEl = el(
      'property',
      'property',
      '',
      attrs({
        fmtid: '{D5CDD505-2E9C-101B-9397-08002B2CF9AE}',
        pid: '2',
        name: 'MyProp',
      })
    )
    const valueEl = el('vt:lpwstr', 'lpwstr', VT_NS)

    const result = validate([
      { type: 'startDocument' },
      { type: 'startElement', element: root },
      { type: 'startElement', element: propertyEl },
      { type: 'startElement', element: valueEl },
      { type: 'text', text: 'hello' },
      { type: 'endElement', element: valueEl },
      { type: 'endElement', element: propertyEl },
      { type: 'endElement', element: root },
      { type: 'endDocument' },
    ])

    expect(result.valid).toBe(true)
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'INFERRED_DEFAULT_NAMESPACE',
        path: '/Properties',
      }),
    ])
  })

  it('rejects nested elements inside dcterms:created', () => {
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
    const createdEl = el('dcterms:created', 'created', DCTERMS_NS)
    const nestedTitleEl = el('dc:title', 'title', DC_NS)

    const result = validate([
      { type: 'startDocument' },
      { type: 'startElement', element: root },
      { type: 'startElement', element: createdEl },
      { type: 'startElement', element: nestedTitleEl },
      { type: 'text', text: 'Nested title' },
      { type: 'endElement', element: nestedTitleEl },
      { type: 'endElement', element: createdEl },
      { type: 'endElement', element: root },
      { type: 'endDocument' },
    ])

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((err) => ['INVALID_CONTENT', 'TOO_MANY_ELEMENTS', 'INVALID_ELEMENT'].includes(err.code))
    ).toBe(true)
  })

  it('accepts xml:lang on cp:keywords and cp:value', () => {
    const root = el(
      'cp:coreProperties',
      'coreProperties',
      CORE_PROPS_NS,
      [],
      new Map([
        ['cp', CORE_PROPS_NS],
        ['dc', DC_NS],
        ['dcterms', DCTERMS_NS],
        ['xml', XML_NS],
      ])
    )
    const keywordsEl = el('cp:keywords', 'keywords', CORE_PROPS_NS, [
      {
        name: 'xml:lang',
        localName: 'lang',
        namespaceUri: XML_NS,
        value: 'en-US',
      },
    ])
    const valueEl = el('cp:value', 'value', CORE_PROPS_NS, [
      {
        name: 'xml:lang',
        localName: 'lang',
        namespaceUri: XML_NS,
        value: 'en-US',
      },
    ])

    const result = validate([
      { type: 'startDocument' },
      { type: 'startElement', element: root },
      { type: 'startElement', element: keywordsEl },
      { type: 'startElement', element: valueEl },
      { type: 'text', text: 'alpha, beta' },
      { type: 'endElement', element: valueEl },
      { type: 'endElement', element: keywordsEl },
      { type: 'endElement', element: root },
      { type: 'endDocument' },
    ])

    expect(result.valid).toBe(true)
    expect(result.errors.some((err) => err.code === 'INVALID_ATTRIBUTE')).toBe(false)
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
    const overrideEl = el(
      'Override',
      'Override',
      CONTENT_TYPES_STRICT_NS,
      attrs({
        PartName: '/word/document.xml',
        ContentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
      })
    )

    const result = validate([
      { type: 'startDocument' },
      { type: 'startElement', element: root },
      { type: 'startElement', element: defaultEl },
      { type: 'endElement', element: defaultEl },
      { type: 'startElement', element: overrideEl },
      { type: 'endElement', element: overrideEl },
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

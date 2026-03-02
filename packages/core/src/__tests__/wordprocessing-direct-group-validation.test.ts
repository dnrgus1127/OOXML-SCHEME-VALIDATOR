import { describe, expect, it } from 'vitest'

import { ValidationEngine } from '../engine/validator'
import { loadSchemaRegistry } from '../schema/schema-loader'
import type { XmlAttribute, XmlElementInfo } from '../runtime'

const WORDPROCESSING_NAMESPACES = [
  {
    label: 'strict',
    uri: 'http://purl.oclc.org/ooxml/wordprocessingml/main',
  },
  {
    label: 'transitional',
    uri: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  },
] as const

function makeElement(
  localName: string,
  namespaceUri: string,
  options?: {
    attributes?: XmlAttribute[]
    namespaceDeclarations?: Map<string, string>
  }
): XmlElementInfo {
  return {
    name: `w:${localName}`,
    localName,
    namespaceUri,
    attributes: options?.attributes ?? [],
    namespaceDeclarations: options?.namespaceDeclarations,
  }
}

describe('wordprocessing direct group content validation', () => {
  it.each(WORDPROCESSING_NAMESPACES)(
    'validates hdr > p without INVALID_ELEMENT in $label namespace',
    ({ uri }) => {
      const engine = new ValidationEngine(loadSchemaRegistry('document'), {
        maxErrors: 100,
        allowWhitespace: true,
      })

      engine.startDocument()

      engine.startElement(
        makeElement('hdr', uri, {
          namespaceDeclarations: new Map([
            ['', uri],
            ['w', uri],
          ]),
        })
      )
      engine.startElement(makeElement('p', uri))
      engine.endElement(makeElement('p', uri))
      engine.endElement(makeElement('hdr', uri))

      const result = engine.endDocument()

      const invalidElementErrors = result.errors.filter((error) => error.code === 'INVALID_ELEMENT')
      expect(invalidElementErrors).toHaveLength(0)
      expect(result.valid).toBe(true)
    }
  )

  it.each(WORDPROCESSING_NAMESPACES)(
    'validates document/body/p/hyperlink/r without INVALID_ELEMENT in $label namespace',
    ({ uri }) => {
      const engine = new ValidationEngine(loadSchemaRegistry('document'), {
        maxErrors: 100,
        allowWhitespace: true,
      })

      engine.startDocument()

      engine.startElement(
        makeElement('document', uri, {
          namespaceDeclarations: new Map([
            ['', uri],
            ['w', uri],
          ]),
        })
      )
      engine.startElement(makeElement('body', uri))
      engine.startElement(makeElement('p', uri))
      engine.startElement(makeElement('hyperlink', uri))
      engine.startElement(makeElement('r', uri))
      engine.endElement(makeElement('r', uri))
      engine.endElement(makeElement('hyperlink', uri))
      engine.endElement(makeElement('p', uri))
      engine.endElement(makeElement('body', uri))
      engine.endElement(makeElement('document', uri))

      const result = engine.endDocument()

      const invalidElementErrors = result.errors.filter((error) => error.code === 'INVALID_ELEMENT')
      expect(invalidElementErrors).toHaveLength(0)
      expect(result.valid).toBe(true)
    }
  )
})

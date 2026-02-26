import { describe, it, expect } from 'vitest'

import type { Facet, SchemaRegistry, XsdComplexType, XsdSchema } from '../types'
import { validateFacet } from '../engine/simple-type-validator'
import { validateAttributes } from '../engine/attribute-validator'

const WORDPROCESSINGML_STRICT_NS = 'http://purl.oclc.org/ooxml/wordprocessingml/main'
const WORDPROCESSINGML_TRANSITIONAL_NS =
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

function createTestRegistry(schemas: Map<string, XsdSchema>): SchemaRegistry {
  return {
    schemas,
    resolveType: () => undefined,
    resolveElement: () => undefined,
    resolveGroup: () => undefined,
    resolveAttributeGroup: () => undefined,
    resolveSchemaPrefix: () => undefined,
  }
}

function createWordSchema(namespaceUri: string): XsdSchema {
  return {
    targetNamespace: namespaceUri,
    namespaces: [{ prefix: 'w', uri: namespaceUri }],
    elementFormDefault: 'qualified',
    attributeFormDefault: 'qualified',
    imports: [],
    includes: [],
    redefines: [],
    simpleTypes: new Map(),
    complexTypes: new Map(),
    elements: new Map(),
    attributes: new Map(),
    groups: new Map(),
    attributeGroups: new Map(),
  }
}

describe('wordprocessing transitional compatibility', () => {
  it('accepts left/right as aliases for start/end in ST_Jc enumeration', () => {
    const facet: Facet = {
      type: 'enumeration',
      values: ['start', 'center', 'end'],
    }

    expect(validateFacet('left', facet, 'ST_Jc', WORDPROCESSINGML_STRICT_NS)).toBe(true)
    expect(validateFacet('right', facet, 'ST_Jc', WORDPROCESSINGML_STRICT_NS)).toBe(true)
    expect(validateFacet('left', facet, 'ST_BrClear', WORDPROCESSINGML_STRICT_NS)).toBe(false)
  })

  it('accepts w:left when schema attribute is w:start (transitional namespace)', () => {
    const strictSchema = createWordSchema(WORDPROCESSINGML_STRICT_NS)
    const registry = createTestRegistry(new Map([[WORDPROCESSINGML_STRICT_NS, strictSchema]]))

    const schemaType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_IndTest',
      abstract: false,
      mixed: false,
      content: { kind: 'empty' },
      attributes: [{ kind: 'attribute', name: 'start', use: 'optional' }],
      attributeGroups: [],
    }

    const errors: Array<{ code: string; message: string }> = []
    const errorHandler = {
      pushError: (code: string, message: string) => {
        errors.push({ code, message })
      },
      pushFacetError: () => {
        // no-op
      },
      currentPath: () => '/',
    }

    validateAttributes(
      [
        {
          name: 'w:left',
          localName: 'left',
          namespaceUri: WORDPROCESSINGML_TRANSITIONAL_NS,
          value: '720',
        },
      ],
      schemaType,
      WORDPROCESSINGML_TRANSITIONAL_NS,
      new Map([['w', WORDPROCESSINGML_TRANSITIONAL_NS]]),
      registry,
      errorHandler
    )

    expect(errors).toEqual([])
  })
})

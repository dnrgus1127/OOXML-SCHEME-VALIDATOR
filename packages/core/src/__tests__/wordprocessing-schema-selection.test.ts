import { describe, expect, it } from 'vitest'

import type { Facet } from '../types'
import { loadSchemaRegistry } from '../schema/schema-loader'
import { validateAttributes } from '../engine/attribute-validator'
import { validateBuiltinOrReferencedType } from '../engine/simple-type-validator'
import type { ValidationErrorHandler } from '../engine/error-handlers'

const WORDPROCESSINGML_STRICT_NS = 'http://purl.oclc.org/ooxml/wordprocessingml/main'
const WORDPROCESSINGML_TRANSITIONAL_NS =
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

function createTestErrorHandler(codes: string[]): ValidationErrorHandler {
  return {
    pushError: (code: string) => {
      codes.push(code)
    },
    pushWarning: () => {
      // no-op
    },
    pushFacetError: (facet: Facet) => {
      codes.push(facet.type === 'enumeration' ? 'INVALID_ENUM_VALUE' : 'INVALID_VALUE')
    },
    currentPath: () => '/',
  }
}

describe('wordprocessing schema selection', () => {
  it('uses strict/transitional ST_Jc enums based on namespace', () => {
    const registry = loadSchemaRegistry('document')
    const strictErrors: string[] = []
    const transitionalErrors: string[] = []

    const strictResult = validateBuiltinOrReferencedType(
      'left',
      { name: 'ST_Jc', isBuiltin: false },
      new Map([['w', WORDPROCESSINGML_STRICT_NS]]),
      registry,
      createTestErrorHandler(strictErrors),
      WORDPROCESSINGML_STRICT_NS
    )

    const transitionalResult = validateBuiltinOrReferencedType(
      'left',
      { name: 'ST_Jc', isBuiltin: false },
      new Map([['w', WORDPROCESSINGML_TRANSITIONAL_NS]]),
      registry,
      createTestErrorHandler(transitionalErrors),
      WORDPROCESSINGML_TRANSITIONAL_NS
    )

    expect(strictResult).toBe(false)
    expect(strictErrors).toContain('INVALID_ENUM_VALUE')
    expect(transitionalResult).toBe(true)
    expect(transitionalErrors).not.toContain('INVALID_ENUM_VALUE')
  })

  it('uses strict/transitional CT_Ind attributes based on namespace', () => {
    const registry = loadSchemaRegistry('document')
    const strictType = registry.resolveType(WORDPROCESSINGML_STRICT_NS, 'CT_Ind')
    const transitionalType = registry.resolveType(WORDPROCESSINGML_TRANSITIONAL_NS, 'CT_Ind')

    expect(strictType?.kind).toBe('complexType')
    expect(transitionalType?.kind).toBe('complexType')
    if (!strictType || strictType.kind !== 'complexType') return
    if (!transitionalType || transitionalType.kind !== 'complexType') return

    const strictErrors: string[] = []
    validateAttributes(
      [
        {
          name: 'w:left',
          localName: 'left',
          namespaceUri: WORDPROCESSINGML_STRICT_NS,
          value: '720',
        },
      ],
      strictType,
      WORDPROCESSINGML_STRICT_NS,
      new Map([['w', WORDPROCESSINGML_STRICT_NS]]),
      registry,
      createTestErrorHandler(strictErrors)
    )

    const transitionalErrors: string[] = []
    validateAttributes(
      [
        {
          name: 'w:left',
          localName: 'left',
          namespaceUri: WORDPROCESSINGML_TRANSITIONAL_NS,
          value: '720',
        },
      ],
      transitionalType,
      WORDPROCESSINGML_TRANSITIONAL_NS,
      new Map([['w', WORDPROCESSINGML_TRANSITIONAL_NS]]),
      registry,
      createTestErrorHandler(transitionalErrors)
    )

    expect(strictErrors).toContain('INVALID_ATTRIBUTE')
    expect(transitionalErrors).not.toContain('INVALID_ATTRIBUTE')
  })
})

import { describe, expect, it } from 'vitest'
import { loadSchemaRegistry } from '../schema/schema-loader'
import { resolveTypeReference } from '../engine/type-resolver'
import type { TypeReference } from '../types'

const CHART_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
const DML_MAIN_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main'

describe('namespace resolution fallback', () => {
  it('should resolve unprefixed type reference using fallback schema namespace first', () => {
    const registry = loadSchemaRegistry('spreadsheet')
    const namespaceContext = new Map<string, string>([['', CHART_NS]])

    const ref: TypeReference = {
      name: 'CT_ShapeProperties',
      isBuiltin: false,
    }

    const errors: string[] = []
    const resolved = resolveTypeReference(
      ref,
      namespaceContext,
      registry,
      (_code, message) => errors.push(message),
      DML_MAIN_NS
    )

    expect(resolved).toBeDefined()
    expect(resolved?.kind).toBe('complexType')
    expect(errors).toHaveLength(0)
  })
})

import { describe, it, expect } from 'vitest'
import { validateSimpleTypeValue } from '../engine/simple-type-validator'
import { SchemaRegistryImpl } from '../schema/registry'
import type {
  XsdSchema,
  XsdSimpleType,
  Facet,
  ValidationError,
  ValidationWarning,
} from '../types'
import type { ValidationErrorHandler } from '../engine/error-handlers'
import { smlSchema } from '../schemas/sml'

const TEST_NS = 'http://test.example.com/schema'

function makeRegistry(schemas: Map<string, XsdSchema>): SchemaRegistryImpl {
  return new SchemaRegistryImpl(schemas)
}

function makeHandler(): {
  handler: ValidationErrorHandler
  errors: ValidationError[]
  warnings: ValidationWarning[]
} {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  const handler: ValidationErrorHandler = {
    pushError: (code, message, value) => {
      errors.push({ code, message, path: '/', value })
    },
    pushWarning: (code, message) => {
      warnings.push({ code, message, path: '/' })
    },
    pushFacetError: (facet: Facet, value: string) => {
      errors.push({ code: 'FACET_VIOLATION', message: facet.type, path: '/', value })
    },
    currentPath: () => '/',
  }
  return { handler, errors, warnings }
}

describe('union with inline anonymous simpleType members', () => {
  it('정상 케이스: ST_TextRotation 0/90/180/255 모두 유효해야 함', () => {
    const registry = makeRegistry(new Map([[smlSchema.targetNamespace, smlSchema]]))
    const stTextRotation = smlSchema.simpleTypes.get('ST_TextRotation') as XsdSimpleType
    expect(stTextRotation).toBeDefined()
    expect(stTextRotation.content.kind).toBe('union')

    const namespaceContext = new Map([['', smlSchema.targetNamespace]])

    for (const value of ['0', '90', '180', '255']) {
      const { handler, errors } = makeHandler()
      validateSimpleTypeValue(
        value,
        stTextRotation,
        namespaceContext,
        registry,
        handler,
        smlSchema.targetNamespace
      )
      expect(errors, `value=${value} 가 ST_TextRotation 검증을 통과해야 함`).toEqual([])
    }
  })

  it('실패 케이스: ST_TextRotation 200 은 무효해야 함 (180 초과 & 255 아님)', () => {
    const registry = makeRegistry(new Map([[smlSchema.targetNamespace, smlSchema]]))
    const stTextRotation = smlSchema.simpleTypes.get('ST_TextRotation') as XsdSimpleType
    const namespaceContext = new Map([['', smlSchema.targetNamespace]])

    const { handler, errors } = makeHandler()
    validateSimpleTypeValue(
      '200',
      stTextRotation,
      namespaceContext,
      registry,
      handler,
      smlSchema.targetNamespace
    )
    expect(errors.length).toBeGreaterThan(0)
  })
})

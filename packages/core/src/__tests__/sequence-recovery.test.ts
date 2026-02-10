import { describe, it, expect } from 'vitest'
import { ValidationEngine } from '../engine/validator'
import { SchemaRegistryImpl } from '../schema/registry'
import { loadSchemaRegistry } from '../schema/schema-loader'
import type { XsdSchema, XsdComplexType, XsdElement } from '../types'

const TEST_NS = 'http://test.example.com/schema'

function createTestRegistry(schemas: Map<string, XsdSchema>): SchemaRegistryImpl {
  return new SchemaRegistryImpl(schemas)
}

function makeElement(
  localName: string,
  namespaceUri: string = TEST_NS,
  attrs: Array<{ name: string; value: string }> = [],
  nsDeclarations?: Map<string, string>
) {
  return {
    name: localName,
    localName,
    namespaceUri,
    attributes: attrs.map((a) => ({ name: a.name, value: a.value, localName: a.name })),
    namespaceDeclarations: nsDeclarations,
  }
}

function createSchemaWithTypes(
  complexTypes: Map<string, XsdComplexType>,
  elements: Map<string, XsdElement>
): XsdSchema {
  return {
    targetNamespace: TEST_NS,
    namespaces: [],
    elementFormDefault: 'qualified',
    attributeFormDefault: 'unqualified',
    imports: [],
    includes: [],
    redefines: [],
    simpleTypes: new Map(),
    complexTypes,
    elements,
    attributes: new Map(),
    groups: new Map(),
    attributeGroups: new Map(),
  }
}

describe('sequence compositor skip-ahead recovery', () => {
  // Schema: root -> sequence(idx[req], order[req], tx[opt], cat[opt], val[opt])
  function createSerLikeSchema() {
    const rootType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Root',
      content: {
        kind: 'elementOnly',
        compositor: {
          kind: 'sequence',
          particles: [
            {
              kind: 'element',
              name: 'idx',
              typeRef: { name: 'string', isBuiltin: true },
              occurs: { minOccurs: 1, maxOccurs: 1 },
            },
            {
              kind: 'element',
              name: 'order',
              typeRef: { name: 'string', isBuiltin: true },
              occurs: { minOccurs: 1, maxOccurs: 1 },
            },
            {
              kind: 'element',
              name: 'tx',
              typeRef: { name: 'string', isBuiltin: true },
              occurs: { minOccurs: 0, maxOccurs: 1 },
            },
            {
              kind: 'element',
              name: 'cat',
              typeRef: { name: 'string', isBuiltin: true },
              occurs: { minOccurs: 0, maxOccurs: 1 },
            },
            {
              kind: 'element',
              name: 'val',
              typeRef: { name: 'string', isBuiltin: true },
              occurs: { minOccurs: 0, maxOccurs: 1 },
            },
          ],
          occurs: { minOccurs: 1, maxOccurs: 1 },
        },
      },
      attributes: [],
      attributeGroups: [],
    }

    return createSchemaWithTypes(
      new Map([['CT_Root', rootType]]),
      new Map([['root', { kind: 'element' as const, name: 'root', typeRef: { name: 'CT_Root', isBuiltin: false }, occurs: { minOccurs: 1, maxOccurs: 1 } }]])
    )
  }

  it('should skip ahead and report precise missing required errors', () => {
    const schema = createSerLikeSchema()
    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry, { maxErrors: 100, allowWhitespace: true })

    const nsDecl = new Map([['', TEST_NS]])
    engine.startDocument()
    engine.startElement(makeElement('root', TEST_NS, [], nsDecl))
    // Skip idx and order, start with tx
    engine.startElement(makeElement('tx'))
    engine.text('some text')
    engine.endElement(makeElement('tx'))
    engine.startElement(makeElement('cat'))
    engine.endElement(makeElement('cat'))
    engine.startElement(makeElement('val'))
    engine.endElement(makeElement('val'))
    engine.endElement(makeElement('root', TEST_NS, [], nsDecl))
    const result = engine.endDocument()

    const missingErrors = result.errors.filter((e) => e.code === 'MISSING_REQUIRED_ELEMENT')
    expect(missingErrors).toHaveLength(2)
    expect(missingErrors[0]!.message).toContain('idx')
    expect(missingErrors[1]!.message).toContain('order')

    // No "허용되지 않는 요소" errors for tx, cat, val
    const invalidErrors = result.errors.filter((e) => e.message.includes('허용되지 않는 요소'))
    expect(invalidErrors).toHaveLength(0)

    expect(result.errors).toHaveLength(2)
  })

  it('should not double-report missing elements at endElement', () => {
    const schema = createSerLikeSchema()
    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry, { maxErrors: 100, allowWhitespace: true })

    const nsDecl = new Map([['', TEST_NS]])
    engine.startDocument()
    engine.startElement(makeElement('root', TEST_NS, [], nsDecl))
    engine.startElement(makeElement('tx'))
    engine.endElement(makeElement('tx'))
    engine.endElement(makeElement('root', TEST_NS, [], nsDecl))
    const result = engine.endDocument()

    // Only 2 errors total: idx missing, order missing (reported at skip-ahead time)
    // NOT 4 errors (skip-ahead + endElement duplicate)
    const missingErrors = result.errors.filter((e) => e.code === 'MISSING_REQUIRED_ELEMENT')
    expect(missingErrors).toHaveLength(2)
    expect(result.errors).toHaveLength(2)
  })

  it('should still fail for truly invalid elements', () => {
    const schema = createSerLikeSchema()
    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry, { maxErrors: 100, allowWhitespace: true })

    const nsDecl = new Map([['', TEST_NS]])
    engine.startDocument()
    engine.startElement(makeElement('root', TEST_NS, [], nsDecl))
    // 'unknown' is not in the sequence at all
    engine.startElement(makeElement('unknown'))
    engine.endElement(makeElement('unknown'))
    engine.endElement(makeElement('root', TEST_NS, [], nsDecl))
    const result = engine.endDocument()

    // Should still get MISSING_REQUIRED_ELEMENT for idx (no skip-ahead match)
    expect(result.errors.length).toBeGreaterThan(0)
    const hasNotAllowed = result.errors.some((e) => e.message.includes('허용되지 않는 요소'))
    expect(hasNotAllowed).toBe(true)
  })

  it('should not affect normal sequence validation', () => {
    const schema = createSerLikeSchema()
    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry, { maxErrors: 100, allowWhitespace: true })

    const nsDecl = new Map([['', TEST_NS]])
    engine.startDocument()
    engine.startElement(makeElement('root', TEST_NS, [], nsDecl))
    engine.startElement(makeElement('idx'))
    engine.endElement(makeElement('idx'))
    engine.startElement(makeElement('order'))
    engine.endElement(makeElement('order'))
    engine.startElement(makeElement('tx'))
    engine.endElement(makeElement('tx'))
    engine.endElement(makeElement('root', TEST_NS, [], nsDecl))
    const result = engine.endDocument()

    expect(result.errors).toHaveLength(0)
  })

  it('should not affect optional element skipping', () => {
    // Schema: root -> sequence(a[req], b[opt], c[req])
    const rootType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Root',
      content: {
        kind: 'elementOnly',
        compositor: {
          kind: 'sequence',
          particles: [
            {
              kind: 'element',
              name: 'a',
              typeRef: { name: 'string', isBuiltin: true },
              occurs: { minOccurs: 1, maxOccurs: 1 },
            },
            {
              kind: 'element',
              name: 'b',
              typeRef: { name: 'string', isBuiltin: true },
              occurs: { minOccurs: 0, maxOccurs: 1 },
            },
            {
              kind: 'element',
              name: 'c',
              typeRef: { name: 'string', isBuiltin: true },
              occurs: { minOccurs: 1, maxOccurs: 1 },
            },
          ],
          occurs: { minOccurs: 1, maxOccurs: 1 },
        },
      },
      attributes: [],
      attributeGroups: [],
    }

    const schema = createSchemaWithTypes(
      new Map([['CT_Root', rootType]]),
      new Map([['root', { kind: 'element' as const, name: 'root', typeRef: { name: 'CT_Root', isBuiltin: false }, occurs: { minOccurs: 1, maxOccurs: 1 } }]])
    )
    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry, { maxErrors: 100, allowWhitespace: true })

    const nsDecl = new Map([['', TEST_NS]])
    engine.startDocument()
    engine.startElement(makeElement('root', TEST_NS, [], nsDecl))
    engine.startElement(makeElement('a'))
    engine.endElement(makeElement('a'))
    // Skip optional 'b', go directly to required 'c'
    engine.startElement(makeElement('c'))
    engine.endElement(makeElement('c'))
    engine.endElement(makeElement('root', TEST_NS, [], nsDecl))
    const result = engine.endDocument()

    expect(result.errors).toHaveLength(0)
  })

  it('should enable type resolution for recovered elements', () => {
    // tx has an inlineComplexType with a child 'ref'
    const rootType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Root',
      content: {
        kind: 'elementOnly',
        compositor: {
          kind: 'sequence',
          particles: [
            {
              kind: 'element',
              name: 'idx',
              typeRef: { name: 'string', isBuiltin: true },
              occurs: { minOccurs: 1, maxOccurs: 1 },
            },
            {
              kind: 'element',
              name: 'tx',
              inlineComplexType: {
                kind: 'complexType',
                name: '',
                content: {
                  kind: 'elementOnly',
                  compositor: {
                    kind: 'sequence',
                    particles: [
                      {
                        kind: 'element',
                        name: 'ref',
                        typeRef: { name: 'string', isBuiltin: true },
                        occurs: { minOccurs: 1, maxOccurs: 1 },
                      },
                    ],
                    occurs: { minOccurs: 1, maxOccurs: 1 },
                  },
                },
                attributes: [],
                attributeGroups: [],
              },
              occurs: { minOccurs: 0, maxOccurs: 1 },
            },
          ],
          occurs: { minOccurs: 1, maxOccurs: 1 },
        },
      },
      attributes: [],
      attributeGroups: [],
    }

    const schema = createSchemaWithTypes(
      new Map([['CT_Root', rootType]]),
      new Map([['root', { kind: 'element' as const, name: 'root', typeRef: { name: 'CT_Root', isBuiltin: false }, occurs: { minOccurs: 1, maxOccurs: 1 } }]])
    )
    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry, { maxErrors: 100, allowWhitespace: true })

    const nsDecl = new Map([['', TEST_NS]])
    engine.startDocument()
    engine.startElement(makeElement('root', TEST_NS, [], nsDecl))
    // Skip required idx, go to tx
    engine.startElement(makeElement('tx'))
    engine.startElement(makeElement('ref'))
    engine.text('value')
    engine.endElement(makeElement('ref'))
    engine.endElement(makeElement('tx'))
    engine.endElement(makeElement('root', TEST_NS, [], nsDecl))
    const result = engine.endDocument()

    // Only 1 error: missing idx
    const missingErrors = result.errors.filter((e) => e.code === 'MISSING_REQUIRED_ELEMENT')
    expect(missingErrors).toHaveLength(1)
    expect(missingErrors[0]!.message).toContain('idx')

    // No "schema not found" or "허용되지 않는 요소" errors for ref inside tx
    const schemaNotFound = result.errors.filter(
      (e) => e.message.includes('스키마에서 요소를 찾을 수 없습니다') || e.message.includes('허용되지 않는 요소')
    )
    expect(schemaNotFound).toHaveLength(0)

    expect(result.errors).toHaveLength(1)
  })

  it('should work with real chart schema (ser missing idx/order)', () => {
    const CHART_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
    const registry = loadSchemaRegistry('spreadsheet')
    const engine = new ValidationEngine(registry, { maxErrors: 100, allowWhitespace: true })

    function makeEl(localName: string, ns = CHART_NS, attrs: any[] = []) {
      return {
        name: localName,
        localName,
        namespaceUri: ns,
        attributes: attrs,
      }
    }

    const nsDecl = new Map([['', CHART_NS]])

    engine.startDocument()
    engine.startElement({ ...makeEl('chartSpace'), namespaceDeclarations: nsDecl })
    engine.startElement(makeEl('chart'))
    engine.startElement(makeEl('plotArea'))
    engine.startElement(makeEl('areaChart'))

    // First ser: missing idx and order, starts with tx
    engine.startElement(makeEl('ser'))
    engine.startElement(makeEl('tx'))
    engine.startElement(makeEl('strRef'))
    engine.startElement(makeEl('f'))
    engine.text("'Sheet1'!B1")
    engine.endElement(makeEl('f'))
    engine.endElement(makeEl('strRef'))
    engine.endElement(makeEl('tx'))
    engine.endElement(makeEl('ser'))

    // axId x2 (required)
    engine.startElement(makeEl('axId', CHART_NS, [{ name: 'val', value: '10', localName: 'val' }]))
    engine.endElement(makeEl('axId'))
    engine.startElement(makeEl('axId', CHART_NS, [{ name: 'val', value: '100', localName: 'val' }]))
    engine.endElement(makeEl('axId'))

    engine.endElement(makeEl('areaChart'))
    engine.endElement(makeEl('plotArea'))
    engine.endElement(makeEl('chart'))
    engine.endElement({ ...makeEl('chartSpace'), namespaceDeclarations: nsDecl })
    const result = engine.endDocument()

    // Should have exactly 2 MISSING_REQUIRED_ELEMENT for idx and order
    const missingErrors = result.errors.filter((e) => e.code === 'MISSING_REQUIRED_ELEMENT')
    const idxMissing = missingErrors.filter((e) => e.message.includes('idx'))
    const orderMissing = missingErrors.filter((e) => e.message.includes('order'))
    expect(idxMissing.length).toBeGreaterThanOrEqual(1)
    expect(orderMissing.length).toBeGreaterThanOrEqual(1)

    // Should NOT have "허용되지 않는 요소: tx" or "허용되지 않는 요소: strRef"
    const txNotAllowed = result.errors.filter(
      (e) => e.message.includes('허용되지 않는 요소') && e.message.includes('tx')
    )
    expect(txNotAllowed).toHaveLength(0)

    // strRef and f should be validated normally (no "허용되지 않는 요소" for them)
    const strRefNotAllowed = result.errors.filter(
      (e) => e.message.includes('허용되지 않는 요소') && e.message.includes('strRef')
    )
    expect(strRefNotAllowed).toHaveLength(0)
  })
})

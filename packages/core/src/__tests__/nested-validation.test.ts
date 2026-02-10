import { describe, it, expect } from 'vitest'
import { ValidationEngine } from '../engine/validator'
import { SchemaRegistryImpl } from '../schema/registry'
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

describe('complexContent validation', () => {
  it('should validate child elements of complexContent/extension types', () => {
    // Base type with a sequence containing "baseChild"
    const baseType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Base',
      content: {
        kind: 'elementOnly',
        compositor: {
          kind: 'sequence',
          particles: [
            {
              kind: 'element',
              name: 'baseChild',
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

    // Derived type extends base, adds "extChild"
    const derivedType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Derived',
      content: {
        kind: 'complexContent',
        content: {
          derivation: 'extension',
          base: { name: 'CT_Base', isBuiltin: false },
          compositor: {
            kind: 'sequence',
            particles: [
              {
                kind: 'element',
                name: 'extChild',
                typeRef: { name: 'string', isBuiltin: true },
                occurs: { minOccurs: 1, maxOccurs: 1 },
              },
            ],
            occurs: { minOccurs: 1, maxOccurs: 1 },
          },
          attributes: [],
          attributeGroups: [],
        },
      },
      attributes: [],
      attributeGroups: [],
    }

    const rootElement: XsdElement = {
      kind: 'element',
      name: 'root',
      typeRef: { name: 'CT_Derived', isBuiltin: false },
      occurs: { minOccurs: 1, maxOccurs: 1 },
    }

    const schema = createSchemaWithTypes(
      new Map([
        ['CT_Base', baseType],
        ['CT_Derived', derivedType],
      ]),
      new Map([['root', rootElement]])
    )

    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry)

    const nsDecl = new Map([['', TEST_NS]])

    engine.startDocument()
    engine.startElement(makeElement('root', TEST_NS, [], nsDecl))
    engine.startElement(makeElement('baseChild', TEST_NS))
    engine.text('hello')
    engine.endElement(makeElement('baseChild', TEST_NS))
    engine.startElement(makeElement('extChild', TEST_NS))
    engine.text('world')
    engine.endElement(makeElement('extChild', TEST_NS))
    engine.endElement(makeElement('root', TEST_NS))
    const result = engine.endDocument()

    const elementErrors = result.errors.filter(
      (e) =>
        e.code === 'INVALID_ELEMENT' || e.message.includes('스키마에서 요소를 찾을 수 없습니다')
    )
    expect(elementErrors).toHaveLength(0)
    expect(result.valid).toBe(true)
  })

  it('should validate complexContent/restriction types', () => {
    // Base type with multiple optional elements
    const baseType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Base',
      content: {
        kind: 'elementOnly',
        compositor: {
          kind: 'sequence',
          particles: [
            {
              kind: 'element',
              name: 'alpha',
              typeRef: { name: 'string', isBuiltin: true },
              occurs: { minOccurs: 0, maxOccurs: 1 },
            },
            {
              kind: 'element',
              name: 'beta',
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

    // Restriction: only "alpha" is allowed (restriction replaces compositor)
    const restrictedType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Restricted',
      content: {
        kind: 'complexContent',
        content: {
          derivation: 'restriction',
          base: { name: 'CT_Base', isBuiltin: false },
          compositor: {
            kind: 'sequence',
            particles: [
              {
                kind: 'element',
                name: 'alpha',
                typeRef: { name: 'string', isBuiltin: true },
                occurs: { minOccurs: 1, maxOccurs: 1 },
              },
            ],
            occurs: { minOccurs: 1, maxOccurs: 1 },
          },
          attributes: [],
          attributeGroups: [],
        },
      },
      attributes: [],
      attributeGroups: [],
    }

    const rootElement: XsdElement = {
      kind: 'element',
      name: 'root',
      typeRef: { name: 'CT_Restricted', isBuiltin: false },
      occurs: { minOccurs: 1, maxOccurs: 1 },
    }

    const schema = createSchemaWithTypes(
      new Map([
        ['CT_Base', baseType],
        ['CT_Restricted', restrictedType],
      ]),
      new Map([['root', rootElement]])
    )

    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry)

    const nsDecl = new Map([['', TEST_NS]])

    engine.startDocument()
    engine.startElement(makeElement('root', TEST_NS, [], nsDecl))
    engine.startElement(makeElement('alpha', TEST_NS))
    engine.text('value')
    engine.endElement(makeElement('alpha', TEST_NS))
    engine.endElement(makeElement('root', TEST_NS))
    const result = engine.endDocument()

    const elementErrors = result.errors.filter(
      (e) =>
        e.code === 'INVALID_ELEMENT' || e.message.includes('스키마에서 요소를 찾을 수 없습니다')
    )
    expect(elementErrors).toHaveLength(0)
    expect(result.valid).toBe(true)
  })

  it('should validate nested complexContent (multi-level inheritance)', () => {
    const grandparentType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_GrandParent',
      content: {
        kind: 'elementOnly',
        compositor: {
          kind: 'sequence',
          particles: [
            {
              kind: 'element',
              name: 'gpChild',
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

    const parentType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Parent',
      content: {
        kind: 'complexContent',
        content: {
          derivation: 'extension',
          base: { name: 'CT_GrandParent', isBuiltin: false },
          compositor: {
            kind: 'sequence',
            particles: [
              {
                kind: 'element',
                name: 'pChild',
                typeRef: { name: 'string', isBuiltin: true },
                occurs: { minOccurs: 1, maxOccurs: 1 },
              },
            ],
            occurs: { minOccurs: 1, maxOccurs: 1 },
          },
          attributes: [],
          attributeGroups: [],
        },
      },
      attributes: [],
      attributeGroups: [],
    }

    const childType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Child',
      content: {
        kind: 'complexContent',
        content: {
          derivation: 'extension',
          base: { name: 'CT_Parent', isBuiltin: false },
          compositor: {
            kind: 'sequence',
            particles: [
              {
                kind: 'element',
                name: 'cChild',
                typeRef: { name: 'string', isBuiltin: true },
                occurs: { minOccurs: 1, maxOccurs: 1 },
              },
            ],
            occurs: { minOccurs: 1, maxOccurs: 1 },
          },
          attributes: [],
          attributeGroups: [],
        },
      },
      attributes: [],
      attributeGroups: [],
    }

    const rootElement: XsdElement = {
      kind: 'element',
      name: 'root',
      typeRef: { name: 'CT_Child', isBuiltin: false },
      occurs: { minOccurs: 1, maxOccurs: 1 },
    }

    const schema = createSchemaWithTypes(
      new Map([
        ['CT_GrandParent', grandparentType],
        ['CT_Parent', parentType],
        ['CT_Child', childType],
      ]),
      new Map([['root', rootElement]])
    )

    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry)

    const nsDecl = new Map([['', TEST_NS]])

    engine.startDocument()
    engine.startElement(makeElement('root', TEST_NS, [], nsDecl))
    // Order: grandparent elements → parent elements → child elements
    engine.startElement(makeElement('gpChild', TEST_NS))
    engine.text('1')
    engine.endElement(makeElement('gpChild', TEST_NS))
    engine.startElement(makeElement('pChild', TEST_NS))
    engine.text('2')
    engine.endElement(makeElement('pChild', TEST_NS))
    engine.startElement(makeElement('cChild', TEST_NS))
    engine.text('3')
    engine.endElement(makeElement('cChild', TEST_NS))
    engine.endElement(makeElement('root', TEST_NS))
    const result = engine.endDocument()

    const elementErrors = result.errors.filter(
      (e) =>
        e.code === 'INVALID_ELEMENT' || e.message.includes('스키마에서 요소를 찾을 수 없습니다')
    )
    expect(elementErrors).toHaveLength(0)
    expect(result.valid).toBe(true)
  })

  it('should validate extension with no additional compositor (base-only elements)', () => {
    const baseType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Base',
      content: {
        kind: 'elementOnly',
        compositor: {
          kind: 'sequence',
          particles: [
            {
              kind: 'element',
              name: 'child',
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

    // Extension adds only attributes, no new compositor
    const derivedType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Derived',
      content: {
        kind: 'complexContent',
        content: {
          derivation: 'extension',
          base: { name: 'CT_Base', isBuiltin: false },
          attributes: [],
          attributeGroups: [],
        },
      },
      attributes: [],
      attributeGroups: [],
    }

    const rootElement: XsdElement = {
      kind: 'element',
      name: 'root',
      typeRef: { name: 'CT_Derived', isBuiltin: false },
      occurs: { minOccurs: 1, maxOccurs: 1 },
    }

    const schema = createSchemaWithTypes(
      new Map([
        ['CT_Base', baseType],
        ['CT_Derived', derivedType],
      ]),
      new Map([['root', rootElement]])
    )

    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry)

    const nsDecl = new Map([['', TEST_NS]])

    engine.startDocument()
    engine.startElement(makeElement('root', TEST_NS, [], nsDecl))
    engine.startElement(makeElement('child', TEST_NS))
    engine.text('value')
    engine.endElement(makeElement('child', TEST_NS))
    engine.endElement(makeElement('root', TEST_NS))
    const result = engine.endDocument()

    const elementErrors = result.errors.filter(
      (e) =>
        e.code === 'INVALID_ELEMENT' || e.message.includes('스키마에서 요소를 찾을 수 없습니다')
    )
    expect(elementErrors).toHaveLength(0)
    expect(result.valid).toBe(true)
  })
})

describe('nested compositor validation', () => {
  it('should validate elements inside a choice within a sequence', () => {
    const containerType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Container',
      content: {
        kind: 'elementOnly',
        compositor: {
          kind: 'sequence',
          particles: [
            {
              kind: 'element',
              name: 'header',
              typeRef: { name: 'string', isBuiltin: true },
              occurs: { minOccurs: 1, maxOccurs: 1 },
            },
            {
              kind: 'choice',
              particles: [
                {
                  kind: 'element',
                  name: 'optionA',
                  typeRef: { name: 'string', isBuiltin: true },
                  occurs: { minOccurs: 1, maxOccurs: 1 },
                },
                {
                  kind: 'element',
                  name: 'optionB',
                  typeRef: { name: 'string', isBuiltin: true },
                  occurs: { minOccurs: 1, maxOccurs: 1 },
                },
              ],
              occurs: { minOccurs: 1, maxOccurs: 1 },
            },
            {
              kind: 'element',
              name: 'footer',
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

    const rootElement: XsdElement = {
      kind: 'element',
      name: 'root',
      typeRef: { name: 'CT_Container', isBuiltin: false },
      occurs: { minOccurs: 1, maxOccurs: 1 },
    }

    const schema = createSchemaWithTypes(
      new Map([['CT_Container', containerType]]),
      new Map([['root', rootElement]])
    )

    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry)

    const nsDecl = new Map([['', TEST_NS]])

    engine.startDocument()
    engine.startElement(makeElement('root', TEST_NS, [], nsDecl))
    engine.startElement(makeElement('header', TEST_NS))
    engine.text('h')
    engine.endElement(makeElement('header', TEST_NS))
    engine.startElement(makeElement('optionA', TEST_NS))
    engine.text('a')
    engine.endElement(makeElement('optionA', TEST_NS))
    engine.startElement(makeElement('footer', TEST_NS))
    engine.text('f')
    engine.endElement(makeElement('footer', TEST_NS))
    engine.endElement(makeElement('root', TEST_NS))
    const result = engine.endDocument()

    const elementErrors = result.errors.filter(
      (e) =>
        e.code === 'INVALID_ELEMENT' || e.message.includes('스키마에서 요소를 찾을 수 없습니다')
    )
    expect(elementErrors).toHaveLength(0)
    expect(result.valid).toBe(true)
  })

  it('should validate elements inside a sequence within a choice', () => {
    const containerType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Container',
      content: {
        kind: 'elementOnly',
        compositor: {
          kind: 'choice',
          particles: [
            {
              kind: 'sequence',
              particles: [
                {
                  kind: 'element',
                  name: 'seqA1',
                  typeRef: { name: 'string', isBuiltin: true },
                  occurs: { minOccurs: 1, maxOccurs: 1 },
                },
                {
                  kind: 'element',
                  name: 'seqA2',
                  typeRef: { name: 'string', isBuiltin: true },
                  occurs: { minOccurs: 1, maxOccurs: 1 },
                },
              ],
              occurs: { minOccurs: 1, maxOccurs: 1 },
            },
            {
              kind: 'element',
              name: 'single',
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

    const rootElement: XsdElement = {
      kind: 'element',
      name: 'root',
      typeRef: { name: 'CT_Container', isBuiltin: false },
      occurs: { minOccurs: 1, maxOccurs: 1 },
    }

    const schema = createSchemaWithTypes(
      new Map([['CT_Container', containerType]]),
      new Map([['root', rootElement]])
    )

    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry)

    const nsDecl = new Map([['', TEST_NS]])

    // Test: choose the sequence branch
    engine.startDocument()
    engine.startElement(makeElement('root', TEST_NS, [], nsDecl))
    engine.startElement(makeElement('seqA1', TEST_NS))
    engine.text('1')
    engine.endElement(makeElement('seqA1', TEST_NS))
    engine.startElement(makeElement('seqA2', TEST_NS))
    engine.text('2')
    engine.endElement(makeElement('seqA2', TEST_NS))
    engine.endElement(makeElement('root', TEST_NS))
    const result = engine.endDocument()

    const elementErrors = result.errors.filter(
      (e) =>
        e.code === 'INVALID_ELEMENT' || e.message.includes('스키마에서 요소를 찾을 수 없습니다')
    )
    expect(elementErrors).toHaveLength(0)
    expect(result.valid).toBe(true)
  })

  it('should properly resolve types of child elements in nested compositors', () => {
    // Child type with its own compositor
    const innerType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Inner',
      content: {
        kind: 'elementOnly',
        compositor: {
          kind: 'sequence',
          particles: [
            {
              kind: 'element',
              name: 'innerChild',
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

    const containerType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Container',
      content: {
        kind: 'elementOnly',
        compositor: {
          kind: 'sequence',
          particles: [
            {
              kind: 'choice',
              particles: [
                {
                  kind: 'element',
                  name: 'nested',
                  typeRef: { name: 'CT_Inner', isBuiltin: false },
                  occurs: { minOccurs: 1, maxOccurs: 1 },
                },
              ],
              occurs: { minOccurs: 1, maxOccurs: 1 },
            },
          ],
          occurs: { minOccurs: 1, maxOccurs: 1 },
        },
      },
      attributes: [],
      attributeGroups: [],
    }

    const rootElement: XsdElement = {
      kind: 'element',
      name: 'root',
      typeRef: { name: 'CT_Container', isBuiltin: false },
      occurs: { minOccurs: 1, maxOccurs: 1 },
    }

    const schema = createSchemaWithTypes(
      new Map([
        ['CT_Inner', innerType],
        ['CT_Container', containerType],
      ]),
      new Map([['root', rootElement]])
    )

    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry)

    const nsDecl = new Map([['', TEST_NS]])

    engine.startDocument()
    engine.startElement(makeElement('root', TEST_NS, [], nsDecl))
    // "nested" is inside a choice inside a sequence
    engine.startElement(makeElement('nested', TEST_NS))
    // "innerChild" is a child of "nested" which has type CT_Inner
    engine.startElement(makeElement('innerChild', TEST_NS))
    engine.text('deep')
    engine.endElement(makeElement('innerChild', TEST_NS))
    engine.endElement(makeElement('nested', TEST_NS))
    engine.endElement(makeElement('root', TEST_NS))
    const result = engine.endDocument()

    // No "스키마에서 요소를 찾을 수 없습니다" errors at any level
    const elementErrors = result.errors.filter(
      (e) =>
        e.code === 'INVALID_ELEMENT' || e.message.includes('스키마에서 요소를 찾을 수 없습니다')
    )
    expect(elementErrors).toHaveLength(0)
    expect(result.valid).toBe(true)
  })
})

describe('complexContent attribute inheritance', () => {
  it('should validate attributes defined in complexContent extension', () => {
    const baseType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Base',
      content: { kind: 'empty' },
      attributes: [
        {
          kind: 'attribute',
          name: 'baseAttr',
          typeRef: { name: 'string', isBuiltin: true },
          use: 'required',
        },
      ],
      attributeGroups: [],
    }

    // Derived type extends base, adds its own attribute in the extension content
    const derivedType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Derived',
      content: {
        kind: 'complexContent',
        content: {
          derivation: 'extension',
          base: { name: 'CT_Base', isBuiltin: false },
          attributes: [
            {
              kind: 'attribute',
              name: 'extAttr',
              typeRef: { name: 'string', isBuiltin: true },
              use: 'required',
            },
          ],
          attributeGroups: [],
        },
      },
      attributes: [],
      attributeGroups: [],
    }

    const rootElement: XsdElement = {
      kind: 'element',
      name: 'root',
      typeRef: { name: 'CT_Derived', isBuiltin: false },
      occurs: { minOccurs: 1, maxOccurs: 1 },
    }

    const schema = createSchemaWithTypes(
      new Map([
        ['CT_Base', baseType],
        ['CT_Derived', derivedType],
      ]),
      new Map([['root', rootElement]])
    )

    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry)

    const nsDecl = new Map([['', TEST_NS]])

    // Test: provide both base and extension attributes
    engine.startDocument()
    engine.startElement(
      makeElement(
        'root',
        TEST_NS,
        [
          { name: 'baseAttr', value: 'base' },
          { name: 'extAttr', value: 'ext' },
        ],
        nsDecl
      )
    )
    engine.endElement(makeElement('root', TEST_NS))
    const result = engine.endDocument()

    expect(result.errors).toHaveLength(0)
    expect(result.valid).toBe(true)
  })

  it('should report missing required attributes from base type', () => {
    const baseType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Base',
      content: { kind: 'empty' },
      attributes: [
        {
          kind: 'attribute',
          name: 'baseAttr',
          typeRef: { name: 'string', isBuiltin: true },
          use: 'required',
        },
      ],
      attributeGroups: [],
    }

    const derivedType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Derived',
      content: {
        kind: 'complexContent',
        content: {
          derivation: 'extension',
          base: { name: 'CT_Base', isBuiltin: false },
          attributes: [],
          attributeGroups: [],
        },
      },
      attributes: [],
      attributeGroups: [],
    }

    const rootElement: XsdElement = {
      kind: 'element',
      name: 'root',
      typeRef: { name: 'CT_Derived', isBuiltin: false },
      occurs: { minOccurs: 1, maxOccurs: 1 },
    }

    const schema = createSchemaWithTypes(
      new Map([
        ['CT_Base', baseType],
        ['CT_Derived', derivedType],
      ]),
      new Map([['root', rootElement]])
    )

    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry)

    const nsDecl = new Map([['', TEST_NS]])

    // Test: omit the required base attribute
    engine.startDocument()
    engine.startElement(makeElement('root', TEST_NS, [], nsDecl))
    engine.endElement(makeElement('root', TEST_NS))
    const result = engine.endDocument()

    const missingAttrErrors = result.errors.filter((e) => e.code === 'MISSING_REQUIRED_ATTR')
    expect(missingAttrErrors).toHaveLength(1)
    expect(missingAttrErrors[0]!.message).toContain('baseAttr')
  })

  it('should validate attributes from multi-level complexContent extension chain', () => {
    const grandparentType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_GrandParent',
      content: { kind: 'empty' },
      attributes: [
        {
          kind: 'attribute',
          name: 'gpAttr',
          typeRef: { name: 'string', isBuiltin: true },
          use: 'required',
        },
      ],
      attributeGroups: [],
    }

    const parentType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Parent',
      content: {
        kind: 'complexContent',
        content: {
          derivation: 'extension',
          base: { name: 'CT_GrandParent', isBuiltin: false },
          attributes: [
            {
              kind: 'attribute',
              name: 'parentAttr',
              typeRef: { name: 'string', isBuiltin: true },
              use: 'required',
            },
          ],
          attributeGroups: [],
        },
      },
      attributes: [],
      attributeGroups: [],
    }

    const childType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Child',
      content: {
        kind: 'complexContent',
        content: {
          derivation: 'extension',
          base: { name: 'CT_Parent', isBuiltin: false },
          attributes: [
            {
              kind: 'attribute',
              name: 'childAttr',
              typeRef: { name: 'string', isBuiltin: true },
              use: 'optional',
            },
          ],
          attributeGroups: [],
        },
      },
      attributes: [],
      attributeGroups: [],
    }

    const rootElement: XsdElement = {
      kind: 'element',
      name: 'root',
      typeRef: { name: 'CT_Child', isBuiltin: false },
      occurs: { minOccurs: 1, maxOccurs: 1 },
    }

    const schema = createSchemaWithTypes(
      new Map([
        ['CT_GrandParent', grandparentType],
        ['CT_Parent', parentType],
        ['CT_Child', childType],
      ]),
      new Map([['root', rootElement]])
    )

    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry)

    const nsDecl = new Map([['', TEST_NS]])

    // Test: provide all required attributes from the chain
    engine.startDocument()
    engine.startElement(
      makeElement(
        'root',
        TEST_NS,
        [
          { name: 'gpAttr', value: 'gp' },
          { name: 'parentAttr', value: 'p' },
          { name: 'childAttr', value: 'c' },
        ],
        nsDecl
      )
    )
    engine.endElement(makeElement('root', TEST_NS))
    const result = engine.endDocument()

    expect(result.errors).toHaveLength(0)
    expect(result.valid).toBe(true)
  })

  it('should report missing required attributes from extension content (not top-level)', () => {
    // This tests the case where attributes are in content.content.attributes
    // but schemaType.attributes is empty (as generated by XSD converter)
    const baseType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Base',
      content: { kind: 'empty' },
      attributes: [],
      attributeGroups: [],
    }

    const derivedType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Derived',
      content: {
        kind: 'complexContent',
        content: {
          derivation: 'extension',
          base: { name: 'CT_Base', isBuiltin: false },
          attributes: [
            {
              kind: 'attribute',
              name: 'author',
              typeRef: { name: 'string', isBuiltin: true },
              use: 'required',
            },
            {
              kind: 'attribute',
              name: 'date',
              typeRef: { name: 'string', isBuiltin: true },
              use: 'optional',
            },
          ],
          attributeGroups: [],
        },
      },
      attributes: [], // empty top-level, just like generated schemas
      attributeGroups: [],
    }

    const rootElement: XsdElement = {
      kind: 'element',
      name: 'root',
      typeRef: { name: 'CT_Derived', isBuiltin: false },
      occurs: { minOccurs: 1, maxOccurs: 1 },
    }

    const schema = createSchemaWithTypes(
      new Map([
        ['CT_Base', baseType],
        ['CT_Derived', derivedType],
      ]),
      new Map([['root', rootElement]])
    )

    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry)

    const nsDecl = new Map([['', TEST_NS]])

    // Test 1: provide required attribute, should pass
    engine.startDocument()
    engine.startElement(makeElement('root', TEST_NS, [{ name: 'author', value: 'John' }], nsDecl))
    engine.endElement(makeElement('root', TEST_NS))
    const result1 = engine.endDocument()

    expect(result1.errors).toHaveLength(0)
    expect(result1.valid).toBe(true)

    // Test 2: omit required attribute, should fail
    const engine2 = new ValidationEngine(registry)
    engine2.startDocument()
    engine2.startElement(
      makeElement('root', TEST_NS, [{ name: 'date', value: '2024-01-01' }], nsDecl)
    )
    engine2.endElement(makeElement('root', TEST_NS))
    const result2 = engine2.endDocument()

    const missingAttrErrors = result2.errors.filter((e) => e.code === 'MISSING_REQUIRED_ATTR')
    expect(missingAttrErrors).toHaveLength(1)
    expect(missingAttrErrors[0]!.message).toContain('author')
  })
})

describe('deep nested child validation (cascading)', () => {
  it('should not cascade failures - children of resolved elements should also validate', () => {
    const leafType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Leaf',
      content: {
        kind: 'elementOnly',
        compositor: {
          kind: 'sequence',
          particles: [
            {
              kind: 'element',
              name: 'value',
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

    const middleType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Middle',
      content: {
        kind: 'elementOnly',
        compositor: {
          kind: 'sequence',
          particles: [
            {
              kind: 'element',
              name: 'leaf',
              typeRef: { name: 'CT_Leaf', isBuiltin: false },
              occurs: { minOccurs: 1, maxOccurs: 1 },
            },
          ],
          occurs: { minOccurs: 1, maxOccurs: 1 },
        },
      },
      attributes: [],
      attributeGroups: [],
    }

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
              name: 'middle',
              typeRef: { name: 'CT_Middle', isBuiltin: false },
              occurs: { minOccurs: 1, maxOccurs: 1 },
            },
          ],
          occurs: { minOccurs: 1, maxOccurs: 1 },
        },
      },
      attributes: [],
      attributeGroups: [],
    }

    const rootElement: XsdElement = {
      kind: 'element',
      name: 'root',
      typeRef: { name: 'CT_Root', isBuiltin: false },
      occurs: { minOccurs: 1, maxOccurs: 1 },
    }

    const schema = createSchemaWithTypes(
      new Map([
        ['CT_Root', rootType],
        ['CT_Middle', middleType],
        ['CT_Leaf', leafType],
      ]),
      new Map([['root', rootElement]])
    )

    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry)

    const nsDecl = new Map([['', TEST_NS]])

    engine.startDocument()
    engine.startElement(makeElement('root', TEST_NS, [], nsDecl))
    engine.startElement(makeElement('middle', TEST_NS))
    engine.startElement(makeElement('leaf', TEST_NS))
    engine.startElement(makeElement('value', TEST_NS))
    engine.text('hello')
    engine.endElement(makeElement('value', TEST_NS))
    engine.endElement(makeElement('leaf', TEST_NS))
    engine.endElement(makeElement('middle', TEST_NS))
    engine.endElement(makeElement('root', TEST_NS))
    const result = engine.endDocument()

    expect(result.errors).toHaveLength(0)
    expect(result.valid).toBe(true)
  })

  it('should handle nested compositor with maxOccurs > 1 (choice repeating in sequence)', () => {
    // Root type has sequence with a choice(maxOccurs=2), then a required element
    // <root>
    //   <sequence>
    //     <choice maxOccurs="2">
    //       <element name="optA" type="string"/>
    //       <element name="optB" type="string"/>
    //     </choice>
    //     <element name="required" type="string"/>
    //   </sequence>
    // </root>
    const rootType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Root',
      content: {
        kind: 'elementOnly',
        compositor: {
          kind: 'sequence',
          particles: [
            {
              kind: 'choice',
              particles: [
                {
                  kind: 'element',
                  name: 'optA',
                  typeRef: { name: 'string', isBuiltin: true },
                  occurs: { minOccurs: 1, maxOccurs: 1 },
                },
                {
                  kind: 'element',
                  name: 'optB',
                  typeRef: { name: 'string', isBuiltin: true },
                  occurs: { minOccurs: 1, maxOccurs: 1 },
                },
              ],
              occurs: { minOccurs: 1, maxOccurs: 2 },
            },
            {
              kind: 'element',
              name: 'required',
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

    const rootElement: XsdElement = {
      kind: 'element',
      name: 'root',
      typeRef: { name: 'CT_Root', isBuiltin: false },
      occurs: { minOccurs: 1, maxOccurs: 1 },
    }

    const schema = createSchemaWithTypes(
      new Map([['CT_Root', rootType]]),
      new Map([['root', rootElement]])
    )
    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry, { maxErrors: 100, allowWhitespace: true })

    const nsDecl = new Map([['', TEST_NS]])
    engine.startDocument()

    engine.startElement(makeElement('root', TEST_NS, [], nsDecl))

    // First choice occurrence: select optA
    engine.startElement(makeElement('optA', TEST_NS))
    engine.text('value1')
    engine.endElement(makeElement('optA', TEST_NS))

    // Second choice occurrence: select optB (should work since maxOccurs=2)
    engine.startElement(makeElement('optB', TEST_NS))
    engine.text('value2')
    engine.endElement(makeElement('optB', TEST_NS))

    // Required element after the choice
    engine.startElement(makeElement('required', TEST_NS))
    engine.text('value3')
    engine.endElement(makeElement('required', TEST_NS))

    engine.endElement(makeElement('root', TEST_NS))
    const result = engine.endDocument()

    expect(result.errors).toHaveLength(0)
    expect(result.valid).toBe(true)
  })

  it('should handle nested sequence with maxOccurs > 1', () => {
    // Root type has a parent sequence containing a nested sequence(maxOccurs=unbounded)
    // <root>
    //   <sequence>
    //     <sequence maxOccurs="unbounded">
    //       <element name="a" type="string"/>
    //       <element name="b" type="string"/>
    //     </sequence>
    //   </sequence>
    // </root>
    const rootType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Root',
      content: {
        kind: 'elementOnly',
        compositor: {
          kind: 'sequence',
          particles: [
            {
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
                  occurs: { minOccurs: 1, maxOccurs: 1 },
                },
              ],
              occurs: { minOccurs: 1, maxOccurs: 'unbounded' },
            },
          ],
          occurs: { minOccurs: 1, maxOccurs: 1 },
        },
      },
      attributes: [],
      attributeGroups: [],
    }

    const rootElement: XsdElement = {
      kind: 'element',
      name: 'root',
      typeRef: { name: 'CT_Root', isBuiltin: false },
      occurs: { minOccurs: 1, maxOccurs: 1 },
    }

    const schema = createSchemaWithTypes(
      new Map([['CT_Root', rootType]]),
      new Map([['root', rootElement]])
    )
    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry, { maxErrors: 100, allowWhitespace: true })

    const nsDecl = new Map([['', TEST_NS]])
    engine.startDocument()

    engine.startElement(makeElement('root', TEST_NS, [], nsDecl))

    // First sequence occurrence: a, b
    engine.startElement(makeElement('a', TEST_NS))
    engine.text('1')
    engine.endElement(makeElement('a', TEST_NS))
    engine.startElement(makeElement('b', TEST_NS))
    engine.text('2')
    engine.endElement(makeElement('b', TEST_NS))

    // Second sequence occurrence: a, b
    engine.startElement(makeElement('a', TEST_NS))
    engine.text('3')
    engine.endElement(makeElement('a', TEST_NS))
    engine.startElement(makeElement('b', TEST_NS))
    engine.text('4')
    engine.endElement(makeElement('b', TEST_NS))

    // Third sequence occurrence: a, b
    engine.startElement(makeElement('a', TEST_NS))
    engine.text('5')
    engine.endElement(makeElement('a', TEST_NS))
    engine.startElement(makeElement('b', TEST_NS))
    engine.text('6')
    engine.endElement(makeElement('b', TEST_NS))

    engine.endElement(makeElement('root', TEST_NS))
    const result = engine.endDocument()

    expect(result.errors).toHaveLength(0)
    expect(result.valid).toBe(true)
  })

  it('should reject nested compositor exceeding maxOccurs', () => {
    // choice with maxOccurs=1 — only one branch selection allowed
    const rootType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Root',
      content: {
        kind: 'elementOnly',
        compositor: {
          kind: 'sequence',
          particles: [
            {
              kind: 'choice',
              particles: [
                {
                  kind: 'element',
                  name: 'optA',
                  typeRef: { name: 'string', isBuiltin: true },
                  occurs: { minOccurs: 1, maxOccurs: 1 },
                },
                {
                  kind: 'element',
                  name: 'optB',
                  typeRef: { name: 'string', isBuiltin: true },
                  occurs: { minOccurs: 1, maxOccurs: 1 },
                },
              ],
              occurs: { minOccurs: 1, maxOccurs: 1 },
            },
          ],
          occurs: { minOccurs: 1, maxOccurs: 1 },
        },
      },
      attributes: [],
      attributeGroups: [],
    }

    const rootElement: XsdElement = {
      kind: 'element',
      name: 'root',
      typeRef: { name: 'CT_Root', isBuiltin: false },
      occurs: { minOccurs: 1, maxOccurs: 1 },
    }

    const schema = createSchemaWithTypes(
      new Map([['CT_Root', rootType]]),
      new Map([['root', rootElement]])
    )
    const registry = createTestRegistry(new Map([[TEST_NS, schema]]))
    const engine = new ValidationEngine(registry, { maxErrors: 100, allowWhitespace: true })

    const nsDecl = new Map([['', TEST_NS]])
    engine.startDocument()
    engine.startElement(makeElement('root', TEST_NS, [], nsDecl))

    // First occurrence: select optA — OK
    engine.startElement(makeElement('optA', TEST_NS))
    engine.text('value1')
    engine.endElement(makeElement('optA', TEST_NS))

    // Second occurrence: select optB — should FAIL (maxOccurs=1)
    engine.startElement(makeElement('optB', TEST_NS))
    engine.text('value2')
    engine.endElement(makeElement('optB', TEST_NS))

    engine.endElement(makeElement('root', TEST_NS))
    const result = engine.endDocument()

    // Should have an error for the second choice occurrence
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

describe('cross-namespace complexContent attribute inheritance', () => {
  const OTHER_NS = 'http://other.example.com/schema'

  it('should inherit attributes from a base type in a different namespace via schema prefix', () => {
    // Base type in OTHER_NS with a required attribute
    const baseType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_BaseOther',
      content: { kind: 'empty' },
      attributes: [
        {
          kind: 'attribute',
          name: 'baseAttr',
          typeRef: { name: 'string', isBuiltin: true },
          use: 'required',
        },
      ],
      attributeGroups: [],
    }

    const otherSchema: XsdSchema = {
      targetNamespace: OTHER_NS,
      namespaces: [],
      elementFormDefault: 'qualified',
      attributeFormDefault: 'unqualified',
      imports: [],
      includes: [],
      redefines: [],
      simpleTypes: new Map(),
      complexTypes: new Map([['CT_BaseOther', baseType]]),
      elements: new Map(),
      attributes: new Map(),
      groups: new Map(),
      attributeGroups: new Map(),
    }

    // Derived type in TEST_NS extends base from OTHER_NS using prefix "o"
    const derivedType: XsdComplexType = {
      kind: 'complexType',
      name: 'CT_Derived',
      content: {
        kind: 'complexContent',
        content: {
          derivation: 'extension',
          base: { name: 'CT_BaseOther', isBuiltin: false, namespacePrefix: 'o' },
          attributes: [
            {
              kind: 'attribute',
              name: 'extAttr',
              typeRef: { name: 'string', isBuiltin: true },
              use: 'required',
            },
          ],
          attributeGroups: [],
        },
      },
      attributes: [],
      attributeGroups: [],
    }

    const rootElement: XsdElement = {
      kind: 'element',
      name: 'root',
      typeRef: { name: 'CT_Derived', isBuiltin: false },
      occurs: { minOccurs: 1, maxOccurs: 1 },
    }

    // Schema for TEST_NS declares prefix "o" → OTHER_NS
    const testSchema: XsdSchema = {
      targetNamespace: TEST_NS,
      namespaces: [{ prefix: 'o', uri: OTHER_NS }],
      elementFormDefault: 'qualified',
      attributeFormDefault: 'unqualified',
      imports: [],
      includes: [],
      redefines: [],
      simpleTypes: new Map(),
      complexTypes: new Map([['CT_Derived', derivedType]]),
      elements: new Map([['root', rootElement]]),
      attributes: new Map(),
      groups: new Map(),
      attributeGroups: new Map(),
    }

    const registry = createTestRegistry(
      new Map([
        [TEST_NS, testSchema],
        [OTHER_NS, otherSchema],
      ])
    )
    const engine = new ValidationEngine(registry)

    const nsDecl = new Map([['', TEST_NS]])

    // Test 1: provide both base and extension attributes → should pass
    engine.startDocument()
    engine.startElement(
      makeElement(
        'root',
        TEST_NS,
        [
          { name: 'baseAttr', value: 'base' },
          { name: 'extAttr', value: 'ext' },
        ],
        nsDecl
      )
    )
    engine.endElement(makeElement('root', TEST_NS))
    const result1 = engine.endDocument()

    expect(result1.errors).toHaveLength(0)
    expect(result1.valid).toBe(true)

    // Test 2: omit the base attribute → should report MISSING_REQUIRED_ATTR
    const engine2 = new ValidationEngine(registry)
    engine2.startDocument()
    engine2.startElement(makeElement('root', TEST_NS, [{ name: 'extAttr', value: 'ext' }], nsDecl))
    engine2.endElement(makeElement('root', TEST_NS))
    const result2 = engine2.endDocument()

    const missingAttrErrors = result2.errors.filter((e) => e.code === 'MISSING_REQUIRED_ATTR')
    expect(missingAttrErrors).toHaveLength(1)
    expect(missingAttrErrors[0]!.message).toContain('baseAttr')
  })
})

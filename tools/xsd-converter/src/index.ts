/**
 * XSD to JSON Schema Converter
 *
 * Converts OOXML XSD schema files to TypeScript runtime type definitions
 * for use with @ooxml/core validation engine.
 */

import { XMLParser } from 'fast-xml-parser'
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMAS_DIR = join(__dirname, '../../../schemas')
const OUTPUT_DIR = join(__dirname, '../../../packages/core/src/schemas')

// XML Parser configuration
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: false,
  trimValues: true,
})

// XSD built-in types
const XSD_BUILTIN_TYPES = new Set([
  'string', 'boolean', 'decimal', 'float', 'double', 'duration', 'dateTime',
  'time', 'date', 'gYearMonth', 'gYear', 'gMonthDay', 'gDay', 'gMonth',
  'hexBinary', 'base64Binary', 'anyURI', 'QName', 'NOTATION',
  'normalizedString', 'token', 'language', 'NMTOKEN', 'NMTOKENS',
  'Name', 'NCName', 'ID', 'IDREF', 'IDREFS', 'ENTITY', 'ENTITIES',
  'integer', 'nonPositiveInteger', 'negativeInteger', 'long', 'int',
  'short', 'byte', 'nonNegativeInteger', 'unsignedLong', 'unsignedInt',
  'unsignedShort', 'unsignedByte', 'positiveInteger', 'anyType', 'anySimpleType',
])

interface ParsedSchema {
  targetNamespace: string
  imports: { namespace: string; schemaLocation: string }[]
  simpleTypes: ParsedSimpleType[]
  complexTypes: ParsedComplexType[]
  elements: ParsedElement[]
  groups: ParsedGroup[]
  attributeGroups: ParsedAttributeGroup[]
}

interface ParsedSimpleType {
  name: string
  restriction?: { base: string; facets: ParsedFacet[] }
  union?: { memberTypes: string[] }
  list?: { itemType: string }
}

interface ParsedFacet {
  type: string
  value: string
  fixed?: boolean
}

interface ParsedComplexType {
  name: string
  mixed: boolean
  abstract: boolean
  content?: { type: 'sequence' | 'choice' | 'all'; particles: ParsedParticle[] }
  simpleContent?: ParsedSimpleContent
  complexContent?: ParsedComplexContent
  attributes: ParsedAttribute[]
  attributeGroups: string[]
  anyAttribute?: { namespace: string; processContents: string }
}

interface ParsedParticle {
  type: 'element' | 'sequence' | 'choice' | 'group' | 'any'
  name?: string
  ref?: string
  elementType?: string
  particles?: ParsedParticle[]
  namespace?: string
  processContents?: string
  minOccurs: number
  maxOccurs: number | 'unbounded'
}

interface ParsedElement {
  name: string
  ref?: string
  type?: string
  minOccurs: number
  maxOccurs: number | 'unbounded'
  default?: string
  fixed?: string
  nillable?: boolean
}

interface ParsedAttribute {
  name: string
  ref?: string
  type: string
  use: 'required' | 'optional' | 'prohibited'
  default?: string
  fixed?: string
}

interface ParsedGroup {
  name: string
  content?: { type: 'sequence' | 'choice'; particles: ParsedParticle[] }
}

interface ParsedAttributeGroup {
  name: string
  attributes: ParsedAttribute[]
  attributeGroups: string[]
}

interface ParsedSimpleContent {
  type: 'extension' | 'restriction'
  base: string
  attributes: ParsedAttribute[]
  facets?: ParsedFacet[]
}

interface ParsedComplexContent {
  type: 'extension' | 'restriction'
  base: string
  content?: { type: 'sequence' | 'choice'; particles: ParsedParticle[] }
  attributes: ParsedAttribute[]
  attributeGroups: string[]
}

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

export function convertXsd(xsdContent: string, filename: string): ParsedSchema {
  const parsed = parser.parse(xsdContent)
  const schema = parsed['xsd:schema'] || parsed['xs:schema'] || parsed.schema

  if (!schema) {
    throw new Error(`No schema element found in ${filename}`)
  }

  const targetNamespace = schema['@_targetNamespace'] || ''
  const result: ParsedSchema = {
    targetNamespace,
    imports: [],
    simpleTypes: [],
    complexTypes: [],
    elements: [],
    groups: [],
    attributeGroups: [],
  }

  // Process imports
  const imports = ensureArray(schema['xsd:import'] || schema['xs:import'] || [])
  for (const imp of imports) {
    result.imports.push({
      namespace: imp['@_namespace'] || '',
      schemaLocation: imp['@_schemaLocation'] || '',
    })
  }

  // Process simple types
  const simpleTypes = ensureArray(schema['xsd:simpleType'] || schema['xs:simpleType'] || [])
  for (const st of simpleTypes) {
    result.simpleTypes.push(parseSimpleType(st))
  }

  // Process complex types
  const complexTypes = ensureArray(schema['xsd:complexType'] || schema['xs:complexType'] || [])
  for (const ct of complexTypes) {
    result.complexTypes.push(parseComplexType(ct))
  }

  // Process elements
  const elements = ensureArray(schema['xsd:element'] || schema['xs:element'] || [])
  for (const el of elements) {
    result.elements.push(parseElement(el))
  }

  // Process groups
  const groups = ensureArray(schema['xsd:group'] || schema['xs:group'] || [])
  for (const gr of groups) {
    result.groups.push(parseGroup(gr))
  }

  // Process attribute groups
  const attrGroups = ensureArray(schema['xsd:attributeGroup'] || schema['xs:attributeGroup'] || [])
  for (const ag of attrGroups) {
    result.attributeGroups.push(parseAttributeGroup(ag))
  }

  return result
}

function parseSimpleType(st: any): ParsedSimpleType {
  const name = st['@_name'] || ''
  const restriction = st['xsd:restriction'] || st['xs:restriction']
  const union = st['xsd:union'] || st['xs:union']
  const list = st['xsd:list'] || st['xs:list']

  const result: ParsedSimpleType = { name }

  if (restriction) {
    result.restriction = {
      base: restriction['@_base'] || 'xsd:string',
      facets: extractFacets(restriction),
    }
  } else if (union) {
    const memberTypes = union['@_memberTypes']
    result.union = {
      memberTypes: memberTypes ? memberTypes.split(/\s+/) : [],
    }
  } else if (list) {
    result.list = {
      itemType: list['@_itemType'] || '',
    }
  }

  return result
}

function extractFacets(restriction: any): ParsedFacet[] {
  const facets: ParsedFacet[] = []
  const facetTypes = [
    'enumeration', 'pattern', 'minLength', 'maxLength', 'length',
    'minInclusive', 'maxInclusive', 'minExclusive', 'maxExclusive',
    'totalDigits', 'fractionDigits', 'whiteSpace',
  ]

  for (const facetType of facetTypes) {
    const xsdFacet = restriction[`xsd:${facetType}`] || restriction[`xs:${facetType}`]
    if (xsdFacet) {
      const values = ensureArray(xsdFacet)
      for (const v of values) {
        facets.push({
          type: facetType,
          value: v['@_value'] || '',
          fixed: v['@_fixed'] === 'true',
        })
      }
    }
  }

  return facets
}

function parseComplexType(ct: any): ParsedComplexType {
  const name = ct['@_name'] || ''
  const mixed = ct['@_mixed'] === 'true'
  const abstract = ct['@_abstract'] === 'true'

  const result: ParsedComplexType = {
    name,
    mixed,
    abstract,
    attributes: [],
    attributeGroups: [],
  }

  // Extract content model
  const sequence = ct['xsd:sequence'] || ct['xs:sequence']
  const choice = ct['xsd:choice'] || ct['xs:choice']
  const all = ct['xsd:all'] || ct['xs:all']
  const simpleContent = ct['xsd:simpleContent'] || ct['xs:simpleContent']
  const complexContent = ct['xsd:complexContent'] || ct['xs:complexContent']

  if (sequence) {
    result.content = { type: 'sequence', particles: parseParticles(sequence) }
  } else if (choice) {
    result.content = { type: 'choice', particles: parseParticles(choice) }
  } else if (all) {
    result.content = { type: 'all', particles: parseParticles(all) }
  } else if (simpleContent) {
    result.simpleContent = parseSimpleContent(simpleContent)
  } else if (complexContent) {
    result.complexContent = parseComplexContent(complexContent)
  }

  // Extract attributes
  const attrs = ensureArray(ct['xsd:attribute'] || ct['xs:attribute'] || [])
  for (const attr of attrs) {
    result.attributes.push(parseAttribute(attr))
  }

  // Extract attribute groups
  const attrGroups = ensureArray(ct['xsd:attributeGroup'] || ct['xs:attributeGroup'] || [])
  for (const ag of attrGroups) {
    if (ag['@_ref']) {
      result.attributeGroups.push(ag['@_ref'])
    }
  }

  // Extract anyAttribute
  const anyAttr = ct['xsd:anyAttribute'] || ct['xs:anyAttribute']
  if (anyAttr) {
    result.anyAttribute = {
      namespace: anyAttr['@_namespace'] || '##any',
      processContents: anyAttr['@_processContents'] || 'strict',
    }
  }

  return result
}

function parseParticles(container: any): ParsedParticle[] {
  const particles: ParsedParticle[] = []

  // Elements
  const elements = ensureArray(container['xsd:element'] || container['xs:element'] || [])
  for (const el of elements) {
    particles.push({
      type: 'element',
      name: el['@_name'] || undefined,
      ref: el['@_ref'] || undefined,
      elementType: el['@_type'] || undefined,
      minOccurs: parseInt(el['@_minOccurs'] || '1', 10),
      maxOccurs: el['@_maxOccurs'] === 'unbounded' ? 'unbounded' : parseInt(el['@_maxOccurs'] || '1', 10),
    })
  }

  // Nested sequences
  const sequences = ensureArray(container['xsd:sequence'] || container['xs:sequence'] || [])
  for (const seq of sequences) {
    particles.push({
      type: 'sequence',
      particles: parseParticles(seq),
      minOccurs: parseInt(seq['@_minOccurs'] || '1', 10),
      maxOccurs: seq['@_maxOccurs'] === 'unbounded' ? 'unbounded' : parseInt(seq['@_maxOccurs'] || '1', 10),
    })
  }

  // Nested choices
  const choices = ensureArray(container['xsd:choice'] || container['xs:choice'] || [])
  for (const ch of choices) {
    particles.push({
      type: 'choice',
      particles: parseParticles(ch),
      minOccurs: parseInt(ch['@_minOccurs'] || '1', 10),
      maxOccurs: ch['@_maxOccurs'] === 'unbounded' ? 'unbounded' : parseInt(ch['@_maxOccurs'] || '1', 10),
    })
  }

  // Group references
  const groups = ensureArray(container['xsd:group'] || container['xs:group'] || [])
  for (const gr of groups) {
    if (gr['@_ref']) {
      particles.push({
        type: 'group',
        ref: gr['@_ref'],
        minOccurs: parseInt(gr['@_minOccurs'] || '1', 10),
        maxOccurs: gr['@_maxOccurs'] === 'unbounded' ? 'unbounded' : parseInt(gr['@_maxOccurs'] || '1', 10),
      })
    }
  }

  // Any elements
  const anys = ensureArray(container['xsd:any'] || container['xs:any'] || [])
  for (const any of anys) {
    particles.push({
      type: 'any',
      namespace: any['@_namespace'] || '##any',
      processContents: any['@_processContents'] || 'strict',
      minOccurs: parseInt(any['@_minOccurs'] || '1', 10),
      maxOccurs: any['@_maxOccurs'] === 'unbounded' ? 'unbounded' : parseInt(any['@_maxOccurs'] || '1', 10),
    })
  }

  return particles
}

function parseElement(el: any): ParsedElement {
  return {
    name: el['@_name'] || '',
    ref: el['@_ref'] || undefined,
    type: el['@_type'] || undefined,
    minOccurs: parseInt(el['@_minOccurs'] || '1', 10),
    maxOccurs: el['@_maxOccurs'] === 'unbounded' ? 'unbounded' : parseInt(el['@_maxOccurs'] || '1', 10),
    default: el['@_default'],
    fixed: el['@_fixed'],
    nillable: el['@_nillable'] === 'true',
  }
}

function parseAttribute(attr: any): ParsedAttribute {
  return {
    name: attr['@_name'] || '',
    ref: attr['@_ref'] || undefined,
    type: attr['@_type'] || 'xsd:string',
    use: (attr['@_use'] as 'required' | 'optional' | 'prohibited') || 'optional',
    default: attr['@_default'],
    fixed: attr['@_fixed'],
  }
}

function parseGroup(gr: any): ParsedGroup {
  const name = gr['@_name'] || ''
  const sequence = gr['xsd:sequence'] || gr['xs:sequence']
  const choice = gr['xsd:choice'] || gr['xs:choice']

  const result: ParsedGroup = { name }

  if (sequence) {
    result.content = { type: 'sequence', particles: parseParticles(sequence) }
  } else if (choice) {
    result.content = { type: 'choice', particles: parseParticles(choice) }
  }

  return result
}

function parseAttributeGroup(ag: any): ParsedAttributeGroup {
  const name = ag['@_name'] || ''
  const result: ParsedAttributeGroup = {
    name,
    attributes: [],
    attributeGroups: [],
  }

  const attrs = ensureArray(ag['xsd:attribute'] || ag['xs:attribute'] || [])
  for (const attr of attrs) {
    result.attributes.push(parseAttribute(attr))
  }

  const attrGroups = ensureArray(ag['xsd:attributeGroup'] || ag['xs:attributeGroup'] || [])
  for (const ref of attrGroups) {
    if (ref['@_ref']) {
      result.attributeGroups.push(ref['@_ref'])
    }
  }

  return result
}

function parseSimpleContent(sc: any): ParsedSimpleContent {
  const extension = sc['xsd:extension'] || sc['xs:extension']
  const restriction = sc['xsd:restriction'] || sc['xs:restriction']

  if (extension) {
    const attrs = ensureArray(extension['xsd:attribute'] || extension['xs:attribute'] || [])
    return {
      type: 'extension',
      base: extension['@_base'] || '',
      attributes: attrs.map(parseAttribute),
    }
  }

  if (restriction) {
    const attrs = ensureArray(restriction['xsd:attribute'] || restriction['xs:attribute'] || [])
    return {
      type: 'restriction',
      base: restriction['@_base'] || '',
      attributes: attrs.map(parseAttribute),
      facets: extractFacets(restriction),
    }
  }

  return { type: 'extension', base: '', attributes: [] }
}

function parseComplexContent(cc: any): ParsedComplexContent {
  const extension = cc['xsd:extension'] || cc['xs:extension']
  const restriction = cc['xsd:restriction'] || cc['xs:restriction']
  const source = extension || restriction

  if (!source) {
    return { type: 'extension', base: '', attributes: [], attributeGroups: [] }
  }

  const sequence = source['xsd:sequence'] || source['xs:sequence']
  const choice = source['xsd:choice'] || source['xs:choice']
  const attrs = ensureArray(source['xsd:attribute'] || source['xs:attribute'] || [])
  const attrGroups = ensureArray(source['xsd:attributeGroup'] || source['xs:attributeGroup'] || [])

  return {
    type: extension ? 'extension' : 'restriction',
    base: source['@_base'] || '',
    content: sequence
      ? { type: 'sequence', particles: parseParticles(sequence) }
      : choice
        ? { type: 'choice', particles: parseParticles(choice) }
        : undefined,
    attributes: attrs.map(parseAttribute),
    attributeGroups: attrGroups.filter((ref: any) => ref['@_ref']).map((ref: any) => ref['@_ref']),
  }
}

// ============================================================================
// TypeScript Code Generation
// ============================================================================

function makeTypeRef(typeStr: string): string {
  if (!typeStr) return '{ name: "string", isBuiltin: true }'

  const [prefix, localName] = typeStr.includes(':') ? typeStr.split(':') : ['', typeStr]

  if (prefix === 'xsd' || prefix === 'xs') {
    return `{ name: "${localName}", isBuiltin: true }`
  }

  if (!prefix) {
    return `{ name: "${localName}", isBuiltin: false }`
  }

  return `{ namespacePrefix: "${prefix}", name: "${localName}", isBuiltin: false }`
}

function generateOccurs(minOccurs: number, maxOccurs: number | 'unbounded'): string {
  return `{ minOccurs: ${minOccurs}, maxOccurs: ${maxOccurs === 'unbounded' ? '"unbounded"' : maxOccurs} }`
}

function generateFacets(facets: ParsedFacet[]): string {
  // Group enumerations and patterns
  const enums = facets.filter(f => f.type === 'enumeration')
  const patterns = facets.filter(f => f.type === 'pattern')
  const others = facets.filter(f => f.type !== 'enumeration' && f.type !== 'pattern')

  const result: string[] = []

  if (enums.length > 0) {
    result.push(`{ type: "enumeration", values: [${enums.map(f => `"${escapeString(f.value)}"`).join(', ')}] }`)
  }

  if (patterns.length > 0) {
    result.push(`{ type: "pattern", patterns: [${patterns.map(f => `"${escapeString(f.value)}"`).join(', ')}] }`)
  }

  for (const f of others) {
    if (['minLength', 'maxLength', 'length', 'totalDigits', 'fractionDigits'].includes(f.type)) {
      result.push(`{ type: "${f.type}", value: ${parseInt(f.value, 10)}${f.fixed ? ', fixed: true' : ''} }`)
    } else if (f.type === 'whiteSpace') {
      result.push(`{ type: "whiteSpace", value: "${f.value}" as const }`)
    } else {
      result.push(`{ type: "${f.type}", value: "${escapeString(f.value)}" }`)
    }
  }

  return `[${result.join(', ')}]`
}

function escapeString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

function generateSimpleType(st: ParsedSimpleType): string {
  let content: string

  if (st.restriction) {
    content = `{ kind: "restriction", base: ${makeTypeRef(st.restriction.base)}, facets: ${generateFacets(st.restriction.facets)} }`
  } else if (st.union) {
    content = `{ kind: "union", memberTypes: [${st.union.memberTypes.map(makeTypeRef).join(', ')}] }`
  } else if (st.list) {
    content = `{ kind: "list", itemType: ${makeTypeRef(st.list.itemType)} }`
  } else {
    content = '{ kind: "restriction", base: { name: "string", isBuiltin: true }, facets: [] }'
  }

  return `{ kind: "simpleType", name: "${st.name}", content: ${content} }`
}

function generateAttribute(attr: ParsedAttribute): string {
  const parts = [
    `kind: "attribute"`,
    attr.name ? `name: "${attr.name}"` : undefined,
    attr.ref ? `ref: ${makeTypeRef(attr.ref)}` : undefined,
    `typeRef: ${makeTypeRef(attr.type)}`,
    `use: "${attr.use}"`,
    attr.default ? `default: { value: "${escapeString(attr.default)}", fixed: false }` : undefined,
    attr.fixed ? `default: { value: "${escapeString(attr.fixed)}", fixed: true }` : undefined,
  ].filter(Boolean)

  return `{ ${parts.join(', ')} }`
}

function generateParticle(p: ParsedParticle): string {
  if (p.type === 'element') {
    const parts = [
      `kind: "element"`,
      p.name ? `name: "${p.name}"` : undefined,
      p.ref ? `ref: ${makeTypeRef(p.ref)}` : undefined,
      p.elementType ? `typeRef: ${makeTypeRef(p.elementType)}` : undefined,
      `occurs: ${generateOccurs(p.minOccurs, p.maxOccurs)}`,
    ].filter(Boolean)
    return `{ ${parts.join(', ')} }`
  }

  if (p.type === 'sequence' || p.type === 'choice') {
    return `{ kind: "${p.type}", particles: [${(p.particles || []).map(generateParticle).join(', ')}], occurs: ${generateOccurs(p.minOccurs, p.maxOccurs)} }`
  }

  if (p.type === 'group') {
    return `{ kind: "groupRef", ref: ${makeTypeRef(p.ref!)}, occurs: ${generateOccurs(p.minOccurs, p.maxOccurs)} }`
  }

  if (p.type === 'any') {
    return `{ kind: "any", namespace: "${p.namespace || '##any'}", processContents: "${p.processContents || 'strict'}" as const, occurs: ${generateOccurs(p.minOccurs, p.maxOccurs)} }`
  }

  return '{}'
}

function generateComplexType(ct: ParsedComplexType): string {
  const attrs = ct.attributes.map(generateAttribute).join(', ')
  const attrGroups = ct.attributeGroups.map(ag => `{ kind: "attributeGroup", ref: ${makeTypeRef(ag)} }`).join(', ')

  let content: string

  if (ct.content) {
    const compositor = `{ kind: "${ct.content.type}", ${ct.content.type === 'all' ? 'elements' : 'particles'}: [${ct.content.particles.map(generateParticle).join(', ')}], occurs: { minOccurs: 1, maxOccurs: 1 } }`
    content = `{ kind: "${ct.mixed ? 'mixed' : 'elementOnly'}", compositor: ${compositor} }`
  } else if (ct.simpleContent) {
    const scAttrs = ct.simpleContent.attributes.map(generateAttribute).join(', ')
    if (ct.simpleContent.type === 'extension') {
      content = `{ kind: "simpleContent", content: { derivation: "extension", base: ${makeTypeRef(ct.simpleContent.base)}, attributes: [${scAttrs}], attributeGroups: [] } }`
    } else {
      const facets = ct.simpleContent.facets ? generateFacets(ct.simpleContent.facets) : '[]'
      content = `{ kind: "simpleContent", content: { derivation: "restriction", base: ${makeTypeRef(ct.simpleContent.base)}, facets: ${facets}, attributes: [${scAttrs}], attributeGroups: [] } }`
    }
  } else if (ct.complexContent) {
    const ccAttrs = ct.complexContent.attributes.map(generateAttribute).join(', ')
    const ccAttrGroups = ct.complexContent.attributeGroups.map(ag => `{ kind: "attributeGroup", ref: ${makeTypeRef(ag)} }`).join(', ')
    const compositor = ct.complexContent.content
      ? `{ kind: "${ct.complexContent.content.type}", particles: [${ct.complexContent.content.particles.map(generateParticle).join(', ')}], occurs: { minOccurs: 1, maxOccurs: 1 } }`
      : 'undefined'
    content = `{ kind: "complexContent", content: { derivation: "${ct.complexContent.type}", base: ${makeTypeRef(ct.complexContent.base)}, compositor: ${compositor}, attributes: [${ccAttrs}], attributeGroups: [${ccAttrGroups}] } }`
  } else {
    content = '{ kind: "empty" }'
  }

  const anyAttr = ct.anyAttribute
    ? `, anyAttribute: { kind: "anyAttribute", namespace: "${ct.anyAttribute.namespace}", processContents: "${ct.anyAttribute.processContents}" as const }`
    : ''

  return `{ kind: "complexType", name: "${ct.name}", abstract: ${ct.abstract}, mixed: ${ct.mixed}, content: ${content}, attributes: [${attrs}], attributeGroups: [${attrGroups}]${anyAttr} }`
}

function generateElement(el: ParsedElement): string {
  const parts = [
    `kind: "element"`,
    `name: "${el.name}"`,
    el.ref ? `ref: ${makeTypeRef(el.ref)}` : undefined,
    el.type ? `typeRef: ${makeTypeRef(el.type)}` : undefined,
    `occurs: ${generateOccurs(el.minOccurs, el.maxOccurs)}`,
    el.nillable ? `nillable: true` : undefined,
    el.default ? `default: { value: "${escapeString(el.default)}", fixed: false }` : undefined,
    el.fixed ? `default: { value: "${escapeString(el.fixed)}", fixed: true }` : undefined,
  ].filter(Boolean)

  return `{ ${parts.join(', ')} }`
}

function generateGroup(gr: ParsedGroup): string {
  const compositor = gr.content
    ? `{ kind: "${gr.content.type}", particles: [${gr.content.particles.map(generateParticle).join(', ')}], occurs: { minOccurs: 1, maxOccurs: 1 } }`
    : 'undefined'
  return `{ kind: "group", name: "${gr.name}", compositor: ${compositor} }`
}

function generateAttributeGroup(ag: ParsedAttributeGroup): string {
  const attrs = ag.attributes.map(generateAttribute).join(', ')
  const refs = ag.attributeGroups.map(ref => makeTypeRef(ref)).join(', ')
  return `{ kind: "attributeGroup", name: "${ag.name}", attributes: [${attrs}], attributeGroupRefs: [${refs}] }`
}

function generateTypeScript(schema: ParsedSchema, filename: string): string {
  const lines: string[] = []

  lines.push('/**')
  lines.push(` * Auto-generated from ${filename}`)
  lines.push(' * DO NOT EDIT - Generated by xsd-converter')
  lines.push(' */')
  lines.push('')
  lines.push("import type { XsdSchema } from '../types'")
  lines.push('')

  const varName = camelCase(basename(filename, '.xsd'))

  // Generate imports
  const imports = schema.imports.map(imp =>
    `{ kind: "import", namespace: "${imp.namespace}", schemaLocation: "${imp.schemaLocation}" }`
  ).join(',\n    ')

  // Generate simpleTypes as Map entries
  const simpleTypeEntries = schema.simpleTypes.map(st =>
    `["${st.name}", ${generateSimpleType(st)}]`
  ).join(',\n    ')

  // Generate complexTypes as Map entries
  const complexTypeEntries = schema.complexTypes.map(ct =>
    `["${ct.name}", ${generateComplexType(ct)}]`
  ).join(',\n    ')

  // Generate elements as Map entries
  const elementEntries = schema.elements.map(el =>
    `["${el.name}", ${generateElement(el)}]`
  ).join(',\n    ')

  // Generate groups as Map entries
  const groupEntries = schema.groups.map(gr =>
    `["${gr.name}", ${generateGroup(gr)}]`
  ).join(',\n    ')

  // Generate attributeGroups as Map entries
  const attrGroupEntries = schema.attributeGroups.map(ag =>
    `["${ag.name}", ${generateAttributeGroup(ag)}]`
  ).join(',\n    ')

  lines.push(`export const ${varName}Schema: XsdSchema = {`)
  lines.push(`  targetNamespace: "${schema.targetNamespace}",`)
  lines.push(`  namespaces: [],`)
  lines.push(`  elementFormDefault: "qualified",`)
  lines.push(`  attributeFormDefault: "unqualified",`)
  lines.push(`  imports: [`)
  if (imports) lines.push(`    ${imports}`)
  lines.push(`  ],`)
  lines.push(`  includes: [],`)
  lines.push(`  redefines: [],`)
  lines.push(`  simpleTypes: new Map([`)
  if (simpleTypeEntries) lines.push(`    ${simpleTypeEntries}`)
  lines.push(`  ]),`)
  lines.push(`  complexTypes: new Map([`)
  if (complexTypeEntries) lines.push(`    ${complexTypeEntries}`)
  lines.push(`  ]),`)
  lines.push(`  elements: new Map([`)
  if (elementEntries) lines.push(`    ${elementEntries}`)
  lines.push(`  ]),`)
  lines.push(`  attributes: new Map(),`)
  lines.push(`  groups: new Map([`)
  if (groupEntries) lines.push(`    ${groupEntries}`)
  lines.push(`  ]),`)
  lines.push(`  attributeGroups: new Map([`)
  if (attrGroupEntries) lines.push(`    ${attrGroupEntries}`)
  lines.push(`  ]),`)
  lines.push(`}`)
  lines.push('')
  lines.push(`export default ${varName}Schema`)

  return lines.join('\n')
}

function camelCase(str: string): string {
  return str
    .split('-')
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('')
}

// Main execution
async function main(): Promise<void> {
  console.log('XSD to JSON Schema Converter')
  console.log('============================')
  console.log(`Input: ${SCHEMAS_DIR}`)
  console.log(`Output: ${OUTPUT_DIR}`)
  console.log('')

  // Ensure output directory exists
  mkdirSync(OUTPUT_DIR, { recursive: true })

  // Find all XSD files
  const xsdFiles = readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith('.xsd'))
  console.log(`Found ${xsdFiles.length} XSD files\n`)

  const results: { filename: string; success: boolean; error?: string; stats?: any }[] = []

  for (const xsdFile of xsdFiles) {
    process.stdout.write(`Processing: ${xsdFile}... `)

    try {
      const xsdPath = join(SCHEMAS_DIR, xsdFile)
      const xsdContent = readFileSync(xsdPath, 'utf-8')

      const schema = convertXsd(xsdContent, xsdFile)
      const tsContent = generateTypeScript(schema, xsdFile)

      const outputFile = join(OUTPUT_DIR, xsdFile.replace('.xsd', '.ts'))
      writeFileSync(outputFile, tsContent)

      const stats = {
        simpleTypes: schema.simpleTypes.length,
        complexTypes: schema.complexTypes.length,
        elements: schema.elements.length,
        groups: schema.groups.length,
        attributeGroups: schema.attributeGroups.length,
      }

      results.push({ filename: xsdFile, success: true, stats })
      console.log(`✓ (${stats.simpleTypes}st, ${stats.complexTypes}ct, ${stats.elements}el)`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      results.push({ filename: xsdFile, success: false, error: errorMessage })
      console.log(`✗ ${errorMessage}`)
    }
  }

  // Generate index file
  generateIndexFile(results.filter((r) => r.success).map((r) => r.filename))

  // Summary
  console.log('\n========== Summary ==========')
  const successCount = results.filter((r) => r.success).length
  console.log(`Success: ${successCount}/${results.length}`)

  let totalSimple = 0,
    totalComplex = 0,
    totalElements = 0
  for (const r of results) {
    if (r.stats) {
      totalSimple += r.stats.simpleTypes
      totalComplex += r.stats.complexTypes
      totalElements += r.stats.elements
    }
  }
  console.log(`Total: ${totalSimple} simpleTypes, ${totalComplex} complexTypes, ${totalElements} elements`)

  if (successCount < results.length) {
    console.log('\nFailed files:')
    results
      .filter((r) => !r.success)
      .forEach((r) => console.log(`  - ${r.filename}: ${r.error}`))
  }
}

function generateIndexFile(filenames: string[]): void {
  const exports = filenames
    .map((f) => {
      const baseName = f.replace('.xsd', '')
      const varName = camelCase(baseName)
      return `export { ${varName}Schema } from './${baseName}'`
    })
    .join('\n')

  const content = `/**
 * Auto-generated schema index
 * DO NOT EDIT - Generated by xsd-converter
 */

${exports}
`

  writeFileSync(join(OUTPUT_DIR, 'index.ts'), content)
  console.log(`\nGenerated: index.ts`)
}

main().catch(console.error)

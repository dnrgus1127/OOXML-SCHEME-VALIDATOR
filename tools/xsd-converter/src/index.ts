/**
 * XSD to JSON Schema Converter
 *
 * Converts OOXML XSD schema files to TypeScript runtime type definitions
 * for use with @ooxml/core validation engine.
 *
 * Uses preserveOrder mode to maintain correct particle ordering in compositors.
 */

import { XMLParser } from 'fast-xml-parser'
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMAS_DIR = join(__dirname, '../../../schemas')
const OUTPUT_DIR = join(__dirname, '../../../packages/core/src/schemas')

// XML Parser configuration — preserveOrder mode to maintain child ordering
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: false,
  trimValues: true,
  preserveOrder: true,
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

// ============================================================================
// preserveOrder helper functions
// ============================================================================

/** Get an attribute value from a preserveOrder node */
function attr(node: any, name: string): string | undefined {
  return node?.[':@']?.['@_' + name]
}

/** Get the tag name of a preserveOrder node (first key that isn't ':@') */
function nodeTag(node: any): string {
  if (!node) return ''
  for (const key of Object.keys(node)) {
    if (key !== ':@') return key
  }
  return ''
}

/** Get the ordered children array of a preserveOrder node */
function nodeChildren(node: any): any[] {
  const tag = nodeTag(node)
  return tag ? (node[tag] || []) : []
}

/** Find all child nodes matching a tag (supports xsd: and xs: prefixes) */
function findByTag(children: any[], baseName: string): any[] {
  return children.filter(child => {
    const tag = nodeTag(child)
    return tag === `xsd:${baseName}` || tag === `xs:${baseName}`
  })
}

/** Find the first child node matching a tag */
function findFirstByTag(children: any[], baseName: string): any | undefined {
  return children.find(child => {
    const tag = nodeTag(child)
    return tag === `xsd:${baseName}` || tag === `xs:${baseName}`
  })
}

/** Check if a tag name matches an XSD tag (with xsd: or xs: prefix) */
function isXsdTag(tag: string, baseName: string): boolean {
  return tag === `xsd:${baseName}` || tag === `xs:${baseName}`
}

// ============================================================================
// Parsing functions (preserveOrder format)
// ============================================================================

export function convertXsd(xsdContent: string, filename: string): ParsedSchema {
  const parsed = parser.parse(xsdContent)
  // preserveOrder returns an array; find the schema element
  const schemaNode = parsed.find((node: any) => {
    const tag = nodeTag(node)
    return tag === 'xsd:schema' || tag === 'xs:schema' || tag === 'schema'
  })

  if (!schemaNode) {
    throw new Error(`No schema element found in ${filename}`)
  }

  const targetNamespace = attr(schemaNode, 'targetNamespace') || ''
  const schemaChildren = nodeChildren(schemaNode)

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
  for (const imp of findByTag(schemaChildren, 'import')) {
    result.imports.push({
      namespace: attr(imp, 'namespace') || '',
      schemaLocation: attr(imp, 'schemaLocation') || '',
    })
  }

  // Process simple types
  for (const st of findByTag(schemaChildren, 'simpleType')) {
    result.simpleTypes.push(parseSimpleType(st))
  }

  // Process complex types
  for (const ct of findByTag(schemaChildren, 'complexType')) {
    result.complexTypes.push(parseComplexType(ct))
  }

  // Process elements
  for (const el of findByTag(schemaChildren, 'element')) {
    result.elements.push(parseElement(el))
  }

  // Process groups
  for (const gr of findByTag(schemaChildren, 'group')) {
    result.groups.push(parseGroup(gr))
  }

  // Process attribute groups
  for (const ag of findByTag(schemaChildren, 'attributeGroup')) {
    result.attributeGroups.push(parseAttributeGroup(ag))
  }

  return result
}

function parseSimpleType(stNode: any): ParsedSimpleType {
  const name = attr(stNode, 'name') || ''
  const children = nodeChildren(stNode)
  const restriction = findFirstByTag(children, 'restriction')
  const union = findFirstByTag(children, 'union')
  const list = findFirstByTag(children, 'list')

  const result: ParsedSimpleType = { name }

  if (restriction) {
    result.restriction = {
      base: attr(restriction, 'base') || 'xsd:string',
      facets: extractFacets(restriction),
    }
  } else if (union) {
    const memberTypes = attr(union, 'memberTypes')
    result.union = {
      memberTypes: memberTypes ? memberTypes.split(/\s+/) : [],
    }
  } else if (list) {
    result.list = {
      itemType: attr(list, 'itemType') || '',
    }
  }

  return result
}

function extractFacets(restrictionNode: any): ParsedFacet[] {
  const facets: ParsedFacet[] = []
  const children = nodeChildren(restrictionNode)
  const facetTypes = [
    'enumeration', 'pattern', 'minLength', 'maxLength', 'length',
    'minInclusive', 'maxInclusive', 'minExclusive', 'maxExclusive',
    'totalDigits', 'fractionDigits', 'whiteSpace',
  ]

  for (const facetType of facetTypes) {
    for (const facetNode of findByTag(children, facetType)) {
      facets.push({
        type: facetType,
        value: attr(facetNode, 'value') || '',
        fixed: attr(facetNode, 'fixed') === 'true',
      })
    }
  }

  return facets
}

function parseComplexType(ctNode: any): ParsedComplexType {
  const name = attr(ctNode, 'name') || ''
  const mixed = attr(ctNode, 'mixed') === 'true'
  const abstract = attr(ctNode, 'abstract') === 'true'
  const children = nodeChildren(ctNode)

  const result: ParsedComplexType = {
    name,
    mixed,
    abstract,
    attributes: [],
    attributeGroups: [],
  }

  // Extract content model
  const sequence = findFirstByTag(children, 'sequence')
  const choice = findFirstByTag(children, 'choice')
  const all = findFirstByTag(children, 'all')
  const simpleContent = findFirstByTag(children, 'simpleContent')
  const complexContent = findFirstByTag(children, 'complexContent')

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
  for (const attrNode of findByTag(children, 'attribute')) {
    result.attributes.push(parseAttribute(attrNode))
  }

  // Extract attribute groups
  for (const ag of findByTag(children, 'attributeGroup')) {
    const ref = attr(ag, 'ref')
    if (ref) {
      result.attributeGroups.push(ref)
    }
  }

  // Extract anyAttribute
  const anyAttr = findFirstByTag(children, 'anyAttribute')
  if (anyAttr) {
    result.anyAttribute = {
      namespace: attr(anyAttr, 'namespace') || '##any',
      processContents: attr(anyAttr, 'processContents') || 'strict',
    }
  }

  return result
}

/**
 * Parse particles from a compositor node (sequence/choice/all).
 * Iterates children in document order to preserve correct ordering.
 */
function parseParticles(compositorNode: any): ParsedParticle[] {
  const particles: ParsedParticle[] = []
  const children = nodeChildren(compositorNode)

  for (const child of children) {
    const tag = nodeTag(child)

    if (isXsdTag(tag, 'element')) {
      particles.push({
        type: 'element',
        name: attr(child, 'name') || undefined,
        ref: attr(child, 'ref') || undefined,
        elementType: attr(child, 'type') || undefined,
        minOccurs: parseInt(attr(child, 'minOccurs') || '1', 10),
        maxOccurs: attr(child, 'maxOccurs') === 'unbounded' ? 'unbounded' : parseInt(attr(child, 'maxOccurs') || '1', 10),
      })
    } else if (isXsdTag(tag, 'sequence')) {
      particles.push({
        type: 'sequence',
        particles: parseParticles(child),
        minOccurs: parseInt(attr(child, 'minOccurs') || '1', 10),
        maxOccurs: attr(child, 'maxOccurs') === 'unbounded' ? 'unbounded' : parseInt(attr(child, 'maxOccurs') || '1', 10),
      })
    } else if (isXsdTag(tag, 'choice')) {
      particles.push({
        type: 'choice',
        particles: parseParticles(child),
        minOccurs: parseInt(attr(child, 'minOccurs') || '1', 10),
        maxOccurs: attr(child, 'maxOccurs') === 'unbounded' ? 'unbounded' : parseInt(attr(child, 'maxOccurs') || '1', 10),
      })
    } else if (isXsdTag(tag, 'group')) {
      const ref = attr(child, 'ref')
      if (ref) {
        particles.push({
          type: 'group',
          ref,
          minOccurs: parseInt(attr(child, 'minOccurs') || '1', 10),
          maxOccurs: attr(child, 'maxOccurs') === 'unbounded' ? 'unbounded' : parseInt(attr(child, 'maxOccurs') || '1', 10),
        })
      }
    } else if (isXsdTag(tag, 'any')) {
      particles.push({
        type: 'any',
        namespace: attr(child, 'namespace') || '##any',
        processContents: attr(child, 'processContents') || 'strict',
        minOccurs: parseInt(attr(child, 'minOccurs') || '1', 10),
        maxOccurs: attr(child, 'maxOccurs') === 'unbounded' ? 'unbounded' : parseInt(attr(child, 'maxOccurs') || '1', 10),
      })
    }
  }

  return particles
}

function parseElement(elNode: any): ParsedElement {
  return {
    name: attr(elNode, 'name') || '',
    ref: attr(elNode, 'ref') || undefined,
    type: attr(elNode, 'type') || undefined,
    minOccurs: parseInt(attr(elNode, 'minOccurs') || '1', 10),
    maxOccurs: attr(elNode, 'maxOccurs') === 'unbounded' ? 'unbounded' : parseInt(attr(elNode, 'maxOccurs') || '1', 10),
    default: attr(elNode, 'default'),
    fixed: attr(elNode, 'fixed'),
    nillable: attr(elNode, 'nillable') === 'true',
  }
}

function parseAttribute(attrNode: any): ParsedAttribute {
  return {
    name: attr(attrNode, 'name') || '',
    ref: attr(attrNode, 'ref') || undefined,
    type: attr(attrNode, 'type') || 'xsd:string',
    use: (attr(attrNode, 'use') as 'required' | 'optional' | 'prohibited') || 'optional',
    default: attr(attrNode, 'default'),
    fixed: attr(attrNode, 'fixed'),
  }
}

function parseGroup(grNode: any): ParsedGroup {
  const name = attr(grNode, 'name') || ''
  const children = nodeChildren(grNode)
  const sequence = findFirstByTag(children, 'sequence')
  const choice = findFirstByTag(children, 'choice')

  const result: ParsedGroup = { name }

  if (sequence) {
    result.content = { type: 'sequence', particles: parseParticles(sequence) }
  } else if (choice) {
    result.content = { type: 'choice', particles: parseParticles(choice) }
  }

  return result
}

function parseAttributeGroup(agNode: any): ParsedAttributeGroup {
  const name = attr(agNode, 'name') || ''
  const children = nodeChildren(agNode)
  const result: ParsedAttributeGroup = {
    name,
    attributes: [],
    attributeGroups: [],
  }

  for (const attrNode of findByTag(children, 'attribute')) {
    result.attributes.push(parseAttribute(attrNode))
  }

  for (const ref of findByTag(children, 'attributeGroup')) {
    const refName = attr(ref, 'ref')
    if (refName) {
      result.attributeGroups.push(refName)
    }
  }

  return result
}

function parseSimpleContent(scNode: any): ParsedSimpleContent {
  const children = nodeChildren(scNode)
  const extension = findFirstByTag(children, 'extension')
  const restriction = findFirstByTag(children, 'restriction')

  if (extension) {
    const extChildren = nodeChildren(extension)
    const attrs = findByTag(extChildren, 'attribute')
    return {
      type: 'extension',
      base: attr(extension, 'base') || '',
      attributes: attrs.map(parseAttribute),
    }
  }

  if (restriction) {
    const restChildren = nodeChildren(restriction)
    const attrs = findByTag(restChildren, 'attribute')
    return {
      type: 'restriction',
      base: attr(restriction, 'base') || '',
      attributes: attrs.map(parseAttribute),
      facets: extractFacets(restriction),
    }
  }

  return { type: 'extension', base: '', attributes: [] }
}

function parseComplexContent(ccNode: any): ParsedComplexContent {
  const children = nodeChildren(ccNode)
  const extension = findFirstByTag(children, 'extension')
  const restriction = findFirstByTag(children, 'restriction')
  const source = extension || restriction

  if (!source) {
    return { type: 'extension', base: '', attributes: [], attributeGroups: [] }
  }

  const sourceChildren = nodeChildren(source)
  const sequence = findFirstByTag(sourceChildren, 'sequence')
  const choice = findFirstByTag(sourceChildren, 'choice')
  const attrs = findByTag(sourceChildren, 'attribute')
  const attrGroups = findByTag(sourceChildren, 'attributeGroup')

  return {
    type: extension ? 'extension' : 'restriction',
    base: attr(source, 'base') || '',
    content: sequence
      ? { type: 'sequence', particles: parseParticles(sequence) }
      : choice
        ? { type: 'choice', particles: parseParticles(choice) }
        : undefined,
    attributes: attrs.map(parseAttribute),
    attributeGroups: attrGroups.filter((ref: any) => attr(ref, 'ref')).map((ref: any) => attr(ref, 'ref')!),
  }
}

// ============================================================================
// TypeScript Code Generation (unchanged from original)
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

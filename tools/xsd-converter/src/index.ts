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

/**
 * Convert XSD schema to our runtime format
 */
export function convertXsd(xsdContent: string, filename: string): ConvertedSchema {
  const parsed = parser.parse(xsdContent)
  const schema = parsed['xsd:schema'] || parsed['xs:schema'] || parsed.schema

  if (!schema) {
    throw new Error(`No schema element found in ${filename}`)
  }

  const targetNamespace = schema['@_targetNamespace'] || ''
  const result: ConvertedSchema = {
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
    result.simpleTypes.push(convertSimpleType(st))
  }

  // Process complex types
  const complexTypes = ensureArray(schema['xsd:complexType'] || schema['xs:complexType'] || [])
  for (const ct of complexTypes) {
    result.complexTypes.push(convertComplexType(ct))
  }

  // Process elements
  const elements = ensureArray(schema['xsd:element'] || schema['xs:element'] || [])
  for (const el of elements) {
    result.elements.push(convertElement(el))
  }

  // Process groups
  const groups = ensureArray(schema['xsd:group'] || schema['xs:group'] || [])
  for (const gr of groups) {
    result.groups.push(convertGroup(gr))
  }

  // Process attribute groups
  const attrGroups = ensureArray(schema['xsd:attributeGroup'] || schema['xs:attributeGroup'] || [])
  for (const ag of attrGroups) {
    result.attributeGroups.push(convertAttributeGroup(ag))
  }

  return result
}

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function convertSimpleType(st: any): SimpleTypeSchema {
  const name = st['@_name'] || ''
  const restriction = st['xsd:restriction'] || st['xs:restriction']
  const union = st['xsd:union'] || st['xs:union']
  const list = st['xsd:list'] || st['xs:list']

  const result: SimpleTypeSchema = { name }

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

function extractFacets(restriction: any): FacetSchema[] {
  const facets: FacetSchema[] = []
  const facetTypes = [
    'enumeration',
    'pattern',
    'minLength',
    'maxLength',
    'length',
    'minInclusive',
    'maxInclusive',
    'minExclusive',
    'maxExclusive',
    'totalDigits',
    'fractionDigits',
    'whiteSpace',
  ]

  for (const facetType of facetTypes) {
    const xsdFacet = restriction[`xsd:${facetType}`] || restriction[`xs:${facetType}`]
    if (xsdFacet) {
      const values = ensureArray(xsdFacet)
      for (const v of values) {
        facets.push({
          type: facetType as FacetSchema['type'],
          value: v['@_value'] || '',
          fixed: v['@_fixed'] === 'true',
        })
      }
    }
  }

  return facets
}

function convertComplexType(ct: any): ComplexTypeSchema {
  const name = ct['@_name'] || ''
  const mixed = ct['@_mixed'] === 'true'
  const abstract = ct['@_abstract'] === 'true'

  const result: ComplexTypeSchema = {
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
    result.content = { type: 'sequence', particles: convertParticles(sequence) }
  } else if (choice) {
    result.content = { type: 'choice', particles: convertParticles(choice) }
  } else if (all) {
    result.content = { type: 'all', particles: convertParticles(all) }
  } else if (simpleContent) {
    result.simpleContent = convertSimpleContent(simpleContent)
  } else if (complexContent) {
    result.complexContent = convertComplexContent(complexContent)
  }

  // Extract attributes
  const attrs = ensureArray(ct['xsd:attribute'] || ct['xs:attribute'] || [])
  for (const attr of attrs) {
    result.attributes.push(convertAttribute(attr))
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

function convertParticles(container: any): ParticleSchema[] {
  const particles: ParticleSchema[] = []

  // Elements
  const elements = ensureArray(container['xsd:element'] || container['xs:element'] || [])
  for (const el of elements) {
    const element = convertElement(el)
    particles.push({
      ...element,
      type: 'element' as const,
      minOccurs: parseInt(el['@_minOccurs'] || '1', 10),
      maxOccurs: el['@_maxOccurs'] === 'unbounded' ? -1 : parseInt(el['@_maxOccurs'] || '1', 10),
    })
  }

  // Nested sequences
  const sequences = ensureArray(container['xsd:sequence'] || container['xs:sequence'] || [])
  for (const seq of sequences) {
    particles.push({
      type: 'sequence',
      particles: convertParticles(seq),
      minOccurs: parseInt(seq['@_minOccurs'] || '1', 10),
      maxOccurs: seq['@_maxOccurs'] === 'unbounded' ? -1 : parseInt(seq['@_maxOccurs'] || '1', 10),
    })
  }

  // Nested choices
  const choices = ensureArray(container['xsd:choice'] || container['xs:choice'] || [])
  for (const ch of choices) {
    particles.push({
      type: 'choice',
      particles: convertParticles(ch),
      minOccurs: parseInt(ch['@_minOccurs'] || '1', 10),
      maxOccurs: ch['@_maxOccurs'] === 'unbounded' ? -1 : parseInt(ch['@_maxOccurs'] || '1', 10),
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
        maxOccurs: gr['@_maxOccurs'] === 'unbounded' ? -1 : parseInt(gr['@_maxOccurs'] || '1', 10),
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
      maxOccurs: any['@_maxOccurs'] === 'unbounded' ? -1 : parseInt(any['@_maxOccurs'] || '1', 10),
    })
  }

  return particles
}

function convertElement(el: any): ElementSchema {
  return {
    name: el['@_name'] || '',
    ref: el['@_ref'] || undefined,
    type: el['@_type'] || undefined,
    minOccurs: parseInt(el['@_minOccurs'] || '1', 10),
    maxOccurs: el['@_maxOccurs'] === 'unbounded' ? -1 : parseInt(el['@_maxOccurs'] || '1', 10),
    default: el['@_default'],
    fixed: el['@_fixed'],
    nillable: el['@_nillable'] === 'true',
  }
}

function convertAttribute(attr: any): AttributeSchema {
  return {
    name: attr['@_name'] || '',
    ref: attr['@_ref'] || undefined,
    type: attr['@_type'] || 'xsd:string',
    use: (attr['@_use'] as 'required' | 'optional' | 'prohibited') || 'optional',
    default: attr['@_default'],
    fixed: attr['@_fixed'],
  }
}

function convertGroup(gr: any): GroupSchema {
  const name = gr['@_name'] || ''
  const sequence = gr['xsd:sequence'] || gr['xs:sequence']
  const choice = gr['xsd:choice'] || gr['xs:choice']

  const result: GroupSchema = { name }

  if (sequence) {
    result.content = { type: 'sequence', particles: convertParticles(sequence) }
  } else if (choice) {
    result.content = { type: 'choice', particles: convertParticles(choice) }
  }

  return result
}

function convertAttributeGroup(ag: any): AttributeGroupSchema {
  const name = ag['@_name'] || ''
  const result: AttributeGroupSchema = {
    name,
    attributes: [],
    attributeGroups: [],
  }

  const attrs = ensureArray(ag['xsd:attribute'] || ag['xs:attribute'] || [])
  for (const attr of attrs) {
    result.attributes.push(convertAttribute(attr))
  }

  const attrGroups = ensureArray(ag['xsd:attributeGroup'] || ag['xs:attributeGroup'] || [])
  for (const ref of attrGroups) {
    if (ref['@_ref']) {
      result.attributeGroups.push(ref['@_ref'])
    }
  }

  return result
}

function convertSimpleContent(sc: any): SimpleContentSchema {
  const extension = sc['xsd:extension'] || sc['xs:extension']
  const restriction = sc['xsd:restriction'] || sc['xs:restriction']

  if (extension) {
    const attrs = ensureArray(extension['xsd:attribute'] || extension['xs:attribute'] || [])
    const result: SimpleContentSchema = {
      type: 'extension',
      base: extension['@_base'] || '',
      attributes: attrs.map(convertAttribute),
    }
    return result
  }

  if (restriction) {
    return {
      type: 'restriction',
      base: restriction['@_base'] || '',
      facets: extractFacets(restriction),
    }
  }

  return { type: 'extension', base: '', attributes: [] }
}

function convertComplexContent(cc: any): ComplexContentSchema {
  const extension = cc['xsd:extension'] || cc['xs:extension']
  const restriction = cc['xsd:restriction'] || cc['xs:restriction']
  const source = extension || restriction

  if (!source) {
    return { type: 'extension', base: '' }
  }

  // Extract content model
  const sequence = source['xsd:sequence'] || source['xs:sequence']
  const choice = source['xsd:choice'] || source['xs:choice']

  // Extract attributes
  const attrs = ensureArray(source['xsd:attribute'] || source['xs:attribute'] || [])
  const attrGroups = ensureArray(source['xsd:attributeGroup'] || source['xs:attributeGroup'] || [])

  const result: ComplexContentSchema = {
    type: extension ? 'extension' : 'restriction',
    base: source['@_base'] || '',
    content: sequence
      ? { type: 'sequence', particles: convertParticles(sequence) }
      : choice
        ? { type: 'choice', particles: convertParticles(choice) }
        : undefined,
    attributes: attrs.map(convertAttribute),
    attributeGroups: attrGroups.filter((ref) => ref['@_ref']).map((ref) => ref['@_ref']),
  }

  return result
}

// Type definitions for converted schema
interface ConvertedSchema {
  targetNamespace: string
  imports: { namespace: string; schemaLocation: string }[]
  simpleTypes: SimpleTypeSchema[]
  complexTypes: ComplexTypeSchema[]
  elements: ElementSchema[]
  groups: GroupSchema[]
  attributeGroups: AttributeGroupSchema[]
}

interface SimpleTypeSchema {
  name: string
  restriction?: {
    base: string
    facets: FacetSchema[]
  }
  union?: {
    memberTypes: string[]
  }
  list?: {
    itemType: string
  }
}

interface FacetSchema {
  type:
    | 'enumeration'
    | 'pattern'
    | 'minLength'
    | 'maxLength'
    | 'length'
    | 'minInclusive'
    | 'maxInclusive'
    | 'minExclusive'
    | 'maxExclusive'
    | 'totalDigits'
    | 'fractionDigits'
    | 'whiteSpace'
  value: string
  fixed?: boolean
}

interface ComplexTypeSchema {
  name: string
  mixed: boolean
  abstract: boolean
  content?: ContentSchema
  simpleContent?: SimpleContentSchema
  complexContent?: ComplexContentSchema
  attributes: AttributeSchema[]
  attributeGroups: string[]
  anyAttribute?: {
    namespace: string
    processContents: string
  }
}

interface ContentSchema {
  type: 'sequence' | 'choice' | 'all'
  particles: ParticleSchema[]
}

interface ParticleSchema {
  type: 'element' | 'sequence' | 'choice' | 'group' | 'any'
  name?: string
  ref?: string
  particles?: ParticleSchema[]
  namespace?: string
  processContents?: string
  minOccurs: number
  maxOccurs: number
  [key: string]: any
}

interface ElementSchema {
  name: string
  ref?: string
  type?: string
  minOccurs: number
  maxOccurs: number
  default?: string
  fixed?: string
  nillable?: boolean
}

interface AttributeSchema {
  name: string
  ref?: string
  type: string
  use: 'required' | 'optional' | 'prohibited'
  default?: string
  fixed?: string
}

interface GroupSchema {
  name: string
  content?: ContentSchema
}

interface AttributeGroupSchema {
  name: string
  attributes: AttributeSchema[]
  attributeGroups: string[]
}

interface SimpleContentSchema {
  type: 'extension' | 'restriction'
  base: string
  attributes?: AttributeSchema[]
  facets?: FacetSchema[]
}

interface ComplexContentSchema {
  type: 'extension' | 'restriction'
  base: string
  content?: ContentSchema
  attributes?: AttributeSchema[]
  attributeGroups?: string[]
}

/**
 * Generate TypeScript file from converted schema
 */
function generateTypeScript(schema: ConvertedSchema, filename: string): string {
  const lines: string[] = []

  lines.push('/**')
  lines.push(` * Auto-generated from ${filename}`)
  lines.push(' * DO NOT EDIT - Generated by xsd-converter')
  lines.push(' */')
  lines.push('')
  lines.push("import type { XsdSchema, XsdSimpleType, XsdComplexType, XsdElement, XsdGroup, XsdAttributeGroup } from '../types'")
  lines.push('')

  const varName = camelCase(basename(filename, '.xsd'))

  lines.push(`export const ${varName}Schema: XsdSchema = ${JSON.stringify(convertToRuntimeSchema(schema), null, 2)}`)
  lines.push('')
  lines.push(`export default ${varName}Schema`)

  return lines.join('\n')
}

/**
 * Convert parsed schema to runtime format compatible with @ooxml/core types
 */
function convertToRuntimeSchema(schema: ConvertedSchema): any {
  return {
    targetNamespace: schema.targetNamespace,
    imports: schema.imports,
    simpleTypes: schema.simpleTypes.map(convertSimpleTypeToRuntime),
    complexTypes: schema.complexTypes.map(convertComplexTypeToRuntime),
    elements: schema.elements.map(convertElementToRuntime),
    groups: schema.groups.map(convertGroupToRuntime),
    attributeGroups: schema.attributeGroups.map(convertAttributeGroupToRuntime),
  }
}

function convertSimpleTypeToRuntime(st: SimpleTypeSchema): any {
  const result: any = { name: st.name }

  if (st.restriction) {
    result.content = {
      kind: 'restriction',
      base: parseTypeReference(st.restriction.base),
      facets: st.restriction.facets.map((f) => ({
        kind: f.type,
        value: f.value,
        fixed: f.fixed,
      })),
    }
  } else if (st.union) {
    result.content = {
      kind: 'union',
      memberTypes: st.union.memberTypes.map(parseTypeReference),
    }
  } else if (st.list) {
    result.content = {
      kind: 'list',
      itemType: parseTypeReference(st.list.itemType),
    }
  }

  return result
}

function convertComplexTypeToRuntime(ct: ComplexTypeSchema): any {
  const result: any = {
    name: ct.name,
    mixed: ct.mixed,
    abstract: ct.abstract,
    attributes: ct.attributes.map(convertAttributeToRuntime),
    attributeGroupRefs: ct.attributeGroups.map(parseTypeReference),
  }

  if (ct.content) {
    result.content = {
      kind: ct.content.type === 'sequence' ? 'elementOnly' : ct.content.type === 'choice' ? 'elementOnly' : 'elementOnly',
      compositor: convertContentToRuntime(ct.content),
    }
  } else if (ct.simpleContent) {
    result.content = {
      kind: 'simpleContent',
      derivation: ct.simpleContent.type,
      base: parseTypeReference(ct.simpleContent.base),
      attributes: ct.simpleContent.attributes?.map(convertAttributeToRuntime) || [],
    }
  } else if (ct.complexContent) {
    result.content = {
      kind: 'complexContent',
      derivation: ct.complexContent.type,
      base: parseTypeReference(ct.complexContent.base),
      compositor: ct.complexContent.content ? convertContentToRuntime(ct.complexContent.content) : undefined,
      attributes: ct.complexContent.attributes?.map(convertAttributeToRuntime) || [],
      attributeGroupRefs: ct.complexContent.attributeGroups?.map(parseTypeReference) || [],
    }
  } else {
    result.content = { kind: 'empty' }
  }

  if (ct.anyAttribute) {
    result.anyAttribute = ct.anyAttribute
  }

  return result
}

function convertContentToRuntime(content: ContentSchema): any {
  return {
    kind: content.type,
    particles: content.particles.map(convertParticleToRuntime),
    minOccurs: 1,
    maxOccurs: 1,
  }
}

function convertParticleToRuntime(p: ParticleSchema): any {
  if (p.type === 'element') {
    return {
      kind: 'element',
      name: p.name,
      ref: p.ref ? parseTypeReference(p.ref) : undefined,
      type: p.type ? parseTypeReference(p.type) : undefined,
      minOccurs: p.minOccurs,
      maxOccurs: p.maxOccurs === -1 ? 'unbounded' : p.maxOccurs,
    }
  } else if (p.type === 'sequence' || p.type === 'choice') {
    return {
      kind: p.type,
      particles: p.particles?.map(convertParticleToRuntime) || [],
      minOccurs: p.minOccurs,
      maxOccurs: p.maxOccurs === -1 ? 'unbounded' : p.maxOccurs,
    }
  } else if (p.type === 'group') {
    return {
      kind: 'group',
      ref: parseTypeReference(p.ref!),
      minOccurs: p.minOccurs,
      maxOccurs: p.maxOccurs === -1 ? 'unbounded' : p.maxOccurs,
    }
  } else if (p.type === 'any') {
    return {
      kind: 'any',
      namespace: p.namespace,
      processContents: p.processContents,
      minOccurs: p.minOccurs,
      maxOccurs: p.maxOccurs === -1 ? 'unbounded' : p.maxOccurs,
    }
  }

  return p
}

function convertElementToRuntime(el: ElementSchema): any {
  return {
    name: el.name,
    type: el.type ? parseTypeReference(el.type) : undefined,
    minOccurs: el.minOccurs,
    maxOccurs: el.maxOccurs === -1 ? 'unbounded' : el.maxOccurs,
    default: el.default,
    fixed: el.fixed,
    nillable: el.nillable,
  }
}

function convertAttributeToRuntime(attr: AttributeSchema): any {
  return {
    name: attr.name,
    ref: attr.ref ? parseTypeReference(attr.ref) : undefined,
    type: parseTypeReference(attr.type),
    use: attr.use,
    default: attr.default,
    fixed: attr.fixed,
  }
}

function convertGroupToRuntime(gr: GroupSchema): any {
  return {
    name: gr.name,
    compositor: gr.content ? convertContentToRuntime(gr.content) : undefined,
  }
}

function convertAttributeGroupToRuntime(ag: AttributeGroupSchema): any {
  return {
    name: ag.name,
    attributes: ag.attributes.map(convertAttributeToRuntime),
    attributeGroupRefs: ag.attributeGroups.map(parseTypeReference),
  }
}

function parseTypeReference(typeStr: string): any {
  if (!typeStr) return { kind: 'builtin', name: 'string' }

  const [prefix, localName] = typeStr.includes(':') ? typeStr.split(':') : ['', typeStr]

  // XSD built-in types
  if (prefix === 'xsd' || prefix === 'xs') {
    return { kind: 'builtin', name: localName }
  }

  // Local type reference
  if (!prefix) {
    return { kind: 'local', name: localName }
  }

  // External type reference
  return { kind: 'external', prefix, name: localName }
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

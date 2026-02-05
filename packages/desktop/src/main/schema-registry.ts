import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import type { SchemaElementInfo, SchemaRegistry, TypeReference, XsdElement, XsdSchema, XsdNamespace } from '@ooxml/core'
import { SchemaRegistryBuilderImpl, findSchemaElementInfo } from '@ooxml/core'
import { xmlToJson, type JsonElement } from '@ooxml/parser'

let registryPromise: Promise<SchemaRegistry> | null = null

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function parseTypeReference(qname: string | undefined): TypeReference | undefined {
  if (!qname) return undefined
  const [prefix, name] = qname.includes(':') ? qname.split(':') : [undefined, qname]
  const isBuiltin = prefix === 'xsd' || prefix === 'xs'
  return {
    namespacePrefix: isBuiltin ? undefined : prefix,
    name,
    isBuiltin,
  }
}

function parseOccurs(value: string | undefined, defaultValue: number): number | 'unbounded' {
  if (!value) return defaultValue
  if (value === 'unbounded') return 'unbounded'
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? defaultValue : parsed
}

function parseNamespaces(schema: JsonElement): XsdNamespace[] {
  const namespaces: XsdNamespace[] = []
  for (const [key, value] of Object.entries(schema.attributes)) {
    if (key === 'xmlns') {
      namespaces.push({ prefix: '', uri: value })
      continue
    }
    if (key.startsWith('xmlns:')) {
      namespaces.push({ prefix: key.replace('xmlns:', ''), uri: value })
    }
  }
  return namespaces
}

function parseElements(schema: JsonElement): Map<string, XsdElement> {
  const elements = new Map<string, XsdElement>()
  const rawElements = ensureArray(schema.children.filter((child) => child.name === 'element'))

  for (const element of rawElements) {
    const name = element.attributes.name
    const ref = element.attributes.ref
    const type = element.attributes.type
    const minOccurs = parseOccurs(element.attributes.minOccurs, 1)
    const maxOccurs = parseOccurs(element.attributes.maxOccurs, 1)

    const entry: XsdElement = {
      kind: 'element',
      name,
      ref: parseTypeReference(ref),
      typeRef: parseTypeReference(type),
      occurs: {
        minOccurs: typeof minOccurs === 'number' ? minOccurs : 0,
        maxOccurs,
      },
      nillable: element.attributes.nillable === 'true',
      abstract: element.attributes.abstract === 'true',
    }

    if (name) {
      elements.set(name, entry)
    }
  }

  return elements
}

function parseSchemaFile(filePath: string): XsdSchema {
  const xml = readFileSync(filePath, 'utf-8')
  const schema = xmlToJson(xml)
  if (!schema || schema.name !== 'schema') {
    throw new Error(`스키마를 찾을 수 없습니다: ${filePath}`)
  }

  const namespaces = parseNamespaces(schema)
  const targetNamespace = schema.attributes.targetNamespace ?? ''

  return {
    targetNamespace,
    namespaces,
    elementFormDefault: schema.attributes.elementFormDefault ?? 'unqualified',
    attributeFormDefault: schema.attributes.attributeFormDefault ?? 'unqualified',
    blockDefault: undefined,
    finalDefault: undefined,
    imports: [],
    includes: [],
    redefines: [],
    simpleTypes: new Map(),
    complexTypes: new Map(),
    elements: parseElements(schema),
    attributes: new Map(),
    groups: new Map(),
    attributeGroups: new Map(),
  }
}

async function buildSchemaRegistry(): Promise<SchemaRegistry> {
  const builder = new SchemaRegistryBuilderImpl()
  const schemasDir = join(process.cwd(), 'schemas')
  const files = readdirSync(schemasDir)

  for (const file of files) {
    if (!file.endsWith('.xsd')) continue
    const schema = parseSchemaFile(join(schemasDir, file))
    builder.addSchema(schema)
  }

  return builder.build()
}

export async function getSchemaRegistry(): Promise<SchemaRegistry> {
  if (!registryPromise) {
    registryPromise = buildSchemaRegistry()
  }
  return registryPromise
}

export async function lookupSchemaElement(
  elementName: string,
  namespaceUri?: string,
): Promise<SchemaElementInfo | null> {
  const registry = await getSchemaRegistry()
  return findSchemaElementInfo(registry, elementName, namespaceUri)
}

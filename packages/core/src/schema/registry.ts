import type {
  SchemaRegistry,
  SchemaRegistryBuilder,
  XsdComplexType,
  XsdSchema,
  XsdSimpleType,
  XsdParser,
  XsdElement,
  XsdGroup,
  XsdAttributeGroup,
} from '../types'
import { normalizeNamespace } from '../runtime'

export class SchemaRegistryImpl implements SchemaRegistry {
  private _schemaPrefixMap?: Map<string, string>

  constructor(public schemas: Map<string, XsdSchema>) {}

  /** Resolve a namespace prefix from schema namespace declarations */
  resolveSchemaPrefix(prefix: string): string | undefined {
    if (!this._schemaPrefixMap) {
      this._schemaPrefixMap = new Map()
      for (const schema of this.schemas.values()) {
        for (const ns of schema.namespaces) {
          if (ns.prefix && !this._schemaPrefixMap.has(ns.prefix)) {
            this._schemaPrefixMap.set(ns.prefix, ns.uri)
          }
        }
      }
    }
    return this._schemaPrefixMap.get(prefix)
  }

  resolveType(namespaceUri: string, typeName: string): XsdComplexType | XsdSimpleType | undefined {
    // Normalize namespace to handle Transitional -> Strict mapping
    const normalizedNs = normalizeNamespace(namespaceUri)
    const schema = this.schemas.get(normalizedNs)
    if (!schema) {
      return undefined
    }
    return schema.simpleTypes.get(typeName) ?? schema.complexTypes.get(typeName)
  }

  resolveElement(namespaceUri: string, elementName: string): XsdElement | undefined {
    const normalizedNs = normalizeNamespace(namespaceUri)
    const schema = this.schemas.get(normalizedNs)
    return schema?.elements.get(elementName)
  }

  resolveGroup(namespaceUri: string, groupName: string): XsdGroup | undefined {
    const normalizedNs = normalizeNamespace(namespaceUri)
    const schema = this.schemas.get(normalizedNs)
    return schema?.groups.get(groupName)
  }

  resolveAttributeGroup(namespaceUri: string, groupName: string): XsdAttributeGroup | undefined {
    const normalizedNs = normalizeNamespace(namespaceUri)
    const schema = this.schemas.get(normalizedNs)
    return schema?.attributeGroups.get(groupName)
  }
}

export class SchemaRegistryBuilderImpl implements SchemaRegistryBuilder {
  private schemas = new Map<string, XsdSchema>()

  constructor(private parser?: XsdParser) {}

  addSchema(schema: XsdSchema): void {
    const namespaceUri = schema.targetNamespace ?? ''
    this.schemas.set(namespaceUri, schema)
  }

  async addSchemaFromFile(filePath: string): Promise<void> {
    if (!this.parser) {
      throw new Error('XsdParser가 등록되지 않았습니다.')
    }
    const schema = await this.parser.parseFile(filePath)
    this.addSchema(schema)
  }

  async resolveReferences(): Promise<void> {
    // TODO: import/include/redefine 처리 로직은 파서 구현에 위임
  }

  build(): SchemaRegistry {
    return new SchemaRegistryImpl(this.schemas)
  }
}

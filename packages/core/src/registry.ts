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
} from './types';

export class SchemaRegistryImpl implements SchemaRegistry {
  constructor(public schemas: Map<string, XsdSchema>) {}

  resolveType(namespaceUri: string, typeName: string): XsdComplexType | XsdSimpleType | undefined {
    const schema = this.schemas.get(namespaceUri);
    if (!schema) {
      return undefined;
    }
    return schema.simpleTypes.get(typeName) ?? schema.complexTypes.get(typeName);
  }

  resolveElement(namespaceUri: string, elementName: string): XsdElement | undefined {
    const schema = this.schemas.get(namespaceUri);
    return schema?.elements.get(elementName);
  }

  resolveGroup(namespaceUri: string, groupName: string): XsdGroup | undefined {
    const schema = this.schemas.get(namespaceUri);
    return schema?.groups.get(groupName);
  }

  resolveAttributeGroup(namespaceUri: string, groupName: string): XsdAttributeGroup | undefined {
    const schema = this.schemas.get(namespaceUri);
    return schema?.attributeGroups.get(groupName);
  }
}

export class SchemaRegistryBuilderImpl implements SchemaRegistryBuilder {
  private schemas = new Map<string, XsdSchema>();

  constructor(private parser?: XsdParser) {}

  addSchema(schema: XsdSchema): void {
    const namespaceUri = schema.targetNamespace ?? '';
    this.schemas.set(namespaceUri, schema);
  }

  async addSchemaFromFile(filePath: string): Promise<void> {
    if (!this.parser) {
      throw new Error('XsdParser가 등록되지 않았습니다.');
    }
    const schema = await this.parser.parseFile(filePath);
    this.addSchema(schema);
  }

  async resolveReferences(): Promise<void> {
    // TODO: import/include/redefine 처리 로직은 파서 구현에 위임
  }

  build(): SchemaRegistry {
    return new SchemaRegistryImpl(this.schemas);
  }
}

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

/**
 * Namespace mapping: Transitional (used in most Office files) -> Strict (used in XSD schemas)
 */
const TRANSITIONAL_TO_STRICT_NS: Record<string, string> = {
  // SpreadsheetML
  'http://schemas.openxmlformats.org/spreadsheetml/2006/main': 'http://purl.oclc.org/ooxml/spreadsheetml/main',
  // WordprocessingML
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main': 'http://purl.oclc.org/ooxml/wordprocessingml/main',
  // PresentationML
  'http://schemas.openxmlformats.org/presentationml/2006/main': 'http://purl.oclc.org/ooxml/presentationml/main',
  // DrawingML
  'http://schemas.openxmlformats.org/drawingml/2006/main': 'http://purl.oclc.org/ooxml/drawingml/main',
  'http://schemas.openxmlformats.org/drawingml/2006/chart': 'http://purl.oclc.org/ooxml/drawingml/chart',
  'http://schemas.openxmlformats.org/drawingml/2006/chartDrawing': 'http://purl.oclc.org/ooxml/drawingml/chartDrawing',
  'http://schemas.openxmlformats.org/drawingml/2006/diagram': 'http://purl.oclc.org/ooxml/drawingml/diagram',
  'http://schemas.openxmlformats.org/drawingml/2006/picture': 'http://purl.oclc.org/ooxml/drawingml/picture',
  'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing': 'http://purl.oclc.org/ooxml/drawingml/spreadsheetDrawing',
  'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing': 'http://purl.oclc.org/ooxml/drawingml/wordprocessingDrawing',
  'http://schemas.openxmlformats.org/drawingml/2006/lockedCanvas': 'http://purl.oclc.org/ooxml/drawingml/lockedCanvas',
  // Office Document
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships': 'http://purl.oclc.org/ooxml/officeDocument/relationships',
  'http://schemas.openxmlformats.org/officeDocument/2006/sharedTypes': 'http://purl.oclc.org/ooxml/officeDocument/sharedTypes',
  'http://schemas.openxmlformats.org/officeDocument/2006/math': 'http://purl.oclc.org/ooxml/officeDocument/math',
  'http://schemas.openxmlformats.org/officeDocument/2006/bibliography': 'http://purl.oclc.org/ooxml/officeDocument/bibliography',
  'http://schemas.openxmlformats.org/officeDocument/2006/characteristics': 'http://purl.oclc.org/ooxml/officeDocument/characteristics',
  'http://schemas.openxmlformats.org/officeDocument/2006/custom-properties': 'http://purl.oclc.org/ooxml/officeDocument/custom-properties',
  'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties': 'http://purl.oclc.org/ooxml/officeDocument/extended-properties',
  'http://schemas.openxmlformats.org/officeDocument/2006/customXml': 'http://purl.oclc.org/ooxml/officeDocument/customXml',
  'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes': 'http://purl.oclc.org/ooxml/officeDocument/docPropsVTypes',
};

/**
 * Normalize namespace URI: Convert Transitional to Strict if applicable
 */
function normalizeNamespace(namespaceUri: string): string {
  return TRANSITIONAL_TO_STRICT_NS[namespaceUri] || namespaceUri;
}

export class SchemaRegistryImpl implements SchemaRegistry {
  constructor(public schemas: Map<string, XsdSchema>) {}

  resolveType(namespaceUri: string, typeName: string): XsdComplexType | XsdSimpleType | undefined {
    // Normalize namespace to handle Transitional -> Strict mapping
    const normalizedNs = normalizeNamespace(namespaceUri);
    const schema = this.schemas.get(normalizedNs);
    if (!schema) {
      return undefined;
    }
    return schema.simpleTypes.get(typeName) ?? schema.complexTypes.get(typeName);
  }

  resolveElement(namespaceUri: string, elementName: string): XsdElement | undefined {
    const normalizedNs = normalizeNamespace(namespaceUri);
    const schema = this.schemas.get(normalizedNs);
    return schema?.elements.get(elementName);
  }

  resolveGroup(namespaceUri: string, groupName: string): XsdGroup | undefined {
    const normalizedNs = normalizeNamespace(namespaceUri);
    const schema = this.schemas.get(normalizedNs);
    return schema?.groups.get(groupName);
  }

  resolveAttributeGroup(namespaceUri: string, groupName: string): XsdAttributeGroup | undefined {
    const normalizedNs = normalizeNamespace(namespaceUri);
    const schema = this.schemas.get(normalizedNs);
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

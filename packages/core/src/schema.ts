import type {
  SchemaRegistry,
  SchemaElementInfo,
  XsdComplexType,
  XsdElement,
  XsdSchema,
  XsdSimpleType,
  TypeReference,
} from './types';

function resolveNamespaceFromSchema(schema: XsdSchema, prefix?: string): string {
  if (!prefix) {
    return schema.targetNamespace ?? '';
  }
  const match = schema.namespaces.find((namespace) => namespace.prefix === prefix);
  return match?.uri ?? '';
}

function resolveTypeReference(
  registry: SchemaRegistry,
  schema: XsdSchema,
  ref: TypeReference,
): { schemaType?: XsdComplexType | XsdSimpleType; typeName?: string; typeNamespaceUri?: string } {
  if (ref.isBuiltin) {
    return {
      typeName: ref.name,
      typeNamespaceUri: 'http://www.w3.org/2001/XMLSchema',
    };
  }

  const typeNamespaceUri = resolveNamespaceFromSchema(schema, ref.namespacePrefix);
  const schemaType = registry.resolveType(typeNamespaceUri, ref.name);
  return {
    schemaType,
    typeName: ref.name,
    typeNamespaceUri,
  };
}

function buildElementInfo(
  registry: SchemaRegistry,
  schema: XsdSchema,
  namespaceUri: string,
  element: XsdElement,
  fallbackName?: string,
): SchemaElementInfo | null {
  if (element.ref) {
    const refNamespaceUri = resolveNamespaceFromSchema(schema, element.ref.namespacePrefix);
    const refSchema = registry.schemas.get(refNamespaceUri);
    const refElement = refSchema?.elements.get(element.ref.name);
    if (!refSchema || !refElement) {
      return null;
    }
    return buildElementInfo(registry, refSchema, refNamespaceUri, refElement, element.ref.name);
  }

  if (element.inlineComplexType) {
    return {
      elementName: element.name ?? fallbackName ?? '',
      namespaceUri,
      element,
      schema,
      schemaType: element.inlineComplexType,
      typeName: element.inlineComplexType.name,
      typeNamespaceUri: namespaceUri,
    };
  }

  if (element.inlineSimpleType) {
    return {
      elementName: element.name ?? fallbackName ?? '',
      namespaceUri,
      element,
      schema,
      schemaType: element.inlineSimpleType,
      typeName: element.inlineSimpleType.name,
      typeNamespaceUri: namespaceUri,
    };
  }

  if (element.typeRef) {
    const resolved = resolveTypeReference(registry, schema, element.typeRef);
    return {
      elementName: element.name ?? fallbackName ?? '',
      namespaceUri,
      element,
      schema,
      schemaType: resolved.schemaType,
      typeName: resolved.typeName,
      typeNamespaceUri: resolved.typeNamespaceUri,
    };
  }

  return {
    elementName: element.name ?? fallbackName ?? '',
    namespaceUri,
    element,
    schema,
  };
}

/**
 * 요소 이름과 네임스페이스로 스키마 정보를 조회합니다.
 * 네임스페이스가 없으면 전체 스키마에서 이름이 유일한 요소만 반환합니다.
 */
export function findSchemaElementInfo(
  registry: SchemaRegistry,
  elementName: string,
  namespaceUri?: string,
): SchemaElementInfo | null {
  if (!elementName) {
    return null;
  }

  if (namespaceUri !== undefined) {
    const schema = registry.schemas.get(namespaceUri);
    const element = schema?.elements.get(elementName);
    if (!schema || !element) {
      return null;
    }
    return buildElementInfo(registry, schema, namespaceUri, element, elementName);
  }

  const matches: Array<{ schema: XsdSchema; namespaceUri: string; element: XsdElement }> = [];
  for (const [schemaNamespace, schema] of registry.schemas.entries()) {
    const element = schema.elements.get(elementName);
    if (element) {
      matches.push({ schema, namespaceUri: schemaNamespace, element });
    }
  }

  if (matches.length !== 1) {
    return null;
  }

  const match = matches[0];
  return buildElementInfo(registry, match.schema, match.namespaceUri, match.element, elementName);
}

import type { SchemaRegistry, XsdComplexType, XsdSimpleType, TypeReference } from '../types'
import type { XmlElementInfo } from '../runtime'
import type { ErrorCallback } from './error-handlers'
import { resolveNamespaceWithFallback } from './namespace-helpers'
import { formatMessage } from '../i18n/format'

export function resolveSchemaElementType(
  schemaElement:
    | {
        typeRef?: TypeReference
        inlineComplexType?: XsdComplexType
        inlineSimpleType?: XsdSimpleType
      }
    | undefined,
  namespaceContext: Map<string, string>,
  element: XmlElementInfo,
  registry: SchemaRegistry,
  onError: ErrorCallback
): XsdComplexType | XsdSimpleType | null {
  if (!schemaElement) {
    onError('INVALID_ELEMENT', formatMessage('TYPE.ELEMENT_NOT_FOUND', element.name))
    return null
  }

  if (schemaElement.inlineComplexType) {
    return schemaElement.inlineComplexType
  }

  if (schemaElement.inlineSimpleType) {
    return schemaElement.inlineSimpleType
  }

  if (schemaElement.typeRef) {
    return resolveTypeReference(schemaElement.typeRef, namespaceContext, registry, onError)
  }

  return null
}

export function resolveTypeReference(
  ref: TypeReference,
  namespaceContext: Map<string, string>,
  registry: SchemaRegistry,
  onError: ErrorCallback
): XsdComplexType | XsdSimpleType | null {
  if (ref.isBuiltin) {
    return {
      kind: 'simpleType',
      name: ref.name,
      content: {
        kind: 'restriction',
        base: ref,
        facets: [],
      },
    } as XsdSimpleType
  }

  const namespaceUri = resolveNamespaceWithFallback(namespaceContext, ref.namespacePrefix, registry)
  const type = registry.resolveType(namespaceUri, ref.name)
  if (!type) {
    onError('UNKNOWN_TYPE', formatMessage('TYPE.TYPE_NOT_FOUND', ref.name))
  }
  return type ?? null
}

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
        substitutionGroup?: TypeReference
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
    return resolveTypeReference(
      schemaElement.typeRef,
      namespaceContext,
      registry,
      onError,
      element.namespaceUri
    )
  }

  if (schemaElement.substitutionGroup) {
    return resolveElementTypeFromSubstitutionGroup(
      schemaElement.substitutionGroup,
      namespaceContext,
      registry,
      onError,
      element.namespaceUri,
      new Set()
    )
  }

  return null
}

function resolveElementTypeFromSubstitutionGroup(
  substitutionGroup: TypeReference,
  namespaceContext: Map<string, string>,
  registry: SchemaRegistry,
  onError: ErrorCallback,
  fallbackNamespaceUri: string,
  visited: Set<string>
): XsdComplexType | XsdSimpleType | null {
  const namespaceUri = resolveNamespaceWithFallback(
    namespaceContext,
    substitutionGroup.namespacePrefix,
    registry,
    fallbackNamespaceUri
  )
  const resolvedNamespaceUri =
    namespaceUri || (!substitutionGroup.namespacePrefix ? fallbackNamespaceUri : '')

  const visitedKey = `${resolvedNamespaceUri}:${substitutionGroup.name}`
  if (visited.has(visitedKey)) {
    return null
  }
  visited.add(visitedKey)

  const headElement = registry.resolveElement(resolvedNamespaceUri, substitutionGroup.name)
  if (!headElement) {
    return null
  }

  if (headElement.inlineComplexType) {
    return headElement.inlineComplexType
  }

  if (headElement.inlineSimpleType) {
    return headElement.inlineSimpleType
  }

  if (headElement.typeRef) {
    return resolveTypeReference(
      headElement.typeRef,
      namespaceContext,
      registry,
      onError,
      resolvedNamespaceUri
    )
  }

  if (headElement.substitutionGroup) {
    return resolveElementTypeFromSubstitutionGroup(
      headElement.substitutionGroup,
      namespaceContext,
      registry,
      onError,
      resolvedNamespaceUri,
      visited
    )
  }

  return null
}

export function resolveTypeReference(
  ref: TypeReference,
  namespaceContext: Map<string, string>,
  registry: SchemaRegistry,
  onError: ErrorCallback,
  fallbackNamespaceUri?: string
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

  const namespaceUri = resolveNamespaceWithFallback(
    namespaceContext,
    ref.namespacePrefix,
    registry,
    fallbackNamespaceUri
  )
  const resolvedNamespaceUri = namespaceUri || (!ref.namespacePrefix ? fallbackNamespaceUri ?? '' : '')
  const type = registry.resolveType(resolvedNamespaceUri, ref.name)
  if (!type) {
    onError('UNKNOWN_TYPE', formatMessage('TYPE.TYPE_NOT_FOUND', ref.name))
  }
  return type ?? null
}

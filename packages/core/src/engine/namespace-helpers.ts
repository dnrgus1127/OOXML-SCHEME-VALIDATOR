import type { SchemaRegistry } from '../types'
import { normalizeNamespace, resolveNamespaceUri } from '../runtime'

/**
 * Resolve a namespace URI from XML context with schema prefix fallback.
 *
 * - prefixed reference: XML context -> schema prefix map fallback
 * - unprefixed reference: fallback schema namespace -> XML default namespace
 */
export function resolveNamespaceWithFallback(
  namespaceContext: Map<string, string>,
  prefix: string | undefined,
  registry: SchemaRegistry,
  fallbackNamespaceUri?: string
): string {
  if (!prefix) {
    return fallbackNamespaceUri ?? resolveNamespaceUri(namespaceContext)
  }

  const xmlResult = resolveNamespaceUri(namespaceContext, prefix)
  if (xmlResult) return xmlResult

  if (fallbackNamespaceUri) {
    const normalizedFallback = normalizeNamespace(fallbackNamespaceUri)
    const schema =
      registry.schemas.get(normalizedFallback) ?? registry.schemas.get(fallbackNamespaceUri)
    const localSchemaNamespace = schema?.namespaces.find((ns) => ns.prefix === prefix)?.uri
    if (localSchemaNamespace) {
      return localSchemaNamespace
    }
  }

  return registry.resolveSchemaPrefix(prefix) ?? ''
}

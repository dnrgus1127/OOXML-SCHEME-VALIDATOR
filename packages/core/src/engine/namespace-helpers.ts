import type { SchemaRegistry } from '../types'
import { resolveNamespaceUri } from '../runtime'

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

  return registry.resolveSchemaPrefix(prefix) ?? ''
}

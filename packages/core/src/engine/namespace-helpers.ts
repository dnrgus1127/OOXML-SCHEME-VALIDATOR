import type { SchemaRegistry } from '../types'
import { resolveNamespaceUri } from '../runtime'

/**
 * Resolve a namespace URI from XML context with schema prefix fallback.
 * First tries the XML namespace context, then falls back to the schema's
 * registered prefix-to-namespace mappings.
 */
export function resolveNamespaceWithFallback(
  namespaceContext: Map<string, string>,
  prefix: string | undefined,
  registry: SchemaRegistry
): string {
  const xmlResult = prefix
    ? resolveNamespaceUri(namespaceContext, prefix)
    : resolveNamespaceUri(namespaceContext)
  if (xmlResult) return xmlResult
  if (prefix) {
    return registry.resolveSchemaPrefix(prefix) ?? ''
  }
  return ''
}

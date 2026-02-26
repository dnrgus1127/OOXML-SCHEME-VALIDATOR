import type {
  SchemaRegistry,
  XsdSimpleType,
  TypeReference,
  Facet,
  SimpleTypeRestriction,
  SimpleTypeUnion,
  SimpleTypeList,
} from '../types'
import { isSimpleType } from '../types'
import type { ErrorCallback } from './error-handlers'
import type { ValidationErrorHandler } from './error-handlers'
import { resolveTypeReference } from './type-resolver'
import { formatMessage } from '../i18n/format'

function resolveSimpleTypeNamespace(
  registry: SchemaRegistry,
  simpleType: XsdSimpleType
): string | undefined {
  if (!simpleType.name) {
    return undefined
  }

  for (const [namespaceUri, schema] of registry.schemas.entries()) {
    if (schema.simpleTypes.get(simpleType.name) === simpleType) {
      return namespaceUri
    }
  }

  return undefined
}

function createBufferedErrorHandler(base: ValidationErrorHandler): ValidationErrorHandler {
  return {
    pushError: () => {
      // no-op: caller decides whether to surface buffered attempt errors
    },
    pushFacetError: () => {
      // no-op: caller decides whether to surface buffered attempt errors
    },
    currentPath: () => base.currentPath(),
  }
}

function createTrackingErrorHandler(
  base: ValidationErrorHandler
): { handler: ValidationErrorHandler; hasError: () => boolean } {
  let errored = false
  return {
    handler: {
      pushError: (code: string, message: string, value?: string) => {
        errored = true
        base.pushError(code, message, value)
      },
      pushFacetError: (facet: Facet, value: string) => {
        errored = true
        base.pushFacetError(facet, value)
      },
      currentPath: () => base.currentPath(),
    },
    hasError: () => errored,
  }
}

export function validateSimpleTypeValue(
  value: string,
  simpleType: XsdSimpleType,
  namespaceContext: Map<string, string>,
  registry: SchemaRegistry,
  errorHandler: ValidationErrorHandler,
  fallbackNamespaceUri?: string
): void {
  const content = simpleType.content
  if (content.kind === 'restriction') {
    validateRestriction(
      value,
      content,
      namespaceContext,
      registry,
      errorHandler,
      fallbackNamespaceUri
    )
    return
  }

  if (content.kind === 'union') {
    validateUnion(value, content, namespaceContext, registry, errorHandler, fallbackNamespaceUri)
    return
  }

  if (content.kind === 'list') {
    validateList(value, content, namespaceContext, registry, errorHandler, fallbackNamespaceUri)
  }
}

function validateRestriction(
  value: string,
  restriction: SimpleTypeRestriction,
  namespaceContext: Map<string, string>,
  registry: SchemaRegistry,
  errorHandler: ValidationErrorHandler,
  fallbackNamespaceUri?: string
): void {
  const bufferedHandler = createBufferedErrorHandler(errorHandler)
  if (
    !validateBuiltinOrReferencedType(
      value,
      restriction.base,
      namespaceContext,
      registry,
      bufferedHandler,
      fallbackNamespaceUri
    )
  ) {
    errorHandler.pushError(
      'INVALID_VALUE',
      formatMessage('VALUE.INVALID_TYPE', restriction.base.name),
      value
    )
    return
  }

  for (const facet of restriction.facets) {
    if (
      restriction.base.isBuiltin &&
      restriction.base.name === 'hexBinary' &&
      (facet.type === 'length' || facet.type === 'minLength' || facet.type === 'maxLength')
    ) {
      const byteLength = value.length / 2
      const isValidHexByteLength =
        facet.type === 'length'
          ? byteLength === facet.value
          : facet.type === 'minLength'
            ? byteLength >= facet.value
            : byteLength <= facet.value

      if (!isValidHexByteLength) {
        errorHandler.pushFacetError(facet, value)
        return
      }
      continue
    }

    if (!validateFacet(value, facet)) {
      errorHandler.pushFacetError(facet, value)
      return
    }
  }
}

function validateUnion(
  value: string,
  union: SimpleTypeUnion,
  namespaceContext: Map<string, string>,
  registry: SchemaRegistry,
  errorHandler: ValidationErrorHandler,
  fallbackNamespaceUri?: string
): void {
  const bufferedHandler = createBufferedErrorHandler(errorHandler)
  for (const memberType of union.memberTypes) {
    if (
      validateBuiltinOrReferencedType(
        value,
        memberType,
        namespaceContext,
        registry,
        bufferedHandler,
        fallbackNamespaceUri
      )
    ) {
      return
    }
  }

  errorHandler.pushError('INVALID_VALUE', formatMessage('VALUE.INVALID_UNION'), value)
}

function validateList(
  value: string,
  list: SimpleTypeList,
  namespaceContext: Map<string, string>,
  registry: SchemaRegistry,
  errorHandler: ValidationErrorHandler,
  fallbackNamespaceUri?: string
): void {
  const items = value.split(/\s+/).filter(Boolean)
  const bufferedHandler = createBufferedErrorHandler(errorHandler)
  for (const item of items) {
    if (
      !validateBuiltinOrReferencedType(
        item,
        list.itemType,
        namespaceContext,
        registry,
        bufferedHandler,
        fallbackNamespaceUri
      )
    ) {
      errorHandler.pushError('INVALID_VALUE', formatMessage('VALUE.INVALID_LIST_ITEM'), item)
      return
    }
  }
}

export function validateBuiltinOrReferencedType(
  value: string,
  typeRef: TypeReference,
  namespaceContext: Map<string, string>,
  registry: SchemaRegistry,
  errorHandler: ValidationErrorHandler,
  fallbackNamespaceUri?: string
): boolean {
  if (typeRef.isBuiltin) {
    return validateBuiltinType(value, typeRef.name)
  }

  const resolved = resolveTypeReference(
    typeRef,
    namespaceContext,
    registry,
    errorHandler.pushError.bind(errorHandler),
    fallbackNamespaceUri
  )
  if (!resolved || !isSimpleType(resolved)) {
    return false
  }

  const tracking = createTrackingErrorHandler(errorHandler)
  validateSimpleTypeValue(
    value,
    resolved,
    namespaceContext,
    registry,
    tracking.handler,
    resolveSimpleTypeNamespace(registry, resolved) ?? fallbackNamespaceUri
  )
  return !tracking.hasError()
}

/**
 * Apply whitespace normalization according to XML Schema Part 2 specification
 * @param value - The string value to normalize
 * @param mode - The whitespace mode: 'preserve' | 'replace' | 'collapse'
 * @returns Normalized string value
 */
export function applyWhitespace(value: string, mode: 'preserve' | 'replace' | 'collapse'): string {
  if (mode === 'preserve') {
    return value
  }

  // Step 1: replace - Replace each tab, newline, and carriage return with a space
  let result = value.replace(/[\t\n\r]/g, ' ')

  if (mode === 'replace') {
    return result
  }

  // Step 2: collapse - Apply replace + collapse consecutive spaces + trim
  result = result.replace(/\s{2,}/g, ' ').trim()
  return result
}

export function validateFacet(value: string, facet: Facet): boolean {
  switch (facet.type) {
    case 'enumeration':
      return facet.values.includes(value)
    case 'pattern': // XML Schema regex syntax is richer than JavaScript regex (e.g. class subtraction),
    // so we validate with the subset JS can compile and ignore unsupported patterns.
    {
      let hasCompilablePattern = false

      for (const pattern of facet.patterns) {
        let regex: RegExp
        try {
          regex = new RegExp(`^${pattern}$`)
          hasCompilablePattern = true
        } catch {
          continue
        }

        if (regex.test(value)) {
          return true
        }

        if (pattern.includes('%') && /^\d+$/.test(value) && regex.test(`${value}%`)) {
          return true
        }
      }

      return hasCompilablePattern ? false : true
    }
    case 'minLength':
      return value.length >= facet.value
    case 'maxLength':
      return value.length <= facet.value
    case 'length':
      return value.length === facet.value
    case 'minInclusive':
      return parseFloat(value) >= parseFloat(facet.value)
    case 'maxInclusive':
      return parseFloat(value) <= parseFloat(facet.value)
    case 'minExclusive':
      return parseFloat(value) > parseFloat(facet.value)
    case 'maxExclusive':
      return parseFloat(value) < parseFloat(facet.value)
    case 'totalDigits':
      return value.replace(/[-+.]/g, '').length <= facet.value
    case 'fractionDigits':
      if (value.includes('.')) {
        const parts = value.split('.')
        return (parts[1]?.length ?? 0) <= facet.value
      }
      return true
    case 'whiteSpace':
      // WhiteSpace facet validation: check if value matches normalized form
      const normalized = applyWhitespace(value, facet.value as 'preserve' | 'replace' | 'collapse')
      return value === normalized
    default:
      return true
  }
}

/**
 * Validate URI according to RFC 3986 (simplified)
 * @param value - The URI string to validate
 * @returns true if valid URI or relative reference
 */
function validateUri(value: string): boolean {
  if (!value) return true // Empty URI is allowed (optional)

  // Check for invalid characters (spaces, control characters)
  if (/[\s\x00-\x1F\x7F]/.test(value)) return false

  // RFC 3986 absolute URI pattern: scheme ":" hier-part [ "?" query ] [ "#" fragment ]
  // Scheme: ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )
  const absoluteUriPattern = /^[a-z][a-z0-9+.-]*:.+/i

  // Absolute URI validation
  if (absoluteUriPattern.test(value)) return true

  // Relative reference validation (OOXML relationships)
  // Allow: path segments, query, fragment
  // Examples: "../styles.xml", "rId1", "./file.xml", "#section"
  const relativeRefPattern = /^([.]{0,2}\/)?[^:]*$/

  return relativeRefPattern.test(value)
}

export function validateBuiltinType(value: string, typeName: string): boolean {
  switch (typeName) {
    case 'string':
      return true
    case 'normalizedString':
      // normalizedString applies 'replace' whitespace processing
      return value === applyWhitespace(value, 'replace')
    case 'boolean':
      return ['true', 'false', '1', '0'].includes(value)
    case 'integer':
      return /^[+-]?\d+$/.test(value)
    case 'int': {
      const num = parseInt(value, 10)
      return !Number.isNaN(num) && num >= -2147483648 && num <= 2147483647
    }
    case 'unsignedInt': {
      const num = parseInt(value, 10)
      return !Number.isNaN(num) && num >= 0 && num <= 4294967295
    }
    case 'unsignedByte': {
      const num = parseInt(value, 10)
      return !Number.isNaN(num) && num >= 0 && num <= 255
    }
    case 'decimal':
    case 'float':
    case 'double':
      return !Number.isNaN(parseFloat(value))
    case 'hexBinary':
      return /^[0-9A-Fa-f]*$/.test(value) && value.length % 2 === 0
    case 'base64Binary':
      return /^[A-Za-z0-9+/]*={0,2}$/.test(value)
    case 'dateTime':
      return !Number.isNaN(Date.parse(value))
    case 'anyURI':
      return validateUri(value)
    case 'token':
      // token applies 'collapse' whitespace processing
      return value === applyWhitespace(value, 'collapse')
    case 'NCName':
      // NCName is derived from token, so it also requires collapse
      return (
        value === applyWhitespace(value, 'collapse') &&
        /^[a-zA-Z_][\w.-]*$/.test(value) &&
        !value.includes(':')
      )
    default:
      return true
  }
}

import type {
  SchemaRegistry,
  XsdSimpleType,
  TypeReference,
  Facet,
  SimpleTypeRestriction,
  SimpleTypeUnion,
  SimpleTypeList,
} from './types'
import { isSimpleType } from './types'
import type { ErrorCallback } from './error-handlers'
import type { ValidationErrorHandler } from './error-handlers'
import { resolveTypeReference } from './type-resolver'

export function validateSimpleTypeValue(
  value: string,
  simpleType: XsdSimpleType,
  namespaceContext: Map<string, string>,
  registry: SchemaRegistry,
  errorHandler: ValidationErrorHandler
): void {
  const content = simpleType.content
  if (content.kind === 'restriction') {
    validateRestriction(value, content, namespaceContext, registry, errorHandler)
    return
  }

  if (content.kind === 'union') {
    validateUnion(value, content, namespaceContext, registry, errorHandler)
    return
  }

  if (content.kind === 'list') {
    validateList(value, content, namespaceContext, registry, errorHandler)
  }
}

function validateRestriction(
  value: string,
  restriction: SimpleTypeRestriction,
  namespaceContext: Map<string, string>,
  registry: SchemaRegistry,
  errorHandler: ValidationErrorHandler
): void {
  if (
    !validateBuiltinOrReferencedType(
      value,
      restriction.base,
      namespaceContext,
      registry,
      errorHandler
    )
  ) {
    errorHandler.pushError('INVALID_VALUE', `타입 검증 실패: ${restriction.base.name}`, value)
    return
  }

  for (const facet of restriction.facets) {
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
  errorHandler: ValidationErrorHandler
): void {
  for (const memberType of union.memberTypes) {
    if (
      validateBuiltinOrReferencedType(value, memberType, namespaceContext, registry, errorHandler)
    ) {
      return
    }
  }

  errorHandler.pushError('INVALID_VALUE', 'union 멤버 타입과 일치하지 않습니다.', value)
}

function validateList(
  value: string,
  list: SimpleTypeList,
  namespaceContext: Map<string, string>,
  registry: SchemaRegistry,
  errorHandler: ValidationErrorHandler
): void {
  const items = value.split(/\s+/).filter(Boolean)
  for (const item of items) {
    if (
      !validateBuiltinOrReferencedType(
        item,
        list.itemType,
        namespaceContext,
        registry,
        errorHandler
      )
    ) {
      errorHandler.pushError('INVALID_VALUE', 'list 항목 타입과 일치하지 않습니다.', item)
      return
    }
  }
}

export function validateBuiltinOrReferencedType(
  value: string,
  typeRef: TypeReference,
  namespaceContext: Map<string, string>,
  registry: SchemaRegistry,
  errorHandler: ValidationErrorHandler
): boolean {
  if (typeRef.isBuiltin) {
    return validateBuiltinType(value, typeRef.name)
  }

  const resolved = resolveTypeReference(
    typeRef,
    namespaceContext,
    registry,
    errorHandler.pushError.bind(errorHandler)
  )
  if (!resolved || !isSimpleType(resolved)) {
    return false
  }

  validateSimpleTypeValue(value, resolved, namespaceContext, registry, errorHandler)
  return true
}

export function validateFacet(value: string, facet: Facet): boolean {
  switch (facet.type) {
    case 'enumeration':
      return facet.values.includes(value)
    case 'pattern':
      return facet.patterns.some((pattern) => new RegExp(`^${pattern}$`).test(value))
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
      return true
    default:
      return true
  }
}

export function validateBuiltinType(value: string, typeName: string): boolean {
  switch (typeName) {
    case 'string':
    case 'normalizedString':
      return true
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
    case 'token':
      return value === value.trim() && !/\s{2,}/.test(value)
    case 'NCName':
      return /^[a-zA-Z_][\w.-]*$/.test(value) && !value.includes(':')
    default:
      return true
  }
}

import type {
  SchemaRegistry,
  XsdAttribute,
  XsdAttributeGroup,
  XsdAnyAttribute,
  XsdComplexType,
} from '../types'
import { hasComplexContent, hasSimpleContent, isSimpleType } from '../types'
import type { XmlAttribute, ElementStackFrame } from '../runtime'
import type { ValidationErrorHandler } from './error-handlers'
import { resolveNamespaceWithFallback } from './namespace-helpers'
import { resolveTypeReference } from './type-resolver'
import { validateSimpleTypeValue } from './simple-type-validator'
import { formatMessage } from '../i18n/format'

function collectAllAttributes(
  schemaType: XsdComplexType,
  namespaceContext: Map<string, string>,
  registry: SchemaRegistry,
  fallbackNamespaceUri: string,
  visited?: Set<string>
): {
  attributes: XsdAttribute[]
  attributeGroups: XsdAttributeGroup[]
  anyAttribute?: XsdAnyAttribute
} {
  const attributes: XsdAttribute[] = [...schemaType.attributes]
  const attributeGroups: XsdAttributeGroup[] = [...schemaType.attributeGroups]
  let anyAttribute = schemaType.anyAttribute

  if (hasComplexContent(schemaType.content)) {
    const derivation = schemaType.content.content

    attributes.push(...derivation.attributes)
    attributeGroups.push(...derivation.attributeGroups)
    if (derivation.anyAttribute) {
      anyAttribute = anyAttribute ?? derivation.anyAttribute
    }

    if (derivation.derivation === 'extension') {
      const seen = visited ?? new Set<string>()
      const baseKey = `${derivation.base.namespacePrefix ?? ''}:${derivation.base.name}`
      if (!seen.has(baseKey)) {
        seen.add(baseKey)
        const resolvedBaseNs = resolveNamespaceWithFallback(
          namespaceContext,
          derivation.base.namespacePrefix,
          registry,
          fallbackNamespaceUri
        )
        const baseType = registry.resolveType(resolvedBaseNs, derivation.base.name)
        if (baseType && baseType.kind === 'complexType') {
          const baseAttrs = collectAllAttributes(
            baseType,
            namespaceContext,
            registry,
            resolvedBaseNs,
            seen
          )
          const derivedNames = new Set(attributes.filter((a) => a.name).map((a) => a.name!))
          for (const baseAttr of baseAttrs.attributes) {
            if (baseAttr.name && !derivedNames.has(baseAttr.name)) {
              attributes.push(baseAttr)
            }
          }
          attributeGroups.push(...baseAttrs.attributeGroups)
          if (baseAttrs.anyAttribute) {
            anyAttribute = anyAttribute ?? baseAttrs.anyAttribute
          }
        }
      }
    }
  }

  if (hasSimpleContent(schemaType.content)) {
    const derivation = schemaType.content.content
    attributes.push(...derivation.attributes)
    attributeGroups.push(...derivation.attributeGroups)
    if (derivation.anyAttribute) {
      anyAttribute = anyAttribute ?? derivation.anyAttribute
    }
  }

  return { attributes, attributeGroups, anyAttribute }
}

function validateAttributeValue(
  value: string,
  schemaDef: XsdAttribute,
  namespaceContext: Map<string, string>,
  registry: SchemaRegistry,
  errorHandler: ValidationErrorHandler,
  fallbackNamespaceUri: string
): void {
  if (schemaDef.inlineType) {
    validateSimpleTypeValue(
      value,
      schemaDef.inlineType,
      namespaceContext,
      registry,
      errorHandler,
      fallbackNamespaceUri
    )
    return
  }

  if (schemaDef.typeRef) {
    const resolved = resolveTypeReference(
      schemaDef.typeRef,
      namespaceContext,
      registry,
      errorHandler.pushError.bind(errorHandler),
      fallbackNamespaceUri
    )
    if (resolved && isSimpleType(resolved)) {
      validateSimpleTypeValue(
        value,
        resolved,
        namespaceContext,
        registry,
        errorHandler,
        fallbackNamespaceUri
      )
    }
  }
}

function parseAttributeLocalName(name: string): string {
  const colonIndex = name.indexOf(':')
  return colonIndex >= 0 ? name.slice(colonIndex + 1) : name
}

function getAttributeDisplayName(attr: XsdAttribute): string {
  if (attr.name) {
    return attr.name
  }
  if (!attr.ref) {
    return ''
  }
  if (!attr.ref.namespacePrefix) {
    return attr.ref.name
  }
  return `${attr.ref.namespacePrefix}:${attr.ref.name}`
}

function getSchemaAttributeKey(
  attr: XsdAttribute,
  namespaceContext: Map<string, string>,
  registry: SchemaRegistry,
  fallbackNamespaceUri: string
): string | undefined {
  if (attr.ref) {
    const namespaceUri = resolveNamespaceWithFallback(
      namespaceContext,
      attr.ref.namespacePrefix,
      registry,
      fallbackNamespaceUri
    )
    let resolvedNamespaceUri = namespaceUri || (!attr.ref.namespacePrefix ? fallbackNamespaceUri : '')
    if (!resolvedNamespaceUri && attr.ref.namespacePrefix === 'xml') {
      resolvedNamespaceUri = 'http://www.w3.org/XML/1998/namespace'
    }
    return `${resolvedNamespaceUri}:${attr.ref.name}`
  }

  if (attr.name) {
    return `:${attr.name}`
  }

  return undefined
}

function getXmlAttributeKey(attr: XmlAttribute): string {
  let namespaceUri = attr.namespaceUri ?? ''
  if (!namespaceUri && attr.name.startsWith('xml:')) {
    namespaceUri = 'http://www.w3.org/XML/1998/namespace'
  }
  const localName = attr.localName || parseAttributeLocalName(attr.name)
  return `${namespaceUri}:${localName}`
}

function buildAllowedAttributes(
  collected: {
    attributes: XsdAttribute[]
    attributeGroups: XsdAttributeGroup[]
    anyAttribute?: XsdAnyAttribute
  },
  namespaceContext: Map<string, string>,
  registry: SchemaRegistry,
  fallbackNamespaceUri: string
): Map<string, XsdAttribute> {
  const allowedAttributes = new Map<string, XsdAttribute>()

  const addAttribute = (attr: XsdAttribute) => {
    const key = getSchemaAttributeKey(attr, namespaceContext, registry, fallbackNamespaceUri)
    if (key) {
      allowedAttributes.set(key, attr)
    }
  }

  for (const attr of collected.attributes) {
    addAttribute(attr)
  }

  for (const group of collected.attributeGroups) {
    if (group.ref) {
      const namespaceUri = resolveNamespaceWithFallback(
        namespaceContext,
        group.ref.namespacePrefix,
        registry,
        fallbackNamespaceUri
      )
      const resolved = registry.resolveAttributeGroup(namespaceUri, group.ref.name)
      if (resolved?.attributes) {
        for (const attr of resolved.attributes) {
          addAttribute(attr)
        }
      }
    }
  }

  return allowedAttributes
}

export function validateAttributes(
  attributes: XmlAttribute[],
  schemaType: XsdComplexType,
  fallbackNamespaceUri: string,
  namespaceContext: Map<string, string>,
  registry: SchemaRegistry,
  errorHandler: ValidationErrorHandler
): Set<string> {
  const collected = collectAllAttributes(
    schemaType,
    namespaceContext,
    registry,
    fallbackNamespaceUri
  )
  const allowedAttributes = buildAllowedAttributes(
    collected,
    namespaceContext,
    registry,
    fallbackNamespaceUri
  )

  const validated = new Set<string>()

  for (const xmlAttr of attributes) {
    if (xmlAttr.name.startsWith('xmlns')) {
      continue
    }

    const attrKey = getXmlAttributeKey(xmlAttr)
    const schemaDef = allowedAttributes.get(attrKey)
    if (!schemaDef) {
      if (collected.anyAttribute) {
        continue
      }
      errorHandler.pushError('INVALID_ATTRIBUTE', formatMessage('ATTRIBUTE.INVALID', xmlAttr.name))
      continue
    }

    validateAttributeValue(
      xmlAttr.value,
      schemaDef,
      namespaceContext,
      registry,
      errorHandler,
      fallbackNamespaceUri
    )
    validated.add(attrKey)
  }

  for (const [attrKey, attr] of allowedAttributes.entries()) {
    if (attr.use === 'prohibited' && validated.has(attrKey)) {
      errorHandler.pushError(
        'INVALID_ATTRIBUTE',
        formatMessage('ATTRIBUTE.PROHIBITED', getAttributeDisplayName(attr))
      )
    }
  }

  return validated
}

export function checkRequiredAttributes(
  schemaType: XsdComplexType,
  frame: ElementStackFrame,
  fallbackNamespaceUri: string,
  namespaceContext: Map<string, string>,
  registry: SchemaRegistry,
  errorHandler: ValidationErrorHandler
): void {
  const collected = collectAllAttributes(
    schemaType,
    namespaceContext,
    registry,
    fallbackNamespaceUri
  )
  const allowedAttributes = buildAllowedAttributes(
    collected,
    namespaceContext,
    registry,
    fallbackNamespaceUri
  )

  for (const [attrKey, attr] of allowedAttributes.entries()) {
    if (attr.use === 'required' && !frame.validatedAttributes.has(attrKey)) {
      errorHandler.pushError(
        'MISSING_REQUIRED_ATTR',
        formatMessage('ATTRIBUTE.MISSING_REQUIRED', getAttributeDisplayName(attr))
      )
    }
  }
}

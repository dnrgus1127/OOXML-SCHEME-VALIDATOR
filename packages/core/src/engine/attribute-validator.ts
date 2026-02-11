import type {
  SchemaRegistry,
  XsdAttribute,
  XsdAttributeGroup,
  XsdAnyAttribute,
  XsdComplexType,
} from '../types'
import { hasComplexContent, isSimpleType } from '../types'
import type { XmlAttribute, ElementStackFrame } from '../runtime'
import { resolveNamespaceUri } from '../runtime'
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
        const baseNs = resolveNamespaceWithFallback(
          namespaceContext,
          derivation.base.namespacePrefix,
          registry
        )
        const resolvedBaseNs =
          baseNs || (!derivation.base.namespacePrefix ? fallbackNamespaceUri : '')
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
    validateSimpleTypeValue(value, schemaDef.inlineType, namespaceContext, registry, errorHandler)
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
      validateSimpleTypeValue(value, resolved, namespaceContext, registry, errorHandler)
    }
  }
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
  const allowedAttributes = new Map<string, XsdAttribute>()

  for (const attr of collected.attributes) {
    if (attr.name) {
      allowedAttributes.set(attr.name, attr)
    }
  }

  for (const group of collected.attributeGroups) {
    if (group.ref) {
      const namespaceUri = group.ref.namespacePrefix
        ? resolveNamespaceUri(namespaceContext, group.ref.namespacePrefix)
        : resolveNamespaceUri(namespaceContext) || fallbackNamespaceUri
      const resolved = registry.resolveAttributeGroup(namespaceUri, group.ref.name)
      if (resolved?.attributes) {
        for (const attr of resolved.attributes) {
          if (attr.name) {
            allowedAttributes.set(attr.name, attr)
          }
        }
      }
    }
  }

  const validated = new Set<string>()

  for (const xmlAttr of attributes) {
    if (xmlAttr.name.startsWith('xmlns')) {
      continue
    }

    const attrName = xmlAttr.localName ?? xmlAttr.name
    const schemaDef = allowedAttributes.get(attrName)
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
    validated.add(attrName)
  }

  for (const attr of allowedAttributes.values()) {
    if (attr.use === 'prohibited' && validated.has(attr.name ?? '')) {
      errorHandler.pushError('INVALID_ATTRIBUTE', formatMessage('ATTRIBUTE.PROHIBITED', attr.name!))
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

  for (const attr of collected.attributes) {
    if (attr.use === 'required' && attr.name && !frame.validatedAttributes.has(attr.name)) {
      errorHandler.pushError('MISSING_REQUIRED_ATTR', formatMessage('ATTRIBUTE.MISSING_REQUIRED', attr.name!))
    }
  }

  for (const group of collected.attributeGroups) {
    if (group.ref) {
      const namespaceUri = group.ref.namespacePrefix
        ? resolveNamespaceUri(namespaceContext, group.ref.namespacePrefix)
        : resolveNamespaceUri(namespaceContext) || fallbackNamespaceUri
      const resolved = registry.resolveAttributeGroup(namespaceUri, group.ref.name)
      if (resolved?.attributes) {
        for (const attr of resolved.attributes) {
          if (attr.use === 'required' && attr.name && !frame.validatedAttributes.has(attr.name)) {
            errorHandler.pushError('MISSING_REQUIRED_ATTR', formatMessage('ATTRIBUTE.MISSING_REQUIRED', attr.name!))
          }
        }
      }
    }
  }
}

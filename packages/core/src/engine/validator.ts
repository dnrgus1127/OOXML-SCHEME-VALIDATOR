import type {
  SchemaRegistry,
  ValidationResult,
  ValidationOptions,
  ValidationErrorCode,
  XsdComplexType,
  XsdSimpleType,
  TypeReference,
} from '../types'
import { hasComplexContent, hasElementContent, hasSimpleContent, isElement, isAny } from '../types'
import {
  ElementStackFrame,
  XmlElementInfo,
  createRuntimeContext,
  resolveNamespaceUri,
  withNamespaceContext,
  isComplexSchemaType,
  FlattenedParticle,
} from '../runtime'
import {
  checkMissingRequiredElementDetails,
  initCompositorState,
  validateCompositorChild,
} from './compositor'
import type { OccurrenceViolation } from './compositor-types'
import { createErrorHandler, ValidationErrorHandler } from './error-handlers'
import { resolveSchemaElementType } from './type-resolver'
import { validateSimpleTypeValue, validateBuiltinOrReferencedType } from './simple-type-validator'
import { validateAttributes, checkRequiredAttributes } from './attribute-validator'
import { setLocale, formatMessage } from '../i18n/format'

export class ValidationEngine {
  private context
  private errorHandler!: ValidationErrorHandler

  constructor(
    private registry: SchemaRegistry,
    options?: ValidationOptions
  ) {
    this.context = createRuntimeContext(this.registry)
    if (options) {
      this.context.options = { ...options }
      if (options.locale) {
        setLocale(options.locale)
      }
    }
    this.errorHandler = createErrorHandler(this.context)
  }

  private createResolver(namespaceContext: Map<string, string>, fallbackNamespaceUri?: string) {
    return {
      resolveNamespaceUri: (prefix?: string): string => {
        if (!prefix) {
          return fallbackNamespaceUri ?? resolveNamespaceUri(namespaceContext)
        }

        const xmlResult = resolveNamespaceUri(namespaceContext, prefix)
        if (xmlResult) return xmlResult
        return this.registry.resolveSchemaPrefix(prefix) ?? ''
      },
    }
  }

  private resolveSchemaTypeNamespace(schemaType: XsdComplexType | XsdSimpleType | null): string {
    if (!schemaType || !schemaType.name) {
      return ''
    }

    for (const [namespaceUri, schema] of this.registry.schemas.entries()) {
      if (schema.complexTypes.get(schemaType.name) === schemaType) {
        return namespaceUri
      }
      if (schema.simpleTypes.get(schemaType.name) === schemaType) {
        return namespaceUri
      }
    }

    return ''
  }

  startDocument(): void {
    this.context.elementStack = []
    this.context.namespaceStack = [new Map()]
    this.context.errors = []
    this.context.warnings = []
    this.context.idValues = new Set()
    this.context.idrefValues = new Set()
    this.errorHandler = createErrorHandler(this.context)
  }

  startElement(element: XmlElementInfo): void {
    const namespaceContext = withNamespaceContext(
      this.context.namespaceStack,
      element.namespaceDeclarations
    )
    this.context.namespaceStack.push(namespaceContext)

    let matchedParticle: FlattenedParticle | undefined
    const parentFrame = this.context.elementStack[this.context.elementStack.length - 1]
    const resolver = this.createResolver(namespaceContext, parentFrame?.schemaNamespaceUri)

    let shouldResolveSchema = true

    if (parentFrame?.compositorState) {
      const result = validateCompositorChild(
        element.namespaceUri,
        element.localName,
        parentFrame.compositorState,
        this.registry,
        resolver
      )

      if (result.skippedRequiredDetails?.length) {
        for (const missingDetail of result.skippedRequiredDetails) {
          this.errorHandler.pushError(
            'MISSING_REQUIRED_ELEMENT',
            this.formatOccurrenceViolationMessage(missingDetail)
          )
        }
      } else if (result.skippedRequired) {
        for (const missing of result.skippedRequired) {
          this.errorHandler.pushError(
            'MISSING_REQUIRED_ELEMENT',
            formatMessage('ELEMENT.MISSING_REQUIRED', missing)
          )
        }
      }

      if (!result.success) {
        const message = result.occurrenceViolation
          ? this.formatOccurrenceViolationMessage(result.occurrenceViolation)
          : formatMessage('ELEMENT.INVALID', element.name)
        this.errorHandler.pushError(
          result.errorCode ?? 'INVALID_CONTENT',
          message
        )
      }

      matchedParticle = result.matchedParticle
      shouldResolveSchema = result.success || Boolean(result.matchedParticle)
    }

    const isWildcardMatch = Boolean(matchedParticle && isAny(matchedParticle.particle))

    const schemaElement = !shouldResolveSchema
      ? undefined
      : isWildcardMatch
      ? undefined
      : matchedParticle
        ? (this.extractElementFromParticle(
            matchedParticle,
            namespaceContext,
            parentFrame?.schemaNamespaceUri
          ) ??
          this.registry.resolveElement(element.namespaceUri, element.localName))
        : this.registry.resolveElement(element.namespaceUri, element.localName)

    const schemaType = !shouldResolveSchema || isWildcardMatch
      ? null
      : resolveSchemaElementType(
          schemaElement,
          namespaceContext,
          element,
          this.registry,
          this.errorHandler.pushError.bind(this.errorHandler)
        )

    const validatedAttributes = isComplexSchemaType(schemaType)
      ? validateAttributes(
          element.attributes,
          schemaType,
          this.resolveSchemaTypeNamespace(schemaType) || element.namespaceUri,
          namespaceContext,
          this.registry,
          this.errorHandler
        )
      : new Set<string>()

    const schemaNamespaceUri = this.resolveSchemaTypeNamespace(schemaType) || element.namespaceUri

    const frame: ElementStackFrame = {
      elementName: element.localName,
      namespaceUri: element.namespaceUri,
      schemaNamespaceUri,
      schemaType,
      compositorState: isComplexSchemaType(schemaType)
        ? initCompositorState(
            schemaType,
            this.registry,
            this.createResolver(namespaceContext, schemaNamespaceUri)
          )
        : null,
      textContent: '',
      validatedAttributes,
    }

    this.context.elementStack.push(frame)
  }

  text(text: string): void {
    const frame = this.context.elementStack[this.context.elementStack.length - 1]
    if (!frame) {
      return
    }

    frame.textContent += text
  }

  endElement(element: XmlElementInfo): void {
    const currentFrame = this.context.elementStack[this.context.elementStack.length - 1]
    if (!currentFrame) {
      return
    }

    if (currentFrame.compositorState) {
      const endNsContext =
        this.context.namespaceStack[this.context.namespaceStack.length - 1] ?? new Map()
      const missingDetails = checkMissingRequiredElementDetails(
        currentFrame.compositorState,
        this.registry,
        this.createResolver(endNsContext, currentFrame.schemaNamespaceUri)
      )

      for (const missingDetail of missingDetails) {
        this.errorHandler.pushError(
          'MISSING_REQUIRED_ELEMENT',
          this.formatOccurrenceViolationMessage(missingDetail)
        )
      }
    }

    if (isComplexSchemaType(currentFrame.schemaType)) {
      const namespaceContext =
        this.context.namespaceStack[this.context.namespaceStack.length - 1] ?? new Map()
      checkRequiredAttributes(
        currentFrame.schemaType,
        currentFrame,
        currentFrame.schemaNamespaceUri,
        namespaceContext,
        this.registry,
        this.errorHandler
      )
    }

    if (currentFrame.textContent.trim() !== '') {
      this.validateTextContent(currentFrame, currentFrame.textContent)
    } else if (
      !this.context.options.allowWhitespace &&
      isComplexSchemaType(currentFrame.schemaType) &&
      hasElementContent(currentFrame.schemaType.content)
    ) {
      if (currentFrame.textContent.length > 0) {
        this.errorHandler.pushError(
          'UNEXPECTED_TEXT',
          formatMessage('ELEMENT.UNEXPECTED_TEXT.ELEMENT_ONLY')
        )
      }
    }

    this.context.elementStack.pop()
    this.context.namespaceStack.pop()
  }

  endDocument(): ValidationResult {
    const errors = this.context.errors.map((error) => ({
      ...error,
      code: error.code as ValidationErrorCode,
    }))

    return {
      valid: errors.length === 0,
      errors,
      warnings: this.context.options.includeWarnings ? this.context.warnings : undefined,
    }
  }

  private validateTextContent(frame: ElementStackFrame, textContent: string): void {
    const schemaType = frame.schemaType
    if (!schemaType) {
      return
    }

    const nsCtx = this.context.namespaceStack[this.context.namespaceStack.length - 1] ?? new Map()

    if (!isComplexSchemaType(schemaType)) {
      validateSimpleTypeValue(
        textContent.trim(),
        schemaType,
        nsCtx,
        this.registry,
        this.errorHandler,
        frame.schemaNamespaceUri
      )
      return
    }

    if (hasSimpleContent(schemaType.content)) {
      const baseType = schemaType.content.content.base
      validateBuiltinOrReferencedType(
        textContent.trim(),
        baseType,
        nsCtx,
        this.registry,
        this.errorHandler,
        frame.schemaNamespaceUri
      )
      return
    }

    if (hasComplexContent(schemaType.content)) {
      if (!schemaType.content.mixed && !this.context.options.allowWhitespace) {
        this.errorHandler.pushError(
          'UNEXPECTED_TEXT',
          formatMessage('ELEMENT.UNEXPECTED_TEXT.COMPLEX_CONTENT'),
          textContent
        )
      }
    }
  }

  private formatOccurrenceViolationMessage(violation: OccurrenceViolation): string {
    if (violation.kind === 'tooMany') {
      if (violation.maxOccurs === 'unbounded') {
        return formatMessage('ELEMENT.INVALID', violation.elementName)
      }

      return formatMessage(
        'ELEMENT.COUNT_EXCEEDED',
        violation.elementName,
        violation.maxOccurs,
        violation.actualCount - violation.maxOccurs,
        violation.actualCount
      )
    }

    if (violation.minOccurs === 1 && violation.maxOccurs === 1) {
      return formatMessage('ELEMENT.MISSING_REQUIRED', violation.elementName)
    }

    return formatMessage(
      'ELEMENT.COUNT_SHORTAGE',
      violation.elementName,
      violation.minOccurs,
      violation.minOccurs - violation.actualCount,
      violation.actualCount
    )
  }

  private extractElementFromParticle(
    particle: FlattenedParticle,
    namespaceContext: Map<string, string>,
    fallbackNamespaceUri?: string
  ):
    | {
        typeRef?: TypeReference
        inlineComplexType?: XsdComplexType
        inlineSimpleType?: XsdSimpleType
        substitutionGroup?: TypeReference
      }
    | undefined {
    const p = particle.particle

    if (isElement(p)) {
      if (p.ref && !p.typeRef && !p.inlineComplexType && !p.inlineSimpleType) {
        let refNs = p.ref.namespacePrefix
          ? resolveNamespaceUri(namespaceContext, p.ref.namespacePrefix)
          : fallbackNamespaceUri ?? resolveNamespaceUri(namespaceContext)
        if (!refNs && p.ref.namespacePrefix) {
          refNs = this.registry.resolveSchemaPrefix(p.ref.namespacePrefix) ?? ''
        }
        return this.registry.resolveElement(refNs, p.ref.name)
      }

      return {
        typeRef: p.typeRef,
        inlineComplexType: p.inlineComplexType,
        inlineSimpleType: p.inlineSimpleType,
        substitutionGroup: p.substitutionGroup,
      }
    }

    if (isAny(p)) {
      return undefined
    }

    return undefined
  }
}

export function createValidationEngine(
  registry: SchemaRegistry,
  options?: ValidationOptions
): ValidationEngine {
  return new ValidationEngine(registry, options)
}

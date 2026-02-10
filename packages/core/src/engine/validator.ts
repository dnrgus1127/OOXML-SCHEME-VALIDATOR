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
  checkMissingRequiredElements,
  initCompositorState,
  validateCompositorChild,
} from './compositor'
import { createErrorHandler, ValidationErrorHandler } from './error-handlers'
import { resolveSchemaElementType } from './type-resolver'
import { validateSimpleTypeValue, validateBuiltinOrReferencedType } from './simple-type-validator'
import { validateAttributes, checkRequiredAttributes } from './attribute-validator'

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
    }
    this.errorHandler = createErrorHandler(this.context)
  }

  private createResolver(namespaceContext: Map<string, string>) {
    return {
      resolveNamespaceUri: (prefix?: string): string => {
        const xmlResult = resolveNamespaceUri(namespaceContext, prefix)
        if (xmlResult) return xmlResult
        if (prefix) {
          return this.registry.resolveSchemaPrefix(prefix) ?? ''
        }
        return ''
      },
    }
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
    const resolver = this.createResolver(namespaceContext)

    if (parentFrame?.compositorState) {
      const result = validateCompositorChild(
        element.namespaceUri,
        element.localName,
        parentFrame.compositorState,
        this.registry,
        resolver
      )

      if (result.skippedRequired) {
        for (const missing of result.skippedRequired) {
          this.errorHandler.pushError(
            'MISSING_REQUIRED_ELEMENT',
            `필수 요소 '${missing}'가 누락되었습니다.`
          )
        }
      }

      if (!result.success) {
        this.errorHandler.pushError(
          result.errorCode ?? 'INVALID_CONTENT',
          `허용되지 않는 요소: ${element.name}`
        )
      }

      matchedParticle = result.matchedParticle
    }

    const schemaElement = matchedParticle
      ? (this.extractElementFromParticle(matchedParticle, namespaceContext) ??
        this.registry.resolveElement(element.namespaceUri, element.localName))
      : this.registry.resolveElement(element.namespaceUri, element.localName)

    const schemaType = resolveSchemaElementType(
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
          namespaceContext,
          this.registry,
          this.errorHandler
        )
      : new Set<string>()

    const frame: ElementStackFrame = {
      elementName: element.localName,
      namespaceUri: element.namespaceUri,
      schemaType,
      compositorState: isComplexSchemaType(schemaType)
        ? initCompositorState(schemaType, this.registry, resolver)
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
      const missing = checkMissingRequiredElements(
        currentFrame.compositorState,
        this.registry,
        this.createResolver(endNsContext)
      )

      for (const missingElement of missing) {
        this.errorHandler.pushError(
          'MISSING_REQUIRED_ELEMENT',
          `필수 요소 '${missingElement}'가 누락되었습니다.`
        )
      }
    }

    if (isComplexSchemaType(currentFrame.schemaType)) {
      const namespaceContext =
        this.context.namespaceStack[this.context.namespaceStack.length - 1] ?? new Map()
      checkRequiredAttributes(
        currentFrame.schemaType,
        currentFrame,
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
          'element-only 컨텐츠에서 텍스트가 발견되었습니다.'
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
        this.errorHandler
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
        this.errorHandler
      )
      return
    }

    if (hasComplexContent(schemaType.content)) {
      if (!schemaType.content.mixed && !this.context.options.allowWhitespace) {
        this.errorHandler.pushError(
          'UNEXPECTED_TEXT',
          'complexContent에서 텍스트가 허용되지 않습니다.',
          textContent
        )
      }
    }
  }

  private extractElementFromParticle(
    particle: FlattenedParticle,
    namespaceContext: Map<string, string>
  ):
    | {
        typeRef?: TypeReference
        inlineComplexType?: XsdComplexType
        inlineSimpleType?: XsdSimpleType
      }
    | undefined {
    const p = particle.particle

    if (isElement(p)) {
      if (p.ref && !p.typeRef && !p.inlineComplexType && !p.inlineSimpleType) {
        let refNs = p.ref.namespacePrefix
          ? resolveNamespaceUri(namespaceContext, p.ref.namespacePrefix)
          : resolveNamespaceUri(namespaceContext)
        if (!refNs && p.ref.namespacePrefix) {
          refNs = this.registry.resolveSchemaPrefix(p.ref.namespacePrefix) ?? ''
        }
        return this.registry.resolveElement(refNs, p.ref.name)
      }

      return {
        typeRef: p.typeRef,
        inlineComplexType: p.inlineComplexType,
        inlineSimpleType: p.inlineSimpleType,
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

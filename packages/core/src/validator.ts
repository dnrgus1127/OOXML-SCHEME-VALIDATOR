import type {
  SchemaRegistry,
  ValidationResult,
  ValidationOptions,
  ValidationErrorCode,
  XsdAttribute,
  XsdAttributeGroup,
  XsdComplexType,
  XsdSimpleType,
  TypeReference,
  Facet,
  SimpleTypeRestriction,
  SimpleTypeUnion,
  SimpleTypeList,
  XsdElement,
  XsdAny,
  XsdAnyAttribute,
} from './types';
import { hasComplexContent, hasElementContent, hasSimpleContent, isSimpleType, isElement, isAny } from './types';
import {
  CompositorState,
  ElementStackFrame,
  XmlAttribute,
  XmlElementInfo,
  createRuntimeContext,
  makeQualifiedName,
  resolveNamespaceUri,
  withNamespaceContext,
  isComplexSchemaType,
  FlattenedParticle,
} from './runtime';
import { checkMissingRequiredElements, initCompositorState, validateCompositorChild } from './compositor';

export class ValidationEngine {
  private context;

  constructor(private registry: SchemaRegistry, options?: ValidationOptions) {
    this.context = createRuntimeContext(this.registry);
    if (options) {
      this.context.options = { ...options };
    }
  }

  /**
   * Create a namespace resolver that combines XML context with schema prefix fallback.
   * Schema prefixes (like "a", "s", "r") are resolved from the schema's namespace
   * declarations when they're not found in the XML namespace context.
   */
  private createResolver(namespaceContext: Map<string, string>) {
    return {
      resolveNamespaceUri: (prefix?: string): string => {
        const xmlResult = resolveNamespaceUri(namespaceContext, prefix);
        if (xmlResult) return xmlResult;
        // Fall back to schema namespace prefix map
        if (prefix) {
          return this.registry.resolveSchemaPrefix(prefix) ?? '';
        }
        return '';
      },
    };
  }

  startDocument(): void {
    this.context.elementStack = [];
    this.context.namespaceStack = [new Map()];
    this.context.errors = [];
    this.context.warnings = [];
    this.context.idValues = new Set();
    this.context.idrefValues = new Set();
  }

  startElement(element: XmlElementInfo): void {
    const namespaceContext = withNamespaceContext(
      this.context.namespaceStack,
      element.namespaceDeclarations,
    );
    this.context.namespaceStack.push(namespaceContext);

    let matchedParticle: FlattenedParticle | undefined;
    const parentFrame = this.context.elementStack[this.context.elementStack.length - 1];
    const resolver = this.createResolver(namespaceContext);

    if (parentFrame?.compositorState) {
      const result = validateCompositorChild(
        element.namespaceUri,
        element.localName,
        parentFrame.compositorState,
        this.registry,
        resolver,
      );

      if (!result.success) {
        this.pushError(result.errorCode ?? 'INVALID_CONTENT', `허용되지 않는 요소: ${element.name}`);
      }

      matchedParticle = result.matchedParticle;
    }

    const schemaElement = matchedParticle
      ? (this.extractElementFromParticle(matchedParticle, namespaceContext)
        ?? this.registry.resolveElement(element.namespaceUri, element.localName))
      : this.registry.resolveElement(element.namespaceUri, element.localName);
    const schemaType = this.resolveSchemaElementType(schemaElement, namespaceContext, element);

    const validatedAttributes = isComplexSchemaType(schemaType)
      ? this.validateAttributes(element.attributes, schemaType, namespaceContext)
      : new Set<string>();

    const frame: ElementStackFrame = {
      elementName: element.localName,
      namespaceUri: element.namespaceUri,
      schemaType,
      compositorState: isComplexSchemaType(schemaType)
        ? initCompositorState(schemaType, this.registry, resolver)
        : null,
      textContent: '',
      validatedAttributes,
    };

    this.context.elementStack.push(frame);
  }

  text(text: string): void {
    const frame = this.context.elementStack[this.context.elementStack.length - 1];
    if (!frame) {
      return;
    }

    frame.textContent += text;
  }

  endElement(element: XmlElementInfo): void {
    const currentFrame = this.context.elementStack[this.context.elementStack.length - 1];
    if (!currentFrame) {
      return;
    }

    if (currentFrame.compositorState) {
      const endNsContext = this.context.namespaceStack[this.context.namespaceStack.length - 1] ?? new Map();
      const missing = checkMissingRequiredElements(
        currentFrame.compositorState,
        this.registry,
        this.createResolver(endNsContext),
      );

      for (const missingElement of missing) {
        this.pushError(
          'MISSING_REQUIRED_ELEMENT',
          `필수 요소 '${missingElement}'가 누락되었습니다.`,
        );
      }
    }

    if (isComplexSchemaType(currentFrame.schemaType)) {
      this.checkRequiredAttributes(currentFrame.schemaType, currentFrame);
    }

    if (currentFrame.textContent.trim() !== '') {
      this.validateTextContent(currentFrame, currentFrame.textContent);
    } else if (!this.context.options.allowWhitespace && isComplexSchemaType(currentFrame.schemaType) && hasElementContent(currentFrame.schemaType.content)) {
      if (currentFrame.textContent.length > 0) {
        this.pushError('UNEXPECTED_TEXT', 'element-only 컨텐츠에서 텍스트가 발견되었습니다.');
      }
    }

    this.context.elementStack.pop();
    this.context.namespaceStack.pop();
  }

  endDocument(): ValidationResult {
    const errors = this.context.errors.map((error) => ({
      ...error,
      code: error.code as ValidationErrorCode,
    }));

    return {
      valid: errors.length === 0,
      errors,
      warnings: this.context.options.includeWarnings ? this.context.warnings : undefined,
    };
  }

  private resolveSchemaElementType(
    schemaElement: { typeRef?: TypeReference; inlineComplexType?: XsdComplexType; inlineSimpleType?: XsdSimpleType } | undefined,
    namespaceContext: Map<string, string>,
    element: XmlElementInfo,
  ): XsdComplexType | XsdSimpleType | null {
    if (!schemaElement) {
      this.pushError('INVALID_ELEMENT', `스키마에서 요소를 찾을 수 없습니다: ${element.name}`);
      return null;
    }

    if (schemaElement.inlineComplexType) {
      return schemaElement.inlineComplexType;
    }

    if (schemaElement.inlineSimpleType) {
      return schemaElement.inlineSimpleType;
    }

    if (schemaElement.typeRef) {
      return this.resolveTypeReference(schemaElement.typeRef, namespaceContext);
    }

    return null;
  }

  private resolveTypeReference(
    ref: TypeReference,
    namespaceContext: Map<string, string>,
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
      } as XsdSimpleType;
    }

    let namespaceUri = ref.namespacePrefix ? resolveNamespaceUri(namespaceContext, ref.namespacePrefix) : resolveNamespaceUri(namespaceContext);
    // Fall back to schema namespace prefix map if XML context doesn't have the prefix
    if (!namespaceUri && ref.namespacePrefix) {
      namespaceUri = this.registry.resolveSchemaPrefix(ref.namespacePrefix) ?? '';
    }
    const type = this.registry.resolveType(namespaceUri, ref.name);
    if (!type) {
      this.pushError('UNKNOWN_TYPE', `타입을 찾을 수 없습니다: ${ref.name}`);
    }
    return type ?? null;
  }

  /**
   * Collect all attributes from a complexType, including those inherited
   * through complexContent extension/restriction chains.
   */
  private collectAllAttributes(
    schemaType: XsdComplexType,
    namespaceContext: Map<string, string>,
    visited?: Set<string>,
  ): { attributes: XsdAttribute[]; attributeGroups: XsdAttributeGroup[]; anyAttribute?: XsdAnyAttribute } {
    const attributes: XsdAttribute[] = [...schemaType.attributes];
    const attributeGroups: XsdAttributeGroup[] = [...schemaType.attributeGroups];
    let anyAttribute = schemaType.anyAttribute;

    if (hasComplexContent(schemaType.content)) {
      const derivation = schemaType.content.content;

      // Add attributes from the extension/restriction itself
      attributes.push(...derivation.attributes);
      attributeGroups.push(...derivation.attributeGroups);
      if (derivation.anyAttribute) {
        anyAttribute = anyAttribute ?? derivation.anyAttribute;
      }

      // For extensions, also inherit base type attributes
      if (derivation.derivation === 'extension') {
        const seen = visited ?? new Set<string>();
        const baseKey = `${derivation.base.namespacePrefix ?? ''}:${derivation.base.name}`;
        if (!seen.has(baseKey)) {
          seen.add(baseKey);
          const baseNs = derivation.base.namespacePrefix
            ? resolveNamespaceUri(namespaceContext, derivation.base.namespacePrefix)
            : resolveNamespaceUri(namespaceContext);
          const baseType = this.registry.resolveType(baseNs, derivation.base.name);
          if (baseType && baseType.kind === 'complexType') {
            const baseAttrs = this.collectAllAttributes(baseType, namespaceContext, seen);
            // Base attributes come first, derived can override
            const derivedNames = new Set(attributes.filter(a => a.name).map(a => a.name!));
            for (const baseAttr of baseAttrs.attributes) {
              if (baseAttr.name && !derivedNames.has(baseAttr.name)) {
                attributes.push(baseAttr);
              }
            }
            attributeGroups.push(...baseAttrs.attributeGroups);
            if (baseAttrs.anyAttribute) {
              anyAttribute = anyAttribute ?? baseAttrs.anyAttribute;
            }
          }
        }
      }
    }

    return { attributes, attributeGroups, anyAttribute };
  }

  private validateAttributes(
    attributes: XmlAttribute[],
    schemaType: XsdComplexType,
    namespaceContext: Map<string, string>,
  ): Set<string> {
    const collected = this.collectAllAttributes(schemaType, namespaceContext);
    const allowedAttributes = new Map<string, XsdAttribute>();

    for (const attr of collected.attributes) {
      if (attr.name) {
        allowedAttributes.set(attr.name, attr);
      }
    }

    for (const group of collected.attributeGroups) {
      if (group.ref) {
        const namespaceUri = group.ref.namespacePrefix
          ? resolveNamespaceUri(namespaceContext, group.ref.namespacePrefix)
          : resolveNamespaceUri(namespaceContext);
        const resolved = this.registry.resolveAttributeGroup(namespaceUri, group.ref.name);
        if (resolved?.attributes) {
          for (const attr of resolved.attributes) {
            if (attr.name) {
              allowedAttributes.set(attr.name, attr);
            }
          }
        }
      }
    }

    const validated = new Set<string>();

    for (const xmlAttr of attributes) {
      if (xmlAttr.name.startsWith('xmlns')) {
        continue;
      }

      const attrName = xmlAttr.localName ?? xmlAttr.name;
      const schemaDef = allowedAttributes.get(attrName);
      if (!schemaDef) {
        if (collected.anyAttribute) {
          continue;
        }
        this.pushError('INVALID_ATTRIBUTE', `허용되지 않는 속성: ${xmlAttr.name}`);
        continue;
      }

      this.validateAttributeValue(xmlAttr.value, schemaDef, namespaceContext);
      validated.add(attrName);
    }

    for (const attr of allowedAttributes.values()) {
      if (attr.use === 'prohibited' && validated.has(attr.name ?? '')) {
        this.pushError('INVALID_ATTRIBUTE', `금지된 속성 사용: ${attr.name}`);
      }
    }

    return validated;
  }

  private validateAttributeValue(
    value: string,
    schemaDef: XsdAttribute,
    namespaceContext: Map<string, string>,
  ): void {
    if (schemaDef.inlineType) {
      this.validateSimpleTypeValue(value, schemaDef.inlineType, namespaceContext);
      return;
    }

    if (schemaDef.typeRef) {
      const resolved = this.resolveTypeReference(schemaDef.typeRef, namespaceContext);
      if (resolved && isSimpleType(resolved)) {
        this.validateSimpleTypeValue(value, resolved, namespaceContext);
      }
      return;
    }
  }

  private validateSimpleTypeValue(
    value: string,
    simpleType: XsdSimpleType,
    namespaceContext: Map<string, string>,
  ): void {
    const content = simpleType.content;
    if (content.kind === 'restriction') {
      this.validateRestriction(value, content, namespaceContext);
      return;
    }

    if (content.kind === 'union') {
      this.validateUnion(value, content, namespaceContext);
      return;
    }

    if (content.kind === 'list') {
      this.validateList(value, content, namespaceContext);
    }
  }

  private validateRestriction(
    value: string,
    restriction: SimpleTypeRestriction,
    namespaceContext: Map<string, string>,
  ): void {
    if (!this.validateBuiltinOrReferencedType(value, restriction.base, namespaceContext)) {
      this.pushError('INVALID_VALUE', `타입 검증 실패: ${restriction.base.name}`, value);
      return;
    }

    for (const facet of restriction.facets) {
      if (!this.validateFacet(value, facet)) {
        this.pushFacetError(facet, value);
        return;
      }
    }
  }

  private validateUnion(
    value: string,
    union: SimpleTypeUnion,
    namespaceContext: Map<string, string>,
  ): void {
    for (const memberType of union.memberTypes) {
      if (this.validateBuiltinOrReferencedType(value, memberType, namespaceContext)) {
        return;
      }
    }

    this.pushError('INVALID_VALUE', 'union 멤버 타입과 일치하지 않습니다.', value);
  }

  private validateList(
    value: string,
    list: SimpleTypeList,
    namespaceContext: Map<string, string>,
  ): void {
    const items = value.split(/\s+/).filter(Boolean);
    for (const item of items) {
      if (!this.validateBuiltinOrReferencedType(item, list.itemType, namespaceContext)) {
        this.pushError('INVALID_VALUE', 'list 항목 타입과 일치하지 않습니다.', item);
        return;
      }
    }
  }

  private validateBuiltinOrReferencedType(
    value: string,
    typeRef: TypeReference,
    namespaceContext: Map<string, string>,
  ): boolean {
    if (typeRef.isBuiltin) {
      return this.validateBuiltinType(value, typeRef.name);
    }

    const resolved = this.resolveTypeReference(typeRef, namespaceContext);
    if (!resolved || !isSimpleType(resolved)) {
      return false;
    }

    this.validateSimpleTypeValue(value, resolved, namespaceContext);
    return true;
  }

  private validateFacet(value: string, facet: Facet): boolean {
    switch (facet.type) {
      case 'enumeration':
        return facet.values.includes(value);
      case 'pattern':
        return facet.patterns.some((pattern) => new RegExp(`^${pattern}$`).test(value));
      case 'minLength':
        return value.length >= facet.value;
      case 'maxLength':
        return value.length <= facet.value;
      case 'length':
        return value.length === facet.value;
      case 'minInclusive':
        return parseFloat(value) >= parseFloat(facet.value);
      case 'maxInclusive':
        return parseFloat(value) <= parseFloat(facet.value);
      case 'minExclusive':
        return parseFloat(value) > parseFloat(facet.value);
      case 'maxExclusive':
        return parseFloat(value) < parseFloat(facet.value);
      case 'totalDigits':
        return value.replace(/[-+.]/g, '').length <= facet.value;
      case 'fractionDigits':
        if (value.includes('.')) {
          const parts = value.split('.');
          return (parts[1]?.length ?? 0) <= facet.value;
        }
        return true;
      case 'whiteSpace':
        return true;
      default:
        return true;
    }
  }

  private validateBuiltinType(value: string, typeName: string): boolean {
    switch (typeName) {
      case 'string':
      case 'normalizedString':
        return true;
      case 'boolean':
        return ['true', 'false', '1', '0'].includes(value);
      case 'integer':
        return /^[+-]?\d+$/.test(value);
      case 'int': {
        const num = parseInt(value, 10);
        return !Number.isNaN(num) && num >= -2147483648 && num <= 2147483647;
      }
      case 'unsignedInt': {
        const num = parseInt(value, 10);
        return !Number.isNaN(num) && num >= 0 && num <= 4294967295;
      }
      case 'unsignedByte': {
        const num = parseInt(value, 10);
        return !Number.isNaN(num) && num >= 0 && num <= 255;
      }
      case 'decimal':
      case 'float':
      case 'double':
        return !Number.isNaN(parseFloat(value));
      case 'hexBinary':
        return /^[0-9A-Fa-f]*$/.test(value) && value.length % 2 === 0;
      case 'base64Binary':
        return /^[A-Za-z0-9+/]*={0,2}$/.test(value);
      case 'dateTime':
        return !Number.isNaN(Date.parse(value));
      case 'token':
        return value === value.trim() && !/\s{2,}/.test(value);
      case 'NCName':
        return /^[a-zA-Z_][\w.-]*$/.test(value) && !value.includes(':');
      default:
        return true;
    }
  }

  private validateTextContent(frame: ElementStackFrame, textContent: string): void {
    const schemaType = frame.schemaType;
    if (!schemaType) {
      return;
    }

    if (!isComplexSchemaType(schemaType)) {
      // For simple types, validate as simple type value
      this.validateSimpleTypeValue(textContent.trim(), schemaType, this.context.namespaceStack[this.context.namespaceStack.length - 1] ?? new Map());
      return;
    }

    if (hasSimpleContent(schemaType.content)) {
      const baseType = schemaType.content.content.base;
      this.validateBuiltinOrReferencedType(textContent.trim(), baseType, this.context.namespaceStack[this.context.namespaceStack.length - 1] ?? new Map());
      return;
    }

    if (hasComplexContent(schemaType.content)) {
      if (!schemaType.content.mixed && !this.context.options.allowWhitespace) {
        this.pushError('UNEXPECTED_TEXT', 'complexContent에서 텍스트가 허용되지 않습니다.', textContent);
      }
    }
  }

  private checkRequiredAttributes(schemaType: XsdComplexType, frame: ElementStackFrame): void {
    const namespaceContext = this.context.namespaceStack[this.context.namespaceStack.length - 1] ?? new Map();
    const collected = this.collectAllAttributes(schemaType, namespaceContext);

    for (const attr of collected.attributes) {
      if (attr.use === 'required' && attr.name && !frame.validatedAttributes.has(attr.name)) {
        this.pushError('MISSING_REQUIRED_ATTR', `필수 속성 누락: ${attr.name}`);
      }
    }

    for (const group of collected.attributeGroups) {
      if (group.ref) {
        const namespaceUri = group.ref.namespacePrefix
          ? resolveNamespaceUri(namespaceContext, group.ref.namespacePrefix)
          : resolveNamespaceUri(namespaceContext);
        const resolved = this.registry.resolveAttributeGroup(namespaceUri, group.ref.name);
        if (resolved?.attributes) {
          for (const attr of resolved.attributes) {
            if (attr.use === 'required' && attr.name && !frame.validatedAttributes.has(attr.name)) {
              this.pushError('MISSING_REQUIRED_ATTR', `필수 속성 누락: ${attr.name}`);
            }
          }
        }
      }
    }
  }

  private pushFacetError(facet: Facet, value: string): void {
    const code = facet.type === 'enumeration' ? 'INVALID_ENUM_VALUE' : 'INVALID_VALUE';
    this.pushError(code, `Facet 검증 실패 (${facet.type})`, value);
  }

  private pushError(code: ValidationErrorCode | string, message: string, value?: string): void {
    this.context.errors.push({
      code,
      message,
      path: this.currentPath(),
      value,
    });

    if (this.context.options.failFast) {
      throw new Error(message);
    }
  }

  private currentPath(): string {
    const parts = this.context.elementStack.map((frame) => frame.elementName);
    return `/${parts.join('/')}`;
  }

  private extractElementFromParticle(
    particle: FlattenedParticle,
    namespaceContext: Map<string, string>,
  ): { typeRef?: TypeReference; inlineComplexType?: XsdComplexType; inlineSimpleType?: XsdSimpleType } | undefined {
    const p = particle.particle;

    // Handle element particles - extract type information
    if (isElement(p)) {
      // If element uses ref, resolve it from registry
      if (p.ref && !p.typeRef && !p.inlineComplexType && !p.inlineSimpleType) {
        let refNs = p.ref.namespacePrefix
          ? resolveNamespaceUri(namespaceContext, p.ref.namespacePrefix)
          : resolveNamespaceUri(namespaceContext);
        if (!refNs && p.ref.namespacePrefix) {
          refNs = this.registry.resolveSchemaPrefix(p.ref.namespacePrefix) ?? '';
        }
        return this.registry.resolveElement(refNs, p.ref.name);
      }

      return {
        typeRef: p.typeRef,
        inlineComplexType: p.inlineComplexType,
        inlineSimpleType: p.inlineSimpleType,
      };
    }

    // Handle any particles - allow any content without validation
    if (isAny(p)) {
      return undefined;
    }

    // Handle nested compositors - rely on compositor state machine
    return undefined;
  }
}

export function createValidationEngine(registry: SchemaRegistry, options?: ValidationOptions): ValidationEngine {
  return new ValidationEngine(registry, options);
}

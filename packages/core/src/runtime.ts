import type {
  XsdComplexType,
  XsdSimpleType,
  XsdElement,
  XsdAny,
  XsdChoice,
  XsdSequence,
  XsdAll,
  XsdGroupRef,
  SchemaRegistry,
} from './types';

export interface FlattenedParticle {
  index: number;
  particle: XsdElement | XsdAny | XsdSequence | XsdChoice | XsdAll | XsdGroupRef;
  minOccurs: number;
  maxOccurs: number | 'unbounded';
  allowedNames?: Set<string>;
}

export interface CompositorState {
  kind: 'sequence' | 'choice' | 'all';
  flattenedParticles: FlattenedParticle[];
  currentIndex: number;
  selectedBranch: number | null;
  appearedElements: Set<string>;
  occurrenceCounts: Map<number, number>;
  nestedStates: Map<number, CompositorState>;
}

export interface ElementStackFrame {
  elementName: string;
  namespaceUri: string;
  schemaType: XsdComplexType | XsdSimpleType | null;
  compositorState: CompositorState | null;
  textContent: string;
  validatedAttributes: Set<string>;
}

export interface XmlAttribute {
  name: string;
  value: string;
  localName?: string;
  namespaceUri?: string;
}

export interface XmlElementInfo {
  name: string;
  localName: string;
  namespaceUri: string;
  attributes: XmlAttribute[];
  namespaceDeclarations?: Map<string, string>;
}

export interface RuntimeValidationContext {
  registry: SchemaRegistry;
  elementStack: ElementStackFrame[];
  namespaceStack: Map<string, string>[];
  errors: Array<{ code: string; message: string; path: string; value?: string; expected?: string }>;
  warnings: Array<{ code: string; message: string; path: string }>;
  idValues: Set<string>;
  idrefValues: Set<string>;
  options: {
    strict?: boolean;
    failFast?: boolean;
    maxErrors?: number;
    includeWarnings?: boolean;
    customValidators?: Map<string, (value: string) => boolean>;
    allowWhitespace?: boolean;
  };
}

export function createRuntimeContext(registry: SchemaRegistry): RuntimeValidationContext {
  return {
    registry,
    elementStack: [],
    namespaceStack: [new Map()],
    errors: [],
    warnings: [],
    idValues: new Set(),
    idrefValues: new Set(),
    options: {},
  };
}

export function withNamespaceContext(
  stack: Map<string, string>[],
  declarations?: Map<string, string>,
): Map<string, string> {
  const current = new Map(stack[stack.length - 1]);
  if (declarations) {
    for (const [prefix, uri] of declarations.entries()) {
      current.set(prefix, uri);
    }
  }
  return current;
}

export function resolveNamespaceUri(context: Map<string, string>, prefix?: string): string {
  if (!prefix) {
    return context.get('') ?? '';
  }
  return context.get(prefix) ?? '';
}

export function makeQualifiedName(namespaceUri: string, localName: string): string {
  return `${namespaceUri}:${localName}`;
}

export function isComplexSchemaType(
  schemaType: XsdComplexType | XsdSimpleType | null,
): schemaType is XsdComplexType {
  return Boolean(schemaType && schemaType.kind === 'complexType');
}

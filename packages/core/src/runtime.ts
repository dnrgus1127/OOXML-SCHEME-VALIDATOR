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
} from './types'

export interface FlattenedParticle {
  index: number
  particle: XsdElement | XsdAny | XsdSequence | XsdChoice | XsdAll | XsdGroupRef
  minOccurs: number
  maxOccurs: number | 'unbounded'
  allowedNames?: Set<string>
}

export interface CompositorState {
  kind: 'sequence' | 'choice' | 'all'
  flattenedParticles: FlattenedParticle[]
  currentIndex: number
  selectedBranch: number | null
  appearedElements: Set<string>
  occurrenceCounts: Map<number, number>
  nestedStates: Map<number, CompositorState>
}

export interface ElementStackFrame {
  elementName: string
  namespaceUri: string
  schemaNamespaceUri: string
  schemaType: XsdComplexType | XsdSimpleType | null
  compositorState: CompositorState | null
  textContent: string
  validatedAttributes: Set<string>
}

export interface XmlAttribute {
  name: string
  value: string
  localName?: string
  namespaceUri?: string
}

export interface XmlElementInfo {
  name: string
  localName: string
  namespaceUri: string
  attributes: XmlAttribute[]
  namespaceDeclarations?: Map<string, string>
}

export interface RuntimeValidationContext {
  registry: SchemaRegistry
  elementStack: ElementStackFrame[]
  namespaceStack: Map<string, string>[]
  errors: Array<{ code: string; message: string; path: string; value?: string; expected?: string }>
  warnings: Array<{ code: string; message: string; path: string }>
  idValues: Set<string>
  idrefValues: Set<string>
  options: {
    strict?: boolean
    failFast?: boolean
    maxErrors?: number
    includeWarnings?: boolean
    customValidators?: Map<string, (value: string) => boolean>
    allowWhitespace?: boolean
  }
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
  }
}

export function withNamespaceContext(
  stack: Map<string, string>[],
  declarations?: Map<string, string>
): Map<string, string> {
  const current = new Map(stack[stack.length - 1])
  if (declarations) {
    for (const [prefix, uri] of declarations.entries()) {
      current.set(prefix, uri)
    }
  }
  return current
}

export function resolveNamespaceUri(context: Map<string, string>, prefix?: string): string {
  if (!prefix) {
    return context.get('') ?? ''
  }
  return context.get(prefix) ?? ''
}

/**
 * Namespace mapping: Transitional (used in most Office files) -> Strict (used in XSD schemas)
 */
const TRANSITIONAL_TO_STRICT_NS: Record<string, string> = {
  'http://schemas.openxmlformats.org/spreadsheetml/2006/main':
    'http://purl.oclc.org/ooxml/spreadsheetml/main',
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main':
    'http://purl.oclc.org/ooxml/wordprocessingml/main',
  'http://schemas.openxmlformats.org/presentationml/2006/main':
    'http://purl.oclc.org/ooxml/presentationml/main',
  'http://schemas.openxmlformats.org/drawingml/2006/main':
    'http://purl.oclc.org/ooxml/drawingml/main',
  'http://schemas.openxmlformats.org/drawingml/2006/chart':
    'http://purl.oclc.org/ooxml/drawingml/chart',
  'http://schemas.openxmlformats.org/drawingml/2006/chartDrawing':
    'http://purl.oclc.org/ooxml/drawingml/chartDrawing',
  'http://schemas.openxmlformats.org/drawingml/2006/diagram':
    'http://purl.oclc.org/ooxml/drawingml/diagram',
  'http://schemas.openxmlformats.org/drawingml/2006/picture':
    'http://purl.oclc.org/ooxml/drawingml/picture',
  'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing':
    'http://purl.oclc.org/ooxml/drawingml/spreadsheetDrawing',
  'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing':
    'http://purl.oclc.org/ooxml/drawingml/wordprocessingDrawing',
  'http://schemas.openxmlformats.org/drawingml/2006/lockedCanvas':
    'http://purl.oclc.org/ooxml/drawingml/lockedCanvas',
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships':
    'http://purl.oclc.org/ooxml/officeDocument/relationships',
  'http://schemas.openxmlformats.org/officeDocument/2006/sharedTypes':
    'http://purl.oclc.org/ooxml/officeDocument/sharedTypes',
  'http://schemas.openxmlformats.org/officeDocument/2006/math':
    'http://purl.oclc.org/ooxml/officeDocument/math',
  'http://schemas.openxmlformats.org/officeDocument/2006/bibliography':
    'http://purl.oclc.org/ooxml/officeDocument/bibliography',
  'http://schemas.openxmlformats.org/officeDocument/2006/characteristics':
    'http://purl.oclc.org/ooxml/officeDocument/characteristics',
  'http://schemas.openxmlformats.org/officeDocument/2006/custom-properties':
    'http://purl.oclc.org/ooxml/officeDocument/custom-properties',
  'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties':
    'http://purl.oclc.org/ooxml/officeDocument/extended-properties',
  'http://schemas.openxmlformats.org/officeDocument/2006/customXml':
    'http://purl.oclc.org/ooxml/officeDocument/customXml',
  'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes':
    'http://purl.oclc.org/ooxml/officeDocument/docPropsVTypes',
}

/** Normalize namespace URI: Convert Transitional to Strict if applicable */
export function normalizeNamespace(namespaceUri: string): string {
  return TRANSITIONAL_TO_STRICT_NS[namespaceUri] || namespaceUri
}

export function makeQualifiedName(namespaceUri: string, localName: string): string {
  return `${normalizeNamespace(namespaceUri)}:${localName}`
}

export function isComplexSchemaType(
  schemaType: XsdComplexType | XsdSimpleType | null
): schemaType is XsdComplexType {
  return Boolean(schemaType && schemaType.kind === 'complexType')
}

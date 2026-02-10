import type {
  ComplexContent,
  ElementContent,
  SchemaRegistry,
  XsdAll,
  XsdChoice,
  XsdComplexType,
  XsdSequence,
} from '../types'
import { hasComplexContent, hasElementContent } from '../types'
import { CompositorState } from '../runtime'
import type { NamespaceResolver } from './compositor-types'
import { flattenParticles, resolveGroupCompositor } from './compositor-utils'

/**
 * Compositor로부터 상태 객체를 생성합니다.
 *
 * @param compositor - sequence, choice, all 중 하나
 * @param registry - 스키마 레지스트리
 * @param resolver - 네임스페이스 URI 변환기
 * @returns 새로 생성된 compositor 상태
 */
export function createCompositorState(
  compositor: XsdSequence | XsdChoice | XsdAll,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): CompositorState {
  const flattenedParticles = flattenParticles(
    compositor.kind === 'all' ? compositor.elements : compositor.particles,
    registry,
    resolver
  )

  return {
    kind: compositor.kind,
    flattenedParticles,
    currentIndex: 0,
    selectedBranch: null,
    appearedElements: new Set(),
    occurrenceCounts: new Map(),
    nestedStates: new Map(),
  }
}

/**
 * 스키마 타입으로부터 compositor 상태를 초기화합니다.
 *
 * @param schemaType - XSD 복합 타입 정의
 * @param registry - 스키마 레지스트리 (타입/그룹 조회용)
 * @param resolver - 네임스페이스 URI 변환기
 * @returns 초기화된 compositor 상태, 또는 content model이 없으면 null
 */
export function initCompositorState(
  schemaType: XsdComplexType | null,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): CompositorState | null {
  if (!schemaType) {
    return null
  }

  if (hasElementContent(schemaType.content)) {
    const content = schemaType.content as ElementContent
    const compositor =
      content.compositor ?? resolveGroupCompositor(content.groupRef, registry, resolver)
    if (!compositor) {
      return null
    }
    return createCompositorState(compositor, registry, resolver)
  }

  if (hasComplexContent(schemaType.content)) {
    return initComplexContentCompositorState(schemaType.content, registry, resolver)
  }

  return null
}

function initComplexContentCompositorState(
  content: ComplexContent,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): CompositorState | null {
  const derivation = content.content
  const extensionCompositor =
    derivation.compositor ?? resolveGroupCompositor(derivation.groupRef, registry, resolver)

  const baseResult = resolveBaseCompositor(derivation, registry, resolver, extensionCompositor)
  if (baseResult.earlyReturn !== undefined) {
    return baseResult.earlyReturn
  }

  if (derivation.derivation === 'restriction') {
    if (!extensionCompositor) {
      return null
    }
    return createCompositorState(extensionCompositor, registry, resolver)
  }

  return mergeCompositors(baseResult.compositor, extensionCompositor, registry, resolver)
}

/**
 * Recursively resolve the base type's compositor from a complexContent derivation.
 * Returns `earlyReturn` when the recursive base state can be directly used or merged.
 */
export function resolveBaseCompositor(
  derivation: ComplexContent['content'],
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
  extensionCompositor: XsdSequence | XsdChoice | XsdAll | undefined
): { compositor?: XsdSequence | XsdChoice | XsdAll; earlyReturn?: CompositorState | null } {
  const baseNamespaceUri = derivation.base.namespacePrefix
    ? resolver.resolveNamespaceUri(derivation.base.namespacePrefix)
    : resolver.resolveNamespaceUri()
  const baseType = registry.resolveType(baseNamespaceUri, derivation.base.name)

  if (!baseType || baseType.kind !== 'complexType') {
    return {}
  }

  if (hasElementContent(baseType.content)) {
    const baseContent = baseType.content as ElementContent
    return {
      compositor:
        baseContent.compositor ?? resolveGroupCompositor(baseContent.groupRef, registry, resolver),
    }
  }

  if (hasComplexContent(baseType.content)) {
    const baseState = initComplexContentCompositorState(baseType.content, registry, resolver)
    if (baseState) {
      if (!extensionCompositor) {
        return { earlyReturn: baseState }
      }
      const extensionParticles = flattenParticles(
        extensionCompositor.kind === 'all'
          ? extensionCompositor.elements
          : extensionCompositor.particles,
        registry,
        resolver,
        baseState.flattenedParticles.length
      )
      return {
        earlyReturn: {
          kind: 'sequence',
          flattenedParticles: [...baseState.flattenedParticles, ...extensionParticles],
          currentIndex: 0,
          selectedBranch: null,
          appearedElements: new Set(),
          occurrenceCounts: new Map(),
          nestedStates: new Map(),
        },
      }
    }
  }

  return {}
}

/**
 * Merge base compositor and extension compositor into a single sequence state.
 * Handles cases where one or both are undefined.
 */
export function mergeCompositors(
  baseCompositor: XsdSequence | XsdChoice | XsdAll | undefined,
  extensionCompositor: XsdSequence | XsdChoice | XsdAll | undefined,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): CompositorState | null {
  if (!baseCompositor && !extensionCompositor) {
    return null
  }

  if (!baseCompositor && extensionCompositor) {
    return createCompositorState(extensionCompositor, registry, resolver)
  }

  if (baseCompositor && !extensionCompositor) {
    return createCompositorState(baseCompositor, registry, resolver)
  }

  const baseParticles = flattenParticles(
    baseCompositor!.kind === 'all' ? baseCompositor!.elements : baseCompositor!.particles,
    registry,
    resolver
  )
  const extParticles = flattenParticles(
    extensionCompositor!.kind === 'all'
      ? extensionCompositor!.elements
      : extensionCompositor!.particles,
    registry,
    resolver,
    baseParticles.length
  )

  return {
    kind: 'sequence',
    flattenedParticles: [...baseParticles, ...extParticles],
    currentIndex: 0,
    selectedBranch: null,
    appearedElements: new Set(),
    occurrenceCounts: new Map(),
    nestedStates: new Map(),
  }
}

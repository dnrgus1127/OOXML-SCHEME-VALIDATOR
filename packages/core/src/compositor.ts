import type {
  ComplexContent,
  ElementContent,
  Particle,
  SchemaRegistry,
  XsdAll,
  XsdChoice,
  XsdComplexType,
  XsdElement,
  XsdGroup,
  XsdGroupRef,
  XsdSequence,
} from './types'
import {
  hasComplexContent,
  hasElementContent,
  isAll,
  isAny,
  isChoice,
  isElement,
  isGroupRef,
  isSequence,
} from './types'
import { CompositorState, FlattenedParticle, makeQualifiedName } from './runtime'

interface NamespaceResolver {
  resolveNamespaceUri(prefix?: string): string
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
function resolveBaseCompositor(
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
function mergeCompositors(
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
 * XML 자식 요소가 compositor 상태에 맞는지 검증합니다.
 *
 * @param childNamespaceUri - 자식 요소의 네임스페이스 URI
 * @param childLocalName - 자식 요소의 로컬 이름
 * @param state - 현재 compositor 상태 (sequence/choice/all)
 * @param registry - 스키마 레지스트리
 * @param resolver - 네임스페이스 URI 변환기
 * @returns 검증 결과 (성공 여부, 에러 코드, 매치된 particle)
 */
export function validateCompositorChild(
  childNamespaceUri: string,
  childLocalName: string,
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): { success: boolean; errorCode?: string; matchedParticle?: FlattenedParticle } {
  switch (state.kind) {
    case 'sequence':
      return validateSequenceChild(childNamespaceUri, childLocalName, state, registry, resolver)
    case 'choice':
      return validateChoiceChild(childNamespaceUri, childLocalName, state, registry, resolver)
    case 'all':
      return validateAllChild(childNamespaceUri, childLocalName, state, registry, resolver)
    default:
      return { success: false, errorCode: 'INVALID_CONTENT' }
  }
}

/**
 * Compositor 상태에서 필수 요소가 누락되었는지 확인합니다.
 *
 * @param state - 검사할 compositor 상태
 * @param registry - 스키마 레지스트리
 * @param resolver - 네임스페이스 URI 변환기
 * @returns 누락된 필수 요소들의 설명 배열
 */
export function checkMissingRequiredElements(
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): string[] {
  const missing: string[] = []

  if (state.kind === 'choice') {
    if (state.selectedBranch === null) {
      return missing
    }

    const particle = state.flattenedParticles[state.selectedBranch]
    if (particle) {
      const count = state.occurrenceCounts.get(particle.index) ?? 0
      if (count < particle.minOccurs) {
        missing.push(particleDescription(particle))
      }

      const nestedState = state.nestedStates.get(particle.index)
      if (nestedState) {
        missing.push(...checkMissingRequiredElements(nestedState, registry, resolver))
      }
    }

    return missing
  }

  for (const particle of state.flattenedParticles) {
    const count = state.occurrenceCounts.get(particle.index) ?? 0
    if (count < particle.minOccurs) {
      missing.push(particleDescription(particle))
      continue
    }

    const nestedState = state.nestedStates.get(particle.index)
    if (nestedState) {
      missing.push(...checkMissingRequiredElements(nestedState, registry, resolver))
    }
  }

  return missing
}

/**
 * Sequence compositor에서 자식 요소를 검증합니다.
 * Sequence는 스키마에 정의된 순서대로 요소가 나타나야 합니다.
 *
 * @param childNamespaceUri - 자식 요소의 네임스페이스 URI
 * @param childLocalName - 자식 요소의 로컬 이름
 * @param state - sequence compositor 상태
 * @param registry - 스키마 레지스트리
 * @param resolver - 네임스페이스 URI 변환기
 * @returns 검증 결과
 */
function validateSequenceChild(
  childNamespaceUri: string,
  childLocalName: string,
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): { success: boolean; errorCode?: string; matchedParticle?: FlattenedParticle } {
  const qualifiedName = makeQualifiedName(childNamespaceUri, childLocalName)

  for (let i = state.currentIndex; i < state.flattenedParticles.length; i += 1) {
    const particle = state.flattenedParticles[i]
    if (!particle) continue

    // For nested compositors, delegate validation to nested state
    if (isNestedCompositor(particle.particle)) {
      const nested = getOrCreateNestedState(state, particle, registry, resolver)
      const nestedResult = validateCompositorChild(
        childNamespaceUri,
        childLocalName,
        nested,
        registry,
        resolver
      )
      if (nestedResult.success) {
        if (!state.occurrenceCounts.has(i)) {
          state.occurrenceCounts.set(i, 1)
        }
        state.currentIndex = i
        return { success: true, matchedParticle: nestedResult.matchedParticle }
      }
      // Nested compositor didn't match — try starting a new occurrence if allowed
      const count = state.occurrenceCounts.get(i) ?? 0
      if (count > 0 && (particle.maxOccurs === 'unbounded' || count < particle.maxOccurs)) {
        const freshNested = resetNestedState(state, particle, registry, resolver)
        const retryResult = validateCompositorChild(
          childNamespaceUri,
          childLocalName,
          freshNested,
          registry,
          resolver
        )
        if (retryResult.success) {
          state.occurrenceCounts.set(i, count + 1)
          state.currentIndex = i
          return { success: true, matchedParticle: retryResult.matchedParticle }
        }
      }
      if (count < particle.minOccurs) {
        return { success: false, errorCode: 'MISSING_REQUIRED_ELEMENT' }
      }
      continue
    }

    const canMatch = particleAllows(qualifiedName, particle, state, registry, resolver)

    if (canMatch) {
      const count = (state.occurrenceCounts.get(i) ?? 0) + 1
      state.occurrenceCounts.set(i, count)
      if (particle.maxOccurs !== 'unbounded' && count > particle.maxOccurs) {
        return { success: false, errorCode: 'TOO_MANY_ELEMENTS' }
      }

      if (particle.maxOccurs !== 'unbounded' && count === particle.maxOccurs) {
        state.currentIndex = i + 1
      } else {
        state.currentIndex = i
      }

      return { success: true, matchedParticle: particle }
    }

    const count = state.occurrenceCounts.get(i) ?? 0
    if (count < particle.minOccurs) {
      return { success: false, errorCode: 'MISSING_REQUIRED_ELEMENT' }
    }
  }

  return { success: false, errorCode: 'INVALID_ELEMENT' }
}

/**
 * Choice compositor에서 자식 요소를 검증합니다.
 * Choice는 여러 옵션 중 하나만 선택되어야 하며, 한 번 선택되면 해당 branch를 계속 따릅니다.
 *
 * @param childNamespaceUri - 자식 요소의 네임스페이스 URI
 * @param childLocalName - 자식 요소의 로컬 이름
 * @param state - choice compositor 상태
 * @param registry - 스키마 레지스트리
 * @param resolver - 네임스페이스 URI 변환기
 * @returns 검증 결과
 */
function validateChoiceChild(
  childNamespaceUri: string,
  childLocalName: string,
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): { success: boolean; errorCode?: string; matchedParticle?: FlattenedParticle } {
  const qualifiedName = makeQualifiedName(childNamespaceUri, childLocalName)

  if (state.selectedBranch !== null) {
    const particle = state.flattenedParticles[state.selectedBranch]
    if (particle) {
      const matchResult = matchParticle(
        childNamespaceUri,
        childLocalName,
        qualifiedName,
        particle,
        state,
        registry,
        resolver
      )
      if (matchResult) {
        if (!isNestedCompositor(particle.particle)) {
          const count = (state.occurrenceCounts.get(state.selectedBranch) ?? 0) + 1
          state.occurrenceCounts.set(state.selectedBranch, count)
          if (particle.maxOccurs !== 'unbounded' && count > particle.maxOccurs) {
            return { success: false, errorCode: 'TOO_MANY_ELEMENTS' }
          }
        }
        return { success: true, matchedParticle: matchResult }
      }

      const count = state.occurrenceCounts.get(particle.index) ?? 0
      if (count < particle.minOccurs) {
        return { success: false, errorCode: 'MISSING_REQUIRED_ELEMENT' }
      }
    }

    // Branch is exhausted or doesn't match — return failure.
    // The PARENT compositor handles re-occurrence via the reset mechanism
    // (respecting its own maxOccurs), rather than re-selecting here.
    return { success: false, errorCode: 'CHOICE_NOT_SATISFIED' }
  }

  for (let i = 0; i < state.flattenedParticles.length; i += 1) {
    const particle = state.flattenedParticles[i]
    if (!particle) continue
    const matchResult = matchParticle(
      childNamespaceUri,
      childLocalName,
      qualifiedName,
      particle,
      state,
      registry,
      resolver
    )
    if (matchResult) {
      state.selectedBranch = i
      state.occurrenceCounts.set(i, 1)
      return { success: true, matchedParticle: matchResult }
    }
  }

  return { success: false, errorCode: 'CHOICE_NOT_SATISFIED' }
}

/**
 * Try to match a child element against a particle.
 * For nested compositors, delegates to nested state and returns the actual element particle.
 * Returns the matched FlattenedParticle or undefined if no match.
 */
function matchParticle(
  childNamespaceUri: string,
  childLocalName: string,
  qualifiedName: string,
  particle: FlattenedParticle,
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): FlattenedParticle | undefined {
  if (isSequence(particle.particle) || isChoice(particle.particle) || isAll(particle.particle)) {
    const nested = getOrCreateNestedState(state, particle, registry, resolver)
    const nestedResult = validateCompositorChild(
      childNamespaceUri,
      childLocalName,
      nested,
      registry,
      resolver
    )
    if (nestedResult.success) {
      return nestedResult.matchedParticle
    }
    // Try reset for a new occurrence if allowed
    const count = state.occurrenceCounts.get(particle.index) ?? 0
    if (count > 0 && (particle.maxOccurs === 'unbounded' || count < particle.maxOccurs)) {
      const freshNested = resetNestedState(state, particle, registry, resolver)
      const retryResult = validateCompositorChild(
        childNamespaceUri,
        childLocalName,
        freshNested,
        registry,
        resolver
      )
      if (retryResult.success) {
        return retryResult.matchedParticle
      }
    }
    return undefined
  }

  if (particleAllows(qualifiedName, particle, state, registry, resolver)) {
    return particle
  }

  return undefined
}

/**
 * All compositor에서 자식 요소를 검증합니다.
 * All은 모든 요소가 나타나야 하지만 순서는 상관없습니다.
 *
 * @param childNamespaceUri - 자식 요소의 네임스페이스 URI
 * @param childLocalName - 자식 요소의 로컬 이름
 * @param state - all compositor 상태
 * @param registry - 스키마 레지스트리
 * @param resolver - 네임스페이스 URI 변환기
 * @returns 검증 결과
 */
function validateAllChild(
  childNamespaceUri: string,
  childLocalName: string,
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): { success: boolean; errorCode?: string; matchedParticle?: FlattenedParticle } {
  const qualifiedName = makeQualifiedName(childNamespaceUri, childLocalName)

  const particle = state.flattenedParticles.find((entry) => entry.allowedNames?.has(qualifiedName))
  if (!particle) {
    return { success: false, errorCode: 'INVALID_ELEMENT' }
  }

  if (state.appearedElements.has(qualifiedName)) {
    return { success: false, errorCode: 'TOO_MANY_ELEMENTS' }
  }

  state.appearedElements.add(qualifiedName)
  const count = (state.occurrenceCounts.get(particle.index) ?? 0) + 1
  state.occurrenceCounts.set(particle.index, count)

  if (particle.maxOccurs !== 'unbounded' && count > particle.maxOccurs) {
    return { success: false, errorCode: 'TOO_MANY_ELEMENTS' }
  }

  const nestedState = state.nestedStates.get(particle.index)
  if (nestedState) {
    return validateCompositorChild(
      childNamespaceUri,
      childLocalName,
      nestedState,
      registry,
      resolver
    )
  }

  return { success: true, matchedParticle: particle }
}

/**
 * Particle이 중첩된 compositor(sequence/choice/all)인지 확인합니다.
 * 중첩된 compositor는 내부에 추가 검증 로직이 필요한 컨테이너 구조입니다.
 *
 * @param particle - 검사할 particle (요소 또는 compositor)
 * @returns sequence, choice, all 중 하나면 true
 */
function isNestedCompositor(particle: Particle | XsdElement): boolean {
  return isSequence(particle) || isChoice(particle) || isAll(particle)
}

/**
 * Particle이 특정 qualified name을 허용하는지 확인합니다.
 *
 * @param qualifiedName - 네임스페이스 URI와 로컬 이름이 결합된 전체 이름
 * @param particle - 확인할 particle
 * @param state - 현재 compositor 상태
 * @param registry - 스키마 레지스트리
 * @param resolver - 네임스페이스 URI 변환기
 * @returns 해당 이름을 허용하면 true
 */
function particleAllows(
  qualifiedName: string,
  particle: FlattenedParticle,
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): boolean {
  if (particle.allowedNames?.has(qualifiedName)) {
    return true
  }

  if (isAny(particle.particle)) {
    return true
  }

  if (isSequence(particle.particle) || isChoice(particle.particle) || isAll(particle.particle)) {
    const nested = getOrCreateNestedState(state, particle, registry, resolver)
    return nested.flattenedParticles.some((nestedParticle) =>
      nestedParticle.allowedNames?.has(qualifiedName)
    )
  }

  return false
}

function getOrCreateNestedState(
  parent: CompositorState,
  particle: FlattenedParticle,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): CompositorState {
  const cached = parent.nestedStates.get(particle.index)
  if (cached) {
    return cached
  }

  if (isSequence(particle.particle) || isChoice(particle.particle) || isAll(particle.particle)) {
    const nested = createCompositorState(particle.particle, registry, resolver)
    parent.nestedStates.set(particle.index, nested)
    return nested
  }

  throw new Error('Invalid nested compositor state')
}

/** Reset a nested compositor state for a new occurrence (e.g., maxOccurs > 1) */
function resetNestedState(
  parent: CompositorState,
  particle: FlattenedParticle,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): CompositorState {
  if (isSequence(particle.particle) || isChoice(particle.particle) || isAll(particle.particle)) {
    const fresh = createCompositorState(particle.particle, registry, resolver)
    parent.nestedStates.set(particle.index, fresh)
    return fresh
  }

  throw new Error('Invalid nested compositor state')
}

function flattenParticles(
  particles: Array<Particle | XsdElement>,
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
  startIndex = 0
): FlattenedParticle[] {
  const flattened: FlattenedParticle[] = []
  let index = startIndex

  for (const particle of particles) {
    if (isGroupRef(particle)) {
      const group = resolveGroup(particle, registry, resolver)
      if (group?.compositor) {
        const nested = flattenParticles(
          group.compositor.kind === 'all' ? group.compositor.elements : group.compositor.particles,
          registry,
          resolver,
          index
        )
        flattened.push(...nested)
        index += nested.length
        continue
      }
    }

    const allowedNames = buildAllowedNames(particle, registry, resolver)
    const occurs = getParticleOccurs(particle)

    flattened.push({
      index,
      particle,
      minOccurs: occurs.minOccurs,
      maxOccurs: occurs.maxOccurs,
      allowedNames,
    })
    index += 1
  }

  return flattened
}

function buildAllowedNames(
  particle: Particle | XsdElement,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): Set<string> | undefined {
  if (isElement(particle)) {
    const name = particle.name ?? particle.ref?.name ?? ''
    const namespace = particle.ref?.namespacePrefix
      ? resolver.resolveNamespaceUri(particle.ref.namespacePrefix)
      : resolver.resolveNamespaceUri()
    return new Set([makeQualifiedName(namespace, name)])
  }

  if (isAll(particle)) {
    return new Set(
      particle.elements.map((element) => {
        const name = element.name ?? element.ref?.name ?? ''
        const namespace = element.ref?.namespacePrefix
          ? resolver.resolveNamespaceUri(element.ref.namespacePrefix)
          : resolver.resolveNamespaceUri()
        return makeQualifiedName(namespace, name)
      })
    )
  }

  if (isSequence(particle) || isChoice(particle)) {
    const nested = flattenParticles(particle.particles, registry, resolver)
    const names = new Set<string>()
    for (const entry of nested) {
      if (entry.allowedNames) {
        for (const name of entry.allowedNames) {
          names.add(name)
        }
      }
    }
    return names
  }

  if (isAny(particle)) {
    return undefined
  }

  if (isGroupRef(particle)) {
    const group = resolveGroup(particle, registry, resolver)
    if (group?.compositor) {
      return buildAllowedNames(group.compositor, registry, resolver)
    }
  }

  return new Set()
}

function resolveGroupCompositor(
  groupRef: XsdGroupRef | undefined,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): XsdSequence | XsdChoice | XsdAll | undefined {
  if (!groupRef) {
    return undefined
  }

  const group = resolveGroup(groupRef, registry, resolver)
  return group?.compositor
}

function resolveGroup(
  groupRef: XsdGroupRef,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): XsdGroup | undefined {
  const namespaceUri = groupRef.ref.namespacePrefix
    ? resolver.resolveNamespaceUri(groupRef.ref.namespacePrefix)
    : resolver.resolveNamespaceUri()
  return registry.resolveGroup(namespaceUri, groupRef.ref.name)
}

function getParticleOccurs(particle: Particle | XsdElement): {
  minOccurs: number
  maxOccurs: number | 'unbounded'
} {
  if ('occurs' in particle) {
    return particle.occurs
  }

  return { minOccurs: 1, maxOccurs: 1 }
}

function particleDescription(particle: FlattenedParticle): string {
  if (isElement(particle.particle)) {
    return particle.particle.name ?? particle.particle.ref?.name ?? 'element'
  }
  if (isGroupRef(particle.particle)) {
    return particle.particle.ref.name
  }
  return particle.particle.kind
}

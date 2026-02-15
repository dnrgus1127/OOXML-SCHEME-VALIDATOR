import type { SchemaRegistry } from '../types'
import { CompositorState, makeQualifiedName } from '../runtime'
import type {
  NamespaceResolver,
  CompositorValidationResult,
  OccurrenceViolation,
} from './compositor-types'
import { particleDescription } from './compositor-utils'

/**
 * All compositor에서 자식 요소를 검증합니다.
 * All은 모든 요소가 나타나야 하지만 순서는 상관없습니다.
 *
 * @param childNamespaceUri - 자식 요소의 네임스페이스 URI
 * @param childLocalName - 자식 요소의 로컬 이름
 * @param state - all compositor 상태
 * @param registry - 스키마 레지스트리
 * @param resolver - 네임스페이스 URI 변환기
 * @param validateCompositorChild - compositor 검증 위임 함수 (순환 의존성 방지)
 * @returns 검증 결과
 */
export function validateAllChild(
  childNamespaceUri: string,
  childLocalName: string,
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
  validateCompositorChild: (
    childNamespaceUri: string,
    childLocalName: string,
    state: CompositorState,
    registry: SchemaRegistry,
    resolver: NamespaceResolver
  ) => CompositorValidationResult
): CompositorValidationResult {
  const qualifiedName = makeQualifiedName(childNamespaceUri, childLocalName)

  const particle = state.flattenedParticles.find((entry) => entry.allowedNames?.has(qualifiedName))
  if (!particle) {
    return { success: false, errorCode: 'INVALID_ELEMENT' }
  }

  if (state.appearedElements.has(qualifiedName)) {
    const actualCount = (state.occurrenceCounts.get(particle.index) ?? 0) + 1
    return {
      success: false,
      errorCode: 'TOO_MANY_ELEMENTS',
      matchedParticle: particle,
      occurrenceViolation: {
        elementName: particleDescription(particle),
        minOccurs: particle.minOccurs,
        maxOccurs: particle.maxOccurs,
        actualCount,
        kind: 'tooMany',
      },
    }
  }

  state.appearedElements.add(qualifiedName)
  const count = (state.occurrenceCounts.get(particle.index) ?? 0) + 1
  state.occurrenceCounts.set(particle.index, count)

  if (particle.maxOccurs !== 'unbounded' && count > particle.maxOccurs) {
    return {
      success: false,
      errorCode: 'TOO_MANY_ELEMENTS',
      matchedParticle: particle,
      occurrenceViolation: {
        elementName: particleDescription(particle),
        minOccurs: particle.minOccurs,
        maxOccurs: particle.maxOccurs,
        actualCount: count,
        kind: 'tooMany',
      },
    }
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
 * Compositor 상태에서 필수 요소가 누락되었는지 확인합니다.
 *
 * @param state - 검사할 compositor 상태
 * @param registry - 스키마 레지스트리
 * @param resolver - 네임스페이스 URI 변환기
 * @param _checkMissingRequiredElementsRecursive - 재귀 호출 함수 (순환 의존성 방지)
 * @returns 누락된 필수 요소들의 설명 배열
 */
export function checkMissingRequiredElements(
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
  _checkMissingRequiredElementsRecursive: (
    state: CompositorState,
    registry: SchemaRegistry,
    resolver: NamespaceResolver
  ) => string[]
): string[] {
  return checkMissingRequiredElementDetails(
    state,
    registry,
    resolver,
    checkMissingRequiredElementDetails
  ).map((detail) => detail.elementName)
}

/**
 * Compositor 상태에서 필수 요소 occurrence(minOccurs)가 부족한 상세 정보를 반환합니다.
 */
export function checkMissingRequiredElementDetails(
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
  checkMissingRequiredElementDetailsRecursive?: (
    state: CompositorState,
    registry: SchemaRegistry,
    resolver: NamespaceResolver
  ) => OccurrenceViolation[]
): OccurrenceViolation[] {
  const recurse =
    checkMissingRequiredElementDetailsRecursive ??
    ((nestedState: CompositorState, nestedRegistry: SchemaRegistry, nestedResolver: NamespaceResolver) =>
      checkMissingRequiredElementDetails(nestedState, nestedRegistry, nestedResolver))

  const missing: OccurrenceViolation[] = []

  if (state.kind === 'choice') {
    if (state.selectedBranch === null) {
      return missing
    }

    const particle = state.flattenedParticles[state.selectedBranch]
    if (particle) {
      const count = state.occurrenceCounts.get(particle.index) ?? 0
      if (count < particle.minOccurs) {
        missing.push({
          elementName: particleDescription(particle),
          minOccurs: particle.minOccurs,
          maxOccurs: particle.maxOccurs,
          actualCount: count,
          kind: 'tooFew',
        })
      }

      const nestedState = state.nestedStates.get(particle.index)
      if (nestedState) {
        missing.push(...recurse(nestedState, registry, resolver))
      }
    }

    return missing
  }

  for (const particle of state.flattenedParticles) {
    const count = state.occurrenceCounts.get(particle.index) ?? 0
    if (count < particle.minOccurs) {
      missing.push({
        elementName: particleDescription(particle),
        minOccurs: particle.minOccurs,
        maxOccurs: particle.maxOccurs,
        actualCount: count,
        kind: 'tooFew',
      })
      continue
    }

    const nestedState = state.nestedStates.get(particle.index)
    if (nestedState) {
      missing.push(...recurse(nestedState, registry, resolver))
    }
  }

  return missing
}

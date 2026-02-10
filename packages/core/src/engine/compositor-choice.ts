import type { SchemaRegistry } from '../types'
import { isAll, isChoice, isSequence } from '../types'
import { CompositorState, FlattenedParticle, makeQualifiedName } from '../runtime'
import type { NamespaceResolver, CompositorValidationResult } from './compositor-types'
import {
  getOrCreateNestedState,
  isNestedCompositor,
  particleAllows,
  resetNestedState,
} from './compositor-utils'

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
  resolver: NamespaceResolver,
  validateCompositorChild: (
    childNamespaceUri: string,
    childLocalName: string,
    state: CompositorState,
    registry: SchemaRegistry,
    resolver: NamespaceResolver
  ) => CompositorValidationResult
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
 * Choice compositor에서 자식 요소를 검증합니다.
 * Choice는 여러 옵션 중 하나만 선택되어야 하며, 한 번 선택되면 해당 branch를 계속 따릅니다.
 *
 * @param childNamespaceUri - 자식 요소의 네임스페이스 URI
 * @param childLocalName - 자식 요소의 로컬 이름
 * @param state - choice compositor 상태
 * @param registry - 스키마 레지스트리
 * @param resolver - 네임스페이스 URI 변환기
 * @param validateCompositorChild - compositor 검증 위임 함수 (순환 의존성 방지)
 * @returns 검증 결과
 */
export function validateChoiceChild(
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
        resolver,
        validateCompositorChild
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
      resolver,
      validateCompositorChild
    )
    if (matchResult) {
      state.selectedBranch = i
      state.occurrenceCounts.set(i, 1)
      return { success: true, matchedParticle: matchResult }
    }
  }

  return { success: false, errorCode: 'CHOICE_NOT_SATISFIED' }
}

import type { SchemaRegistry } from '../types'
import { CompositorState, FlattenedParticle, makeQualifiedName } from '../runtime'
import type {
  NamespaceResolver,
  CompositorValidationResult,
  OccurrenceViolation,
} from './compositor-types'
import {
  getOrCreateNestedState,
  isNestedCompositor,
  particleAllows,
  particleDescription,
  resetNestedState,
} from './compositor-utils'

function createOccurrenceViolation(
  particle: FlattenedParticle,
  actualCount: number,
  kind: 'tooMany' | 'tooFew'
): OccurrenceViolation {
  return {
    elementName: particleDescription(particle),
    minOccurs: particle.minOccurs,
    maxOccurs: particle.maxOccurs,
    actualCount,
    kind,
  }
}

/**
 * 필수 요소가 블로킹할 때, 시퀀스의 후속 파티클에서 매칭을 시도합니다.
 * 매칭 성공 시 건너뛴 필수 요소들을 skippedRequired로 보고하고,
 * 해당 파티클의 occurrenceCounts를 minOccurs로 설정하여 endElement 중복 보고를 방지합니다.
 */
function trySkipAhead(
  childNamespaceUri: string,
  childLocalName: string,
  qualifiedName: string,
  blockingIndex: number,
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
): CompositorValidationResult | undefined {
  for (let j = blockingIndex + 1; j < state.flattenedParticles.length; j += 1) {
    const candidate = state.flattenedParticles[j]
    if (!candidate) continue

    let matched = false
    let matchedParticle: FlattenedParticle | undefined

    if (isNestedCompositor(candidate.particle)) {
      const nested = getOrCreateNestedState(state, candidate, registry, resolver)
      const nestedResult = validateCompositorChild(
        childNamespaceUri,
        childLocalName,
        nested,
        registry,
        resolver
      )
      if (nestedResult.success) {
        matched = true
        matchedParticle = nestedResult.matchedParticle
        if (!state.occurrenceCounts.has(j)) {
          state.occurrenceCounts.set(j, 1)
        }
        state.currentIndex = j
      }
    } else {
      const canMatch = particleAllows(qualifiedName, candidate, state, registry, resolver)
      if (canMatch) {
        matched = true
        matchedParticle = candidate
        const count = (state.occurrenceCounts.get(j) ?? 0) + 1
        state.occurrenceCounts.set(j, count)
        if (candidate.maxOccurs !== 'unbounded' && count >= candidate.maxOccurs) {
          state.currentIndex = j + 1
        } else {
          state.currentIndex = j
        }
      }
    }

    if (matched) {
      const skippedRequired: string[] = []
      const skippedRequiredDetails: OccurrenceViolation[] = []
      for (let k = blockingIndex; k < j; k += 1) {
        const skipped = state.flattenedParticles[k]
        if (!skipped) continue
        const skippedCount = state.occurrenceCounts.get(k) ?? 0
        if (skippedCount < skipped.minOccurs) {
          skippedRequired.push(particleDescription(skipped))
          skippedRequiredDetails.push(createOccurrenceViolation(skipped, skippedCount, 'tooFew'))
          state.occurrenceCounts.set(k, skipped.minOccurs)
        }
      }
      return { success: true, matchedParticle, skippedRequired, skippedRequiredDetails }
    }
  }

  return undefined
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
 * @param validateCompositorChild - compositor 검증 위임 함수 (순환 의존성 방지)
 * @returns 검증 결과
 */
export function validateSequenceChild(
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
  const findExhaustedParticle = (): FlattenedParticle | undefined =>
    state.flattenedParticles.find((particle) => {
      if (particle.maxOccurs === 'unbounded') {
        return false
      }

      const count = state.occurrenceCounts.get(particle.index) ?? 0
      return (
        count >= particle.maxOccurs &&
        particleAllows(qualifiedName, particle, state, registry, resolver)
      )
    })

  const createTooManyResult = (particle: FlattenedParticle): CompositorValidationResult => {
    const actualCount = (state.occurrenceCounts.get(particle.index) ?? 0) + 1
    state.occurrenceCounts.set(particle.index, actualCount)
    return {
      success: false,
      errorCode: 'TOO_MANY_ELEMENTS',
      matchedParticle: particle,
      occurrenceViolation: createOccurrenceViolation(particle, actualCount, 'tooMany'),
    }
  }

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
        return {
          success: true,
          matchedParticle: nestedResult.matchedParticle,
          skippedRequired: nestedResult.skippedRequired,
        }
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
          return {
            success: true,
            matchedParticle: retryResult.matchedParticle,
            skippedRequired: retryResult.skippedRequired,
          }
        }
      }
      if (count < particle.minOccurs) {
        const skipResult = trySkipAhead(
          childNamespaceUri,
          childLocalName,
          qualifiedName,
          i,
          state,
          registry,
          resolver,
          validateCompositorChild
        )
        if (skipResult) return skipResult
        const exhaustedParticle = findExhaustedParticle()
        if (exhaustedParticle) {
          return createTooManyResult(exhaustedParticle)
        }
        return {
          success: false,
          errorCode: 'MISSING_REQUIRED_ELEMENT',
          occurrenceViolation: createOccurrenceViolation(particle, count, 'tooFew'),
        }
      }
      continue
    }

    const canMatch = particleAllows(qualifiedName, particle, state, registry, resolver)

    if (canMatch) {
      const count = (state.occurrenceCounts.get(i) ?? 0) + 1
      state.occurrenceCounts.set(i, count)
      if (particle.maxOccurs !== 'unbounded' && count > particle.maxOccurs) {
        return {
          success: false,
          errorCode: 'TOO_MANY_ELEMENTS',
          matchedParticle: particle,
          occurrenceViolation: createOccurrenceViolation(particle, count, 'tooMany'),
        }
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
      const skipResult = trySkipAhead(
        childNamespaceUri,
        childLocalName,
        qualifiedName,
        i,
        state,
        registry,
        resolver,
        validateCompositorChild
      )
      if (skipResult) return skipResult
      const exhaustedParticle = findExhaustedParticle()
      if (exhaustedParticle) {
        return createTooManyResult(exhaustedParticle)
      }
      return {
        success: false,
        errorCode: 'MISSING_REQUIRED_ELEMENT',
        occurrenceViolation: createOccurrenceViolation(particle, count, 'tooFew'),
      }
    }
  }

  const exhaustedParticle = findExhaustedParticle()
  if (exhaustedParticle) {
    return createTooManyResult(exhaustedParticle)
  }

  return { success: false, errorCode: 'INVALID_ELEMENT' }
}

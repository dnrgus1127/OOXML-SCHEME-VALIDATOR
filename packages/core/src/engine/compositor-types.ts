import type { FlattenedParticle } from '../runtime'

/**
 * 네임스페이스 prefix를 URI로 변환하는 인터페이스입니다.
 * XML 네임스페이스 context와 스키마 레지스트리 양쪽에서 사용됩니다.
 */
export interface NamespaceResolver {
  /**
   * 네임스페이스 prefix를 URI로 변환합니다.
   *
   * @param prefix - 네임스페이스 prefix (undefined면 기본 네임스페이스)
   * @returns 네임스페이스 URI
   */
  resolveNamespaceUri(prefix?: string): string
}

/**
 * Compositor 검증 결과를 나타냅니다.
 * 성공 여부, 에러 코드, 매치된 particle 정보를 포함합니다.
 */
export interface CompositorValidationResult {
  /**
   * 검증 성공 여부
   */
  success: boolean

  /**
   * 검증 실패 시 에러 코드
   * 예: 'INVALID_ELEMENT', 'MISSING_REQUIRED_ELEMENT', 'TOO_MANY_ELEMENTS'
   */
  errorCode?: string

  /**
   * 매치된 particle 정보 (성공 시)
   */
  matchedParticle?: FlattenedParticle

  /**
   * Occurrence(min/maxOccurs) 제약 위반 상세 정보
   */
  occurrenceViolation?: OccurrenceViolation

  /**
   * Skip-ahead 복구 시 스킵된 필수 요소 이름 목록
   * Sequence compositor에서 필수 요소가 블로킹할 때 후속 매칭을 시도하여
   * 성공한 경우, 건너뛴 필수 요소들의 이름을 보고합니다.
   */
  skippedRequired?: string[]

  /**
   * Skip-ahead 복구 시 스킵된 필수 요소들의 occurrence 위반 상세 정보
   */
  skippedRequiredDetails?: OccurrenceViolation[]
}

/**
 * 요소 occurrence(min/maxOccurs) 위반 정보
 */
export interface OccurrenceViolation {
  elementName: string
  minOccurs: number
  maxOccurs: number | 'unbounded'
  actualCount: number
  kind: 'tooMany' | 'tooFew'
}

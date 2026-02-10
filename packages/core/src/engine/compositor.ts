/**
 * Compositor 검증 엔진 - Facade 모듈
 *
 * 이 모듈은 compositor 관련 모든 기능의 통합 진입점입니다.
 * XSD schema의 compositor(sequence/choice/all) 검증을 처리합니다.
 *
 * 아키텍처:
 * - compositor-types.ts: 타입 정의
 * - compositor-utils.ts: 공통 유틸리티
 * - compositor-init.ts: 상태 초기화 및 상속 처리
 * - compositor-sequence.ts: Sequence 검증 (순서 엄격)
 * - compositor-choice.ts: Choice 검증 (하나 선택)
 * - compositor-all.ts: All 검증 (순서 무관)
 * - compositor.ts: Facade 및 위임 (이 파일)
 *
 * @module engine/compositor
 */

import type { SchemaRegistry } from '../types'
import { CompositorState } from '../runtime'
import type { NamespaceResolver, CompositorValidationResult } from './compositor-types'
import { validateSequenceChild } from './compositor-sequence'
import { validateChoiceChild } from './compositor-choice'
import {
  validateAllChild,
  checkMissingRequiredElements as checkMissingAllElements,
} from './compositor-all'
import {
  initCompositorState as initCompositorStateFromInit,
  createCompositorState as createCompositorStateFromInit,
  resolveBaseCompositor,
  mergeCompositors,
} from './compositor-init'

export type { NamespaceResolver, CompositorValidationResult }
export {
  initCompositorStateFromInit as initCompositorState,
  createCompositorStateFromInit as createCompositorState,
  resolveBaseCompositor,
  mergeCompositors,
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
): CompositorValidationResult {
  switch (state.kind) {
    case 'sequence':
      return validateSequenceChild(
        childNamespaceUri,
        childLocalName,
        state,
        registry,
        resolver,
        validateCompositorChild
      )
    case 'choice':
      return validateChoiceChild(
        childNamespaceUri,
        childLocalName,
        state,
        registry,
        resolver,
        validateCompositorChild
      )
    case 'all':
      return validateAllChild(
        childNamespaceUri,
        childLocalName,
        state,
        registry,
        resolver,
        validateCompositorChild
      )
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
  return checkMissingAllElements(state, registry, resolver, checkMissingRequiredElements)
}

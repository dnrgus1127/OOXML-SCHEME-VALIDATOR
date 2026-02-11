# Compositor 분해 설계 문서

## 개요

현재 `packages/core/src/engine/compositor.ts` (891 LOC)를 7개의 집중된 모듈로 분해하여 유지보수성과 테스트 용이성을 향상시킵니다.

**분해 목표:**

- 단일 책임 원칙 준수
- 함수 기반 아키텍처 유지
- 순환 의존성 방지
- 테스트 커버리지 향상

---

## 1. compositor-types.ts (~40 LOC)

**책임:** Compositor 관련 타입 정의 및 인터페이스

**내보낼 항목:**

```typescript
// 네임스페이스 변환 인터페이스
export interface NamespaceResolver {
  resolveNamespaceUri(prefix?: string): string
}

// 검증 결과 타입
export interface CompositorValidationResult {
  success: boolean
  errorCode?: string
  matchedParticle?: FlattenedParticle
  skippedRequired?: string[] // skip-ahead 복구 시 스킵된 필수 요소
}
```

**의존성:**

- `../types` (SchemaRegistry, FlattenedParticle 등 기본 타입)
- `../runtime` (CompositorState, FlattenedParticle)

**예상 라인 수:** 40 LOC

---

## 2. compositor-utils.ts (~200 LOC)

**책임:** Particle 처리, 이름 검사, 헬퍼 함수

**내보낼 함수:**

```typescript
// Particle 관련 유틸리티
export function isNestedCompositor(particle: Particle | XsdElement): boolean
export function particleAllows(
  qualifiedName: string,
  particle: FlattenedParticle,
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): boolean

// Particle 변환 및 빌드
export function flattenParticles(
  particles: Array<Particle | XsdElement>,
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
  startIndex?: number
): FlattenedParticle[]

export function buildAllowedNames(
  particle: Particle | XsdElement,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): Set<string> | undefined

// Group 해석
export function resolveGroupCompositor(
  groupRef: XsdGroupRef | undefined,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): XsdSequence | XsdChoice | XsdAll | undefined

export function resolveGroup(
  groupRef: XsdGroupRef,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): XsdGroup | undefined

// Occurs 처리
export function getParticleOccurs(particle: Particle | XsdElement): {
  minOccurs: number
  maxOccurs: number | 'unbounded'
}

// 상태 관리 헬퍼
export function getOrCreateNestedState(
  parent: CompositorState,
  particle: FlattenedParticle,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): CompositorState

export function resetNestedState(
  parent: CompositorState,
  particle: FlattenedParticle,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): CompositorState

// 에러 메시지 생성
export function particleDescription(particle: FlattenedParticle): string
```

**주요 로직:**

- `flattenParticles()`: Particle 배열을 FlattenedParticle로 변환 (GroupRef 인라인 포함)
- `buildAllowedNames()`: Element, All, Sequence, Choice, GroupRef에서 허용 이름 추출
- `particleAllows()`: 특정 qualified name이 particle과 매치되는지 확인
- Nested state 캐싱 및 리셋 로직

**의존성:**

- `compositor-types.ts`
- `../types` (모든 XSD 타입, type guards)
- `../runtime` (CompositorState, FlattenedParticle, makeQualifiedName)

**예상 라인 수:** 200 LOC

---

## 3. compositor-init.ts (~150 LOC)

**책임:** Compositor 상태 초기화 및 상속/확장 처리

**내보낼 함수:**

```typescript
// 메인 초기화 함수
export function initCompositorState(
  schemaType: XsdComplexType | null,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): CompositorState | null

export function createCompositorState(
  compositor: XsdSequence | XsdChoice | XsdAll,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): CompositorState

// ComplexContent 처리 (내부 함수로 남길 수 있음)
function initComplexContentCompositorState(
  content: ComplexContent,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): CompositorState | null

// Base compositor 해석 (extension/restriction)
export function resolveBaseCompositor(
  derivation: ComplexContent['content'],
  registry: SchemaRegistry,
  resolver: NamespaceResolver,
  extensionCompositor: XsdSequence | XsdChoice | XsdAll | undefined
): { compositor?: XsdSequence | XsdChoice | XsdAll; earlyReturn?: CompositorState | null }

// Compositor 병합 (extension 시)
export function mergeCompositors(
  baseCompositor: XsdSequence | XsdChoice | XsdAll | undefined,
  extensionCompositor: XsdSequence | XsdChoice | XsdAll | undefined,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): CompositorState | null
```

**주요 로직:**

- `initCompositorState()`: ElementContent, ComplexContent 분기 처리
- `initComplexContentCompositorState()`: extension/restriction 처리, base type 재귀 해석
- `resolveBaseCompositor()`: Base type의 compositor를 재귀적으로 해석, earlyReturn 최적화
- `mergeCompositors()`: Base + extension particles를 하나의 sequence로 병합

**의존성:**

- `compositor-types.ts`
- `compositor-utils.ts` (flattenParticles, resolveGroupCompositor)
- `../types` (ComplexContent, hasElementContent, hasComplexContent 등)
- `../runtime` (CompositorState)

**예상 라인 수:** 150 LOC

---

## 4. compositor-sequence.ts (~200 LOC)

**책임:** Sequence compositor 검증 로직

**내보낼 함수:**

```typescript
export function validateSequenceChild(
  childNamespaceUri: string,
  childLocalName: string,
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): CompositorValidationResult

// Skip-ahead 복구 로직 (내부 함수)
function trySkipAhead(
  childNamespaceUri: string,
  childLocalName: string,
  qualifiedName: string,
  blockingIndex: number,
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): CompositorValidationResult | undefined
```

**주요 로직:**

- 순차 검증: currentIndex부터 순서대로 매칭 시도
- Nested compositor 위임 처리
- maxOccurs 도달 시 currentIndex 증가
- minOccurs 미충족 시 skip-ahead 시도
- Skip-ahead 성공 시 skippedRequired 보고 및 occurrenceCounts 조정

**의존성:**

- `compositor-types.ts`
- `compositor-utils.ts` (particleAllows, isNestedCompositor, getOrCreateNestedState, resetNestedState, particleDescription)
- `../runtime` (makeQualifiedName)

**예상 라인 수:** 200 LOC

---

## 5. compositor-choice.ts (~150 LOC)

**책임:** Choice compositor 검증 로직

**내보낼 함수:**

```typescript
export function validateChoiceChild(
  childNamespaceUri: string,
  childLocalName: string,
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): CompositorValidationResult

// Particle 매칭 헬퍼 (내부 함수)
function matchParticle(
  childNamespaceUri: string,
  childLocalName: string,
  qualifiedName: string,
  particle: FlattenedParticle,
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): FlattenedParticle | undefined
```

**주요 로직:**

- Branch 선택: selectedBranch가 null이면 모든 particle 중 매칭 시도
- Branch 고정: 선택 후에는 해당 branch만 검증
- Nested compositor 위임 및 리셋 처리
- Branch 소진 시 CHOICE_NOT_SATISFIED 반환 (부모 compositor가 재발생 처리)

**의존성:**

- `compositor-types.ts`
- `compositor-utils.ts` (isNestedCompositor, getOrCreateNestedState, resetNestedState, particleAllows)
- `../runtime` (makeQualifiedName)

**예상 라인 수:** 150 LOC

---

## 6. compositor-all.ts (~100 LOC)

**책임:** All compositor 검증 및 필수 요소 체크

**내보낼 함수:**

```typescript
export function validateAllChild(
  childNamespaceUri: string,
  childLocalName: string,
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): CompositorValidationResult

export function checkMissingRequiredElements(
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): string[]
```

**주요 로직:**

- `validateAllChild()`: 순서 무관 검증, appearedElements로 중복 방지
- `checkMissingRequiredElements()`: Compositor 타입별 필수 요소 누락 검사
  - Choice: selectedBranch만 검사
  - Sequence/All: 모든 particle 순회
  - Nested state 재귀 검사

**의존성:**

- `compositor-types.ts`
- `compositor-utils.ts` (particleDescription)
- `../runtime` (makeQualifiedName)

**예상 라인 수:** 100 LOC

---

## 7. compositor.ts (~50 LOC)

**책임:** 통합 진입점 및 재내보내기 (Facade 패턴)

**내보낼 항목:**

```typescript
// 타입 재내보내기
export type { NamespaceResolver, CompositorValidationResult } from './compositor-types'

// 초기화 함수
export {
  initCompositorState,
  createCompositorState,
  resolveBaseCompositor,
  mergeCompositors,
} from './compositor-init'

// 검증 진입점
export function validateCompositorChild(
  childNamespaceUri: string,
  childLocalName: string,
  state: CompositorState,
  registry: SchemaRegistry,
  resolver: NamespaceResolver
): CompositorValidationResult {
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

// 필수 요소 체크
export { checkMissingRequiredElements } from './compositor-all'

// 유틸리티 함수 (필요 시)
export { flattenParticles, buildAllowedNames } from './compositor-utils'
```

**의존성:**

- `compositor-types.ts`
- `compositor-init.ts`
- `compositor-sequence.ts`
- `compositor-choice.ts`
- `compositor-all.ts`

**예상 라인 수:** 50 LOC

---

## 마이그레이션 순서

1. **compositor-types.ts 생성**
   - 타입 정의만 이동
   - 빌드 검증

2. **compositor-utils.ts 생성**
   - 헬퍼 함수들 이동
   - 단위 테스트 추가

3. **compositor-init.ts 생성**
   - 초기화 로직 이동
   - 테스트 검증

4. **compositor-sequence.ts, compositor-choice.ts, compositor-all.ts 생성**
   - 각 compositor 검증 로직 분리
   - 테스트 유지

5. **compositor.ts 통합 facade 생성**
   - 기존 public API 유지
   - 모든 내보내기 통합

6. **기존 compositor.ts 삭제**
   - validator.ts에서 import 경로 동일 유지 (facade 덕분)
   - 빌드 및 전체 테스트 실행

---

## 장점

### 유지보수성

- 각 모듈이 150~200 LOC 이하로 읽기 쉬움
- 단일 책임 원칙으로 수정 범위 명확

### 테스트 용이성

- 개별 함수 단위 테스트 가능
- Mock 의존성 주입 용이

### 확장성

- 새로운 compositor 타입 추가 시 독립 모듈로 추가 가능
- Skip-ahead 로직 개선 시 sequence 모듈만 수정

### 재사용성

- Utils 함수들을 다른 모듈에서도 사용 가능
- Init 로직을 다른 검증 파이프라인에서 재활용 가능

---

## 호환성 보장

- 기존 `compositor.ts`의 public API는 새 facade에서 동일하게 제공
- `validator.ts`는 import 경로 변경 없음:
  ```typescript
  import {
    initCompositorState,
    validateCompositorChild,
    checkMissingRequiredElements,
  } from './compositor'
  ```
- 모든 타입 시그니처 동일 유지

---

## 검증 계획

1. **빌드 검증**: `pnpm run build` 성공
2. **타입 체크**: `pnpm run typecheck` 통과
3. **테스트**: `pnpm run test` 23개 테스트 모두 통과
4. **Lint**: `pnpm run lint` 통과
5. **Format**: `pnpm run format` 적용

---

## 다음 단계

이 설계 문서를 기반으로:

1. 각 모듈별 구현 작업 (Task #3 이후)
2. 단위 테스트 추가 작성
3. 기존 통합 테스트 유지 검증
4. 성능 회귀 테스트 (벤치마크)

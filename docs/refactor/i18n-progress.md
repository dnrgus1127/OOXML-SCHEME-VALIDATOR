# Task #14: I18n 구현 진행 현황

작성일: 2026-02-10
담당자: desktop-coordinator

## 진행률: 50% (2/4일)

---

## Phase 1: I18n 인프라 구축 ✅ 완료

### 생성된 파일

#### 1. `/packages/core/src/i18n/types.ts`
- `LocaleCode` 타입: 'en' | 'ko'
- `MessageFormatter<T>` 제네릭 타입
- `LocalizedMessage<T>` 인터페이스
- `MessageKey` 유니온 타입 (19개 키)
  - COMPOSITOR.* (5개)
  - ELEMENT.* (4개)
  - ATTRIBUTE.* (3개)
  - VALUE.* (5개)
  - TYPE.* (2개)
  - INTERNAL.* (1개)
- `MessageMap` 타입

#### 2. `/packages/core/src/i18n/messages.ts`
- `ERROR_MESSAGES: MessageMap` 상수
- 19개 메시지 키별 한국어/영어 구현
- 파라미터화된 메시지 지원:
  - 요소명, 속성명, 타입명, facet명 등

#### 3. `/packages/core/src/i18n/format.ts`
- `setLocale(locale: LocaleCode): void`
- `getLocale(): LocaleCode`
- `formatMessage<K extends MessageKey>(key, ...args): string`
  - 타입 안전성 보장 (TypeScript 타입 추론)
  - 현재 로케일에 맞는 메시지 반환
- `mapErrorCodeToMessageKey(errorCode, context?): MessageKey | undefined`
  - 기존 에러 코드와 호환성 유지

### 수정된 파일

#### 1. `/packages/core/src/types.ts`
```typescript
export interface ValidationOptions {
  // ... 기존 필드
  locale?: 'en' | 'ko' // 추가됨
}
```

#### 2. `/packages/core/src/index.ts`
```typescript
// I18n exports 추가
export { setLocale, getLocale, formatMessage } from './i18n/format'
export type { LocaleCode, MessageKey } from './i18n/types'
```

### 테스트 커버리지

#### 1. `/packages/core/src/__tests__/i18n.test.ts` (신규)
- 17개 테스트 케이스
- 커버리지:
  - ✅ 로케일 설정/조회
  - ✅ 한국어 메시지 포맷팅 (모든 도메인)
  - ✅ 영어 메시지 포맷팅 (모든 도메인)
  - ✅ 로케일 동적 전환
  - ✅ 에지 케이스 (unknown key)
  - ✅ 타입 안전성

#### 테스트 결과
```
Test Files  6 passed (6)
Tests       105 passed (105)
  - 기존 88개 테스트: 통과 유지
  - 신규 17개 테스트: 모두 통과
```

---

## Phase 2: 기존 코드 마이그레이션 ⏳ 진행 예정

### 1. validator.ts 마이그레이션

**현재 하드코딩 위치:**
- Line ~180-200: `필수 요소 '${missing}'가 누락되었습니다.`
- Line ~220: `허용되지 않는 요소: ${element.name}`
- Line ~250: `element-only 컨텐츠에서 텍스트가 발견되었습니다.`

**변경 전:**
```typescript
errorHandler.pushError(
  'MISSING_REQUIRED_ELEMENT',
  `필수 요소 '${missing}'가 누락되었습니다.`
)
```

**변경 후:**
```typescript
import { formatMessage } from './i18n/format'

errorHandler.pushError(
  'MISSING_REQUIRED_ELEMENT',
  formatMessage('ELEMENT.MISSING_REQUIRED', missing)
)
```

### 2. attribute-validator.ts 마이그레이션

**현재 하드코딩 위치:**
- Line ~50: `허용되지 않는 속성: ${xmlAttr.name}`
- Line ~80: `금지된 속성 사용: ${xmlAttr.name}`
- Line ~120: `필수 속성 누락: ${required.name}`

**변경 계획:**
```typescript
import { formatMessage } from './i18n/format'

// INVALID_ATTRIBUTE
formatMessage('ATTRIBUTE.INVALID', xmlAttr.name)

// PROHIBITED
formatMessage('ATTRIBUTE.PROHIBITED', xmlAttr.name)

// MISSING_REQUIRED_ATTR
formatMessage('ATTRIBUTE.MISSING_REQUIRED', required.name)
```

### 3. simple-type-validator.ts 마이그레이션

**현재 하드코딩 위치:**
- Line ~30: `타입 검증 실패: ${restriction.base.name}`
- Line ~60: `union 멤버 타입과 일치하지 않습니다.`
- Line ~90: `list 항목 타입과 일치하지 않습니다.`
- Line ~120: `Facet 검증 실패 (${facetType})`

**변경 계획:**
```typescript
import { formatMessage } from './i18n/format'

formatMessage('VALUE.INVALID_TYPE', restriction.base.name)
formatMessage('VALUE.INVALID_UNION')
formatMessage('VALUE.INVALID_LIST_ITEM')
formatMessage('VALUE.INVALID_FACET', facetType)
```

### 4. type-resolver.ts 마이그레이션

**현재 하드코딩 위치:**
- Line ~40: `스키마에서 요소를 찾을 수 없습니다: ${element.name}`
- Line ~70: `타입을 찾을 수 없습니다: ${typeName}`

**변경 계획:**
```typescript
import { formatMessage } from './i18n/format'

formatMessage('TYPE.ELEMENT_NOT_FOUND', element.name)
formatMessage('TYPE.TYPE_NOT_FOUND', typeName)
```

### 5. ValidationEngine locale 지원

**packages/core/src/engine/validator.ts (예상):**
```typescript
import { setLocale } from './i18n/format'

export class ValidationEngine {
  constructor(
    private registry: SchemaRegistry,
    private options: ValidationOptions = {}
  ) {
    // 옵션에서 locale 설정
    if (options.locale) {
      setLocale(options.locale)
    }
  }
  // ...
}
```

---

## 성공 지표 체크리스트

### Phase 1 (완료)
- ✅ I18n 인프라 파일 생성 (types, messages, format)
- ✅ ValidationOptions에 locale 추가
- ✅ 공개 API 재내보내기
- ✅ 17개 I18n 테스트 추가 및 통과
- ✅ 기존 88개 테스트 통과 유지
- ✅ 타입 체크 0 에러
- ✅ 빌드 성공

### Phase 2 (대기 중)
- ⏳ validator.ts 마이그레이션 (0/3 메시지)
- ⏳ attribute-validator.ts 마이그레이션 (0/3 메시지)
- ⏳ simple-type-validator.ts 마이그레이션 (0/4 메시지)
- ⏳ type-resolver.ts 마이그레이션 (0/2 메시지)
- ⏳ ValidationEngine locale 연동
- ⏳ 하드코딩 메시지 0개 달성 (현재: 12개)
- ⏳ 105개 테스트 통과 유지
- ⏳ 타입 체크 0 에러 유지

---

## 다음 작업 계획

### Day 3 (예정)
1. validator.ts 마이그레이션
2. attribute-validator.ts 마이그레이션
3. 테스트 검증 (105/105 통과)

### Day 4 (예정)
1. simple-type-validator.ts 마이그레이션
2. type-resolver.ts 마이그레이션
3. ValidationEngine locale 연동
4. 최종 테스트 및 검증
5. 하드코딩 메시지 제로 확인

---

## 리스크 및 이슈

### 발견된 리스크
- 없음 (현재까지)

### 완화 조치
- 점진적 마이그레이션으로 각 단계마다 테스트 실행
- 기존 테스트 통과율 100% 유지
- 타입 체크로 컴파일 타임 검증

---

## 블로킹 상황

- **없음** - Phase 2 작업은 Phase 1 완료에만 의존하며, 현재 완료됨

---

## 메모

### 설계 결정
1. **MessageKey 네이밍**: `{DOMAIN}.{ERROR_CODE}.{VARIANT}` 구조 채택
   - 도메인 분리로 관리 용이
   - Variant로 동일 에러 코드의 다른 메시지 구분

2. **타입 안전성 우선**: TypeScript 타입 추론 최대 활용
   - `formatMessage`의 파라미터 타입이 메시지 키에 따라 자동 추론

3. **기본 로케일**: 한국어('ko') 유지
   - 기존 동작과 호환성 유지

4. **호환성**: 기존 에러 코드 유지
   - `mapErrorCodeToMessageKey` 헬퍼로 점진적 마이그레이션 지원

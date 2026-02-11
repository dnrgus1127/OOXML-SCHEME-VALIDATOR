# I18n 전략 설계 문서

## 개요

`@ooxml/core` 검증 엔진의 모든 에러 메시지에 대한 국제화(i18n) 시스템을 설계합니다.

**설계 원칙:**

- 간단한 객체 맵 기반 (외부 라이브러리 의존성 최소화)
- 타입 안전성 보장 (TypeScript 지원)
- 동적 파라미터 지원 (요소명, 속성명, 값 등)
- 한국어/영어 동시 지원

---

## 추출된 에러 메시지 목록

### 1. Compositor 관련 (compositor.ts)

| 에러 코드                  | 현재 메시지                               | 파라미터 |
| -------------------------- | ----------------------------------------- | -------- |
| `INVALID_CONTENT`          | N/A                                       | -        |
| `MISSING_REQUIRED_ELEMENT` | `필수 요소 '{element}'가 누락되었습니다.` | element  |
| `TOO_MANY_ELEMENTS`        | N/A                                       | element  |
| `INVALID_ELEMENT`          | `허용되지 않는 요소: {element}`           | element  |
| `CHOICE_NOT_SATISFIED`     | N/A                                       | -        |

**내부 에러 (throw):**

- `Invalid nested compositor state` (내부 오류, 사용자에게 노출되지 않을 수 있음)

---

### 2. Validator 관련 (validator.ts)

| 에러 코드                  | 현재 메시지                                        | 파라미터 |
| -------------------------- | -------------------------------------------------- | -------- |
| `MISSING_REQUIRED_ELEMENT` | `필수 요소 '{element}'가 누락되었습니다.`          | element  |
| `INVALID_CONTENT`          | `허용되지 않는 요소: {element}`                    | element  |
| `UNEXPECTED_TEXT`          | `element-only 컨텐츠에서 텍스트가 발견되었습니다.` | -        |
| `UNEXPECTED_TEXT`          | `complexContent에서 텍스트가 허용되지 않습니다.`   | text     |

---

### 3. Attribute 관련 (attribute-validator.ts)

| 에러 코드               | 현재 메시지                       | 파라미터  |
| ----------------------- | --------------------------------- | --------- |
| `INVALID_ATTRIBUTE`     | `허용되지 않는 속성: {attribute}` | attribute |
| `INVALID_ATTRIBUTE`     | `금지된 속성 사용: {attribute}`   | attribute |
| `MISSING_REQUIRED_ATTR` | `필수 속성 누락: {attribute}`     | attribute |

---

### 4. Simple Type 관련 (simple-type-validator.ts)

| 에러 코드            | 현재 메시지                            | 파라미터         |
| -------------------- | -------------------------------------- | ---------------- |
| `INVALID_VALUE`      | `타입 검증 실패: {typeName}`           | typeName, value  |
| `INVALID_VALUE`      | `union 멤버 타입과 일치하지 않습니다.` | value            |
| `INVALID_VALUE`      | `list 항목 타입과 일치하지 않습니다.`  | item             |
| `INVALID_ENUM_VALUE` | `Facet 검증 실패 ({facetType})`        | facetType, value |
| `INVALID_VALUE`      | `Facet 검증 실패 ({facetType})`        | facetType, value |

---

### 5. Type Resolver 관련 (type-resolver.ts)

| 에러 코드         | 현재 메시지                                     | 파라미터 |
| ----------------- | ----------------------------------------------- | -------- |
| `INVALID_ELEMENT` | `스키마에서 요소를 찾을 수 없습니다: {element}` | element  |
| `UNKNOWN_TYPE`    | `타입을 찾을 수 없습니다: {typeName}`           | typeName |

---

## 메시지 키 명명 규칙

### 규칙

1. **네임스페이스 구조**: `{DOMAIN}.{ERROR_CODE}.{VARIANT?}`
2. **대문자 스네이크 케이스** 사용
3. **Variant**: 동일한 에러 코드로 다른 메시지가 필요할 때 사용

### 예시

```typescript
'COMPOSITOR.INVALID_CONTENT'
'COMPOSITOR.MISSING_REQUIRED_ELEMENT'
'COMPOSITOR.TOO_MANY_ELEMENTS'
'COMPOSITOR.INVALID_ELEMENT'
'COMPOSITOR.CHOICE_NOT_SATISFIED'

'ELEMENT.MISSING_REQUIRED'
'ELEMENT.INVALID'
'ELEMENT.UNEXPECTED_TEXT.ELEMENT_ONLY'
'ELEMENT.UNEXPECTED_TEXT.COMPLEX_CONTENT'

'ATTRIBUTE.INVALID'
'ATTRIBUTE.PROHIBITED'
'ATTRIBUTE.MISSING_REQUIRED'

'VALUE.INVALID_TYPE'
'VALUE.INVALID_UNION'
'VALUE.INVALID_LIST_ITEM'
'VALUE.INVALID_ENUM'
'VALUE.INVALID_FACET'

'TYPE.ELEMENT_NOT_FOUND'
'TYPE.TYPE_NOT_FOUND'
```

---

## I18n 구조 설계

### 1. 타입 정의 (packages/core/src/i18n/types.ts)

```typescript
export type LocaleCode = 'en' | 'ko'

export type MessageFormatter<T extends any[] = any[]> = (...args: T) => string

export interface LocalizedMessage<T extends any[] = any[]> {
  en: MessageFormatter<T>
  ko: MessageFormatter<T>
}

export type MessageKey =
  // Compositor
  | 'COMPOSITOR.INVALID_CONTENT'
  | 'COMPOSITOR.MISSING_REQUIRED_ELEMENT'
  | 'COMPOSITOR.TOO_MANY_ELEMENTS'
  | 'COMPOSITOR.INVALID_ELEMENT'
  | 'COMPOSITOR.CHOICE_NOT_SATISFIED'
  // Element
  | 'ELEMENT.MISSING_REQUIRED'
  | 'ELEMENT.INVALID'
  | 'ELEMENT.UNEXPECTED_TEXT.ELEMENT_ONLY'
  | 'ELEMENT.UNEXPECTED_TEXT.COMPLEX_CONTENT'
  // Attribute
  | 'ATTRIBUTE.INVALID'
  | 'ATTRIBUTE.PROHIBITED'
  | 'ATTRIBUTE.MISSING_REQUIRED'
  // Value
  | 'VALUE.INVALID_TYPE'
  | 'VALUE.INVALID_UNION'
  | 'VALUE.INVALID_LIST_ITEM'
  | 'VALUE.INVALID_ENUM'
  | 'VALUE.INVALID_FACET'
  // Type
  | 'TYPE.ELEMENT_NOT_FOUND'
  | 'TYPE.TYPE_NOT_FOUND'
  // Internal errors
  | 'INTERNAL.INVALID_COMPOSITOR_STATE'

export type MessageMap = {
  [K in MessageKey]: LocalizedMessage
}
```

---

### 2. 메시지 정의 (packages/core/src/i18n/messages.ts)

```typescript
import type { MessageMap } from './types'

export const ERROR_MESSAGES: MessageMap = {
  // Compositor
  'COMPOSITOR.INVALID_CONTENT': {
    en: () => 'Invalid content structure',
    ko: () => '잘못된 컨텐츠 구조입니다',
  },
  'COMPOSITOR.MISSING_REQUIRED_ELEMENT': {
    en: (element: string) => `Required element '${element}' is missing`,
    ko: (element: string) => `필수 요소 '${element}'가 누락되었습니다`,
  },
  'COMPOSITOR.TOO_MANY_ELEMENTS': {
    en: (element: string) => `Too many occurrences of element '${element}'`,
    ko: (element: string) => `요소 '${element}'가 허용된 횟수를 초과했습니다`,
  },
  'COMPOSITOR.INVALID_ELEMENT': {
    en: (element: string) => `Element '${element}' is not allowed here`,
    ko: (element: string) => `요소 '${element}'는 이 위치에서 허용되지 않습니다`,
  },
  'COMPOSITOR.CHOICE_NOT_SATISFIED': {
    en: () => 'Choice compositor constraint not satisfied',
    ko: () => 'choice 제약 조건을 만족하지 않습니다',
  },

  // Element
  'ELEMENT.MISSING_REQUIRED': {
    en: (element: string) => `Required element '${element}' is missing`,
    ko: (element: string) => `필수 요소 '${element}'가 누락되었습니다`,
  },
  'ELEMENT.INVALID': {
    en: (element: string) => `Invalid element: ${element}`,
    ko: (element: string) => `허용되지 않는 요소: ${element}`,
  },
  'ELEMENT.UNEXPECTED_TEXT.ELEMENT_ONLY': {
    en: () => 'Text content is not allowed in element-only content',
    ko: () => 'element-only 컨텐츠에서 텍스트가 발견되었습니다',
  },
  'ELEMENT.UNEXPECTED_TEXT.COMPLEX_CONTENT': {
    en: () => 'Text content is not allowed in complexContent',
    ko: () => 'complexContent에서 텍스트가 허용되지 않습니다',
  },

  // Attribute
  'ATTRIBUTE.INVALID': {
    en: (attribute: string) => `Attribute '${attribute}' is not allowed`,
    ko: (attribute: string) => `허용되지 않는 속성: ${attribute}`,
  },
  'ATTRIBUTE.PROHIBITED': {
    en: (attribute: string) => `Prohibited attribute '${attribute}' is used`,
    ko: (attribute: string) => `금지된 속성 사용: ${attribute}`,
  },
  'ATTRIBUTE.MISSING_REQUIRED': {
    en: (attribute: string) => `Required attribute '${attribute}' is missing`,
    ko: (attribute: string) => `필수 속성 누락: ${attribute}`,
  },

  // Value
  'VALUE.INVALID_TYPE': {
    en: (typeName: string) => `Type validation failed: ${typeName}`,
    ko: (typeName: string) => `타입 검증 실패: ${typeName}`,
  },
  'VALUE.INVALID_UNION': {
    en: () => 'Value does not match any union member type',
    ko: () => 'union 멤버 타입과 일치하지 않습니다',
  },
  'VALUE.INVALID_LIST_ITEM': {
    en: () => 'List item does not match expected type',
    ko: () => 'list 항목 타입과 일치하지 않습니다',
  },
  'VALUE.INVALID_ENUM': {
    en: (facetType: string) => `Enumeration validation failed: ${facetType}`,
    ko: (facetType: string) => `열거형 검증 실패: ${facetType}`,
  },
  'VALUE.INVALID_FACET': {
    en: (facetType: string) => `Facet validation failed: ${facetType}`,
    ko: (facetType: string) => `Facet 검증 실패: ${facetType}`,
  },

  // Type
  'TYPE.ELEMENT_NOT_FOUND': {
    en: (element: string) => `Element not found in schema: ${element}`,
    ko: (element: string) => `스키마에서 요소를 찾을 수 없습니다: ${element}`,
  },
  'TYPE.TYPE_NOT_FOUND': {
    en: (typeName: string) => `Type not found: ${typeName}`,
    ko: (typeName: string) => `타입을 찾을 수 없습니다: ${typeName}`,
  },

  // Internal
  'INTERNAL.INVALID_COMPOSITOR_STATE': {
    en: () => 'Invalid nested compositor state (internal error)',
    ko: () => '잘못된 중첩 compositor 상태 (내부 오류)',
  },
}
```

---

### 3. I18n 헬퍼 (packages/core/src/i18n/format.ts)

```typescript
import type { LocaleCode, MessageKey } from './types'
import { ERROR_MESSAGES } from './messages'

let currentLocale: LocaleCode = 'ko' // 기본값

export function setLocale(locale: LocaleCode): void {
  currentLocale = locale
}

export function getLocale(): LocaleCode {
  return currentLocale
}

export function formatMessage<K extends MessageKey>(
  key: K,
  ...args: Parameters<(typeof ERROR_MESSAGES)[K][LocaleCode]>
): string {
  const message = ERROR_MESSAGES[key]
  if (!message) {
    return `Unknown message key: ${key}`
  }

  const formatter = message[currentLocale]
  return formatter(...args)
}

// 에러 코드 → 메시지 키 매핑 헬퍼
export function mapErrorCodeToMessageKey(
  errorCode: string,
  context?: string
): MessageKey | undefined {
  // 기존 에러 코드를 새 메시지 키로 매핑
  const mapping: Record<string, MessageKey> = {
    INVALID_CONTENT: 'COMPOSITOR.INVALID_CONTENT',
    MISSING_REQUIRED_ELEMENT: 'ELEMENT.MISSING_REQUIRED',
    TOO_MANY_ELEMENTS: 'COMPOSITOR.TOO_MANY_ELEMENTS',
    INVALID_ELEMENT: 'ELEMENT.INVALID',
    CHOICE_NOT_SATISFIED: 'COMPOSITOR.CHOICE_NOT_SATISFIED',
    INVALID_ATTRIBUTE: 'ATTRIBUTE.INVALID',
    MISSING_REQUIRED_ATTR: 'ATTRIBUTE.MISSING_REQUIRED',
    INVALID_VALUE: 'VALUE.INVALID_TYPE',
    INVALID_ENUM_VALUE: 'VALUE.INVALID_ENUM',
    UNEXPECTED_TEXT: 'ELEMENT.UNEXPECTED_TEXT.ELEMENT_ONLY',
    UNKNOWN_TYPE: 'TYPE.TYPE_NOT_FOUND',
  }

  return mapping[errorCode]
}
```

---

### 4. ValidationOptions에 locale 추가 (types.ts)

```typescript
export interface ValidationOptions {
  failFast?: boolean
  allowWhitespace?: boolean
  includeWarnings?: boolean
  locale?: 'en' | 'ko' // 추가
}
```

---

## 마이그레이션 전략

### Phase 1: I18n 인프라 구축 (Task #3 완료 후 구현)

1. `packages/core/src/i18n/` 디렉토리 생성
2. `types.ts`, `messages.ts`, `format.ts` 작성
3. `packages/core/src/index.ts`에서 재내보내기:
   ```typescript
   export { setLocale, getLocale, formatMessage } from './i18n/format'
   export type { LocaleCode, MessageKey } from './i18n/types'
   ```

### Phase 2: 기존 코드 마이그레이션

#### 2.1 에러 핸들러 수정 (error-handlers.ts)

**현재:**

```typescript
pushError(code: string, message: string, value?: string): void
```

**변경 후:**

```typescript
import { formatMessage, mapErrorCodeToMessageKey } from '../i18n/format'
import type { MessageKey } from '../i18n/types'

pushError(
  code: string,
  message: string | MessageKey,
  value?: string,
  ...args: any[]
): void {
  let finalMessage: string

  // MessageKey인 경우 formatMessage 사용
  if (message.includes('.')) {
    finalMessage = formatMessage(message as MessageKey, ...args)
  } else {
    // 기존 방식 호환 (하드코딩된 메시지)
    finalMessage = message
  }

  context.errors.push({
    code,
    message: finalMessage,
    path: this.currentPath(),
    value,
  })

  if (context.options.failFast) {
    throw new Error(finalMessage)
  }
}
```

#### 2.2 Validator 마이그레이션 (validator.ts)

**현재:**

```typescript
this.errorHandler.pushError('MISSING_REQUIRED_ELEMENT', `필수 요소 '${missing}'가 누락되었습니다.`)
```

**변경 후:**

```typescript
this.errorHandler.pushError(
  'MISSING_REQUIRED_ELEMENT',
  'ELEMENT.MISSING_REQUIRED',
  undefined,
  missing
)
```

#### 2.3 Compositor 마이그레이션 (compositor.ts)

**현재:**

```typescript
return { success: false, errorCode: 'INVALID_ELEMENT' }
```

**변경 후:** 동일 (메시지는 validator에서 생성)

#### 2.4 Attribute Validator 마이그레이션 (attribute-validator.ts)

**현재:**

```typescript
errorHandler.pushError('INVALID_ATTRIBUTE', `허용되지 않는 속성: ${xmlAttr.name}`)
```

**변경 후:**

```typescript
errorHandler.pushError('INVALID_ATTRIBUTE', 'ATTRIBUTE.INVALID', undefined, xmlAttr.name)
```

#### 2.5 Simple Type Validator 마이그레이션 (simple-type-validator.ts)

**현재:**

```typescript
errorHandler.pushError('INVALID_VALUE', `타입 검증 실패: ${restriction.base.name}`, value)
```

**변경 후:**

```typescript
errorHandler.pushError('INVALID_VALUE', 'VALUE.INVALID_TYPE', value, restriction.base.name)
```

#### 2.6 Type Resolver 마이그레이션 (type-resolver.ts)

**현재:**

```typescript
onError('INVALID_ELEMENT', `스키마에서 요소를 찾을 수 없습니다: ${element.name}`)
```

**변경 후:**

```typescript
onError('INVALID_ELEMENT', 'TYPE.ELEMENT_NOT_FOUND', element.name)
```

### Phase 3: 테스트 업데이트

1. 기존 테스트에서 메시지 검증을 에러 코드 검증으로 변경
2. I18n 함수에 대한 단위 테스트 추가
3. 로케일 전환 통합 테스트 추가

---

## 사용 예시

### 기본 사용

```typescript
import { setLocale, formatMessage } from '@ooxml/core'

// 한국어 메시지
setLocale('ko')
formatMessage('ELEMENT.MISSING_REQUIRED', 'worksheetSource')
// → "필수 요소 'worksheetSource'가 누락되었습니다"

// 영어 메시지
setLocale('en')
formatMessage('ELEMENT.MISSING_REQUIRED', 'worksheetSource')
// → "Required element 'worksheetSource' is missing"
```

### ValidationOptions 사용

```typescript
import { createValidationEngine } from '@ooxml/core'

const engine = createValidationEngine(registry, {
  locale: 'en',
  failFast: false,
})
```

---

## 장점

### 1. 유지보수성

- 모든 메시지를 중앙에서 관리
- 메시지 변경 시 한 곳만 수정
- 일관된 메시지 스타일 보장

### 2. 타입 안전성

- MessageKey 타입으로 컴파일 타임 검증
- formatMessage의 파라미터 타입 추론
- 잘못된 키 사용 방지

### 3. 확장성

- 새 로케일 추가 용이 (LocaleCode 확장)
- 새 메시지 키 추가 간단
- 파라미터화된 메시지 지원

### 4. 테스트 용이성

- 메시지 포맷팅 로직 독립 테스트
- 로케일 전환 테스트 가능
- Mock 주입 용이

---

## 제약사항 및 고려사항

### 1. 기존 에러 코드 호환성

- 기존 `ValidationErrorCode` 타입 유지
- 새 `MessageKey`와 매핑 테이블 제공
- 점진적 마이그레이션 가능

### 2. 번들 크기

- 메시지 맵은 약 2-3KB 증가 예상
- Tree-shaking 불가능 (모든 메시지 포함)
- 필요 시 lazy loading 고려 가능

### 3. 성능

- formatMessage는 함수 호출 오버헤드 있음
- 에러 발생 시에만 호출되므로 영향 미미
- 캐싱 불필요 (에러 메시지는 고유함)

---

## 다음 단계

1. Task #3 완료 후 Phase 1 구현 (I18n 인프라)
2. Phase 2 마이그레이션 (점진적)
3. 테스트 업데이트
4. Desktop 앱에서 로케일 전환 UI 추가
5. 문서화 업데이트

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
  'ELEMENT.COUNT_EXCEEDED': {
    en: (element: string, allowed: number, diff: number, actual: number) =>
      `Element '${element}' count exceeds allowed ${allowed} by ${diff}. (actual ${actual})`,
    ko: (element: string, allowed: number, diff: number, actual: number) =>
      `'${element}' 요소의 개수가 스키마에서 허용되는 개수인 ${allowed}개보다 ${diff}개 많습니다. (실제 ${actual}개)`,
  },
  'ELEMENT.COUNT_SHORTAGE': {
    en: (element: string, required: number, diff: number, actual: number) =>
      `Element '${element}' count is short of required ${required} by ${diff}. (actual ${actual})`,
    ko: (element: string, required: number, diff: number, actual: number) =>
      `'${element}' 요소의 개수가 스키마에서 허용되는 개수인 ${required}개보다 ${diff}개 적습니다. (실제 ${actual}개)`,
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

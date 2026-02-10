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
  context?: string,
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

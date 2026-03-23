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
  | 'ELEMENT.COUNT_EXCEEDED'
  | 'ELEMENT.COUNT_SHORTAGE'
  | 'ELEMENT.INFERRED_DEFAULT_NAMESPACE'
  | 'ELEMENT.UNSUPPORTED_ALTERNATE_CONTENT'
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

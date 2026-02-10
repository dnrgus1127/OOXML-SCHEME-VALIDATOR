import { describe, it, expect, beforeEach } from 'vitest'
import { setLocale, getLocale, formatMessage } from '../i18n/format'
import type { MessageKey } from '../i18n/types'

describe('I18n System', () => {
  beforeEach(() => {
    setLocale('ko') // Reset to default
  })

  describe('setLocale and getLocale', () => {
    it('should set and get locale correctly', () => {
      setLocale('en')
      expect(getLocale()).toBe('en')

      setLocale('ko')
      expect(getLocale()).toBe('ko')
    })

    it('should default to Korean locale', () => {
      expect(getLocale()).toBe('ko')
    })
  })

  describe('formatMessage', () => {
    describe('Korean locale', () => {
      beforeEach(() => {
        setLocale('ko')
      })

      it('should format compositor messages', () => {
        expect(formatMessage('COMPOSITOR.INVALID_CONTENT')).toBe('잘못된 컨텐츠 구조입니다')
        expect(formatMessage('COMPOSITOR.MISSING_REQUIRED_ELEMENT', 'chart')).toBe(
          "필수 요소 'chart'가 누락되었습니다",
        )
        expect(formatMessage('COMPOSITOR.TOO_MANY_ELEMENTS', 'item')).toBe(
          "요소 'item'가 허용된 횟수를 초과했습니다",
        )
        expect(formatMessage('COMPOSITOR.INVALID_ELEMENT', 'invalid')).toBe(
          "요소 'invalid'는 이 위치에서 허용되지 않습니다",
        )
        expect(formatMessage('COMPOSITOR.CHOICE_NOT_SATISFIED')).toBe(
          'choice 제약 조건을 만족하지 않습니다',
        )
      })

      it('should format element messages', () => {
        expect(formatMessage('ELEMENT.MISSING_REQUIRED', 'worksheet')).toBe(
          "필수 요소 'worksheet'가 누락되었습니다",
        )
        expect(formatMessage('ELEMENT.INVALID', 'unknown')).toBe('허용되지 않는 요소: unknown')
        expect(formatMessage('ELEMENT.UNEXPECTED_TEXT.ELEMENT_ONLY')).toBe(
          'element-only 컨텐츠에서 텍스트가 발견되었습니다',
        )
        expect(formatMessage('ELEMENT.UNEXPECTED_TEXT.COMPLEX_CONTENT')).toBe(
          'complexContent에서 텍스트가 허용되지 않습니다',
        )
      })

      it('should format attribute messages', () => {
        expect(formatMessage('ATTRIBUTE.INVALID', 'invalidAttr')).toBe(
          '허용되지 않는 속성: invalidAttr',
        )
        expect(formatMessage('ATTRIBUTE.PROHIBITED', 'prohibitedAttr')).toBe(
          '금지된 속성 사용: prohibitedAttr',
        )
        expect(formatMessage('ATTRIBUTE.MISSING_REQUIRED', 'id')).toBe('필수 속성 누락: id')
      })

      it('should format value messages', () => {
        expect(formatMessage('VALUE.INVALID_TYPE', 'xsd:int')).toBe('타입 검증 실패: xsd:int')
        expect(formatMessage('VALUE.INVALID_UNION')).toBe('union 멤버 타입과 일치하지 않습니다')
        expect(formatMessage('VALUE.INVALID_LIST_ITEM')).toBe('list 항목 타입과 일치하지 않습니다')
        expect(formatMessage('VALUE.INVALID_ENUM', 'color')).toBe('열거형 검증 실패: color')
        expect(formatMessage('VALUE.INVALID_FACET', 'minLength')).toBe(
          'Facet 검증 실패: minLength',
        )
      })

      it('should format type messages', () => {
        expect(formatMessage('TYPE.ELEMENT_NOT_FOUND', 'unknownElement')).toBe(
          '스키마에서 요소를 찾을 수 없습니다: unknownElement',
        )
        expect(formatMessage('TYPE.TYPE_NOT_FOUND', 'CT_Unknown')).toBe(
          '타입을 찾을 수 없습니다: CT_Unknown',
        )
      })

      it('should format internal messages', () => {
        expect(formatMessage('INTERNAL.INVALID_COMPOSITOR_STATE')).toBe(
          '잘못된 중첩 compositor 상태 (내부 오류)',
        )
      })
    })

    describe('English locale', () => {
      beforeEach(() => {
        setLocale('en')
      })

      it('should format compositor messages', () => {
        expect(formatMessage('COMPOSITOR.INVALID_CONTENT')).toBe('Invalid content structure')
        expect(formatMessage('COMPOSITOR.MISSING_REQUIRED_ELEMENT', 'chart')).toBe(
          "Required element 'chart' is missing",
        )
        expect(formatMessage('COMPOSITOR.TOO_MANY_ELEMENTS', 'item')).toBe(
          "Too many occurrences of element 'item'",
        )
        expect(formatMessage('COMPOSITOR.INVALID_ELEMENT', 'invalid')).toBe(
          "Element 'invalid' is not allowed here",
        )
        expect(formatMessage('COMPOSITOR.CHOICE_NOT_SATISFIED')).toBe(
          'Choice compositor constraint not satisfied',
        )
      })

      it('should format element messages', () => {
        expect(formatMessage('ELEMENT.MISSING_REQUIRED', 'worksheet')).toBe(
          "Required element 'worksheet' is missing",
        )
        expect(formatMessage('ELEMENT.INVALID', 'unknown')).toBe('Invalid element: unknown')
        expect(formatMessage('ELEMENT.UNEXPECTED_TEXT.ELEMENT_ONLY')).toBe(
          'Text content is not allowed in element-only content',
        )
        expect(formatMessage('ELEMENT.UNEXPECTED_TEXT.COMPLEX_CONTENT')).toBe(
          'Text content is not allowed in complexContent',
        )
      })

      it('should format attribute messages', () => {
        expect(formatMessage('ATTRIBUTE.INVALID', 'invalidAttr')).toBe(
          "Attribute 'invalidAttr' is not allowed",
        )
        expect(formatMessage('ATTRIBUTE.PROHIBITED', 'prohibitedAttr')).toBe(
          "Prohibited attribute 'prohibitedAttr' is used",
        )
        expect(formatMessage('ATTRIBUTE.MISSING_REQUIRED', 'id')).toBe(
          "Required attribute 'id' is missing",
        )
      })

      it('should format value messages', () => {
        expect(formatMessage('VALUE.INVALID_TYPE', 'xsd:int')).toBe(
          'Type validation failed: xsd:int',
        )
        expect(formatMessage('VALUE.INVALID_UNION')).toBe(
          'Value does not match any union member type',
        )
        expect(formatMessage('VALUE.INVALID_LIST_ITEM')).toBe(
          'List item does not match expected type',
        )
        expect(formatMessage('VALUE.INVALID_ENUM', 'color')).toBe(
          'Enumeration validation failed: color',
        )
        expect(formatMessage('VALUE.INVALID_FACET', 'minLength')).toBe(
          'Facet validation failed: minLength',
        )
      })

      it('should format type messages', () => {
        expect(formatMessage('TYPE.ELEMENT_NOT_FOUND', 'unknownElement')).toBe(
          'Element not found in schema: unknownElement',
        )
        expect(formatMessage('TYPE.TYPE_NOT_FOUND', 'CT_Unknown')).toBe(
          'Type not found: CT_Unknown',
        )
      })

      it('should format internal messages', () => {
        expect(formatMessage('INTERNAL.INVALID_COMPOSITOR_STATE')).toBe(
          'Invalid nested compositor state (internal error)',
        )
      })
    })

    describe('Locale switching', () => {
      it('should switch messages when locale changes', () => {
        const key: MessageKey = 'ELEMENT.MISSING_REQUIRED'
        const element = 'chart'

        setLocale('ko')
        const koreanMsg = formatMessage(key, element)
        expect(koreanMsg).toBe("필수 요소 'chart'가 누락되었습니다")

        setLocale('en')
        const englishMsg = formatMessage(key, element)
        expect(englishMsg).toBe("Required element 'chart' is missing")

        setLocale('ko')
        const koreanMsg2 = formatMessage(key, element)
        expect(koreanMsg2).toBe("필수 요소 'chart'가 누락되었습니다")
      })
    })

    describe('Edge cases', () => {
      it('should handle unknown message keys gracefully', () => {
        // @ts-expect-error Testing unknown key
        const result = formatMessage('UNKNOWN.KEY')
        expect(result).toBe('Unknown message key: UNKNOWN.KEY')
      })
    })
  })

  describe('Type safety', () => {
    it('should enforce correct parameter types', () => {
      // This test validates TypeScript compile-time type checking
      // If these compile, the types are working correctly

      // No parameters
      const msg1: string = formatMessage('COMPOSITOR.INVALID_CONTENT')
      expect(msg1).toBeDefined()

      // Single string parameter
      const msg2: string = formatMessage('ELEMENT.MISSING_REQUIRED', 'chart')
      expect(msg2).toBeDefined()

      // Two string parameters would fail at compile time for most message keys
      // This is enforced by TypeScript
    })
  })
})

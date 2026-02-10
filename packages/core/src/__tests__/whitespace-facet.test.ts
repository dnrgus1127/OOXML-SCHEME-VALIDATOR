import { describe, it, expect } from 'vitest'
import {
  applyWhitespace,
  validateFacet,
  validateBuiltinType,
} from '../engine/simple-type-validator'
import type { Facet } from '../types'

describe('applyWhitespace', () => {
  describe('preserve mode', () => {
    it('should preserve all whitespace characters', () => {
      expect(applyWhitespace('hello\tworld', 'preserve')).toBe('hello\tworld')
      expect(applyWhitespace('hello\nworld', 'preserve')).toBe('hello\nworld')
      expect(applyWhitespace('hello\r\nworld', 'preserve')).toBe('hello\r\nworld')
      expect(applyWhitespace('  hello  world  ', 'preserve')).toBe('  hello  world  ')
    })

    it('should preserve consecutive spaces', () => {
      expect(applyWhitespace('a  b', 'preserve')).toBe('a  b')
      expect(applyWhitespace('a   b', 'preserve')).toBe('a   b')
    })

    it('should preserve leading and trailing whitespace', () => {
      expect(applyWhitespace('  hello  ', 'preserve')).toBe('  hello  ')
      expect(applyWhitespace('\thello\t', 'preserve')).toBe('\thello\t')
    })
  })

  describe('replace mode', () => {
    it('should replace tabs with spaces', () => {
      expect(applyWhitespace('hello\tworld', 'replace')).toBe('hello world')
      expect(applyWhitespace('a\tb\tc', 'replace')).toBe('a b c')
    })

    it('should replace newlines with spaces', () => {
      expect(applyWhitespace('hello\nworld', 'replace')).toBe('hello world')
      expect(applyWhitespace('a\nb\nc', 'replace')).toBe('a b c')
    })

    it('should replace carriage returns with spaces', () => {
      expect(applyWhitespace('hello\rworld', 'replace')).toBe('hello world')
      expect(applyWhitespace('hello\r\nworld', 'replace')).toBe('hello  world')
    })

    it('should NOT collapse consecutive spaces', () => {
      expect(applyWhitespace('a  b', 'replace')).toBe('a  b')
      expect(applyWhitespace('  hello  ', 'replace')).toBe('  hello  ')
    })

    it('should NOT trim leading/trailing spaces', () => {
      expect(applyWhitespace('  hello  ', 'replace')).toBe('  hello  ')
      expect(applyWhitespace(' world ', 'replace')).toBe(' world ')
    })
  })

  describe('collapse mode', () => {
    it('should replace control characters with spaces', () => {
      expect(applyWhitespace('hello\tworld', 'collapse')).toBe('hello world')
      expect(applyWhitespace('hello\nworld', 'collapse')).toBe('hello world')
      expect(applyWhitespace('hello\rworld', 'collapse')).toBe('hello world')
    })

    it('should collapse consecutive spaces to single space', () => {
      expect(applyWhitespace('a  b', 'collapse')).toBe('a b')
      expect(applyWhitespace('a   b', 'collapse')).toBe('a b')
      expect(applyWhitespace('a    b', 'collapse')).toBe('a b')
    })

    it('should trim leading and trailing whitespace', () => {
      expect(applyWhitespace('  hello  ', 'collapse')).toBe('hello')
      expect(applyWhitespace('\thello\t', 'collapse')).toBe('hello')
      expect(applyWhitespace(' \n hello \n ', 'collapse')).toBe('hello')
    })

    it('should handle complex whitespace combinations', () => {
      expect(applyWhitespace('  a\t\tb  \nc  ', 'collapse')).toBe('a b c')
      expect(applyWhitespace('\n\n  hello  \t\t  world  \n\n', 'collapse')).toBe('hello world')
    })

    it('should handle edge cases', () => {
      expect(applyWhitespace('', 'collapse')).toBe('')
      expect(applyWhitespace('   ', 'collapse')).toBe('')
      expect(applyWhitespace('\t\n\r', 'collapse')).toBe('')
      expect(applyWhitespace('hello', 'collapse')).toBe('hello')
    })
  })
})

describe('validateFacet - whiteSpace', () => {
  it('should validate preserve mode - value must be unchanged', () => {
    const facet: Facet = { type: 'whiteSpace', value: 'preserve' }

    expect(validateFacet('hello\tworld', facet)).toBe(true)
    expect(validateFacet('hello\nworld', facet)).toBe(true)
    expect(validateFacet('  hello  ', facet)).toBe(true)

    // These are already normalized, so they pass
    expect(validateFacet('hello world', facet)).toBe(true)
    expect(validateFacet('hello', facet)).toBe(true)
  })

  it('should validate replace mode - no tabs/newlines/CR allowed', () => {
    const facet: Facet = { type: 'whiteSpace', value: 'replace' }

    // Valid: no control characters
    expect(validateFacet('hello world', facet)).toBe(true)
    expect(validateFacet('  hello  ', facet)).toBe(true)
    expect(validateFacet('a  b', facet)).toBe(true)

    // Invalid: contains control characters
    expect(validateFacet('hello\tworld', facet)).toBe(false)
    expect(validateFacet('hello\nworld', facet)).toBe(false)
    expect(validateFacet('hello\rworld', facet)).toBe(false)
  })

  it('should validate collapse mode - must be trimmed with single spaces', () => {
    const facet: Facet = { type: 'whiteSpace', value: 'collapse' }

    // Valid: already collapsed
    expect(validateFacet('hello', facet)).toBe(true)
    expect(validateFacet('hello world', facet)).toBe(true)
    expect(validateFacet('a b c', facet)).toBe(true)
    expect(validateFacet('', facet)).toBe(true)

    // Invalid: has consecutive spaces
    expect(validateFacet('a  b', facet)).toBe(false)
    expect(validateFacet('a   b', facet)).toBe(false)

    // Invalid: has leading/trailing spaces
    expect(validateFacet(' hello', facet)).toBe(false)
    expect(validateFacet('hello ', facet)).toBe(false)
    expect(validateFacet('  hello  ', facet)).toBe(false)

    // Invalid: has control characters
    expect(validateFacet('hello\tworld', facet)).toBe(false)
    expect(validateFacet('hello\nworld', facet)).toBe(false)
  })
})

describe('validateBuiltinType - whitespace integration', () => {
  describe('normalizedString type', () => {
    it('should accept values with replace whitespace normalization', () => {
      expect(validateBuiltinType('hello world', 'normalizedString')).toBe(true)
      expect(validateBuiltinType('  hello  ', 'normalizedString')).toBe(true)
      expect(validateBuiltinType('a  b', 'normalizedString')).toBe(true)
    })

    it('should reject values with control characters', () => {
      expect(validateBuiltinType('hello\tworld', 'normalizedString')).toBe(false)
      expect(validateBuiltinType('hello\nworld', 'normalizedString')).toBe(false)
      expect(validateBuiltinType('hello\rworld', 'normalizedString')).toBe(false)
    })
  })

  describe('token type', () => {
    it('should accept collapsed whitespace values', () => {
      expect(validateBuiltinType('hello', 'token')).toBe(true)
      expect(validateBuiltinType('hello world', 'token')).toBe(true)
      expect(validateBuiltinType('a b c', 'token')).toBe(true)
      expect(validateBuiltinType('', 'token')).toBe(true)
    })

    it('should reject values with consecutive spaces', () => {
      expect(validateBuiltinType('a  b', 'token')).toBe(false)
      expect(validateBuiltinType('a   b', 'token')).toBe(false)
    })

    it('should reject values with leading/trailing whitespace', () => {
      expect(validateBuiltinType(' hello', 'token')).toBe(false)
      expect(validateBuiltinType('hello ', 'token')).toBe(false)
      expect(validateBuiltinType('  hello  ', 'token')).toBe(false)
    })

    it('should reject values with control characters', () => {
      expect(validateBuiltinType('hello\tworld', 'token')).toBe(false)
      expect(validateBuiltinType('hello\nworld', 'token')).toBe(false)
      expect(validateBuiltinType('hello\rworld', 'token')).toBe(false)
    })
  })

  describe('NCName type', () => {
    it('should accept valid NCNames with collapsed whitespace', () => {
      expect(validateBuiltinType('hello', 'NCName')).toBe(true)
      expect(validateBuiltinType('myElement', 'NCName')).toBe(true)
      expect(validateBuiltinType('_element', 'NCName')).toBe(true)
      expect(validateBuiltinType('element123', 'NCName')).toBe(true)
    })

    it('should reject NCNames with whitespace', () => {
      expect(validateBuiltinType('hello world', 'NCName')).toBe(false)
      expect(validateBuiltinType(' hello', 'NCName')).toBe(false)
      expect(validateBuiltinType('hello ', 'NCName')).toBe(false)
    })

    it('should reject NCNames with control characters', () => {
      expect(validateBuiltinType('hello\tworld', 'NCName')).toBe(false)
      expect(validateBuiltinType('hello\nworld', 'NCName')).toBe(false)
    })

    it('should reject NCNames with colons', () => {
      expect(validateBuiltinType('ns:element', 'NCName')).toBe(false)
      expect(validateBuiltinType('a:b', 'NCName')).toBe(false)
    })
  })
})

describe('whitespace edge cases', () => {
  it('should handle empty strings', () => {
    expect(applyWhitespace('', 'preserve')).toBe('')
    expect(applyWhitespace('', 'replace')).toBe('')
    expect(applyWhitespace('', 'collapse')).toBe('')
  })

  it('should handle strings with only whitespace', () => {
    expect(applyWhitespace('   ', 'preserve')).toBe('   ')
    expect(applyWhitespace('   ', 'replace')).toBe('   ')
    expect(applyWhitespace('   ', 'collapse')).toBe('')

    expect(applyWhitespace('\t\n\r', 'preserve')).toBe('\t\n\r')
    expect(applyWhitespace('\t\n\r', 'replace')).toBe('   ')
    expect(applyWhitespace('\t\n\r', 'collapse')).toBe('')
  })

  it('should handle non-breaking spaces (U+00A0) as regular characters', () => {
    // Non-breaking space (U+00A0) is not a whitespace character in XML Schema
    const nbspValue = 'hello\u00A0world'
    expect(applyWhitespace(nbspValue, 'collapse')).toBe(nbspValue)
  })

  it('should handle Unicode whitespace variations', () => {
    // Only tab, newline, and carriage return are replaced
    // Other Unicode whitespace characters are preserved
    expect(applyWhitespace('a\u2003b', 'replace')).toBe('a\u2003b') // em space
    expect(applyWhitespace('a\u2003b', 'collapse')).toBe('a\u2003b')
  })
})

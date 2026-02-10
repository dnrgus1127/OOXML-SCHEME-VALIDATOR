import { describe, it, expect } from 'vitest'
import { validateBuiltinType } from '../engine/simple-type-validator'

describe('anyURI validation', () => {
  describe('RFC 3986 absolute URIs', () => {
    it('should accept valid HTTP(S) URIs', () => {
      expect(validateBuiltinType('http://example.com', 'anyURI')).toBe(true)
      expect(validateBuiltinType('https://example.com', 'anyURI')).toBe(true)
      expect(validateBuiltinType('http://example.com:8080', 'anyURI')).toBe(true)
      expect(validateBuiltinType('https://example.com/path/to/resource', 'anyURI')).toBe(true)
    })

    it('should accept URIs with query strings', () => {
      expect(validateBuiltinType('http://example.com?query=value', 'anyURI')).toBe(true)
      expect(validateBuiltinType('https://example.com/path?foo=bar&baz=qux', 'anyURI')).toBe(true)
    })

    it('should accept URIs with fragments', () => {
      expect(validateBuiltinType('http://example.com#section', 'anyURI')).toBe(true)
      expect(validateBuiltinType('https://example.com/page#top', 'anyURI')).toBe(true)
      expect(validateBuiltinType('http://example.com?query=value#fragment', 'anyURI')).toBe(true)
    })

    it('should accept mailto URIs', () => {
      expect(validateBuiltinType('mailto:user@example.com', 'anyURI')).toBe(true)
      expect(validateBuiltinType('mailto:admin@domain.org', 'anyURI')).toBe(true)
    })

    it('should accept URN schemes', () => {
      expect(validateBuiltinType('urn:isbn:0-486-27557-4', 'anyURI')).toBe(true)
      expect(validateBuiltinType('urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6', 'anyURI')).toBe(
        true
      )
      expect(validateBuiltinType('urn:ietf:rfc:3986', 'anyURI')).toBe(true)
    })

    it('should accept file URIs', () => {
      expect(validateBuiltinType('file:///path/to/file.txt', 'anyURI')).toBe(true)
      expect(validateBuiltinType('file://localhost/path/to/file', 'anyURI')).toBe(true)
    })

    it('should accept FTP URIs', () => {
      expect(validateBuiltinType('ftp://ftp.example.com/file.zip', 'anyURI')).toBe(true)
      expect(validateBuiltinType('ftps://secure.example.com/data', 'anyURI')).toBe(true)
    })

    it('should accept data URIs', () => {
      expect(validateBuiltinType('data:text/plain;base64,SGVsbG8=', 'anyURI')).toBe(true)
      expect(validateBuiltinType('data:image/png;base64,iVBORw0KGgo=', 'anyURI')).toBe(true)
      expect(validateBuiltinType('data:text/html,<h1>Hello</h1>', 'anyURI')).toBe(true)
    })

    it('should accept schemes with mixed case', () => {
      expect(validateBuiltinType('HTTP://example.com', 'anyURI')).toBe(true)
      expect(validateBuiltinType('Https://Example.COM', 'anyURI')).toBe(true)
      expect(validateBuiltinType('MailTo:user@host', 'anyURI')).toBe(true)
    })

    it('should accept schemes with digits and special chars', () => {
      expect(validateBuiltinType('h323:user@host', 'anyURI')).toBe(true)
      expect(validateBuiltinType('sip+tls:user@host', 'anyURI')).toBe(true)
      expect(validateBuiltinType('custom-scheme://host', 'anyURI')).toBe(true)
      expect(validateBuiltinType('scheme.v2://host', 'anyURI')).toBe(true)
    })
  })

  describe('OOXML relative references', () => {
    it('should accept relative paths', () => {
      expect(validateBuiltinType('../styles.xml', 'anyURI')).toBe(true)
      expect(validateBuiltinType('./document.xml', 'anyURI')).toBe(true)
      expect(validateBuiltinType('../../shared/theme.xml', 'anyURI')).toBe(true)
    })

    it('should accept simple file names', () => {
      expect(validateBuiltinType('file.xml', 'anyURI')).toBe(true)
      expect(validateBuiltinType('document.xml', 'anyURI')).toBe(true)
      expect(validateBuiltinType('styles.xml', 'anyURI')).toBe(true)
    })

    it('should accept relationship IDs', () => {
      expect(validateBuiltinType('rId1', 'anyURI')).toBe(true)
      expect(validateBuiltinType('rId123', 'anyURI')).toBe(true)
      expect(validateBuiltinType('relationshipId', 'anyURI')).toBe(true)
    })

    it('should accept paths with directories', () => {
      expect(validateBuiltinType('word/document.xml', 'anyURI')).toBe(true)
      expect(validateBuiltinType('xl/workbook.xml', 'anyURI')).toBe(true)
      expect(validateBuiltinType('ppt/slides/slide1.xml', 'anyURI')).toBe(true)
    })

    it('should accept fragment-only references', () => {
      expect(validateBuiltinType('#section', 'anyURI')).toBe(true)
      expect(validateBuiltinType('#top', 'anyURI')).toBe(true)
      expect(validateBuiltinType('#heading-1', 'anyURI')).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should accept empty string', () => {
      expect(validateBuiltinType('', 'anyURI')).toBe(true)
    })

    it('should accept very long URIs', () => {
      const longUri = 'http://example.com/' + 'a'.repeat(2000)
      expect(validateBuiltinType(longUri, 'anyURI')).toBe(true)
    })

    it('should accept URIs with percent-encoded characters', () => {
      expect(validateBuiltinType('http://example.com/path%20with%20spaces', 'anyURI')).toBe(true)
      expect(validateBuiltinType('http://example.com/%E4%B8%AD%E6%96%87', 'anyURI')).toBe(true)
      expect(validateBuiltinType('file:///C:/Program%20Files/app', 'anyURI')).toBe(true)
    })

    it('should accept URIs with special characters', () => {
      expect(validateBuiltinType('http://example.com/~user', 'anyURI')).toBe(true)
      expect(validateBuiltinType('http://example.com/path?q=a+b', 'anyURI')).toBe(true)
      expect(validateBuiltinType('http://example.com/path?arr[]=1&arr[]=2', 'anyURI')).toBe(true)
    })

    it('should accept IPv4 addresses', () => {
      expect(validateBuiltinType('http://192.168.1.1', 'anyURI')).toBe(true)
      expect(validateBuiltinType('http://192.168.1.1:8080/path', 'anyURI')).toBe(true)
    })

    it('should accept IPv6 addresses', () => {
      expect(validateBuiltinType('http://[::1]', 'anyURI')).toBe(true)
      expect(validateBuiltinType('http://[2001:db8::1]:8080', 'anyURI')).toBe(true)
    })

    it('should accept URIs with authentication', () => {
      expect(validateBuiltinType('http://user:pass@example.com', 'anyURI')).toBe(true)
      expect(validateBuiltinType('ftp://admin:secret@ftp.example.com/file', 'anyURI')).toBe(true)
    })
  })

  describe('invalid URIs', () => {
    it('should reject URIs with spaces', () => {
      expect(validateBuiltinType('http://example.com/path with spaces', 'anyURI')).toBe(false)
      expect(validateBuiltinType('not a uri', 'anyURI')).toBe(false)
      expect(validateBuiltinType('file path.xml', 'anyURI')).toBe(false)
    })

    it('should reject URIs with control characters', () => {
      expect(validateBuiltinType('http://example.com/path\nwith\nnewlines', 'anyURI')).toBe(false)
      expect(validateBuiltinType('http://example.com/path\twith\ttabs', 'anyURI')).toBe(false)
      expect(validateBuiltinType('http://example.com/path\rwith\rCR', 'anyURI')).toBe(false)
    })

    it('should reject invalid schemes', () => {
      expect(validateBuiltinType('123:invalid', 'anyURI')).toBe(false) // scheme must start with letter
      expect(validateBuiltinType('-invalid://host', 'anyURI')).toBe(false)
      expect(validateBuiltinType('+invalid://host', 'anyURI')).toBe(false)
    })

    it('should reject URIs with only scheme (no content)', () => {
      expect(validateBuiltinType('http:', 'anyURI')).toBe(false)
      expect(validateBuiltinType('https:', 'anyURI')).toBe(false)
      expect(validateBuiltinType('scheme:', 'anyURI')).toBe(false)
    })
  })

  describe('compatibility with other builtin types', () => {
    it('should not affect string validation', () => {
      expect(validateBuiltinType('any string', 'string')).toBe(true)
      expect(validateBuiltinType('not a uri', 'string')).toBe(true)
    })

    it('should not affect token validation', () => {
      expect(validateBuiltinType('token', 'token')).toBe(true)
      expect(validateBuiltinType('http://example.com', 'token')).toBe(true)
    })
  })
})

import { describe, expect, it } from 'vitest'
import { normalizePartPath, shouldValidateXmlPart } from '../part-validation-filter'

describe('part validation filter', () => {
  it('normalizes paths with and without leading slash', () => {
    expect(normalizePartPath('/word/document.xml')).toBe('/word/document.xml')
    expect(normalizePartPath('word/document.xml')).toBe('/word/document.xml')
    expect(normalizePartPath('')).toBe('/')
  })

  it('excludes non-xml and relationship parts', () => {
    expect(shouldValidateXmlPart('/word/document.bin', 'application/octet-stream')).toBe(false)
    expect(
      shouldValidateXmlPart(
        '/_rels/.rels',
        'application/vnd.openxmlformats-package.relationships+xml'
      )
    ).toBe(false)
    expect(
      shouldValidateXmlPart(
        'word/_rels/document.xml.rels',
        'application/vnd.openxmlformats-package.relationships+xml'
      )
    ).toBe(false)
  })

  it('keeps package metadata parts as validation targets', () => {
    expect(shouldValidateXmlPart('/docProps/core.xml', 'application/xml')).toBe(true)
    expect(shouldValidateXmlPart('/[Content_Types].xml', 'application/xml')).toBe(true)
    expect(shouldValidateXmlPart('[Content_Types].xml', 'application/xml')).toBe(true)
  })

  it('excludes customXml root parts except itemProps', () => {
    expect(shouldValidateXmlPart('/customXml/item1.xml', 'application/xml')).toBe(false)
    expect(shouldValidateXmlPart('/customXml/itemProps1.xml', 'application/xml')).toBe(true)
  })
})

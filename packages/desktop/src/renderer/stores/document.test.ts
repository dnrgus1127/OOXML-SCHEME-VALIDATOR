import { describe, expect, it } from 'vitest'
import { isOriginalDocumentPath } from './document'

describe('isOriginalDocumentPath', () => {
  it('returns true when current file path is the original file path', () => {
    expect(isOriginalDocumentPath('C:/docs/sample.xlsx', 'C:/docs/sample.xlsx')).toBe(true)
  })

  it('returns false when current file path came from save as', () => {
    expect(isOriginalDocumentPath('C:/docs/sample-copy.xlsx', 'C:/docs/sample.xlsx')).toBe(false)
  })

  it('returns false when either path is missing', () => {
    expect(isOriginalDocumentPath(null, 'C:/docs/sample.xlsx')).toBe(false)
    expect(isOriginalDocumentPath('C:/docs/sample.xlsx', null)).toBe(false)
  })
})

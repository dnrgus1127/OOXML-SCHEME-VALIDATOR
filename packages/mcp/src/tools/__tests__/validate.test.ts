import { beforeEach, describe, expect, it, vi } from 'vitest'
const {
  fromBufferMock,
  parseXmlToEventArrayMock,
  loadSchemaRegistryMock,
  validateXmlEventsMock,
} = vi.hoisted(() => ({
  fromBufferMock: vi.fn(),
  parseXmlToEventArrayMock: vi.fn(),
  loadSchemaRegistryMock: vi.fn(),
  validateXmlEventsMock: vi.fn(),
}))

vi.mock('@ooxml/parser', () => ({
  OoxmlParser: {
    fromBuffer: fromBufferMock,
  },
  parseXmlToEventArray: parseXmlToEventArrayMock,
}))

vi.mock('@ooxml/core', () => ({
  loadSchemaRegistry: loadSchemaRegistryMock,
  validateXmlEvents: validateXmlEventsMock,
}))

import { validateOoxml } from '../validate'

describe('validateOoxml', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('실제 core XSD 검증 엔진(validateXmlEvents)을 호출해 결과를 반영한다', async () => {
    const events = [
      { type: 'startDocument' },
      {
        type: 'startElement',
        element: {
          name: 'w:document',
          localName: 'document',
          namespaceUri: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
          prefix: 'w',
          attributes: [],
          namespaceDeclarations: new Map(),
        },
      },
      {
        type: 'endElement',
        element: {
          name: 'w:document',
          localName: 'document',
          namespaceUri: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
          prefix: 'w',
          attributes: [],
          namespaceDeclarations: new Map(),
        },
      },
      { type: 'endDocument' },
    ]

    const fakeDoc = {
      documentType: 'document',
      getXmlParts: () => [
        {
          path: '/word/document.xml',
          contentType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
          content: Buffer.from('<w:document/>', 'utf-8'),
        },
      ],
    }

    fromBufferMock.mockResolvedValue(fakeDoc)
    parseXmlToEventArrayMock.mockReturnValue(events)
    const fakeRegistry = { schemas: new Map() }
    loadSchemaRegistryMock.mockReturnValue(fakeRegistry)
    validateXmlEventsMock.mockReturnValue({
      valid: false,
      errors: [{ code: 'INVALID_CONTENT', message: 'schema fail', path: '/w:document' }],
      warnings: [{ code: 'WARN', message: 'warn', path: '/' }],
    })

    const result = await validateOoxml({
      file_base64: Buffer.from('dummy').toString('base64'),
      options: { maxErrors: 10, strict: true },
    })

    expect(loadSchemaRegistryMock).toHaveBeenCalledWith('document')
    expect(validateXmlEventsMock).toHaveBeenCalledWith(
      fakeRegistry,
      events,
      expect.objectContaining({ strict: true, includeWarnings: true, maxErrors: 10 })
    )
    expect(result.valid).toBe(false)
    expect(result.totalErrors).toBe(1)
    expect(result.totalWarnings).toBe(1)
    expect(result.results[0]?.errors[0]?.code).toBe('INVALID_CONTENT')
    expect(result.results[0]?.errors[0]?.path).toBe('/w:document')
  })
})

import { describe, expect, it } from 'vitest'
import { loadSchemaRegistry } from '../schema/schema-loader'
import { validateXmlEvents, type XmlValidationEvent } from '../mcp'
import type { XmlAttribute, XmlElementInfo } from '../runtime'

const SML_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const MC_NS = 'http://schemas.openxmlformats.org/markup-compatibility/2006'
const X15AC_NS = 'http://schemas.microsoft.com/office/spreadsheetml/2010/11/ac'

function attr(
  name: string,
  value: string,
  namespaceUri = '',
  localName = name.includes(':') ? name.split(':')[1]! : name
): XmlAttribute {
  return { name, value, namespaceUri, localName }
}

function el(
  name: string,
  localName: string,
  namespaceUri: string,
  attributes: XmlAttribute[] = [],
  namespaceDeclarations?: Map<string, string>
): XmlElementInfo {
  return { name, localName, namespaceUri, attributes, namespaceDeclarations }
}

describe('alternate content warning handling', () => {
  it('skips unsupported AlternateContent subtree and preserves workbook sequence validation', () => {
    const root = el(
      'x:workbook',
      'workbook',
      SML_NS,
      [],
      new Map([
        ['x', SML_NS],
        ['r', REL_NS],
      ])
    )

    const events: XmlValidationEvent[] = [
      { type: 'startDocument' },
      { type: 'startElement', element: root },
      { type: 'startElement', element: el('x:workbookPr', 'workbookPr', SML_NS) },
      { type: 'endElement', element: el('x:workbookPr', 'workbookPr', SML_NS) },
      {
        type: 'startElement',
        element: el(
          'mc:AlternateContent',
          'AlternateContent',
          MC_NS,
          [],
          new Map([
            ['mc', MC_NS],
            ['x15', 'http://schemas.microsoft.com/office/spreadsheetml/2010/11/main'],
            ['x15ac', X15AC_NS],
          ])
        ),
      },
      {
        type: 'startElement',
        element: el('mc:Choice', 'Choice', MC_NS, [attr('Requires', 'x15')]),
      },
      {
        type: 'startElement',
        element: el('x15ac:absPath', 'absPath', X15AC_NS, [attr('url', 'C:\\temp\\')]),
      },
      { type: 'endElement', element: el('x15ac:absPath', 'absPath', X15AC_NS) },
      { type: 'endElement', element: el('mc:Choice', 'Choice', MC_NS) },
      { type: 'endElement', element: el('mc:AlternateContent', 'AlternateContent', MC_NS) },
      { type: 'startElement', element: el('x:bookViews', 'bookViews', SML_NS) },
      {
        type: 'startElement',
        element: el('x:workbookView', 'workbookView', SML_NS, [
          attr('xWindow', '0'),
          attr('yWindow', '0'),
          attr('windowWidth', '28550'),
          attr('windowHeight', '11300'),
          attr('activeTab', '1'),
        ]),
      },
      { type: 'endElement', element: el('x:workbookView', 'workbookView', SML_NS) },
      { type: 'endElement', element: el('x:bookViews', 'bookViews', SML_NS) },
      { type: 'startElement', element: el('x:sheets', 'sheets', SML_NS) },
      {
        type: 'startElement',
        element: el('x:sheet', 'sheet', SML_NS, [
          attr('name', 'Sheet1'),
          attr('sheetId', '1'),
          attr('r:id', 'rId1', REL_NS, 'id'),
        ]),
      },
      { type: 'endElement', element: el('x:sheet', 'sheet', SML_NS) },
      { type: 'endElement', element: el('x:sheets', 'sheets', SML_NS) },
      { type: 'endElement', element: root },
      { type: 'endDocument' },
    ]

    const result = validateXmlEvents(loadSchemaRegistry('spreadsheet'), events, {
      allowWhitespace: true,
      includeWarnings: true,
      maxErrors: 200,
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'UNSUPPORTED_ALTERNATE_CONTENT',
        path: '/workbook/AlternateContent',
      }),
    ])
  })
})

import { describe, expect, it } from 'vitest'
import { loadSchemaRegistry } from '../schema/schema-loader'
import { validateXmlEvents, type XmlValidationEvent } from '../mcp'
import type { XmlAttribute, XmlElementInfo } from '../runtime'

const SML_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const MC_NS = 'http://schemas.openxmlformats.org/markup-compatibility/2006'
const XR_NS = 'http://schemas.microsoft.com/office/spreadsheetml/2014/revision'
const XR2_NS = 'http://schemas.microsoft.com/office/spreadsheetml/2015/revision2'
const X15AC_NS = 'http://schemas.microsoft.com/office/spreadsheetml/2010/11/ac'
const CP_NS = 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties'
const DCTERMS_NS = 'http://purl.org/dc/terms/'
const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance'

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

function validateSpreadsheet(events: XmlValidationEvent[], strict = false) {
  const registry = loadSchemaRegistry('spreadsheet')
  return validateXmlEvents(registry, events, {
    allowWhitespace: true,
    strict,
    maxErrors: 200,
  })
}

function validateDocument(events: XmlValidationEvent[], strict = false) {
  const registry = loadSchemaRegistry('document')
  return validateXmlEvents(registry, events, {
    allowWhitespace: true,
    strict,
    maxErrors: 200,
  })
}

describe('transitional compatibility', () => {
  it('accepts foreign namespace extension content in workbook when strict=false', () => {
    const root = el(
      'workbook',
      'workbook',
      SML_NS,
      [attr('mc:Ignorable', 'x15 xr xr2', MC_NS, 'Ignorable')],
      new Map([
        ['', SML_NS],
        ['r', REL_NS],
        ['mc', MC_NS],
        ['xr', XR_NS],
        ['xr2', XR2_NS],
      ])
    )

    const events: XmlValidationEvent[] = [
      { type: 'startDocument' },
      { type: 'startElement', element: root },
      { type: 'startElement', element: el('workbookPr', 'workbookPr', SML_NS) },
      { type: 'endElement', element: el('workbookPr', 'workbookPr', SML_NS) },
      {
        type: 'startElement',
        element: el(
          'mc:AlternateContent',
          'AlternateContent',
          MC_NS,
          [],
          new Map([
            ['mc', MC_NS],
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
        element: el(
          'x15ac:absPath',
          'absPath',
          X15AC_NS,
          [attr('url', 'C:\\temp\\')],
          new Map([['x15ac', X15AC_NS]])
        ),
      },
      { type: 'endElement', element: el('x15ac:absPath', 'absPath', X15AC_NS) },
      { type: 'endElement', element: el('mc:Choice', 'Choice', MC_NS) },
      { type: 'endElement', element: el('mc:AlternateContent', 'AlternateContent', MC_NS) },
      {
        type: 'startElement',
        element: el('xr:revisionPtr', 'revisionPtr', XR_NS),
      },
      { type: 'endElement', element: el('xr:revisionPtr', 'revisionPtr', XR_NS) },
      { type: 'startElement', element: el('bookViews', 'bookViews', SML_NS) },
      {
        type: 'startElement',
        element: el('workbookView', 'workbookView', SML_NS, [
          attr('xr2:uid', '{00000000-0000-0000-0000-000000000000}', XR2_NS, 'uid'),
        ]),
      },
      { type: 'endElement', element: el('workbookView', 'workbookView', SML_NS) },
      { type: 'endElement', element: el('bookViews', 'bookViews', SML_NS) },
      { type: 'startElement', element: el('sheets', 'sheets', SML_NS) },
      {
        type: 'startElement',
        element: el('sheet', 'sheet', SML_NS, [
          attr('name', 'Sheet1'),
          attr('sheetId', '1'),
          attr('r:id', 'rId1', REL_NS, 'id'),
        ]),
      },
      { type: 'endElement', element: el('sheet', 'sheet', SML_NS) },
      { type: 'endElement', element: el('sheets', 'sheets', SML_NS) },
      { type: 'endElement', element: root },
      { type: 'endDocument' },
    ]

    const loose = validateSpreadsheet(events, false)
    expect(loose.valid).toBe(true)

    const strict = validateSpreadsheet(events, true)
    expect(strict.valid).toBe(false)
  })

  it('accepts left/right border elements in stylesheet when strict=false', () => {
    const root = el(
      'styleSheet',
      'styleSheet',
      SML_NS,
      [attr('mc:Ignorable', 'xr', MC_NS, 'Ignorable')],
      new Map([
        ['', SML_NS],
        ['mc', MC_NS],
      ])
    )

    const events: XmlValidationEvent[] = [
      { type: 'startDocument' },
      { type: 'startElement', element: root },
      { type: 'startElement', element: el('borders', 'borders', SML_NS, [attr('count', '1')]) },
      { type: 'startElement', element: el('border', 'border', SML_NS) },
      { type: 'startElement', element: el('left', 'left', SML_NS, [attr('style', 'thin')]) },
      { type: 'startElement', element: el('color', 'color', SML_NS, [attr('rgb', 'FF9DC3E6')]) },
      { type: 'endElement', element: el('color', 'color', SML_NS) },
      { type: 'endElement', element: el('left', 'left', SML_NS) },
      { type: 'startElement', element: el('right', 'right', SML_NS, [attr('style', 'thin')]) },
      { type: 'startElement', element: el('color', 'color', SML_NS, [attr('rgb', 'FF9DC3E6')]) },
      { type: 'endElement', element: el('color', 'color', SML_NS) },
      { type: 'endElement', element: el('right', 'right', SML_NS) },
      { type: 'startElement', element: el('top', 'top', SML_NS) },
      { type: 'endElement', element: el('top', 'top', SML_NS) },
      { type: 'startElement', element: el('bottom', 'bottom', SML_NS) },
      { type: 'endElement', element: el('bottom', 'bottom', SML_NS) },
      { type: 'startElement', element: el('diagonal', 'diagonal', SML_NS) },
      { type: 'endElement', element: el('diagonal', 'diagonal', SML_NS) },
      { type: 'endElement', element: el('border', 'border', SML_NS) },
      { type: 'endElement', element: el('borders', 'borders', SML_NS) },
      { type: 'endElement', element: root },
      { type: 'endDocument' },
    ]

    const result = validateSpreadsheet(events, false)
    expect(result.valid).toBe(true)
  })

  it('accepts xsi:type on dcterms:created when strict=false', () => {
    const root = el(
      'cp:coreProperties',
      'coreProperties',
      CP_NS,
      [],
      new Map([
        ['cp', CP_NS],
        ['dcterms', DCTERMS_NS],
        ['xsi', XSI_NS],
      ])
    )

    const created = el('dcterms:created', 'created', DCTERMS_NS, [
      attr('xsi:type', 'dcterms:W3CDTF', XSI_NS, 'type'),
    ])

    const events: XmlValidationEvent[] = [
      { type: 'startDocument' },
      { type: 'startElement', element: root },
      { type: 'startElement', element: created },
      { type: 'text', text: '2026-02-26T08:03:43Z' },
      { type: 'endElement', element: created },
      { type: 'endElement', element: root },
      { type: 'endDocument' },
    ]

    const result = validateDocument(events, false)
    expect(result.errors.some((err) => err.code === 'INVALID_ATTRIBUTE')).toBe(false)
  })
})

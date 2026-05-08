import { describe, it, expect } from 'vitest'
import { ValidationEngine } from '../engine/validator'
import { loadSchemaRegistry } from '../schema/schema-loader'

const CHART_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
const DML_MAIN_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main'

interface El {
  name: string
  localName: string
  namespaceUri: string
  attributes: Array<{ name: string; value: string; localName: string }>
  namespaceDeclarations?: Map<string, string>
}

function makeEl(prefix: string, localName: string, ns: string, attrs: El['attributes'] = []): El {
  return {
    name: prefix ? `${prefix}:${localName}` : localName,
    localName,
    namespaceUri: ns,
    attributes: attrs,
  }
}

function buildBarChartFixture(engine: ValidationEngine): void {
  const nsDecl = new Map([
    ['c', CHART_NS],
    ['a', DML_MAIN_NS],
  ])

  engine.startDocument()

  engine.startElement({
    ...makeEl('c', 'chartSpace', CHART_NS),
    namespaceDeclarations: nsDecl,
  })
  engine.startElement(makeEl('c', 'chart', CHART_NS))
  engine.startElement(makeEl('c', 'plotArea', CHART_NS))
  engine.startElement(makeEl('c', 'barChart', CHART_NS))
  engine.startElement(
    makeEl('c', 'barDir', CHART_NS, [{ name: 'val', value: 'col', localName: 'val' }])
  )
  engine.endElement(makeEl('c', 'barDir', CHART_NS))
  engine.startElement(makeEl('c', 'ser', CHART_NS))
  engine.startElement(makeEl('c', 'idx', CHART_NS, [{ name: 'val', value: '0', localName: 'val' }]))
  engine.endElement(makeEl('c', 'idx', CHART_NS))
  engine.startElement(
    makeEl('c', 'order', CHART_NS, [{ name: 'val', value: '0', localName: 'val' }])
  )
  engine.endElement(makeEl('c', 'order', CHART_NS))
  engine.startElement(makeEl('c', 'dLbls', CHART_NS))
  engine.startElement(makeEl('c', 'spPr', CHART_NS))
  engine.endElement(makeEl('c', 'spPr', CHART_NS))

  engine.startElement(makeEl('a', 'txPr', DML_MAIN_NS))
  engine.startElement(
    makeEl('a', 'bodyPr', DML_MAIN_NS, [{ name: 'rot', value: '0', localName: 'rot' }])
  )
  engine.endElement(makeEl('a', 'bodyPr', DML_MAIN_NS))
  engine.startElement(makeEl('a', 'p', DML_MAIN_NS))
  engine.endElement(makeEl('a', 'p', DML_MAIN_NS))
  engine.endElement(makeEl('a', 'txPr', DML_MAIN_NS))

  engine.endElement(makeEl('c', 'dLbls', CHART_NS))
  engine.endElement(makeEl('c', 'ser', CHART_NS))
  engine.startElement(
    makeEl('c', 'axId', CHART_NS, [{ name: 'val', value: '1', localName: 'val' }])
  )
  engine.endElement(makeEl('c', 'axId', CHART_NS))
  engine.startElement(
    makeEl('c', 'axId', CHART_NS, [{ name: 'val', value: '2', localName: 'val' }])
  )
  engine.endElement(makeEl('c', 'axId', CHART_NS))
  engine.endElement(makeEl('c', 'barChart', CHART_NS))
  engine.endElement(makeEl('c', 'plotArea', CHART_NS))
  engine.endElement(makeEl('c', 'chart', CHART_NS))
  engine.endElement(makeEl('c', 'chartSpace', CHART_NS))
}

describe('non-standard namespace handling', () => {
  it('a:txPr 에 대해 기본적으로 warning만 발생하고 INVALID_ELEMENT는 발생하지 않는다', () => {
    const registry = loadSchemaRegistry('spreadsheet')
    const engine = new ValidationEngine(registry, {
      maxErrors: 200,
      allowWhitespace: true,
      includeWarnings: true,
    })

    buildBarChartFixture(engine)
    const result = engine.endDocument()

    const txPrInvalid = result.errors.filter(
      (e) => e.code === 'INVALID_ELEMENT' && e.message.includes('a:txPr')
    )
    expect(txPrInvalid).toHaveLength(0)

    const cascadeNotFound = result.errors.filter((e) =>
      e.message.includes('스키마에서 요소를 찾을 수 없습니다')
    )
    expect(cascadeNotFound).toHaveLength(0)

    const warnings = result.warnings ?? []
    const nonStandardWarnings = warnings.filter((w) => w.code === 'NON_STANDARD_NAMESPACE')
    expect(nonStandardWarnings.length).toBeGreaterThanOrEqual(1)
    expect(nonStandardWarnings[0]!.message).toContain('a:txPr')
  })

  it("nonStandardNamespace='error' 에서는 NON_STANDARD_NAMESPACE 에러를 보고하지만 cascade는 억제된다", () => {
    const registry = loadSchemaRegistry('spreadsheet')
    const engine = new ValidationEngine(registry, {
      maxErrors: 200,
      allowWhitespace: true,
      includeWarnings: true,
      nonStandardNamespace: 'error',
    })

    buildBarChartFixture(engine)
    const result = engine.endDocument()

    const nsErrors = result.errors.filter((e) => e.code === 'NON_STANDARD_NAMESPACE')
    expect(nsErrors.length).toBeGreaterThanOrEqual(1)

    const cascadeNotFound = result.errors.filter((e) =>
      e.message.includes('스키마에서 요소를 찾을 수 없습니다')
    )
    expect(cascadeNotFound).toHaveLength(0)

    const txPrInvalid = result.errors.filter(
      (e) => e.code === 'INVALID_ELEMENT' && e.message.includes('a:txPr')
    )
    expect(txPrInvalid).toHaveLength(0)
  })

  it('정상 c:txPr 은 warning을 발생시키지 않는다', () => {
    const registry = loadSchemaRegistry('spreadsheet')
    const engine = new ValidationEngine(registry, {
      maxErrors: 200,
      allowWhitespace: true,
      includeWarnings: true,
    })

    const nsDecl = new Map([
      ['c', CHART_NS],
      ['a', DML_MAIN_NS],
    ])

    engine.startDocument()
    engine.startElement({
      ...makeEl('c', 'chartSpace', CHART_NS),
      namespaceDeclarations: nsDecl,
    })
    engine.startElement(makeEl('c', 'chart', CHART_NS))
    engine.startElement(makeEl('c', 'plotArea', CHART_NS))
    engine.startElement(makeEl('c', 'barChart', CHART_NS))
    engine.startElement(
      makeEl('c', 'barDir', CHART_NS, [{ name: 'val', value: 'col', localName: 'val' }])
    )
    engine.endElement(makeEl('c', 'barDir', CHART_NS))
    engine.startElement(makeEl('c', 'ser', CHART_NS))
    engine.startElement(makeEl('c', 'idx', CHART_NS, [{ name: 'val', value: '0', localName: 'val' }]))
    engine.endElement(makeEl('c', 'idx', CHART_NS))
    engine.startElement(
      makeEl('c', 'order', CHART_NS, [{ name: 'val', value: '0', localName: 'val' }])
    )
    engine.endElement(makeEl('c', 'order', CHART_NS))
    engine.startElement(makeEl('c', 'dLbls', CHART_NS))
    engine.startElement(makeEl('c', 'spPr', CHART_NS))
    engine.endElement(makeEl('c', 'spPr', CHART_NS))
    engine.startElement(makeEl('c', 'txPr', CHART_NS))
    engine.startElement(makeEl('a', 'bodyPr', DML_MAIN_NS))
    engine.endElement(makeEl('a', 'bodyPr', DML_MAIN_NS))
    engine.startElement(makeEl('a', 'p', DML_MAIN_NS))
    engine.endElement(makeEl('a', 'p', DML_MAIN_NS))
    engine.endElement(makeEl('c', 'txPr', CHART_NS))
    engine.endElement(makeEl('c', 'dLbls', CHART_NS))
    engine.endElement(makeEl('c', 'ser', CHART_NS))
    engine.startElement(
      makeEl('c', 'axId', CHART_NS, [{ name: 'val', value: '1', localName: 'val' }])
    )
    engine.endElement(makeEl('c', 'axId', CHART_NS))
    engine.startElement(
      makeEl('c', 'axId', CHART_NS, [{ name: 'val', value: '2', localName: 'val' }])
    )
    engine.endElement(makeEl('c', 'axId', CHART_NS))
    engine.endElement(makeEl('c', 'barChart', CHART_NS))
    engine.endElement(makeEl('c', 'plotArea', CHART_NS))
    engine.endElement(makeEl('c', 'chart', CHART_NS))
    engine.endElement(makeEl('c', 'chartSpace', CHART_NS))

    const result = engine.endDocument()

    const nonStandardWarnings = (result.warnings ?? []).filter(
      (w) => w.code === 'NON_STANDARD_NAMESPACE'
    )
    expect(nonStandardWarnings).toHaveLength(0)
  })
})

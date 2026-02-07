import { describe, it, expect } from 'vitest'
import { ValidationEngine } from '../validator'
import { loadSchemaRegistry } from '../schema-loader'
import type { SchemaRegistry } from '../types'
import { initCompositorState } from '../compositor'
import { resolveNamespaceUri } from '../runtime'

const CHART_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
const DML_MAIN_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const SHARED_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/sharedTypes'

function makeEl(localName: string, ns = CHART_NS, attrs: any[] = []) {
  return {
    name: localName,
    localName,
    namespaceUri: ns,
    attributes: attrs,
  }
}

describe('real chart schema validation', () => {
  it('should validate chartSpace and its child elements', () => {
    const registry = loadSchemaRegistry('spreadsheet')

    const engine = new ValidationEngine(registry, {
      maxErrors: 100,
      allowWhitespace: true,
    })

    const nsDecl = new Map([['', CHART_NS]])

    engine.startDocument()

    engine.startElement({
      ...makeEl('chartSpace'),
      namespaceDeclarations: nsDecl,
    })

    engine.startElement({
      ...makeEl('style'),
      attributes: [{ name: 'val', value: '10', localName: 'val' }],
    })
    engine.endElement(makeEl('style'))

    engine.startElement(makeEl('chart'))
    engine.startElement(makeEl('plotArea'))
    engine.endElement(makeEl('plotArea'))
    engine.endElement(makeEl('chart'))

    engine.endElement(makeEl('chartSpace'))

    const result = engine.endDocument()

    console.log('Validation result:', result.valid)
    console.log('Total errors:', result.errors.length)
    for (const err of result.errors.slice(0, 10)) {
      console.log(`  [${err.code}] ${err.message} (path: ${err.path})`)
    }

    const schemaNotFoundErrors = result.errors.filter((e) =>
      e.message.includes('스키마에서 요소를 찾을 수 없습니다'),
    )
    expect(schemaNotFoundErrors).toHaveLength(0)
  })

  it('should validate deep nesting: plotArea > areaChart > ser > tx > strRef > f', () => {
    const registry = loadSchemaRegistry('spreadsheet')

    const engine = new ValidationEngine(registry, {
      maxErrors: 200,
      allowWhitespace: true,
    })

    const nsDecl = new Map([['', CHART_NS]])

    engine.startDocument()

    engine.startElement({
      ...makeEl('chartSpace'),
      namespaceDeclarations: nsDecl,
    })

    // chartSpace > chart
    engine.startElement(makeEl('chart'))

    // chart > plotArea
    engine.startElement(makeEl('plotArea'))

    // plotArea > areaChart (inside a choice in plotArea's sequence)
    engine.startElement(makeEl('areaChart'))

    // areaChart > grouping (from EG_AreaChartShared group)
    engine.startElement(makeEl('grouping'))
    engine.endElement(makeEl('grouping'))

    // areaChart > ser (from EG_AreaChartShared group)
    engine.startElement(makeEl('ser'))

    // ser > idx (from EG_SerShared group)
    engine.startElement(makeEl('idx'))
    engine.endElement(makeEl('idx'))

    // ser > order (from EG_SerShared group)
    engine.startElement(makeEl('order'))
    engine.endElement(makeEl('order'))

    // ser > tx (from EG_SerShared group, type: CT_SerTx)
    engine.startElement(makeEl('tx'))

    // tx > strRef (inside a choice in CT_SerTx's sequence)
    engine.startElement(makeEl('strRef'))

    // strRef > f (type: string builtin)
    engine.startElement(makeEl('f'))
    engine.text('Sheet1!$A$1')
    engine.endElement(makeEl('f'))

    engine.endElement(makeEl('strRef'))
    engine.endElement(makeEl('tx'))

    engine.endElement(makeEl('ser'))

    // areaChart > axId (x2)
    engine.startElement(makeEl('axId'))
    engine.endElement(makeEl('axId'))
    engine.startElement(makeEl('axId'))
    engine.endElement(makeEl('axId'))

    engine.endElement(makeEl('areaChart'))

    // plotArea > catAx (inside second choice in plotArea's sequence)
    engine.startElement(makeEl('catAx'))
    engine.endElement(makeEl('catAx'))

    engine.endElement(makeEl('plotArea'))
    engine.endElement(makeEl('chart'))
    engine.endElement(makeEl('chartSpace'))

    const result = engine.endDocument()

    console.log('\n=== Deep nesting test ===')
    console.log('Validation result:', result.valid)
    console.log('Total errors:', result.errors.length)
    for (const err of result.errors) {
      console.log(`  [${err.code}] ${err.message} (path: ${err.path})`)
    }

    // The main assertion: no "schema not found" errors
    const schemaNotFoundErrors = result.errors.filter((e) =>
      e.message.includes('스키마에서 요소를 찾을 수 없습니다'),
    )
    expect(schemaNotFoundErrors).toHaveLength(0)
  })

  it('should correctly resolve CT_PlotArea compositor with nested choices', () => {
    const registry = loadSchemaRegistry('spreadsheet')

    // Resolve CT_PlotArea type
    const plotAreaType = registry.resolveType(CHART_NS, 'CT_PlotArea')
    expect(plotAreaType).toBeDefined()
    expect(plotAreaType?.kind).toBe('complexType')

    if (plotAreaType?.kind === 'complexType') {
      console.log('\nCT_PlotArea content kind:', plotAreaType.content.kind)
      if (plotAreaType.content.kind === 'elementOnly') {
        const comp = plotAreaType.content.compositor
        console.log('Compositor kind:', comp?.kind)
        if (comp?.kind === 'sequence') {
          console.log('Particles count:', comp.particles.length)
          for (const p of comp.particles) {
            console.log('  particle:', (p as any).kind, (p as any).name || (p as any).ref?.name || '')
          }
        }
      }

      // Try to init compositor state
      const nsContext = new Map([['', CHART_NS]])
      const state = initCompositorState(plotAreaType, registry, {
        resolveNamespaceUri: (prefix?: string) => resolveNamespaceUri(nsContext, prefix),
      })
      console.log('CompositorState kind:', state?.kind)
      console.log('Flattened particles count:', state?.flattenedParticles.length)
      if (state) {
        for (const fp of state.flattenedParticles) {
          const p = fp.particle as any
          console.log(`  [${fp.index}] ${p.kind} name=${p.name || ''} ref=${p.ref?.name || ''} min=${fp.minOccurs} max=${fp.maxOccurs}`)
          if (fp.allowedNames) {
            console.log(`       allowedNames: ${[...fp.allowedNames].join(', ')}`)
          }
        }
      }
    }
  })

  it('should correctly resolve CT_AreaChart compositor with group ref', () => {
    const registry = loadSchemaRegistry('spreadsheet')

    const areaChartType = registry.resolveType(CHART_NS, 'CT_AreaChart')
    expect(areaChartType).toBeDefined()

    if (areaChartType?.kind === 'complexType' && areaChartType.content.kind === 'elementOnly') {
      const nsContext = new Map([['', CHART_NS]])
      const state = initCompositorState(areaChartType, registry, {
        resolveNamespaceUri: (prefix?: string) => resolveNamespaceUri(nsContext, prefix),
      })
      console.log('\nCT_AreaChart flattened particles:')
      if (state) {
        for (const fp of state.flattenedParticles) {
          const p = fp.particle as any
          console.log(`  [${fp.index}] ${p.kind} name=${p.name || ''} min=${fp.minOccurs} max=${fp.maxOccurs}`)
          if (fp.allowedNames) {
            console.log(`       allowedNames: ${[...fp.allowedNames].join(', ')}`)
          }
        }
      }
    }
  })

  it('should correctly resolve CT_SerTx compositor (sequence with choice)', () => {
    const registry = loadSchemaRegistry('spreadsheet')

    const serTxType = registry.resolveType(CHART_NS, 'CT_SerTx')
    expect(serTxType).toBeDefined()

    if (serTxType?.kind === 'complexType' && serTxType.content.kind === 'elementOnly') {
      const nsContext = new Map([['', CHART_NS]])
      const state = initCompositorState(serTxType, registry, {
        resolveNamespaceUri: (prefix?: string) => resolveNamespaceUri(nsContext, prefix),
      })
      console.log('\nCT_SerTx flattened particles:')
      if (state) {
        for (const fp of state.flattenedParticles) {
          const p = fp.particle as any
          console.log(`  [${fp.index}] ${p.kind} name=${p.name || ''} min=${fp.minOccurs} max=${fp.maxOccurs}`)
          if (fp.allowedNames) {
            console.log(`       allowedNames: ${[...fp.allowedNames].join(', ')}`)
          }
        }
      }
    }
  })
})

describe('cross-namespace type resolution', () => {
  it('should resolve types from other namespaces via schema prefix (e.g., a:CT_ShapeProperties)', () => {
    const registry = loadSchemaRegistry('spreadsheet')

    // Verify that the registry can resolve schema prefixes
    const dmlMainUri = registry.resolveSchemaPrefix('a')
    expect(dmlMainUri).toBe('http://purl.oclc.org/ooxml/drawingml/main')

    const sharedUri = registry.resolveSchemaPrefix('s')
    expect(sharedUri).toBe('http://purl.oclc.org/ooxml/officeDocument/sharedTypes')

    // Verify that cross-namespace types can be resolved
    const shapePropsType = registry.resolveType(dmlMainUri!, 'CT_ShapeProperties')
    expect(shapePropsType).toBeDefined()
    expect(shapePropsType?.kind).toBe('complexType')
  })

  it('should validate chart elements that reference cross-namespace types (spPr, txPr)', () => {
    const registry = loadSchemaRegistry('spreadsheet')

    const engine = new ValidationEngine(registry, {
      maxErrors: 200,
      allowWhitespace: true,
    })

    const nsDecl = new Map([['', CHART_NS]])

    engine.startDocument()
    engine.startElement({
      ...makeEl('chartSpace'),
      namespaceDeclarations: nsDecl,
    })

    engine.startElement(makeEl('chart'))
    engine.startElement(makeEl('plotArea'))

    // areaChart is inside a choice in plotArea's sequence
    engine.startElement(makeEl('areaChart'))

    // grouping (from EG_AreaChartShared)
    engine.startElement(makeEl('grouping'))
    engine.endElement(makeEl('grouping'))

    // ser (from EG_AreaChartShared)
    engine.startElement(makeEl('ser'))

    // idx (required by EG_SerShared)
    engine.startElement(makeEl('idx'))
    engine.endElement(makeEl('idx'))

    // order (required by EG_SerShared)
    engine.startElement(makeEl('order'))
    engine.endElement(makeEl('order'))

    // spPr — this has typeRef: { namespacePrefix: "a", name: "CT_ShapeProperties" }
    // Previously this would fail because "a" prefix couldn't be resolved
    engine.startElement(makeEl('spPr'))

    // CT_ShapeProperties has a sequence with optional elements from drawingml main
    // Just open and close to verify the type was resolved (compositor initialized)
    engine.endElement(makeEl('spPr'))

    engine.endElement(makeEl('ser'))

    // axId (x2 required)
    engine.startElement(makeEl('axId'))
    engine.endElement(makeEl('axId'))
    engine.startElement(makeEl('axId'))
    engine.endElement(makeEl('axId'))

    engine.endElement(makeEl('areaChart'))
    engine.endElement(makeEl('plotArea'))
    engine.endElement(makeEl('chart'))
    engine.endElement(makeEl('chartSpace'))

    const result = engine.endDocument()

    // No "schema not found" errors - cross-namespace types should be resolved
    const schemaNotFoundErrors = result.errors.filter((e) =>
      e.message.includes('스키마에서 요소를 찾을 수 없습니다'),
    )
    expect(schemaNotFoundErrors).toHaveLength(0)

    // No "unknown type" errors - cross-namespace type refs should resolve
    const unknownTypeErrors = result.errors.filter((e) =>
      e.code === 'UNKNOWN_TYPE',
    )
    expect(unknownTypeErrors).toHaveLength(0)
  })
})

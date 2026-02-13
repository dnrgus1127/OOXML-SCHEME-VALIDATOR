import { describe, expect, it } from 'vitest'
import { parseXmlToEventArray } from '../streaming'

describe('parseXmlToEventArray namespace handling', () => {
  it('should keep nested prefix namespace for child elements', () => {
    const xml = `
      <chartSpace xmlns="http://schemas.openxmlformats.org/drawingml/2006/chart">
        <spPr>
          <a:ln xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:prstDash val="solid"/>
          </a:ln>
        </spPr>
      </chartSpace>
    `

    const events = parseXmlToEventArray(xml)
    const startElements = events.filter((event) => event.type === 'startElement')

    const ln = startElements.find(
      (event) => event.type === 'startElement' && event.element.localName === 'ln'
    )
    const prstDash = startElements.find(
      (event) => event.type === 'startElement' && event.element.localName === 'prstDash'
    )

    expect(ln && ln.type === 'startElement' ? ln.element.namespaceUri : '').toBe(
      'http://schemas.openxmlformats.org/drawingml/2006/main'
    )
    expect(prstDash && prstDash.type === 'startElement' ? prstDash.element.namespaceUri : '').toBe(
      'http://schemas.openxmlformats.org/drawingml/2006/main'
    )
  })

  it('should restore parent default namespace after nested override closes', () => {
    const xml = `
      <root xmlns="urn:root">
        <child xmlns="urn:child">
          <inner />
        </child>
        <sibling />
      </root>
    `

    const events = parseXmlToEventArray(xml)
    const startElements = events.filter((event) => event.type === 'startElement')

    const inner = startElements.find(
      (event) => event.type === 'startElement' && event.element.localName === 'inner'
    )
    const sibling = startElements.find(
      (event) => event.type === 'startElement' && event.element.localName === 'sibling'
    )

    expect(inner && inner.type === 'startElement' ? inner.element.namespaceUri : '').toBe('urn:child')
    expect(sibling && sibling.type === 'startElement' ? sibling.element.namespaceUri : '').toBe(
      'urn:root'
    )
  })
})

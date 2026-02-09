/**
 * Streaming XML Parser
 *
 * Converts XML to validation events for use with @ooxml/core
 */

import sax from 'sax'

/**
 * XML Validation Event types (matches @ooxml/core)
 */
export type XmlValidationEvent =
  | { type: 'startDocument' }
  | { type: 'startElement'; element: XmlElementInfo }
  | { type: 'text'; text: string }
  | { type: 'endElement'; element: XmlElementInfo }
  | { type: 'endDocument' }

export interface XmlElementInfo {
  name: string
  localName: string
  namespaceUri: string
  prefix: string
  attributes: XmlAttribute[]
  namespaceDeclarations: Map<string, string>
}

export interface XmlAttribute {
  name: string
  localName: string
  namespaceUri: string
  prefix: string
  value: string
}

/**
 * Parse XML and generate validation events
 */
export function* parseXmlToEvents(xml: string): Generator<XmlValidationEvent> {
  const parser = sax.parser(true, {
    xmlns: true,
    position: true,
    trim: false,
  })

  const events: XmlValidationEvent[] = []
  let currentNamespaces = new Map<string, string>()

  parser.onopentag = (node: sax.QualifiedTag) => {
    // Collect namespace declarations from this element
    const nsDeclarations = new Map<string, string>()

    for (const [key, attr] of Object.entries(node.attributes)) {
      if (key === 'xmlns' || key.startsWith('xmlns:')) {
        const prefix = key === 'xmlns' ? '' : key.slice(6)
        nsDeclarations.set(prefix, attr.value)
        currentNamespaces.set(prefix, attr.value)
      }
    }

    // Convert attributes
    const attributes: XmlAttribute[] = []
    for (const [, attr] of Object.entries(node.attributes)) {
      // Skip namespace declarations for attribute list
      if (attr.name === 'xmlns' || attr.name.startsWith('xmlns:')) {
        continue
      }

      attributes.push({
        name: attr.name,
        localName: attr.local,
        namespaceUri: attr.uri || '',
        prefix: attr.prefix || '',
        value: attr.value,
      })
    }

    events.push({
      type: 'startElement',
      element: {
        name: node.name,
        localName: node.local,
        namespaceUri: node.uri || '',
        prefix: node.prefix || '',
        attributes,
        namespaceDeclarations: nsDeclarations,
      },
    })
  }

  parser.onclosetag = (tagName: string) => {
    // Parse the tag name to get local and prefix
    const colonIndex = tagName.indexOf(':')
    const prefix = colonIndex >= 0 ? tagName.slice(0, colonIndex) : ''
    const localName = colonIndex >= 0 ? tagName.slice(colonIndex + 1) : tagName
    const namespaceUri = currentNamespaces.get(prefix) || ''

    events.push({
      type: 'endElement',
      element: {
        name: tagName,
        localName,
        namespaceUri,
        prefix,
        attributes: [],
        namespaceDeclarations: new Map(),
      },
    })
  }

  parser.ontext = (text: string) => {
    // Only emit text events for non-whitespace content
    if (text.trim()) {
      events.push({ type: 'text', text })
    }
  }

  parser.oncdata = (cdata: string) => {
    events.push({ type: 'text', text: cdata })
  }

  parser.onerror = (err: Error) => {
    throw new Error(`XML parsing error: ${err.message}`)
  }

  // Emit start document
  yield { type: 'startDocument' }

  // Parse the XML
  parser.write(xml).close()

  // Yield all collected events
  for (const event of events) {
    yield event
  }

  // Emit end document
  yield { type: 'endDocument' }
}

/**
 * Parse XML and return all events as an array
 */
export function parseXmlToEventArray(xml: string): XmlValidationEvent[] {
  return Array.from(parseXmlToEvents(xml))
}

/**
 * Async version that yields events for large documents
 */
export async function* parseXmlToEventsAsync(xml: string): AsyncGenerator<XmlValidationEvent> {
  for (const event of parseXmlToEvents(xml)) {
    yield event
  }
}

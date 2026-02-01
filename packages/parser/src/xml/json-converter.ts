/**
 * XML to JSON Converter
 *
 * Provides bidirectional conversion between XML and JSON representations.
 */

import { XMLParser, XMLBuilder } from 'fast-xml-parser'
import type { JsonElement } from '../types'

const XML_PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: false,
  trimValues: true,
  preserveOrder: true,
  commentPropName: '#comment',
  cdataPropName: '#cdata',
}

const XML_BUILDER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  format: true,
  indentBy: '  ',
  suppressEmptyNode: false,
  preserveOrder: true,
}

/**
 * Convert XML string to JSON representation
 */
export function xmlToJson(xml: string): JsonElement {
  const parser = new XMLParser(XML_PARSER_OPTIONS)
  const parsed = parser.parse(xml)

  // The parsed result is an array when preserveOrder is true
  if (Array.isArray(parsed) && parsed.length > 0) {
    return convertParsedToJsonElement(parsed[0])
  }

  return {
    name: '',
    attributes: {},
    children: [],
  }
}

/**
 * Convert JSON representation back to XML string
 */
export function jsonToXml(json: JsonElement, options?: { declaration?: boolean }): string {
  const builder = new XMLBuilder(XML_BUILDER_OPTIONS)
  const converted = convertJsonElementToParsed(json)

  let result = builder.build([converted])

  if (options?.declaration !== false) {
    result = '<?xml version="1.0" encoding="UTF-8"?>\n' + result
  }

  return result
}

/**
 * Convert fast-xml-parser output to our JsonElement format
 */
function convertParsedToJsonElement(parsed: any): JsonElement {
  // Find the element name (the key that's not a special property)
  const keys = Object.keys(parsed)
  const elementKey = keys.find((k) => !k.startsWith(':@') && !k.startsWith('#'))

  if (!elementKey) {
    return { name: '', attributes: {}, children: [] }
  }

  const element: JsonElement = {
    name: extractLocalName(elementKey),
    attributes: {},
    children: [],
  }

  // Extract namespace prefix if present
  if (elementKey.includes(':')) {
    element.prefix = elementKey.split(':')[0]
  }

  // Extract attributes from :@ property
  const attrObj = parsed[':@']
  if (attrObj) {
    for (const [key, value] of Object.entries(attrObj)) {
      if (key.startsWith('@_')) {
        const attrName = key.slice(2)
        element.attributes[attrName] = String(value)

        // Extract namespace declarations
        if (attrName.startsWith('xmlns:')) {
          const prefix = attrName.slice(6)
          if (prefix === element.prefix) {
            element.namespace = String(value)
          }
        } else if (attrName === 'xmlns') {
          if (!element.prefix) {
            element.namespace = String(value)
          }
        }
      }
    }
  }

  // Process children
  const content = parsed[elementKey]
  if (Array.isArray(content)) {
    for (const item of content) {
      if (typeof item === 'object') {
        const childKeys = Object.keys(item)
        const textKey = childKeys.find((k) => k === '#text')

        if (textKey && typeof item[textKey] === 'string') {
          element.text = (element.text || '') + item[textKey]
        } else {
          element.children.push(convertParsedToJsonElement(item))
        }
      }
    }
  }

  return element
}

/**
 * Convert our JsonElement format to fast-xml-parser input
 */
function convertJsonElementToParsed(element: JsonElement): any {
  const elementKey = element.prefix ? `${element.prefix}:${element.name}` : element.name

  const result: any = {}

  // Add attributes
  if (Object.keys(element.attributes).length > 0) {
    result[':@'] = {}
    for (const [key, value] of Object.entries(element.attributes)) {
      result[':@']['@_' + key] = value
    }
  }

  // Add children and text
  const content: any[] = []

  if (element.text) {
    content.push({ '#text': element.text })
  }

  for (const child of element.children) {
    content.push(convertJsonElementToParsed(child))
  }

  result[elementKey] = content.length > 0 ? content : ''

  return result
}

/**
 * Extract local name from qualified name
 */
function extractLocalName(qname: string): string {
  const colonIndex = qname.indexOf(':')
  return colonIndex >= 0 ? qname.slice(colonIndex + 1) : qname
}

/**
 * Pretty print XML string
 */
export function formatXml(xml: string): string {
  const json = xmlToJson(xml)
  return jsonToXml(json)
}

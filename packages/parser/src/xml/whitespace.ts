import { XMLBuilder, XMLParser } from 'fast-xml-parser'

const XML_PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: false,
  trimValues: false,
  preserveOrder: true,
  commentPropName: '#comment',
  cdataPropName: '#cdata',
  processEntities: false,
}

const XML_BUILDER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  format: false,
  preserveOrder: true,
  suppressEmptyNode: false,
  commentPropName: '#comment',
  cdataPropName: '#cdata',
  processEntities: false,
}

type PreserveOrderNode = Record<string, unknown>

function isWhitespaceOnlyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length === 0
}

function stripNodes(
  nodes: PreserveOrderNode[],
  preserveWhitespace: boolean
): PreserveOrderNode[] {
  const normalized: PreserveOrderNode[] = []

  for (const node of nodes) {
    const keys = Object.keys(node)
    const nodeKey = keys[0]

    if (!nodeKey) {
      normalized.push(node)
      continue
    }

    if (nodeKey === '#text') {
      const value = node[nodeKey]
      if (!preserveWhitespace && isWhitespaceOnlyText(value)) {
        continue
      }

      normalized.push(node)
      continue
    }

    if (nodeKey.startsWith('?') || nodeKey === '#comment' || nodeKey === '#cdata') {
      normalized.push(node)
      continue
    }

    const attributes = node[':@']
    const elementPreservesWhitespace =
      preserveWhitespace ||
      (typeof attributes === 'object' &&
        attributes !== null &&
        (attributes as Record<string, unknown>)['@_xml:space'] === 'preserve')

    const content = node[nodeKey]
    if (!Array.isArray(content)) {
      normalized.push(node)
      continue
    }

    normalized.push({
      ...node,
      [nodeKey]: stripNodes(content as PreserveOrderNode[], elementPreservesWhitespace),
    })
  }

  return normalized
}

export function stripInsignificantWhitespace(xml: string): string {
  const trimmed = xml.trimStart()
  if (!trimmed.startsWith('<')) {
    return xml
  }

  try {
    const parser = new XMLParser(XML_PARSER_OPTIONS)
    const builder = new XMLBuilder(XML_BUILDER_OPTIONS)
    const parsed = parser.parse(xml)

    if (!Array.isArray(parsed)) {
      return xml
    }

    return builder.build(stripNodes(parsed as PreserveOrderNode[], false))
  } catch {
    return xml
  }
}

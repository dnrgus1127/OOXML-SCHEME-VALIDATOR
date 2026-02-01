/**
 * get_ooxml_part tool
 *
 * Retrieves the content of a specific part from an OOXML document.
 */

import { readFileSync } from 'fs'
import { OoxmlParser, xmlToJson, formatXml } from '@ooxml/parser'
import type { JsonElement } from '@ooxml/parser'

export interface GetOoxmlPartInput {
  /** Path to the OOXML file */
  file_path?: string
  /** Base64 encoded file content */
  file_base64?: string
  /** Path of the part within the document */
  part_path: string
  /** Output format */
  format?: 'xml' | 'json' | 'raw'
  /** Pretty print output */
  pretty?: boolean
}

export interface GetOoxmlPartOutput {
  partPath: string
  contentType: string
  size: number
  format: string
  content: string | JsonElement
}

/**
 * Execute get_ooxml_part tool
 */
export async function getOoxmlPart(input: GetOoxmlPartInput): Promise<GetOoxmlPartOutput> {
  // Get file buffer
  let buffer: Buffer

  if (input.file_path) {
    try {
      buffer = readFileSync(input.file_path)
    } catch (err) {
      throw new Error(`Failed to read file: ${input.file_path}`)
    }
  } else if (input.file_base64) {
    buffer = Buffer.from(input.file_base64, 'base64')
  } else {
    throw new Error('Either file_path or file_base64 must be provided')
  }

  // Parse document
  const doc = await OoxmlParser.fromBuffer(buffer)

  // Get the part
  const part = doc.getPart(input.part_path)
  if (!part) {
    throw new Error(`Part not found: ${input.part_path}`)
  }

  const format = input.format ?? 'json'
  const pretty = input.pretty ?? true
  const isXml = part.contentType.includes('xml') ||
    part.content.toString('utf-8', 0, 10).trimStart().startsWith('<')

  let content: string | JsonElement

  if (format === 'json' && isXml) {
    const xml = part.content.toString('utf-8')
    content = xmlToJson(xml)
  } else if (format === 'xml' && isXml) {
    const xml = part.content.toString('utf-8')
    content = pretty ? formatXml(xml) : xml
  } else {
    // Raw format or binary content
    if (isXml || part.contentType.includes('text')) {
      content = part.content.toString('utf-8')
    } else {
      // Return base64 for binary content
      content = part.content.toString('base64')
    }
  }

  return {
    partPath: part.path,
    contentType: part.contentType,
    size: part.content.length,
    format,
    content,
  }
}

/**
 * Tool definition for MCP
 */
export const getOoxmlPartTool = {
  name: 'get_ooxml_part',
  description: 'Retrieves the content of a specific part from an OOXML document',
  inputSchema: {
    type: 'object' as const,
    properties: {
      file_path: {
        type: 'string',
        description: 'Path to the OOXML file',
      },
      file_base64: {
        type: 'string',
        description: 'Base64 encoded file content (alternative to file_path)',
      },
      part_path: {
        type: 'string',
        description: 'Path of the part within the document (e.g., /xl/workbook.xml)',
      },
      format: {
        type: 'string',
        enum: ['xml', 'json', 'raw'],
        description: 'Output format for the content',
        default: 'json',
      },
      pretty: {
        type: 'boolean',
        description: 'Pretty print the output',
        default: true,
      },
    },
    required: ['part_path'],
  },
}

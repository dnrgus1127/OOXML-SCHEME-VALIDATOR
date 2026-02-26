/**
 * analyze_ooxml_structure tool
 *
 * Analyzes OOXML document structure and provides part information.
 */

import { OoxmlParser } from '@ooxml/parser'
import { resolveFileBuffer } from './file-input'

export interface AnalyzeOoxmlInput {
  /** Path to the OOXML file */
  file_path?: string
  /** Base64 encoded file content */
  file_base64?: string
  /** Uploaded file reference (alternative to file_path, file_base64) */
  file_ref?: string
  /** Include content preview for each part */
  include_content_preview?: boolean
  /** Maximum preview length */
  preview_length?: number
}

export interface PartInfo {
  path: string
  contentType: string
  size: number
  isXml: boolean
  preview?: string
}

export interface RelationshipInfo {
  source: string
  relationships: {
    id: string
    type: string
    target: string
    targetMode: string
  }[]
}

export interface AnalyzeOoxmlOutput {
  documentType: string
  totalParts: number
  totalSize: number
  parts: PartInfo[]
  relationships: RelationshipInfo[]
  summary: string
}

/**
 * Execute analyze_ooxml_structure tool
 */
export async function analyzeOoxmlStructure(input: AnalyzeOoxmlInput): Promise<AnalyzeOoxmlOutput> {
  // Get file buffer
  const buffer = resolveFileBuffer(input)

  // Parse document
  const doc = await OoxmlParser.fromBuffer(buffer)

  // Collect part information
  const parts: PartInfo[] = []
  let totalSize = 0
  const previewLength = input.preview_length ?? 200

  for (const [path, part] of doc.parts) {
    const size = part.content.length
    totalSize += size

    const isXml =
      part.contentType.includes('xml') ||
      part.content.toString('utf-8', 0, 10).trimStart().startsWith('<')

    const partInfo: PartInfo = {
      path,
      contentType: part.contentType,
      size,
      isXml,
    }

    if (input.include_content_preview && isXml) {
      const content = part.content.toString('utf-8')
      partInfo.preview =
        content.length > previewLength ? content.slice(0, previewLength) + '...' : content
    }

    parts.push(partInfo)
  }

  // Sort parts by path
  parts.sort((a, b) => a.path.localeCompare(b.path))

  // Collect relationship information
  const relationships: RelationshipInfo[] = []

  // Root relationships
  const rootRels = doc.getRelationships('/')
  if (rootRels.length > 0) {
    relationships.push({
      source: '/',
      relationships: rootRels.map((r) => ({
        id: r.id,
        type: r.type.split('/').pop() || r.type,
        target: r.target,
        targetMode: r.targetMode,
      })),
    })
  }

  // Main document relationships
  const mainPart = doc.getMainPart()
  if (mainPart) {
    const mainRels = doc.getRelationships(mainPart.path)
    if (mainRels.length > 0) {
      relationships.push({
        source: mainPart.path,
        relationships: mainRels.map((r) => ({
          id: r.id,
          type: r.type.split('/').pop() || r.type,
          target: r.target,
          targetMode: r.targetMode,
        })),
      })
    }
  }

  // Generate summary
  const xmlParts = parts.filter((p) => p.isXml).length
  const binaryParts = parts.length - xmlParts

  const summary = [
    `Document Type: ${doc.documentType}`,
    `Total Parts: ${parts.length}`,
    `XML Parts: ${xmlParts}`,
    `Binary Parts: ${binaryParts}`,
    `Total Size: ${formatSize(totalSize)}`,
    '',
    'Main Parts:',
    ...parts.slice(0, 10).map((p) => `  ${p.path} (${formatSize(p.size)})`),
    parts.length > 10 ? `  ... and ${parts.length - 10} more` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return {
    documentType: doc.documentType,
    totalParts: parts.length,
    totalSize,
    parts,
    relationships,
    summary,
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Tool definition for MCP
 */
export const analyzeOoxmlStructureTool = {
  name: 'analyze_ooxml_structure',
  description:
    'Analyzes the internal structure of OOXML documents, listing all parts and their relationships',
  inputSchema: {
    type: 'object' as const,
    properties: {
      file_path: {
        type: 'string',
        description: 'Path to the OOXML file to analyze',
      },
      file_base64: {
        type: 'string',
        description: 'Base64 encoded file content (alternative to file_path)',
      },
      file_ref: {
        type: 'string',
        description: 'Uploaded file reference (alternative to file_path, file_base64)',
      },
      include_content_preview: {
        type: 'boolean',
        description: 'Include a preview of XML content for each part',
        default: false,
      },
      preview_length: {
        type: 'number',
        description: 'Maximum length of content preview',
        default: 200,
      },
    },
  },
}

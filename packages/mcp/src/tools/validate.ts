/**
 * validate_ooxml tool
 *
 * Validates OOXML documents against XSD schemas.
 */

import { OoxmlParser, parseXmlToEventArray } from '@ooxml/parser'
import type { XmlValidationEvent } from '@ooxml/parser'
import {
  loadSchemaRegistry,
  validateXmlEvents,
  type ValidationOptions,
  type ValidationWarning as CoreValidationWarning,
} from '@ooxml/core'
import { resolveFileBuffer } from './file-input'

export interface ValidateOoxmlInput {
  /** Path to the OOXML file */
  file_path?: string
  /** Base64 encoded file content (alternative to file_path) */
  file_base64?: string
  /** Uploaded file reference from complete_ooxml_upload (alternative to file_path/file_base64) */
  file_ref?: string
  /** Validation options */
  options?: {
    /** Strict validation mode */
    strict?: boolean
    /** Maximum number of errors to report */
    maxErrors?: number
    /** Specific parts to validate (glob patterns) */
    targetParts?: string[]
  }
}

export interface ValidationError {
  code: string
  message: string
  path: string
  partPath: string
  expected?: string
  actual?: string
}

export interface ValidationWarning {
  code: string
  message: string
  path: string
  partPath: string
}

export interface PartValidationResult {
  partPath: string
  contentType: string
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  elementCount: number
}

export interface ValidateOoxmlOutput {
  valid: boolean
  documentType: string
  partsValidated: number
  totalErrors: number
  totalWarnings: number
  results: PartValidationResult[]
  summary: string
}

/**
 * Execute validate_ooxml tool
 */
export async function validateOoxml(input: ValidateOoxmlInput): Promise<ValidateOoxmlOutput> {
  const buffer = resolveFileBuffer(input)

  // Parse document
  const doc = await OoxmlParser.fromBuffer(buffer)

  // Collect results
  const results: PartValidationResult[] = []
  let totalErrors = 0
  let totalWarnings = 0

  // Get XML parts to validate
  const xmlParts = doc.getXmlParts()
  const targetParts = input.options?.targetParts
  const maxErrors = input.options?.maxErrors ?? 100
  const registry = loadSchemaRegistry(doc.documentType)
  const validationOptions: ValidationOptions = {
    allowWhitespace: true,
    strict: input.options?.strict,
    maxErrors,
    includeWarnings: true,
  }

  for (const part of xmlParts) {
    // Filter by target parts if specified
    if (targetParts && targetParts.length > 0) {
      const shouldInclude = targetParts.some((pattern) => {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'))
        return regex.test(part.path)
      })
      if (!shouldInclude) continue
    }

    // Skip relationship files and content types
    if (part.path.includes('_rels/') || part.path === '/[Content_Types].xml') {
      continue
    }

    // Parse XML to events
    const xml = part.content.toString('utf-8')
    let events: XmlValidationEvent[]
    let parseError: string | null = null

    try {
      events = parseXmlToEventArray(xml)
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err)
      events = []
    }

    // Count elements
    const elementCount = events.filter((e) => e.type === 'startElement').length

    const errors: ValidationError[] = []
    let warnings: ValidationWarning[] = []

    if (parseError) {
      errors.push({
        code: 'XML_PARSE_ERROR',
        message: parseError,
        path: '/',
        partPath: part.path,
      })
    }

    // Basic structural guard: Check for obvious malformed event sequence
    let depth = 0
    for (const event of events) {
      if (event.type === 'startElement') {
        depth++
      } else if (event.type === 'endElement') {
        depth--
        if (depth < 0) {
          errors.push({
            code: 'MALFORMED_XML',
            message: 'Unexpected closing tag',
            path: event.element.name,
            partPath: part.path,
          })
        }
      }
    }

    if (depth !== 0 && !parseError) {
      errors.push({
        code: 'UNCLOSED_TAGS',
        message: `${depth} unclosed tag(s) detected`,
        path: '/',
        partPath: part.path,
      })
    }

    if (!parseError) {
      const schemaValidation = validateXmlEvents(registry, events, validationOptions)
      for (const schemaError of schemaValidation.errors) {
        errors.push({
          code: schemaError.code,
          message: schemaError.message,
          path: schemaError.path,
          partPath: part.path,
        })
      }

      if (schemaValidation.warnings) {
        warnings = schemaValidation.warnings.map((warning: CoreValidationWarning) => ({
          code: warning.code,
          message: warning.message,
          path: warning.path,
          partPath: part.path,
        }))
        totalWarnings += warnings.length
      }
    }

    totalErrors += errors.length

    // Check max errors
    if (totalErrors >= maxErrors) {
      results.push({
        partPath: part.path,
        contentType: part.contentType,
        valid: errors.length === 0,
        errors,
        warnings,
        elementCount,
      })
      break
    }

    results.push({
      partPath: part.path,
      contentType: part.contentType,
      valid: errors.length === 0,
      errors,
      warnings,
      elementCount,
    })
  }

  // Generate summary
  const validParts = results.filter((r) => r.valid).length
  const invalidParts = results.filter((r) => !r.valid).length
  const totalElements = results.reduce((sum, r) => sum + r.elementCount, 0)

  const summary = [
    `Document Type: ${doc.documentType}`,
    `Parts Validated: ${results.length}`,
    `Valid Parts: ${validParts}`,
    `Invalid Parts: ${invalidParts}`,
    `Total Elements: ${totalElements}`,
    `Total Errors: ${totalErrors}`,
    `Total Warnings: ${totalWarnings}`,
  ].join('\n')

  return {
    valid: totalErrors === 0,
    documentType: doc.documentType,
    partsValidated: results.length,
    totalErrors,
    totalWarnings,
    results,
    summary,
  }
}

/**
 * Tool definition for MCP
 */
export const validateOoxmlTool = {
  name: 'validate_ooxml',
  description:
    'Validates OOXML documents (xlsx, docx, pptx) for schema compliance and structural integrity',
  inputSchema: {
    type: 'object' as const,
    properties: {
      file_path: {
        type: 'string',
        description: 'Path to the OOXML file to validate',
      },
      file_base64: {
        type: 'string',
        description: 'Base64 encoded file content (alternative to file_path)',
      },
      file_ref: {
        type: 'string',
        description:
          'Uploaded file reference from complete_ooxml_upload (alternative to file_path/file_base64)',
      },
      options: {
        type: 'object',
        properties: {
          strict: {
            type: 'boolean',
            description: 'Enable strict validation mode',
            default: false,
          },
          maxErrors: {
            type: 'number',
            description: 'Maximum number of errors to report',
            default: 100,
          },
          targetParts: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific parts to validate (glob patterns)',
          },
        },
      },
    },
  },
}

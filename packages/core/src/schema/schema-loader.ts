/**
 * Schema Loader
 *
 * Loads and combines OOXML schemas based on document type
 */

import type {
  XsdSchema,
  SchemaRegistry,
  XsdSimpleType,
  XsdComplexType,
  XsdElement,
  XsdGroup,
  XsdAttributeGroup,
} from '../types'
import { SchemaRegistryImpl } from './registry'
import { normalizeNamespace } from '../runtime'

// Import all schemas
import { smlSchema } from '../schemas/sml'
import { wmlSchema } from '../schemas/wml'
import { pmlSchema } from '../schemas/pml'
import { dmlMainSchema } from '../schemas/dml-main'
import { dmlChartSchema } from '../schemas/dml-chart'
import { dmlChartDrawingSchema } from '../schemas/dml-chartDrawing'
import { dmlDiagramSchema } from '../schemas/dml-diagram'
import { dmlPictureSchema } from '../schemas/dml-picture'
import { dmlSpreadsheetDrawingSchema } from '../schemas/dml-spreadsheetDrawing'
import { dmlWordprocessingDrawingSchema } from '../schemas/dml-wordprocessingDrawing'
import { dmlLockedCanvasSchema } from '../schemas/dml-lockedCanvas'
import { opcCorePropertiesSchema } from '../schemas/opc-coreProperties'
import { opcContentTypesSchema } from '../schemas/opc-contentTypes'
import { opcRelationshipsSchema } from '../schemas/opc-relationships'
import { opcDigSigSchema } from '../schemas/opc-digSig'
import { dcSchema } from '../schemas/dc'
import { dctermsSchema } from '../schemas/dcterms'
import { dcmitypeSchema } from '../schemas/dcmitype'
import { xmlSchema } from '../schemas/xml'
import { sharedCommonSimpleTypesSchema } from '../schemas/shared-commonSimpleTypes'
import { sharedRelationshipReferenceSchema } from '../schemas/shared-relationshipReference'
import { sharedMathSchema } from '../schemas/shared-math'
import { sharedBibliographySchema } from '../schemas/shared-bibliography'
import { sharedDocumentPropertiesExtendedSchema } from '../schemas/shared-documentPropertiesExtended'
import { sharedDocumentPropertiesCustomSchema } from '../schemas/shared-documentPropertiesCustom'
import { sharedDocumentPropertiesVariantTypesSchema } from '../schemas/shared-documentPropertiesVariantTypes'
import { sharedAdditionalCharacteristicsSchema } from '../schemas/shared-additionalCharacteristics'
import { sharedCustomXmlDataPropertiesSchema } from '../schemas/shared-customXmlDataProperties'
import { sharedCustomXmlSchemaPropertiesSchema } from '../schemas/shared-customXmlSchemaProperties'

export type OoxmlDocumentType = 'spreadsheet' | 'document' | 'presentation' | 'unknown'

export { normalizeNamespace }

/**
 * All available schemas
 */
const ALL_SCHEMAS: XsdSchema[] = [
  // Main document schemas
  smlSchema,
  wmlSchema,
  pmlSchema,
  // DrawingML schemas
  dmlMainSchema,
  dmlChartSchema,
  dmlChartDrawingSchema,
  dmlDiagramSchema,
  dmlPictureSchema,
  dmlSpreadsheetDrawingSchema,
  dmlWordprocessingDrawingSchema,
  dmlLockedCanvasSchema,
  // OPC package schemas
  opcCorePropertiesSchema,
  opcContentTypesSchema,
  opcRelationshipsSchema,
  opcDigSigSchema,
  // Dublin Core dependencies for core properties
  dcSchema,
  dctermsSchema,
  dcmitypeSchema,
  xmlSchema,
  // Shared schemas
  sharedCommonSimpleTypesSchema,
  sharedRelationshipReferenceSchema,
  sharedMathSchema,
  sharedBibliographySchema,
  sharedDocumentPropertiesExtendedSchema,
  sharedDocumentPropertiesCustomSchema,
  sharedDocumentPropertiesVariantTypesSchema,
  sharedAdditionalCharacteristicsSchema,
  sharedCustomXmlDataPropertiesSchema,
  sharedCustomXmlSchemaPropertiesSchema,
]

/**
 * Shared schemas that are common to all document types
 */
const SHARED_SCHEMAS: XsdSchema[] = [
  opcCorePropertiesSchema,
  opcContentTypesSchema,
  opcRelationshipsSchema,
  opcDigSigSchema,
  dcSchema,
  dctermsSchema,
  dcmitypeSchema,
  xmlSchema,
  sharedCommonSimpleTypesSchema,
  sharedRelationshipReferenceSchema,
  sharedMathSchema,
  sharedBibliographySchema,
  sharedDocumentPropertiesExtendedSchema,
  sharedDocumentPropertiesCustomSchema,
  sharedDocumentPropertiesVariantTypesSchema,
  sharedAdditionalCharacteristicsSchema,
  sharedCustomXmlDataPropertiesSchema,
  sharedCustomXmlSchemaPropertiesSchema,
]

/**
 * DrawingML schemas (shared across document types)
 */
const DRAWINGML_SCHEMAS: XsdSchema[] = [
  dmlMainSchema,
  dmlChartSchema,
  dmlChartDrawingSchema,
  dmlDiagramSchema,
  dmlPictureSchema,
  dmlLockedCanvasSchema,
]

/**
 * Load schemas for a specific document type
 */
export function loadSchemaRegistry(documentType: OoxmlDocumentType): SchemaRegistry {
  const schemas = new Map<string, XsdSchema>()

  // Add shared schemas
  for (const schema of SHARED_SCHEMAS) {
    if (schema.targetNamespace) {
      schemas.set(schema.targetNamespace, schema)
    }
  }

  // Add DrawingML schemas
  for (const schema of DRAWINGML_SCHEMAS) {
    if (schema.targetNamespace) {
      schemas.set(schema.targetNamespace, schema)
    }
  }

  // Add document-type specific schemas
  switch (documentType) {
    case 'spreadsheet':
      if (smlSchema.targetNamespace) {
        schemas.set(smlSchema.targetNamespace, smlSchema)
      }
      if (dmlSpreadsheetDrawingSchema.targetNamespace) {
        schemas.set(dmlSpreadsheetDrawingSchema.targetNamespace, dmlSpreadsheetDrawingSchema)
      }
      break

    case 'document':
      if (wmlSchema.targetNamespace) {
        schemas.set(wmlSchema.targetNamespace, wmlSchema)
      }
      if (dmlWordprocessingDrawingSchema.targetNamespace) {
        schemas.set(dmlWordprocessingDrawingSchema.targetNamespace, dmlWordprocessingDrawingSchema)
      }
      break

    case 'presentation':
      if (pmlSchema.targetNamespace) {
        schemas.set(pmlSchema.targetNamespace, pmlSchema)
      }
      break

    default:
      // Load all schemas for unknown document types
      for (const schema of ALL_SCHEMAS) {
        if (schema.targetNamespace) {
          schemas.set(schema.targetNamespace, schema)
        }
      }
      break
  }

  return new SchemaRegistryImpl(schemas)
}

/**
 * Load all available schemas
 */
export function loadAllSchemas(): SchemaRegistry {
  const schemas = new Map<string, XsdSchema>()

  for (const schema of ALL_SCHEMAS) {
    if (schema.targetNamespace) {
      schemas.set(schema.targetNamespace, schema)
    }
  }

  return new SchemaRegistryImpl(schemas)
}

/**
 * Get namespace URI for a document type
 */
export function getMainNamespace(documentType: OoxmlDocumentType): string {
  switch (documentType) {
    case 'spreadsheet':
      return 'http://purl.oclc.org/ooxml/spreadsheetml/main'
    case 'document':
      return 'http://purl.oclc.org/ooxml/wordprocessingml/main'
    case 'presentation':
      return 'http://purl.oclc.org/ooxml/presentationml/main'
    default:
      return ''
  }
}

/**
 * Detect document type from namespace URI
 */
export function detectDocumentTypeFromNamespace(namespaceUri: string): OoxmlDocumentType {
  if (namespaceUri.includes('spreadsheetml')) {
    return 'spreadsheet'
  }
  if (namespaceUri.includes('wordprocessingml')) {
    return 'document'
  }
  if (namespaceUri.includes('presentationml')) {
    return 'presentation'
  }
  return 'unknown'
}

/**
 * Get schema statistics
 */
export function getSchemaStats(registry: SchemaRegistry): {
  namespaces: number
  simpleTypes: number
  complexTypes: number
  elements: number
  groups: number
  attributeGroups: number
} {
  let simpleTypes = 0
  let complexTypes = 0
  let elements = 0
  let groups = 0
  let attributeGroups = 0

  for (const schema of registry.schemas.values()) {
    simpleTypes += schema.simpleTypes.size
    complexTypes += schema.complexTypes.size
    elements += schema.elements.size
    groups += schema.groups.size
    attributeGroups += schema.attributeGroups.size
  }

  return {
    namespaces: registry.schemas.size,
    simpleTypes,
    complexTypes,
    elements,
    groups,
    attributeGroups,
  }
}

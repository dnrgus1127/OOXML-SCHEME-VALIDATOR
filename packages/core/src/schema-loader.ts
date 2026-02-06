/**
 * Schema Loader
 *
 * Loads and combines OOXML schemas based on document type
 */

import type { XsdSchema, SchemaRegistry, XsdSimpleType, XsdComplexType, XsdElement, XsdGroup, XsdAttributeGroup } from './types';
import { SchemaRegistryImpl } from './registry';

// Import all schemas
import { smlSchema } from './schemas/sml';
import { wmlSchema } from './schemas/wml';
import { pmlSchema } from './schemas/pml';
import { dmlMainSchema } from './schemas/dml-main';
import { dmlChartSchema } from './schemas/dml-chart';
import { dmlChartDrawingSchema } from './schemas/dml-chartDrawing';
import { dmlDiagramSchema } from './schemas/dml-diagram';
import { dmlPictureSchema } from './schemas/dml-picture';
import { dmlSpreadsheetDrawingSchema } from './schemas/dml-spreadsheetDrawing';
import { dmlWordprocessingDrawingSchema } from './schemas/dml-wordprocessingDrawing';
import { dmlLockedCanvasSchema } from './schemas/dml-lockedCanvas';
import { sharedCommonSimpleTypesSchema } from './schemas/shared-commonSimpleTypes';
import { sharedRelationshipReferenceSchema } from './schemas/shared-relationshipReference';
import { sharedMathSchema } from './schemas/shared-math';
import { sharedBibliographySchema } from './schemas/shared-bibliography';
import { sharedDocumentPropertiesExtendedSchema } from './schemas/shared-documentPropertiesExtended';
import { sharedDocumentPropertiesCustomSchema } from './schemas/shared-documentPropertiesCustom';
import { sharedDocumentPropertiesVariantTypesSchema } from './schemas/shared-documentPropertiesVariantTypes';
import { sharedAdditionalCharacteristicsSchema } from './schemas/shared-additionalCharacteristics';
import { sharedCustomXmlDataPropertiesSchema } from './schemas/shared-customXmlDataProperties';
import { sharedCustomXmlSchemaPropertiesSchema } from './schemas/shared-customXmlSchemaProperties';

export type OoxmlDocumentType = 'spreadsheet' | 'document' | 'presentation' | 'unknown';

/**
 * Namespace mapping: Transitional (used in most Office files) -> Strict (used in XSD schemas)
 *
 * Office files typically use Transitional namespaces (schemas.openxmlformats.org)
 * but our XSD schemas use Strict namespaces (purl.oclc.org/ooxml)
 */
const TRANSITIONAL_TO_STRICT_NS: Record<string, string> = {
  // SpreadsheetML
  'http://schemas.openxmlformats.org/spreadsheetml/2006/main': 'http://purl.oclc.org/ooxml/spreadsheetml/main',
  // WordprocessingML
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main': 'http://purl.oclc.org/ooxml/wordprocessingml/main',
  // PresentationML
  'http://schemas.openxmlformats.org/presentationml/2006/main': 'http://purl.oclc.org/ooxml/presentationml/main',
  // DrawingML
  'http://schemas.openxmlformats.org/drawingml/2006/main': 'http://purl.oclc.org/ooxml/drawingml/main',
  'http://schemas.openxmlformats.org/drawingml/2006/chart': 'http://purl.oclc.org/ooxml/drawingml/chart',
  'http://schemas.openxmlformats.org/drawingml/2006/chartDrawing': 'http://purl.oclc.org/ooxml/drawingml/chartDrawing',
  'http://schemas.openxmlformats.org/drawingml/2006/diagram': 'http://purl.oclc.org/ooxml/drawingml/diagram',
  'http://schemas.openxmlformats.org/drawingml/2006/picture': 'http://purl.oclc.org/ooxml/drawingml/picture',
  'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing': 'http://purl.oclc.org/ooxml/drawingml/spreadsheetDrawing',
  'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing': 'http://purl.oclc.org/ooxml/drawingml/wordprocessingDrawing',
  'http://schemas.openxmlformats.org/drawingml/2006/lockedCanvas': 'http://purl.oclc.org/ooxml/drawingml/lockedCanvas',
  // Office Document
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships': 'http://purl.oclc.org/ooxml/officeDocument/relationships',
  'http://schemas.openxmlformats.org/officeDocument/2006/sharedTypes': 'http://purl.oclc.org/ooxml/officeDocument/sharedTypes',
  'http://schemas.openxmlformats.org/officeDocument/2006/math': 'http://purl.oclc.org/ooxml/officeDocument/math',
  'http://schemas.openxmlformats.org/officeDocument/2006/bibliography': 'http://purl.oclc.org/ooxml/officeDocument/bibliography',
  'http://schemas.openxmlformats.org/officeDocument/2006/characteristics': 'http://purl.oclc.org/ooxml/officeDocument/characteristics',
  'http://schemas.openxmlformats.org/officeDocument/2006/custom-properties': 'http://purl.oclc.org/ooxml/officeDocument/custom-properties',
  'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties': 'http://purl.oclc.org/ooxml/officeDocument/extended-properties',
  'http://schemas.openxmlformats.org/officeDocument/2006/customXml': 'http://purl.oclc.org/ooxml/officeDocument/customXml',
  // Variant Types
  'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes': 'http://purl.oclc.org/ooxml/officeDocument/docPropsVTypes',
};

/**
 * Normalize namespace URI: Convert Transitional to Strict if applicable
 */
export function normalizeNamespace(namespaceUri: string): string {
  return TRANSITIONAL_TO_STRICT_NS[namespaceUri] || namespaceUri;
}

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
];

/**
 * Shared schemas that are common to all document types
 */
const SHARED_SCHEMAS: XsdSchema[] = [
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
];

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
];

/**
 * Load schemas for a specific document type
 */
export function loadSchemaRegistry(documentType: OoxmlDocumentType): SchemaRegistry {
  const schemas = new Map<string, XsdSchema>();

  // Add shared schemas
  for (const schema of SHARED_SCHEMAS) {
    if (schema.targetNamespace) {
      schemas.set(schema.targetNamespace, schema);
    }
  }

  // Add DrawingML schemas
  for (const schema of DRAWINGML_SCHEMAS) {
    if (schema.targetNamespace) {
      schemas.set(schema.targetNamespace, schema);
    }
  }

  // Add document-type specific schemas
  switch (documentType) {
    case 'spreadsheet':
      if (smlSchema.targetNamespace) {
        schemas.set(smlSchema.targetNamespace, smlSchema);
      }
      if (dmlSpreadsheetDrawingSchema.targetNamespace) {
        schemas.set(dmlSpreadsheetDrawingSchema.targetNamespace, dmlSpreadsheetDrawingSchema);
      }
      break;

    case 'document':
      if (wmlSchema.targetNamespace) {
        schemas.set(wmlSchema.targetNamespace, wmlSchema);
      }
      if (dmlWordprocessingDrawingSchema.targetNamespace) {
        schemas.set(dmlWordprocessingDrawingSchema.targetNamespace, dmlWordprocessingDrawingSchema);
      }
      break;

    case 'presentation':
      if (pmlSchema.targetNamespace) {
        schemas.set(pmlSchema.targetNamespace, pmlSchema);
      }
      break;

    default:
      // Load all schemas for unknown document types
      for (const schema of ALL_SCHEMAS) {
        if (schema.targetNamespace) {
          schemas.set(schema.targetNamespace, schema);
        }
      }
      break;
  }

  return new SchemaRegistryImpl(schemas);
}

/**
 * Load all available schemas
 */
export function loadAllSchemas(): SchemaRegistry {
  const schemas = new Map<string, XsdSchema>();

  for (const schema of ALL_SCHEMAS) {
    if (schema.targetNamespace) {
      schemas.set(schema.targetNamespace, schema);
    }
  }

  return new SchemaRegistryImpl(schemas);
}

/**
 * Get namespace URI for a document type
 */
export function getMainNamespace(documentType: OoxmlDocumentType): string {
  switch (documentType) {
    case 'spreadsheet':
      return 'http://purl.oclc.org/ooxml/spreadsheetml/main';
    case 'document':
      return 'http://purl.oclc.org/ooxml/wordprocessingml/main';
    case 'presentation':
      return 'http://purl.oclc.org/ooxml/presentationml/main';
    default:
      return '';
  }
}

/**
 * Detect document type from namespace URI
 */
export function detectDocumentTypeFromNamespace(namespaceUri: string): OoxmlDocumentType {
  if (namespaceUri.includes('spreadsheetml')) {
    return 'spreadsheet';
  }
  if (namespaceUri.includes('wordprocessingml')) {
    return 'document';
  }
  if (namespaceUri.includes('presentationml')) {
    return 'presentation';
  }
  return 'unknown';
}

/**
 * Get schema statistics
 */
export function getSchemaStats(registry: SchemaRegistry): {
  namespaces: number;
  simpleTypes: number;
  complexTypes: number;
  elements: number;
  groups: number;
  attributeGroups: number;
} {
  let simpleTypes = 0;
  let complexTypes = 0;
  let elements = 0;
  let groups = 0;
  let attributeGroups = 0;

  for (const schema of registry.schemas.values()) {
    simpleTypes += schema.simpleTypes.size;
    complexTypes += schema.complexTypes.size;
    elements += schema.elements.size;
    groups += schema.groups.size;
    attributeGroups += schema.attributeGroups.size;
  }

  return {
    namespaces: registry.schemas.size,
    simpleTypes,
    complexTypes,
    elements,
    groups,
    attributeGroups,
  };
}

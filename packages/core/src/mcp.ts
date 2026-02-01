import type { SchemaRegistry, ValidationOptions, ValidationResult, ValidationWarning } from './types';
import type { XmlElementInfo } from './runtime';
import { ValidationEngine } from './validator';

export type XmlValidationEvent =
  | { type: 'startDocument' }
  | { type: 'startElement'; element: XmlElementInfo }
  | { type: 'text'; text: string }
  | { type: 'endElement'; element: XmlElementInfo }
  | { type: 'endDocument' };

export interface PartValidationInput {
  part: string;
  events: XmlValidationEvent[];
}

export interface PartValidationReport extends ValidationResult {
  part: string;
  warnings: ValidationWarning[];
}

export interface ValidationReportSummary {
  totalParts: number;
  validatedParts: number;
  errorCount: number;
  warningCount: number;
}

export interface ValidationReport {
  valid: boolean;
  summary: ValidationReportSummary;
  parts: PartValidationReport[];
}

export function validateXmlEvents(
  registry: SchemaRegistry,
  events: XmlValidationEvent[],
  options?: ValidationOptions,
): ValidationResult {
  const engine = new ValidationEngine(registry, options);
  let started = false;
  let result: ValidationResult | null = null;

  for (const event of events) {
    if (!started && event.type !== 'startDocument') {
      engine.startDocument();
      started = true;
    }

    switch (event.type) {
      case 'startDocument':
        if (!started) {
          engine.startDocument();
          started = true;
        }
        break;
      case 'startElement':
        engine.startElement(event.element);
        break;
      case 'text':
        engine.text(event.text);
        break;
      case 'endElement':
        engine.endElement(event.element);
        break;
      case 'endDocument':
        result = engine.endDocument();
        started = false;
        break;
      default:
        break;
    }
  }

  if (!result) {
    if (!started) {
      engine.startDocument();
    }
    result = engine.endDocument();
  }

  return result;
}

export function validateParts(
  registry: SchemaRegistry,
  inputs: PartValidationInput[],
  options?: ValidationOptions,
): ValidationReport {
  const parts = inputs.map((input) => {
    const result = validateXmlEvents(registry, input.events, options);
    const warnings = result.warnings ?? [];
    return {
      part: input.part,
      valid: result.valid,
      errors: result.errors,
      warnings,
    };
  });

  const summary = parts.reduce<ValidationReportSummary>(
    (acc, part) => ({
      totalParts: acc.totalParts + 1,
      validatedParts: acc.validatedParts + 1,
      errorCount: acc.errorCount + part.errors.length,
      warningCount: acc.warningCount + part.warnings.length,
    }),
    {
      totalParts: 0,
      validatedParts: 0,
      errorCount: 0,
      warningCount: 0,
    },
  );

  const valid = parts.every((part) => part.valid);

  return {
    valid,
    summary,
    parts,
  };
}

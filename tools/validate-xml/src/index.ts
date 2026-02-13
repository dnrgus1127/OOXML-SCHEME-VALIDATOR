#!/usr/bin/env node

/**
 * validate-xml — Developer CLI for validating XML against OOXML schemas
 *
 * Usage:
 *   pnpm --filter validate-xml validate <xml-file> [options]
 *   tsx tools/validate-xml/src/index.ts <xml-file> [options]
 *
 * Options:
 *   --type, -t   Document type: spreadsheet | document | presentation | auto (default: auto)
 *   --locale, -l Locale: ko | en (default: ko)
 *   --max-errors Max number of errors to report (default: 50)
 *   --json       Output as JSON
 *   --no-color   Disable color output
 */

import fs from 'node:fs'
import path from 'node:path'
import { parseXmlToEvents } from '@ooxml/parser'
import {
  ValidationEngine,
  loadSchemaRegistry,
  loadAllSchemas,
  type OoxmlDocumentType,
  type ValidationResult,
} from '@ooxml/core'

// ── CLI arg parsing ─────────────────────────────────────────────

interface CliOptions {
  filePath: string
  documentType: OoxmlDocumentType | 'auto'
  locale: 'ko' | 'en'
  maxErrors: number
  json: boolean
  color: boolean
}

function parseArgs(args: string[]): CliOptions {
  const positional: string[] = []
  let documentType: OoxmlDocumentType | 'auto' = 'auto'
  let locale: 'ko' | 'en' = 'ko'
  let maxErrors = 50
  let json = false
  let color = process.stdout.isTTY !== false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--type' || arg === '-t') {
      const val = args[++i]
      if (val === 'spreadsheet' || val === 'document' || val === 'presentation' || val === 'auto') {
        documentType = val
      } else {
        console.error(`Unknown document type: ${val}`)
        process.exit(1)
      }
    } else if (arg === '--locale' || arg === '-l') {
      const val = args[++i]
      if (val === 'ko' || val === 'en') {
        locale = val
      }
    } else if (arg === '--max-errors') {
      maxErrors = Number(args[++i])
    } else if (arg === '--json') {
      json = true
    } else if (arg === '--no-color') {
      color = false
    } else if (arg === '--help' || arg === '-h') {
      printUsage()
      process.exit(0)
    } else if (!arg.startsWith('-')) {
      positional.push(arg)
    }
  }

  if (positional.length === 0) {
    printUsage()
    process.exit(1)
  }

  return {
    filePath: positional[0]!,
    documentType,
    locale,
    maxErrors,
    json,
    color,
  }
}

function printUsage() {
  console.log(`
Usage: validate-xml <xml-file> [options]

Arguments:
  xml-file              Path to the XML file to validate

Options:
  -t, --type <type>     Document type: spreadsheet | document | presentation | auto (default: auto)
  -l, --locale <locale> Locale for error messages: ko | en (default: ko)
  --max-errors <n>      Max errors to report (default: 50)
  --json                Output result as JSON
  --no-color            Disable colored output
  -h, --help            Show this help
`)
}

// ── Color helpers ───────────────────────────────────────────────

function c(color: boolean) {
  const reset = color ? '\x1b[0m' : ''
  return {
    red: (s: string) => (color ? `\x1b[31m${s}${reset}` : s),
    green: (s: string) => (color ? `\x1b[32m${s}${reset}` : s),
    yellow: (s: string) => (color ? `\x1b[33m${s}${reset}` : s),
    cyan: (s: string) => (color ? `\x1b[36m${s}${reset}` : s),
    dim: (s: string) => (color ? `\x1b[2m${s}${reset}` : s),
    bold: (s: string) => (color ? `\x1b[1m${s}${reset}` : s),
  }
}

// ── Namespace → document type detection ─────────────────────────

function detectTypeFromXml(xml: string): OoxmlDocumentType {
  if (xml.includes('spreadsheetml')) return 'spreadsheet'
  if (xml.includes('wordprocessingml')) return 'document'
  if (xml.includes('presentationml')) return 'presentation'
  // chart, drawingml 등은 모든 문서에 포함될 수 있으므로 unknown
  return 'unknown'
}

// ── Validation ──────────────────────────────────────────────────

function validate(xml: string, options: CliOptions): ValidationResult {
  const docType =
    options.documentType === 'auto' ? detectTypeFromXml(xml) : options.documentType

  const registry =
    docType === 'unknown' ? loadAllSchemas() : loadSchemaRegistry(docType)

  const engine = new ValidationEngine(registry, {
    maxErrors: options.maxErrors,
    allowWhitespace: true,
    locale: options.locale,
  })

  engine.startDocument()

  for (const event of parseXmlToEvents(xml)) {
    switch (event.type) {
      case 'startElement':
        engine.startElement(event.element)
        break
      case 'text':
        engine.text(event.text)
        break
      case 'endElement':
        engine.endElement(event.element)
        break
    }
  }

  return engine.endDocument()
}

// ── Output formatting ───────────────────────────────────────────

function printResult(result: ValidationResult, options: CliOptions) {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  const { red, green, yellow, cyan, dim, bold } = c(options.color)

  console.log()
  console.log(bold(`  OOXML Schema Validation Result`))
  console.log(dim(`  ${'─'.repeat(50)}`))
  console.log(`  File: ${cyan(path.resolve(options.filePath))}`)
  console.log()

  if (result.valid) {
    console.log(`  ${green('✓')} ${bold(green('VALID'))} — No errors found`)
  } else {
    console.log(
      `  ${red('✗')} ${bold(red('INVALID'))} — ${result.errors.length} error(s) found`,
    )
    console.log()

    for (let i = 0; i < result.errors.length; i++) {
      const err = result.errors[i]!
      const num = dim(`  ${String(i + 1).padStart(3)}.`)

      console.log(`${num} ${red(`[${err.code}]`)}`)
      console.log(`       ${err.message}`)
      console.log(`       ${dim('path:')} ${cyan(err.path)}`)
      if (err.expected) {
        console.log(`       ${dim('expected:')} ${yellow(err.expected)}`)
      }
      if (err.value !== undefined) {
        console.log(`       ${dim('value:')} ${yellow(err.value)}`)
      }
      console.log()
    }
  }

  if (result.warnings && result.warnings.length > 0) {
    console.log(dim(`  ─ Warnings ─`))
    for (const warn of result.warnings) {
      console.log(`  ${yellow('⚠')} [${warn.code}] ${warn.message}`)
      console.log(`    ${dim('path:')} ${warn.path}`)
    }
    console.log()
  }

  console.log(dim(`  ${'─'.repeat(50)}`))
  console.log()
}

// ── Main ────────────────────────────────────────────────────────

function main() {
  const options = parseArgs(process.argv.slice(2))

  const resolved = path.resolve(options.filePath)
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`)
    process.exit(1)
  }

  const xml = fs.readFileSync(resolved, 'utf-8')

  const start = performance.now()
  const result = validate(xml, options)
  const elapsed = performance.now() - start

  printResult(result, options)

  if (!options.json) {
    const { dim } = c(options.color)
    console.log(dim(`  Validated in ${elapsed.toFixed(1)}ms`))
    console.log()
  }

  process.exit(result.valid ? 0 : 1)
}

main()

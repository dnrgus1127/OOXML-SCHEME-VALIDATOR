# @ooxml/core

OOXML XSD schema validation engine.

## Features

- Event-based XML validation (SAX-style)
- Full XSD type system support (SimpleType, ComplexType, Facets)
- Compositor state management (sequence, choice, all)
- 16 validation error codes with detailed reporting
- Zero runtime dependencies

## Installation

```bash
pnpm add @ooxml/core
```

## Usage

```typescript
import { ValidationEngine, SchemaRegistryBuilderImpl } from '@ooxml/core'

// Build schema registry
const builder = new SchemaRegistryBuilderImpl()
builder.addSchema(mySchema)
const registry = builder.build()

// Create validation engine
const validator = new ValidationEngine(registry, { failFast: false })

// Validate XML events
validator.startDocument()
validator.startElement({
  name: 'worksheet',
  localName: 'worksheet',
  namespaceUri: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
  attributes: [],
})
// ... more elements
const result = validator.endDocument()

console.log(result.valid) // true or false
console.log(result.errors) // ValidationError[]
```

## API

### SchemaRegistry

Manages multiple XSD schemas by namespace URI.

### ValidationEngine

Event-based XML validation engine.

- `startDocument()` - Begin validation
- `startElement(element)` - Process element start
- `text(text)` - Process text content
- `endElement(element)` - Process element end
- `endDocument()` - Complete validation and return result

### Helper Functions

- `validateXmlEvents(registry, events, options)` - Validate an array of XML events
- `validateParts(registry, inputs, options)` - Validate multiple parts and generate report

## License

MIT

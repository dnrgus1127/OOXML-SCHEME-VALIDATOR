import { loadAllSchemas } from './schema-loader'

export interface SupportedSchemaNamespaceEntry {
  category: string
  schemaName: string
  namespaceUri: string
  specType: 'Strict' | 'Transitional' | 'Other'
}

export interface OoxmlXmlPartInput {
  partPath: string
  xml: string
}

export interface OoxmlPartSchemaReference {
  partPath: string
  namespaces: string[]
  schemaLocations: string[]
  xsdSchemaNames: string[]
  supportedSchemaNames: string[]
}

export interface OoxmlSchemaReferenceSummary {
  namespaces: string[]
  schemaLocations: string[]
  xsdSchemaNames: string[]
  supportedSchemaNames: string[]
  parts: OoxmlPartSchemaReference[]
}

function classifySpecType(namespaceUri: string): SupportedSchemaNamespaceEntry['specType'] {
  const normalizedNamespace = namespaceUri.toLowerCase()

  if (normalizedNamespace.includes('purl.oclc.org/ooxml')) {
    return 'Strict'
  }
  if (normalizedNamespace.includes('schemas.openxmlformats.org')) {
    return 'Transitional'
  }
  return 'Other'
}

function toSupportedSchemaName(namespaceUri: string): { category: string; schemaName: string } {
  const normalizedNamespace = namespaceUri.toLowerCase()

  if (normalizedNamespace.includes('wordprocessingml')) {
    return { category: '문서 본문', schemaName: 'WordprocessingML' }
  }
  if (normalizedNamespace.includes('spreadsheetml')) {
    return { category: '문서 본문', schemaName: 'SpreadsheetML' }
  }
  if (normalizedNamespace.includes('presentationml')) {
    return { category: '문서 본문', schemaName: 'PresentationML' }
  }
  if (normalizedNamespace.includes('drawingml')) {
    return { category: '도형/그래픽', schemaName: 'DrawingML' }
  }
  if (normalizedNamespace.includes('/package/')) {
    return { category: '패키지 메타데이터', schemaName: 'Open Packaging Conventions' }
  }
  if (normalizedNamespace.includes('vml')) {
    return { category: '도형/그래픽', schemaName: 'VML' }
  }
  if (normalizedNamespace.includes('purl.org/dc')) {
    return { category: '메타데이터', schemaName: 'Dublin Core' }
  }
  if (normalizedNamespace.includes('xml/1998/namespace')) {
    return { category: '메타데이터', schemaName: 'XML Namespace' }
  }

  return { category: '공통 구성요소', schemaName: 'Shared Types' }
}

export function getSupportedSchemaNamespaces(): SupportedSchemaNamespaceEntry[] {
  const namespaces = [...loadAllSchemas().schemas.keys()]

  return namespaces
    .map((namespaceUri) => {
      const { category, schemaName } = toSupportedSchemaName(namespaceUri)
      return {
        category,
        schemaName,
        namespaceUri,
        specType: classifySpecType(namespaceUri),
      }
    })
    .sort((left, right) => {
      const categoryOrder = left.category.localeCompare(right.category, 'ko')
      if (categoryOrder !== 0) return categoryOrder

      const schemaOrder = left.schemaName.localeCompare(right.schemaName, 'en')
      if (schemaOrder !== 0) return schemaOrder

      const specOrder = left.specType.localeCompare(right.specType, 'en')
      if (specOrder !== 0) return specOrder

      return left.namespaceUri.localeCompare(right.namespaceUri, 'en')
    })
}

function extractNamespaces(xml: string): string[] {
  const result = new Set<string>()
  const xmlnsRegex = /xmlns(?::[A-Za-z_][\w.-]*)?\s*=\s*['"]([^'"]+)['"]/g
  let match = xmlnsRegex.exec(xml)

  while (match) {
    result.add(match[1])
    match = xmlnsRegex.exec(xml)
  }

  return [...result]
}

function extractSchemaLocations(xml: string): string[] {
  const result = new Set<string>()

  const schemaLocationRegex = /xsi:schemaLocation\s*=\s*['"]([^'"]+)['"]/g
  let schemaLocationMatch = schemaLocationRegex.exec(xml)

  while (schemaLocationMatch) {
    const tokens = schemaLocationMatch[1].trim().split(/\s+/)
    for (let index = 1; index < tokens.length; index += 2) {
      const location = tokens[index]
      if (location) {
        result.add(location)
      }
    }

    schemaLocationMatch = schemaLocationRegex.exec(xml)
  }

  const noNamespaceRegex = /xsi:noNamespaceSchemaLocation\s*=\s*['"]([^'"]+)['"]/g
  let noNamespaceMatch = noNamespaceRegex.exec(xml)

  while (noNamespaceMatch) {
    const location = noNamespaceMatch[1].trim()
    if (location) {
      result.add(location)
    }
    noNamespaceMatch = noNamespaceRegex.exec(xml)
  }

  return [...result]
}

function toXsdSchemaName(schemaLocation: string): string | null {
  const lastSegment = schemaLocation.split(/[\\/]/).pop()?.trim() ?? ''
  if (!lastSegment) return null

  const [withoutQuery] = lastSegment.split('?')
  const [withoutHash] = withoutQuery.split('#')
  if (!withoutHash) return null

  return withoutHash.endsWith('.xsd') ? withoutHash : null
}

export function analyzeOoxmlSchemaReferences(
  parts: OoxmlXmlPartInput[]
): OoxmlSchemaReferenceSummary {
  const supportedByNamespace = new Map(
    getSupportedSchemaNamespaces().map((entry) => [entry.namespaceUri, entry.schemaName])
  )

  const namespaceSet = new Set<string>()
  const schemaLocationSet = new Set<string>()
  const xsdSchemaNameSet = new Set<string>()
  const supportedSchemaNameSet = new Set<string>()

  const partSummaries: OoxmlPartSchemaReference[] = parts.map((part) => {
    const namespaces = extractNamespaces(part.xml)
    const schemaLocations = extractSchemaLocations(part.xml)

    namespaces.forEach((namespaceUri) => {
      namespaceSet.add(namespaceUri)
      const supported = supportedByNamespace.get(namespaceUri)
      if (supported) {
        supportedSchemaNameSet.add(supported)
      }
    })

    schemaLocations.forEach((schemaLocation) => {
      schemaLocationSet.add(schemaLocation)
      const schemaName = toXsdSchemaName(schemaLocation)
      if (schemaName) {
        xsdSchemaNameSet.add(schemaName)
      }
    })

    const partXsdSchemaNames = schemaLocations
      .map((schemaLocation) => toXsdSchemaName(schemaLocation))
      .filter((schemaName): schemaName is string => !!schemaName)

    const partSupportedSchemaNames = namespaces
      .map((namespaceUri) => supportedByNamespace.get(namespaceUri))
      .filter((schemaName): schemaName is string => !!schemaName)

    return {
      partPath: part.partPath,
      namespaces,
      schemaLocations,
      xsdSchemaNames: [...new Set(partXsdSchemaNames)].sort((left, right) =>
        left.localeCompare(right, 'en')
      ),
      supportedSchemaNames: [...new Set(partSupportedSchemaNames)].sort((left, right) =>
        left.localeCompare(right, 'en')
      ),
    }
  })

  return {
    namespaces: [...namespaceSet].sort((left, right) => left.localeCompare(right, 'en')),
    schemaLocations: [...schemaLocationSet].sort((left, right) => left.localeCompare(right, 'en')),
    xsdSchemaNames: [...xsdSchemaNameSet].sort((left, right) => left.localeCompare(right, 'en')),
    supportedSchemaNames: [...supportedSchemaNameSet].sort((left, right) =>
      left.localeCompare(right, 'en')
    ),
    parts: partSummaries.sort((left, right) => left.partPath.localeCompare(right.partPath, 'en')),
  }
}

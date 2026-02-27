import { describe, expect, it } from 'vitest'
import {
  analyzeOoxmlSchemaReferences,
  getSupportedSchemaNamespaces,
} from '../schema/schema-inspector'

describe('schema-inspector', () => {
  it('로드 가능한 스키마 네임스페이스 목록을 반환한다', () => {
    const supported = getSupportedSchemaNamespaces()

    expect(supported.length).toBeGreaterThan(10)
    expect(supported.some((entry) => entry.schemaName === 'WordprocessingML')).toBe(true)
    expect(supported.some((entry) => entry.schemaName === 'Open Packaging Conventions')).toBe(true)
  })

  it('OOXML XML 파트 전체에서 네임스페이스와 스키마 참조를 추출한다', () => {
    const summary = analyzeOoxmlSchemaReferences([
      {
        partPath: 'word/document.xml',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xsi:schemaLocation="http://schemas.openxmlformats.org/wordprocessingml/2006/main wml.xsd">
  <w:body />
</w:document>`,
      },
      {
        partPath: '[Content_Types].xml',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:noNamespaceSchemaLocation="opc-contentTypes.xsd" />`,
      },
    ])

    expect(summary.namespaces).toContain(
      'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    )
    expect(summary.namespaces).toContain(
      'http://schemas.openxmlformats.org/package/2006/content-types'
    )
    expect(summary.schemaLocations).toContain('wml.xsd')
    expect(summary.schemaLocations).toContain('opc-contentTypes.xsd')
    expect(summary.xsdSchemaNames).toContain('wml.xsd')
    expect(summary.xsdSchemaNames).toContain('opc-contentTypes.xsd')
    expect(summary.supportedSchemaNames).toContain('WordprocessingML')
    expect(summary.supportedSchemaNames).toContain('Open Packaging Conventions')
    expect(summary.parts).toHaveLength(2)
  })

  it('다른 prefix로 선언된 schemaLocation도 추출한다', () => {
    const summary = analyzeOoxmlSchemaReferences([
      {
        partPath: 'custom/item1.xml',
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<root xmlns:si="http://www.w3.org/2001/XMLSchema-instance"
      si:schemaLocation="http://example.com/ns custom-schema.xsd"
      si:noNamespaceSchemaLocation="fallback.xsd" />`,
      },
    ])

    expect(summary.schemaLocations).toContain('custom-schema.xsd')
    expect(summary.schemaLocations).toContain('fallback.xsd')
    expect(summary.xsdSchemaNames).toContain('custom-schema.xsd')
    expect(summary.xsdSchemaNames).toContain('fallback.xsd')
  })
})

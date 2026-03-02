import { describe, expect, it } from 'vitest'

import { convertXsd, generateTypeScript } from './index'

describe('convertXsd direct particle handling', () => {
  it('parses direct group content in complexType as synthetic sequence', () => {
    const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:group name="EG_BlockLevelElts">
    <xsd:choice>
      <xsd:element name="p" type="xsd:string"/>
    </xsd:choice>
  </xsd:group>
  <xsd:complexType name="CT_HdrFtr">
    <xsd:group ref="EG_BlockLevelElts" minOccurs="1" maxOccurs="unbounded"/>
  </xsd:complexType>
</xsd:schema>`

    const parsed = convertXsd(xsd, 'direct-group.xsd')
    const complex = parsed.complexTypes.find((type) => type.name === 'CT_HdrFtr')

    expect(complex?.content?.type).toBe('sequence')
    expect(complex?.content?.minOccurs).toBe(1)
    expect(complex?.content?.maxOccurs).toBe(1)
    expect(complex?.content?.particles).toHaveLength(1)

    const directParticle = complex?.content?.particles[0]
    expect(directParticle?.type).toBe('group')
    expect(directParticle?.ref).toBe('EG_BlockLevelElts')
    expect(directParticle?.minOccurs).toBe(1)
    expect(directParticle?.maxOccurs).toBe('unbounded')
  })

  it('parses direct group content in complexContent extension as synthetic sequence', () => {
    const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="CT_Base"/>
  <xsd:group name="EG_PContent">
    <xsd:choice>
      <xsd:element name="r" type="xsd:string"/>
    </xsd:choice>
  </xsd:group>
  <xsd:complexType name="CT_Hyperlink">
    <xsd:complexContent>
      <xsd:extension base="CT_Base">
        <xsd:group ref="EG_PContent" minOccurs="0" maxOccurs="unbounded"/>
      </xsd:extension>
    </xsd:complexContent>
  </xsd:complexType>
</xsd:schema>`

    const parsed = convertXsd(xsd, 'complex-content-direct-group.xsd')
    const complex = parsed.complexTypes.find((type) => type.name === 'CT_Hyperlink')

    expect(complex?.complexContent?.content?.type).toBe('sequence')
    expect(complex?.complexContent?.content?.particles).toHaveLength(1)

    const directParticle = complex?.complexContent?.content?.particles[0]
    expect(directParticle?.type).toBe('group')
    expect(directParticle?.ref).toBe('EG_PContent')
    expect(directParticle?.minOccurs).toBe(0)
    expect(directParticle?.maxOccurs).toBe('unbounded')
  })

  it('generates complexContent all compositor with elements property', () => {
    const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="CT_Base"/>
  <xsd:complexType name="CT_Extended">
    <xsd:complexContent>
      <xsd:extension base="CT_Base">
        <xsd:all>
          <xsd:element name="foo" type="xsd:string"/>
        </xsd:all>
      </xsd:extension>
    </xsd:complexContent>
  </xsd:complexType>
</xsd:schema>`

    const parsed = convertXsd(xsd, 'complex-content-all.xsd')
    const output = generateTypeScript(parsed, 'complex-content-all.xsd')

    expect(output).toContain('kind: "complexContent"')
    expect(output).toContain('kind: "all", elements:')
    expect(output).not.toContain('kind: "all", particles:')
  })
})

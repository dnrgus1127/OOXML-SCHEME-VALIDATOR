import { describe, expect, it } from 'vitest'
import { stripInsignificantWhitespace } from '../whitespace'

describe('stripInsignificantWhitespace', () => {
  it('removes formatting-only whitespace nodes between elements', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <a>1</a>
  <b>
    <c>2</c>
  </b>
</root>`

    expect(stripInsignificantWhitespace(xml)).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><root><a>1</a><b><c>2</c></b></root>'
    )
  })

  it('preserves whitespace under xml:space="preserve"', () => {
    const xml =
      '<?xml version="1.0"?><root><t xml:space="preserve">  keep me  </t><a>1</a>  <b>2</b></root>'

    expect(stripInsignificantWhitespace(xml)).toBe(
      '<?xml version="1.0"?><root><t xml:space="preserve">  keep me  </t><a>1</a><b>2</b></root>'
    )
  })

  it('keeps non-XML content unchanged', () => {
    expect(stripInsignificantWhitespace('plain text')).toBe('plain text')
  })
})

function findTagEnd(xml: string, start: number): number {
  let quote: '"' | "'" | null = null

  for (let index = start; index < xml.length; index++) {
    const char = xml[index]
    if (!char) break

    if (quote) {
      if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === '>') {
      return index
    }
  }

  return -1
}

function getXmlSpaceMode(tagSource: string): 'preserve' | 'default' | null {
  const match = tagSource.match(/\bxml:space\s*=\s*(['"])(.*?)\1/)
  const value = match?.[2]

  if (value === 'preserve') return 'preserve'
  if (value === 'default') return 'default'
  return null
}

export function stripInsignificantWhitespace(xml: string): string {
  if (!xml.trimStart().startsWith('<')) {
    return xml
  }

  const result: string[] = []
  const preserveStack: boolean[] = []
  let index = 0

  while (index < xml.length) {
    const nextTagStart = xml.indexOf('<', index)
    if (nextTagStart < 0) {
      const text = xml.slice(index)
      const preserveWhitespace = preserveStack[preserveStack.length - 1] ?? false
      if (preserveWhitespace || text.trim().length > 0) {
        result.push(text)
      }
      break
    }

    if (nextTagStart > index) {
      const text = xml.slice(index, nextTagStart)
      const preserveWhitespace = preserveStack[preserveStack.length - 1] ?? false
      if (preserveWhitespace || text.trim().length > 0) {
        result.push(text)
      }
    }

    if (xml.startsWith('<!--', nextTagStart)) {
      const commentEnd = xml.indexOf('-->', nextTagStart + 4)
      if (commentEnd < 0) return xml
      result.push(xml.slice(nextTagStart, commentEnd + 3))
      index = commentEnd + 3
      continue
    }

    if (xml.startsWith('<![CDATA[', nextTagStart)) {
      const cdataEnd = xml.indexOf(']]>', nextTagStart + 9)
      if (cdataEnd < 0) return xml
      result.push(xml.slice(nextTagStart, cdataEnd + 3))
      index = cdataEnd + 3
      continue
    }

    if (xml.startsWith('<?', nextTagStart)) {
      const instructionEnd = xml.indexOf('?>', nextTagStart + 2)
      if (instructionEnd < 0) return xml
      result.push(xml.slice(nextTagStart, instructionEnd + 2))
      index = instructionEnd + 2
      continue
    }

    const tagEnd = findTagEnd(xml, nextTagStart + 1)
    if (tagEnd < 0) {
      return xml
    }

    const tagSource = xml.slice(nextTagStart, tagEnd + 1)
    result.push(tagSource)

    if (tagSource.startsWith('</')) {
      preserveStack.pop()
    } else if (!tagSource.startsWith('<!')) {
      const selfClosing = /\/>$/.test(tagSource)
      if (!selfClosing) {
        const parentPreserve = preserveStack[preserveStack.length - 1] ?? false
        const xmlSpaceMode = getXmlSpaceMode(tagSource)
        preserveStack.push(
          xmlSpaceMode === 'preserve'
            ? true
            : xmlSpaceMode === 'default'
              ? false
              : parentPreserve
        )
      }
    }

    index = tagEnd + 1
  }

  return result.join('')
}

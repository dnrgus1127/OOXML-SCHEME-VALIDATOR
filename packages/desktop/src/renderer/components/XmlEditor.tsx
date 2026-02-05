import { useRef, useEffect, useState } from 'react'

interface XmlEditorProps {
  content: string
  partPath: string
  onChange: (content: string) => void
}

interface CursorSchemaInfo {
  elementName: string
  namespaceUri: string
  typeName?: string
  typeNamespaceUri?: string
  typeKind?: string
  occurs?: { minOccurs: number; maxOccurs: number | 'unbounded' }
  nillable?: boolean
  abstract?: boolean
}

interface CursorElementInfo {
  qualifiedName: string
  localName: string
  prefix?: string
  namespaceUri?: string
}

// Simple XML syntax highlighter (placeholder 방식으로 순서 충돌 방지)
function highlightXml(xml: string): string {
  let result = xml

  // 1. 주석 (placeholder 사용)
  result = result.replace(/(&lt;!--.*?--&gt;)/gs, '\x00COMMENT\x01$1\x00/COMMENT\x01')

  // 2. 속성값 먼저 ("..." 패턴)
  result = result.replace(/(".*?")/g, '\x00VALUE\x01$1\x00/VALUE\x01')

  // 3. 속성이름= 패턴 (값은 이미 placeholder로 대체됨)
  result = result.replace(/([\w:-]+)(=)/g, '\x00ATTR\x01$1\x00/ATTR\x01$2')

  // 4. 태그 이름
  result = result.replace(/(&lt;\/?)([\w:-]+)/g, '$1\x00TAG\x01$2\x00/TAG\x01')

  // 5. Placeholder를 실제 span으로 변환
  result = result
    .replace(/\x00COMMENT\x01/g, '<span class="comment">')
    .replace(/\x00\/COMMENT\x01/g, '</span>')
    .replace(/\x00VALUE\x01/g, '<span class="value">')
    .replace(/\x00\/VALUE\x01/g, '</span>')
    .replace(/\x00ATTR\x01/g, '<span class="attr">')
    .replace(/\x00\/ATTR\x01/g, '</span>')
    .replace(/\x00TAG\x01/g, '<span class="tag">')
    .replace(/\x00\/TAG\x01/g, '</span>')

  return result
}

// Format XML with proper indentation
function formatXml(xml: string): string {
  try {
    let formatted = xml
      // Remove existing whitespace between tags
      .replace(/>\s+</g, '><')
      // Add newlines
      .replace(/></g, '>\n<')

    // Indent
    const lines = formatted.split('\n')
    let indent = 0
    const indentedLines = lines.map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return ''

      // Decrease indent for closing tags
      if (trimmed.startsWith('</')) {
        indent = Math.max(0, indent - 1)
      }

      const indentedLine = '  '.repeat(indent) + trimmed

      const isOpeningTag = trimmed.startsWith('<')
        && !trimmed.startsWith('</')
        && !trimmed.startsWith('<?')
        && !trimmed.startsWith('<!')
      const isSelfClosing = trimmed.endsWith('/>')
      const hasInlineClosing = isOpeningTag && trimmed.includes('</')

      // Increase indent for opening tags (not self-closing, not inline closing)
      if (isOpeningTag && !isSelfClosing && !hasInlineClosing) {
        indent++
      }

      return indentedLine
    })

    return indentedLines.join('\n')
  } catch {
    return xml
  }
}

function parseTagName(tagText: string): { qualifiedName: string; localName: string; prefix?: string } | null {
  const match = tagText.match(/^<\s*\/?\s*([^\s/>]+)/)
  if (!match) return null
  const qualifiedName = match[1]
  const [prefix, localName] = qualifiedName.includes(':')
    ? qualifiedName.split(':')
    : [undefined, qualifiedName]
  return { qualifiedName, localName, prefix }
}

function parseNamespaceDeclarations(tagText: string): Map<string, string> {
  const namespaceMap = new Map<string, string>()
  const attrRegex = /xmlns(?::([\w.-]+))?="([^"]*)"/g
  let match: RegExpExecArray | null

  while ((match = attrRegex.exec(tagText)) !== null) {
    const prefix = match[1] ?? ''
    namespaceMap.set(prefix, match[2])
  }

  return namespaceMap
}

function resolveNamespaceUri(map: Map<string, string>, prefix?: string): string | undefined {
  if (!prefix) {
    return map.get('')
  }
  return map.get(prefix)
}

function findCursorElementInfo(xml: string, cursor: number): CursorElementInfo | null {
  const tagRegex = /<[^>]+>/g
  const stack: Array<{ info: CursorElementInfo; namespaceMap: Map<string, string> }> = []
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(xml)) !== null) {
    const tagText = match[0]
    const start = match.index
    const end = start + tagText.length
    if (start > cursor) {
      break
    }

    if (tagText.startsWith('<?') || tagText.startsWith('<!') || tagText.startsWith('<!--')) {
      continue
    }

    const isClosing = tagText.startsWith('</')
    const isSelfClosing = tagText.endsWith('/>')
    const tagName = parseTagName(tagText)
    if (!tagName) continue

    const parentNamespaces = stack.length > 0 ? stack[stack.length - 1].namespaceMap : new Map<string, string>()
    const currentNamespaces = new Map(parentNamespaces)
    const declarations = parseNamespaceDeclarations(tagText)
    for (const [prefix, uri] of declarations.entries()) {
      currentNamespaces.set(prefix, uri)
    }

    const elementInfo: CursorElementInfo = {
      qualifiedName: tagName.qualifiedName,
      localName: tagName.localName,
      prefix: tagName.prefix,
      namespaceUri: resolveNamespaceUri(currentNamespaces, tagName.prefix),
    }

    const cursorInsideTag = cursor >= start && cursor <= end

    if (isClosing) {
      if (cursorInsideTag) {
        const current = stack[stack.length - 1]
        if (current) {
          return {
            ...current.info,
            namespaceUri: resolveNamespaceUri(current.namespaceMap, current.info.prefix),
          }
        }
        return elementInfo
      }
      stack.pop()
      continue
    }

    if (cursorInsideTag) {
      return elementInfo
    }

    if (!isSelfClosing) {
      stack.push({ info: elementInfo, namespaceMap: currentNamespaces })
    }
  }

  if (stack.length > 0) {
    const current = stack[stack.length - 1]
    return {
      ...current.info,
      namespaceUri: resolveNamespaceUri(current.namespaceMap, current.info.prefix),
    }
  }

  return null
}

export function XmlEditor({ content, partPath, onChange }: XmlEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)
  const [localContent, setLocalContent] = useState(content)
  const [showHighlighted, setShowHighlighted] = useState(true)
  const [schemaInfo, setSchemaInfo] = useState<CursorSchemaInfo | null>(null)

  useEffect(() => {
    setLocalContent(content)
    onChange(content)
    setSchemaInfo(null)
  }, [content, partPath])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setLocalContent(newContent)
    onChange(newContent)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab key inserts spaces
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newContent = localContent.slice(0, start) + '  ' + localContent.slice(end)
      setLocalContent(newContent)
      onChange(newContent)

      // Reset cursor position
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      }, 0)
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget
    if (preRef.current) {
      preRef.current.scrollTop = textarea.scrollTop
      preRef.current.scrollLeft = textarea.scrollLeft
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textarea.scrollTop
    }
  }

  const updateSchemaInfo = async () => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursor = textarea.selectionStart
    const elementInfo = findCursorElementInfo(localContent, cursor)
    if (!elementInfo) {
      setSchemaInfo(null)
      return
    }

    const result = await window.electronAPI.getSchemaInfo(
      elementInfo.localName,
      elementInfo.namespaceUri ?? null,
    )

    if (!result.success) {
      setSchemaInfo(null)
      return
    }

    setSchemaInfo(result.data ?? null)
  }

  // Format XML (재포맷팅용)
  const handleFormat = () => {
    const result = formatXml(localContent)
    setLocalContent(result)
    onChange(result)
  }

  const escapedContent = localContent
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return (
    <div className="xml-editor">
      <div className="editor-header">
        <span className="part-path">{partPath}</span>
        <div className="editor-actions">
          <button onClick={handleFormat} className="editor-btn">
            Format
          </button>
          <button onClick={() => setShowHighlighted(!showHighlighted)} className="editor-btn">
            {showHighlighted ? 'Plain' : 'Highlight'}
          </button>
        </div>
      </div>

      <div className="editor-body">
        <div className="line-numbers" ref={lineNumbersRef}>
          {localContent.split('\n').map((_, i) => (
            <div key={i} className="line-number">{i + 1}</div>
          ))}
        </div>

        <div className="editor-content">
          {showHighlighted ? (
            <pre
              ref={preRef}
              className="highlighted"
              dangerouslySetInnerHTML={{ __html: highlightXml(escapedContent) }}
            />
          ) : null}

          <textarea
            ref={textareaRef}
            value={localContent}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onKeyUp={updateSchemaInfo}
            onClick={updateSchemaInfo}
            onMouseUp={updateSchemaInfo}
            onScroll={handleScroll}
            className={showHighlighted ? 'transparent' : ''}
            spellCheck={false}
          />
        </div>
      </div>

      {schemaInfo && (
        <div className="schema-info">
          <div className="schema-info__title">Schema Info</div>
          <div className="schema-info__row">
            <span className="schema-info__label">Element</span>
            <span className="schema-info__value">{schemaInfo.elementName}</span>
          </div>
          <div className="schema-info__row">
            <span className="schema-info__label">Namespace</span>
            <span className="schema-info__value">{schemaInfo.namespaceUri}</span>
          </div>
          {schemaInfo.typeName && (
            <div className="schema-info__row">
              <span className="schema-info__label">Type</span>
              <span className="schema-info__value">
                {schemaInfo.typeName}
                {schemaInfo.typeKind ? ` (${schemaInfo.typeKind})` : ''}
              </span>
            </div>
          )}
          {schemaInfo.occurs && (
            <div className="schema-info__row">
              <span className="schema-info__label">Occurs</span>
              <span className="schema-info__value">
                {schemaInfo.occurs.minOccurs}..{schemaInfo.occurs.maxOccurs}
              </span>
            </div>
          )}
          {(schemaInfo.nillable || schemaInfo.abstract) && (
            <div className="schema-info__row">
              <span className="schema-info__label">Flags</span>
              <span className="schema-info__value">
                {schemaInfo.nillable ? 'nillable' : ''}
                {schemaInfo.nillable && schemaInfo.abstract ? ', ' : ''}
                {schemaInfo.abstract ? 'abstract' : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

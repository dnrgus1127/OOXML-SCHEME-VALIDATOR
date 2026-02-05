import { useRef, useEffect, useState } from 'react'

interface XmlEditorProps {
  content: string
  partPath: string
  onChange: (content: string) => void
  autoFormatOnLoad: boolean
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

      // Increase indent for opening tags (not self-closing)
      if (trimmed.startsWith('<') && !trimmed.startsWith('</') &&
          !trimmed.startsWith('<?') && !trimmed.endsWith('/>')) {
        indent++
      }

      return indentedLine
    })

    return indentedLines.join('\n')
  } catch {
    return xml
  }
}

export function XmlEditor({ content, partPath, onChange, autoFormatOnLoad }: XmlEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)
  const [localContent, setLocalContent] = useState(content)
  const [showHighlighted, setShowHighlighted] = useState(true)

  useEffect(() => {
    if (autoFormatOnLoad) {
      const formatted = formatXml(content)
      setLocalContent(formatted)
      if (formatted !== content) {
        onChange(formatted)
      }
    } else {
      setLocalContent(content)
    }
  }, [content, partPath, autoFormatOnLoad, onChange])

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
            onScroll={handleScroll}
            className={showHighlighted ? 'transparent' : ''}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  )
}

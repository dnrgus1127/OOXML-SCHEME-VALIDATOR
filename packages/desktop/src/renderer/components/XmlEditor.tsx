import { useMemo, useRef, useEffect, useState } from 'react'
import { EditorToolbox } from './EditorToolbox'

interface XmlEditorProps {
  content: string
  partPath: string
  onChange: (content: string) => void
}

interface FoldRange {
  start: number
  end: number
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

function extractTagName(line: string): string | null {
  const tagMatch = line.trim().match(/^<\/?([\w:-]+)/)
  return tagMatch?.[1] ?? null
}

function getFoldRanges(content: string): FoldRange[] {
  const lines = content.split('\n')
  const stack: { lineIndex: number; tagName: string }[] = []
  const ranges: FoldRange[] = []

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('<') || trimmed.startsWith('<!--') || trimmed.startsWith('<?')) {
      return
    }

    if (trimmed.startsWith('</')) {
      const tagName = extractTagName(trimmed)
      if (!tagName) return

      for (let i = stack.length - 1; i >= 0; i--) {
        const candidate = stack[i]
        if (candidate?.tagName === tagName) {
          const opening = stack.splice(i, 1)[0]
          if (!opening) {
            break
          }
          if (index > opening.lineIndex + 1) {
            ranges.push({ start: opening.lineIndex, end: index })
          }
          break
        }
      }
      return
    }

    if (trimmed.endsWith('/>')) {
      return
    }

    const tagName = extractTagName(trimmed)
    if (!tagName) return
    stack.push({ lineIndex: index, tagName })
  })

  return ranges.sort((a, b) => a.start - b.start)
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
      if (
        trimmed.startsWith('<') &&
        !trimmed.startsWith('</') &&
        !trimmed.startsWith('<?') &&
        !trimmed.endsWith('/>')
      ) {
        indent++
      }

      return indentedLine
    })

    return indentedLines.join('\n')
  } catch {
    return xml
  }
}

export function XmlEditor({ content, partPath, onChange }: XmlEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)
  const [localContent, setLocalContent] = useState(content)
  const [showHighlighted, setShowHighlighted] = useState(true)
  const [collapsedLines, setCollapsedLines] = useState<Record<number, boolean>>({})

  useEffect(() => {
    // Part 변경 시 자동 포맷팅 적용
    const formatted = formatXml(content)
    setLocalContent(formatted)
    onChange(formatted)
    setCollapsedLines({})
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
    if (viewerRef.current) {
      viewerRef.current.scrollTop = textarea.scrollTop
      viewerRef.current.scrollLeft = textarea.scrollLeft
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
    setCollapsedLines({})
  }

  const foldRanges = useMemo(() => getFoldRanges(localContent), [localContent])
  const foldRangeMap = useMemo(() => {
    return foldRanges.reduce(
      (acc, range) => {
        acc[range.start] = range
        return acc
      },
      {} as Record<number, FoldRange>
    )
  }, [foldRanges])

  const hiddenLines = useMemo(() => {
    const hidden = new Set<number>()
    foldRanges.forEach((range) => {
      if (!collapsedLines[range.start]) return
      for (let i = range.start + 1; i <= range.end; i++) {
        hidden.add(i)
      }
    })
    return hidden
  }, [collapsedLines, foldRanges])

  const handleToggleLine = (lineIndex: number) => {
    if (!foldRangeMap[lineIndex]) return

    setCollapsedLines((prev) => ({
      ...prev,
      [lineIndex]: !prev[lineIndex],
    }))
  }

  const handleCollapseAll = () => {
    setCollapsedLines(
      foldRanges.reduce(
        (acc, range) => {
          acc[range.start] = true
          return acc
        },
        {} as Record<number, boolean>
      )
    )
  }

  const handleExpandAll = () => {
    setCollapsedLines({})
  }

  const escapedLines = localContent
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .split('\n')

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

      <div className="editor-body with-toolbox">
        <div className="line-numbers" ref={lineNumbersRef}>
          {localContent.split('\n').map((_, i) => (
            <div key={i} className="line-number">
              {i + 1}
            </div>
          ))}
        </div>

        <div className="editor-content">
          <EditorToolbox
            className="editor-toolbox-overlay"
            title="XML 뷰어 도구"
            actions={[
              { label: '전체 접기', onClick: handleCollapseAll, disabled: foldRanges.length === 0 },
              { label: '전체 펼치기', onClick: handleExpandAll, disabled: foldRanges.length === 0 },
            ]}
          />

          {showHighlighted ? (
            <div className="highlighted highlighted-xml-viewer" ref={viewerRef}>
              {escapedLines.map((line, index) => {
                if (hiddenLines.has(index)) {
                  return null
                }

                const foldRange = foldRangeMap[index]
                const isCollapsed = collapsedLines[index]
                const contentToShow = isCollapsed
                  ? `${line} ... (${foldRange ? foldRange.end - foldRange.start : 0} lines)`
                  : line

                return (
                  <div key={index} className="highlighted-line">
                    <button
                      className="fold-toggle"
                      onClick={() => handleToggleLine(index)}
                      disabled={!foldRange}
                    >
                      {foldRange ? (isCollapsed ? '▶' : '▼') : '·'}
                    </button>
                    <span dangerouslySetInnerHTML={{ __html: highlightXml(contentToShow) }} />
                  </div>
                )
              })}
            </div>
          ) : null}

          <textarea
            ref={textareaRef}
            value={localContent}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            className={showHighlighted ? 'transparent' : ''}
            spellCheck={false}
            readOnly={showHighlighted}
          />
        </div>
      </div>
    </div>
  )
}

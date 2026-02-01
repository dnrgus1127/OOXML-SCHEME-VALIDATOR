import { useRef, useEffect, useState } from 'react'

interface XmlEditorProps {
  content: string
  partPath: string
  onChange: (content: string) => void
}

// Simple XML syntax highlighter
function highlightXml(xml: string): string {
  return xml
    // Tags
    .replace(/(&lt;\/?)([\w:-]+)/g, '$1<span class="tag">$2</span>')
    // Attributes
    .replace(/([\w:-]+)(=)/g, '<span class="attr">$1</span>$2')
    // Attribute values
    .replace(/(".*?")/g, '<span class="value">$1</span>')
    // Comments
    .replace(/(&lt;!--.*?--&gt;)/gs, '<span class="comment">$1</span>')
}

export function XmlEditor({ content, partPath, onChange }: XmlEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [localContent, setLocalContent] = useState(content)
  const [showHighlighted, setShowHighlighted] = useState(true)

  useEffect(() => {
    setLocalContent(content)
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

  // Format XML
  const handleFormat = () => {
    try {
      // Simple XML formatting
      let formatted = localContent
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
        if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.startsWith('<?') && !trimmed.endsWith('/>')) {
          indent++
        }

        return indentedLine
      })

      const result = indentedLines.join('\n')
      setLocalContent(result)
      onChange(result)
    } catch (err) {
      console.error('Format error:', err)
    }
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
        <div className="line-numbers">
          {localContent.split('\n').map((_, i) => (
            <div key={i} className="line-number">{i + 1}</div>
          ))}
        </div>

        <div className="editor-content">
          {showHighlighted ? (
            <pre
              className="highlighted"
              dangerouslySetInnerHTML={{ __html: highlightXml(escapedContent) }}
            />
          ) : null}

          <textarea
            ref={textareaRef}
            value={localContent}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className={showHighlighted ? 'transparent' : ''}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'

interface XmlEditorProps {
  content: string
  partPath: string
  onChange: (content: string) => void
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
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<any>(null)

  const [localContent, setLocalContent] = useState(content)
  const [isMonacoReady, setIsMonacoReady] = useState(false)
  const [monacoLoadError, setMonacoLoadError] = useState(false)

  useEffect(() => {
    let disposed = false

    async function initMonaco() {
      if (!editorContainerRef.current || editorRef.current) return

      try {
        const monaco = await import('monaco-editor')
        if (disposed || !editorContainerRef.current) return

        editorRef.current = monaco.editor.create(editorContainerRef.current, {
          value: localContent,
          language: 'xml',
          theme: 'vs-dark',
          automaticLayout: true,
          minimap: { enabled: false },
          // Monaco 기본 gutter/folding 사용 (라인 번호/접기 영역 자동 동기화)
          folding: true,
          showFoldingControls: 'mouseover',
          scrollBeyondLastLine: false,
          fontSize: 12,
          lineHeight: 18,
          tabSize: 2,
          insertSpaces: true,
        })

        editorRef.current.onDidChangeModelContent(() => {
          const value = editorRef.current?.getValue() ?? ''
          setLocalContent(value)
          onChange(value)
        })

        setIsMonacoReady(true)
      } catch {
        setMonacoLoadError(true)
      }
    }

    initMonaco()

    return () => {
      disposed = true
      editorRef.current?.dispose()
      editorRef.current = null
    }
  }, [])

  useEffect(() => {
    const formatted = formatXml(content)
    setLocalContent(formatted)
    onChange(formatted)

    if (editorRef.current && editorRef.current.getValue() !== formatted) {
      editorRef.current.setValue(formatted)
      editorRef.current.trigger('xml-editor', 'editor.unfoldAll', null)
    }
  }, [content, partPath])

  const handleFormat = () => {
    const result = formatXml(editorRef.current?.getValue() ?? localContent)
    setLocalContent(result)
    onChange(result)
    if (editorRef.current && editorRef.current.getValue() !== result) {
      editorRef.current.setValue(result)
    }
  }

  const handleCollapseAll = () => {
    editorRef.current?.trigger('xml-editor', 'editor.foldAll', null)
  }

  const handleExpandAll = () => {
    editorRef.current?.trigger('xml-editor', 'editor.unfoldAll', null)
  }

  return (
    <div className="xml-editor">
      <div className="editor-header">
        <span className="part-path">{partPath}</span>
        <div className="editor-actions">
          <button onClick={handleCollapseAll} className="editor-btn" disabled={!isMonacoReady}>
            전체 접기
          </button>
          <button onClick={handleExpandAll} className="editor-btn" disabled={!isMonacoReady}>
            전체 펼치기
          </button>
          <button
            onClick={handleFormat}
            className="editor-btn"
            disabled={!isMonacoReady && !monacoLoadError}
          >
            Format
          </button>
        </div>
      </div>

      <div className="editor-body monaco-mode">
        <div className="editor-content">
          <div ref={editorContainerRef} className="monaco-editor-host" />

          {monacoLoadError ? (
            <div className="editor-fallback-message">
              Monaco Editor를 로드하지 못했습니다. 의존성 설치 상태를 확인해주세요.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

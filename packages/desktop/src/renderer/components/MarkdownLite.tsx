import { Fragment, type ReactNode } from 'react'

interface MarkdownLiteProps {
  source: string
  className?: string
}

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; body: string }

export function MarkdownLite({ source, className }: MarkdownLiteProps) {
  const blocks = parseBlocks(source)
  return (
    <div className={`md-lite${className ? ` ${className}` : ''}`}>
      {blocks.map((block, idx) => renderBlock(block, idx))}
    </div>
  )
}

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''

    if (line.trim() === '') {
      i++
      continue
    }

    if (line.startsWith('```')) {
      const body: string[] = []
      i++
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) {
        body.push(lines[i] ?? '')
        i++
      }
      if (i < lines.length) i++
      blocks.push({ type: 'code', body: body.join('\n') })
      continue
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: (headingMatch[1] ?? '#').length,
        text: headingMatch[2] ?? '',
      })
      i++
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\s*[-*]\s+/, ''))
        i++
      }
      blocks.push({ type: 'list', items })
      continue
    }

    const paraLines: string[] = []
    while (i < lines.length) {
      const cur = lines[i]
      if (cur === undefined) break
      if (cur.trim() === '') break
      if (/^(#{1,6})\s/.test(cur)) break
      if (/^\s*[-*]\s+/.test(cur)) break
      if (cur.startsWith('```')) break
      paraLines.push(cur)
      i++
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paraLines.join(' ') })
    }
  }

  return blocks
}

const INLINE_RE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let lastIdx = 0
  let key = 0
  let match: RegExpExecArray | null

  INLINE_RE.lastIndex = 0
  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > lastIdx) {
      out.push(<Fragment key={key++}>{text.slice(lastIdx, match.index)}</Fragment>)
    }
    const tok = match[0]
    if (tok.startsWith('`')) {
      out.push(<code key={key++}>{tok.slice(1, -1)}</code>)
    } else if (tok.startsWith('**')) {
      out.push(<strong key={key++}>{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)
      if (linkMatch) {
        out.push(
          <a key={key++} href={linkMatch[2]} target="_blank" rel="noreferrer">
            {linkMatch[1]}
          </a>
        )
      } else {
        out.push(<Fragment key={key++}>{tok}</Fragment>)
      }
    } else {
      out.push(<em key={key++}>{tok.slice(1, -1)}</em>)
    }
    lastIdx = match.index + tok.length
  }
  if (lastIdx < text.length) {
    out.push(<Fragment key={key++}>{text.slice(lastIdx)}</Fragment>)
  }
  return out
}

function renderBlock(block: Block, idx: number): ReactNode {
  if (block.type === 'heading') {
    const level = Math.min(6, Math.max(1, block.level)) as 1 | 2 | 3 | 4 | 5 | 6
    const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
    return <Tag key={idx}>{renderInline(block.text)}</Tag>
  }
  if (block.type === 'list') {
    return (
      <ul key={idx}>
        {block.items.map((item, j) => (
          <li key={j}>{renderInline(item)}</li>
        ))}
      </ul>
    )
  }
  if (block.type === 'code') {
    return (
      <pre key={idx}>
        <code>{block.body}</code>
      </pre>
    )
  }
  return <p key={idx}>{renderInline(block.text)}</p>
}

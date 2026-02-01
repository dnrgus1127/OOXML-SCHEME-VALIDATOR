import { useState, useMemo } from 'react'

interface PartInfo {
  contentType: string
  size: number
}

interface DocumentTreeProps {
  documentType: string
  parts: Record<string, PartInfo>
  selectedPart: string | null
  onSelectPart: (partPath: string) => void
}

interface TreeNode {
  name: string
  path: string
  isDirectory: boolean
  children: TreeNode[]
  part?: PartInfo
}

function buildTree(parts: Record<string, PartInfo>): TreeNode[] {
  const root: TreeNode = { name: '', path: '', isDirectory: true, children: [] }

  for (const [path, part] of Object.entries(parts)) {
    const segments = path.split('/').filter(Boolean)
    let current = root

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      const isLast = i === segments.length - 1
      const currentPath = '/' + segments.slice(0, i + 1).join('/')

      let child = current.children.find((c) => c.name === segment)

      if (!child) {
        child = {
          name: segment,
          path: currentPath,
          isDirectory: !isLast,
          children: [],
          part: isLast ? part : undefined,
        }
        current.children.push(child)
      }

      current = child
    }
  }

  // Sort: directories first, then alphabetically
  function sortChildren(node: TreeNode) {
    node.children.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
    node.children.forEach(sortChildren)
  }

  sortChildren(root)
  return root.children
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function getIcon(node: TreeNode): string {
  if (node.isDirectory) {
    if (node.name === '_rels') return '🔗'
    if (node.name.includes('xl')) return '📊'
    if (node.name.includes('word')) return '📝'
    if (node.name.includes('ppt')) return '📽️'
    return '📁'
  }

  const ext = node.name.split('.').pop()?.toLowerCase()
  if (ext === 'xml') return '📄'
  if (ext === 'rels') return '🔗'
  if (['png', 'jpg', 'jpeg', 'gif'].includes(ext || '')) return '🖼️'
  return '📄'
}

interface TreeNodeComponentProps {
  node: TreeNode
  selectedPart: string | null
  onSelectPart: (path: string) => void
  depth: number
}

function TreeNodeComponent({ node, selectedPart, onSelectPart, depth }: TreeNodeComponentProps) {
  const [expanded, setExpanded] = useState(depth < 2)

  const handleClick = () => {
    if (node.isDirectory) {
      setExpanded(!expanded)
    } else {
      onSelectPart(node.path)
    }
  }

  const isSelected = node.path === selectedPart
  const isXml = node.part?.contentType.includes('xml')

  return (
    <div className="tree-node">
      <div
        className={`tree-item ${isSelected ? 'selected' : ''} ${!node.isDirectory && !isXml ? 'disabled' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {node.isDirectory && (
          <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
        )}
        <span className="icon">{getIcon(node)}</span>
        <span className="name">{node.name}</span>
        {node.part && <span className="size">{formatSize(node.part.size)}</span>}
      </div>

      {node.isDirectory && expanded && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNodeComponent
              key={child.path}
              node={child}
              selectedPart={selectedPart}
              onSelectPart={onSelectPart}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function DocumentTree({ documentType, parts, selectedPart, onSelectPart }: DocumentTreeProps) {
  const tree = useMemo(() => buildTree(parts), [parts])
  const partCount = Object.keys(parts).length

  return (
    <div className="document-tree">
      <div className="tree-header">
        <span className="doc-type">
          {documentType === 'spreadsheet' && '📊 Excel'}
          {documentType === 'document' && '📝 Word'}
          {documentType === 'presentation' && '📽️ PowerPoint'}
          {documentType === 'unknown' && '📄 Unknown'}
        </span>
        <span className="part-count">{partCount} parts</span>
      </div>

      <div className="tree-content">
        {tree.map((node) => (
          <TreeNodeComponent
            key={node.path}
            node={node}
            selectedPart={selectedPart}
            onSelectPart={onSelectPart}
            depth={0}
          />
        ))}
      </div>
    </div>
  )
}

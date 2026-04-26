import { useMemo, useState } from 'react'

interface PartInfo {
  contentType: string
  size: number
}

interface DocumentTreeProps {
  containerFormat?: 'ooxml' | 'odf'
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
      if (!segment) continue

      const isLast = i === segments.length - 1
      const currentPath = '/' + segments.slice(0, i + 1).join('/')

      let child = current.children.find((candidate) => candidate.name === segment)
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

  function sortChildren(node: TreeNode) {
    node.children.sort((left, right) => {
      if (left.isDirectory !== right.isDirectory) {
        return left.isDirectory ? -1 : 1
      }
      return left.name.localeCompare(right.name)
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

function getDocumentLabel(containerFormat: 'ooxml' | 'odf' | undefined, documentType: string): string {
  const prefix = containerFormat === 'odf' ? 'ODF' : 'OOXML'

  switch (documentType) {
    case 'spreadsheet':
      return `${prefix} Spreadsheet`
    case 'document':
      return `${prefix} Text`
    case 'presentation':
      return `${prefix} Presentation`
    case 'odf-text':
      return 'ODF Text'
    case 'odf-spreadsheet':
      return 'ODF Spreadsheet'
    case 'odf-presentation':
      return 'ODF Presentation'
    case 'odf-graphics':
      return 'ODF Graphics'
    case 'odf-package':
      return 'ODF Package'
    default:
      return `${prefix} Package`
  }
}

interface TreeNodeComponentProps {
  node: TreeNode
  selectedPart: string | null
  onSelectPart: (path: string) => void
  depth: number
}

function TreeNodeComponent({ node, selectedPart, onSelectPart, depth }: TreeNodeComponentProps) {
  const [expanded, setExpanded] = useState(depth < 2)
  const isSelected = node.path === selectedPart
  const isXml = node.part?.contentType.includes('xml')

  const handleClick = () => {
    if (node.isDirectory) {
      setExpanded((current) => !current)
      return
    }

    onSelectPart(node.path)
  }

  return (
    <div className="tree-node">
      <div
        className={`tree-item ${isSelected ? 'selected' : ''} ${
          !node.isDirectory && !isXml ? 'disabled' : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {node.isDirectory && <span className="expand-icon">{expanded ? '▼' : '▶'}</span>}
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

export function DocumentTree({
  containerFormat,
  documentType,
  parts,
  selectedPart,
  onSelectPart,
}: DocumentTreeProps) {
  const tree = useMemo(() => buildTree(parts), [parts])
  const partCount = Object.keys(parts).length

  return (
    <div className="document-tree">
      <div className="tree-header">
        <span className="doc-type">{getDocumentLabel(containerFormat, documentType)}</span>
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

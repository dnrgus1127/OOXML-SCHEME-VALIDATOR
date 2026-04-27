import { useMemo, useState } from 'react'
import type { PartDiffStatus } from '../stores/document'

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
  // Compare 모드 전용
  comparisonParts?: Record<string, PartInfo>
  partDiffStatus?: Record<string, PartDiffStatus>
}

interface TreeNode {
  name: string
  path: string
  isDirectory: boolean
  children: TreeNode[]
  part?: PartInfo
  // 디렉토리에서도 자식들의 상태가 모두 동일할 때만 표시되도록 집계
  diffStatus?: PartDiffStatus
}

function buildTree(
  parts: Record<string, PartInfo>,
  comparisonParts: Record<string, PartInfo> | undefined,
  partDiffStatus: Record<string, PartDiffStatus> | undefined
): TreeNode[] {
  const root: TreeNode = { name: '', path: '', isDirectory: true, children: [] }

  // 양쪽 part 합집합으로 트리 구성 (없는 쪽은 더미 PartInfo 사용)
  const allPaths = new Set<string>(Object.keys(parts))
  if (comparisonParts) Object.keys(comparisonParts).forEach((path) => allPaths.add(path))

  for (const path of allPaths) {
    const partInfo = parts[path] ?? comparisonParts?.[path]
    if (!partInfo) continue

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
          part: isLast ? partInfo : undefined,
          diffStatus: isLast ? partDiffStatus?.[path] : undefined,
        }
        current.children.push(child)
      }

      current = child
    }
  }

  function aggregateDiffStatus(node: TreeNode): PartDiffStatus | undefined {
    if (!node.isDirectory) return node.diffStatus
    const childStatuses = node.children.map(aggregateDiffStatus)
    if (childStatuses.some((status) => status === 'modified')) return 'modified'
    if (childStatuses.some((status) => status === 'pending')) return 'pending'
    if (childStatuses.every((status) => status === 'identical')) return 'identical'
    if (childStatuses.every((status) => status === 'only-primary')) return 'only-primary'
    if (childStatuses.every((status) => status === 'only-comparison')) return 'only-comparison'
    return undefined
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
  if (partDiffStatus) {
    root.children.forEach((child) => {
      child.diffStatus = aggregateDiffStatus(child)
    })
  }
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

function getDiffMarker(status: PartDiffStatus | undefined): string {
  switch (status) {
    case 'only-primary':
      return '◀'
    case 'only-comparison':
      return '▶'
    case 'modified':
      return '●'
    case 'pending':
      return '…'
    default:
      return ''
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

  const marker = getDiffMarker(node.diffStatus)

  return (
    <div className="tree-node">
      <div
        className={`tree-item ${isSelected ? 'selected' : ''} ${
          !node.isDirectory && !isXml ? 'disabled' : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        data-diff-status={node.diffStatus ?? undefined}
        onClick={handleClick}
      >
        {node.isDirectory && <span className="expand-icon">{expanded ? '▼' : '▶'}</span>}
        <span className="icon">{getIcon(node)}</span>
        <span className="name">{node.name}</span>
        {marker && <span className="diff-marker">{marker}</span>}
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
  comparisonParts,
  partDiffStatus,
}: DocumentTreeProps) {
  const tree = useMemo(
    () => buildTree(parts, comparisonParts, partDiffStatus),
    [parts, comparisonParts, partDiffStatus]
  )

  const partCount = comparisonParts
    ? new Set([...Object.keys(parts), ...Object.keys(comparisonParts)]).size
    : Object.keys(parts).length

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

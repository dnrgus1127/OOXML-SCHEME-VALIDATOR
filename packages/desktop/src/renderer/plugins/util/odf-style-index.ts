import type { PluginContext } from '../types'

export interface StyleDefinition {
  name: string
  xml: string
  sourcePart: string
}

export type StyleIndex = Map<string, StyleDefinition>

interface CacheEntry {
  signature: string
  index: StyleIndex
}

const cache = new Map<string, CacheEntry>()

const STYLE_NAME_ATTR = /style:name\s*=\s*"([^"]+)"/

export function getCandidateStyleParts(ctx: PluginContext): string[] {
  const candidates = new Set<string>()
  candidates.add(ctx.partPath)

  const dir = ctx.partPath.includes('/')
    ? ctx.partPath.slice(0, ctx.partPath.lastIndexOf('/'))
    : ''
  if (dir) {
    candidates.add(`${dir}/styles.xml`)
    candidates.add(`${dir}/content.xml`)
  }
  candidates.add('styles.xml')
  candidates.add('content.xml')

  return [...candidates].filter((path) => path in ctx.parts)
}

export async function buildOdfStyleIndex(
  ctx: PluginContext,
  candidates: string[]
): Promise<StyleIndex> {
  const signature = `${ctx.filePath}|${candidates
    .map((path) => `${path}:${ctx.parts[path]?.size ?? 0}`)
    .join('|')}`
  const cacheKey = `${ctx.filePath}|${ctx.partPath}`

  const cached = cache.get(cacheKey)
  if (cached && cached.signature === signature) {
    return cached.index
  }

  const index: StyleIndex = new Map()
  const contents = await Promise.all(candidates.map((path) => ctx.getPart(path)))

  candidates.forEach((path, i) => {
    const xml = contents[i]
    if (!xml) return
    extractStyleElements(xml, path, index)
  })

  cache.set(cacheKey, { signature, index })
  return index
}

export function extractStyleElements(xml: string, sourcePart: string, index: StyleIndex): void {
  const openTagRe = /<style:style\b[^>]*?(\/?)>/g
  let match: RegExpExecArray | null

  while ((match = openTagRe.exec(xml)) !== null) {
    const opening = match[0]
    const isSelfClosing = match[1] === '/'
    const nameMatch = STYLE_NAME_ATTR.exec(opening)
    if (!nameMatch) continue
    const name = nameMatch[1]
    if (!name) continue

    if (isSelfClosing) {
      if (!index.has(name)) {
        index.set(name, { name, xml: opening, sourcePart })
      }
      continue
    }

    const startIdx = match.index
    const closeTag = '</style:style>'
    const closeIdx = xml.indexOf(closeTag, openTagRe.lastIndex)
    if (closeIdx === -1) continue

    const endIdx = closeIdx + closeTag.length
    const snippet = xml.slice(startIdx, endIdx)

    if (!index.has(name)) {
      index.set(name, { name, xml: snippet, sourcePart })
    }

    openTagRe.lastIndex = endIdx
  }
}

export function clearOdfStyleIndexCache(): void {
  cache.clear()
}

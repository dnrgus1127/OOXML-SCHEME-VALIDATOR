import type {
  MonacoHoverContribution,
  MonacoHoverHookParams,
  OoxmlPlugin,
  PluginContext,
} from '../types'
import {
  buildOdfStyleIndex,
  extractStyleElements,
  getCandidateStyleParts,
  type StyleDefinition,
  type StyleIndex,
} from '../util/odf-style-index'

const STYLE_NAME_REF_RE = /([\w-]+:)?style-name="([^"]*)"/g

export const odfChartStyleResolver: OoxmlPlugin = {
  id: 'odf-chart-style-resolver',
  name: 'ODF chart style hover',
  description:
    'ODF 차트 XML에서 style-name 속성에 마우스를 올리면 해당 style 정의를 보여줍니다.',
  version: '0.1.0',
  author: 'wooki <wooki@thinkfree.com>',
  detailedDescription: [
    '`chart:style-name`, `text:style-name` 등 ODF 문서의 *:style-name 속성 값에 마우스를 올리면',
    '해당 이름을 가진 `<style:style>` 정의를 hover 박스로 보여줍니다.',
    '',
    '검색 범위는 다음과 같습니다:',
    '- 현재 편집 중인 XML 파트(에디터 버퍼 우선)',
    '- 같은 ODF 패키지 내 동일 디렉터리의 `styles.xml`/`content.xml`',
    '- 패키지 루트의 `styles.xml`/`content.xml`',
    '',
    'ODF 컨테이너의 `content.xml` 또는 `styles.xml` 파트를 보고 있을 때만 활성화됩니다.',
  ].join('\n'),
  preview: {
    inputLabel: '마우스를 올린 위치',
    outputLabel: 'Hover에 표시되는 내용',
    input: {
      label: 'Object 1/content.xml',
      language: 'xml',
      body:
        '<chart:series chart:style-name="ch5" ...>\n' +
        '                              ^^^   ← 이 값 위에 hover',
    },
    output: {
      label: 'Hover',
      language: 'xml',
      body:
        '**style:name="ch5"** (from `Object 1/styles.xml`)\n\n' +
        '<style:style style:name="ch5" style:family="chart">\n' +
        '  <style:graphic-properties draw:stroke="solid" .../>\n' +
        '  <style:chart-properties chart:symbol-type="automatic"/>\n' +
        '</style:style>',
    },
  },

  appliesTo(ctx: PluginContext): boolean {
    if (ctx.containerFormat !== 'odf') return false
    return ctx.partPath.endsWith('content.xml') || ctx.partPath.endsWith('styles.xml')
  },

  hooks: {
    async provideMonacoHover(
      ctx: PluginContext,
      params: MonacoHoverHookParams
    ): Promise<MonacoHoverContribution | null> {
      const { model, position } = params
      const line = model.getLineContent(position.lineNumber)
      const col = position.column

      const ref = findStyleNameRefAt(line, col)
      if (!ref) return null

      const definition = await resolveStyle(ctx, model.getValue(), ref.name)
      if (!definition) return null

      return {
        contents: buildHoverMarkdown(definition),
        range: {
          startLineNumber: position.lineNumber,
          startColumn: ref.valueStart + 1,
          endLineNumber: position.lineNumber,
          endColumn: ref.valueEnd + 1,
        },
      }
    },
  },
}

interface StyleNameRef {
  name: string
  valueStart: number
  valueEnd: number
}

function findStyleNameRefAt(line: string, col: number): StyleNameRef | null {
  const cursor = col - 1
  STYLE_NAME_REF_RE.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = STYLE_NAME_REF_RE.exec(line)) !== null) {
    const value = match[2]
    if (value === undefined) continue
    const matchStart = match.index
    const valueStart = matchStart + match[0].indexOf(`"${value}"`) + 1
    const valueEnd = valueStart + value.length

    if (cursor >= valueStart && cursor <= valueEnd) {
      return { name: value, valueStart, valueEnd }
    }
  }
  return null
}

async function resolveStyle(
  ctx: PluginContext,
  modelText: string,
  name: string
): Promise<StyleDefinition | null> {
  const inline: StyleIndex = new Map()
  extractStyleElements(modelText, ctx.partPath, inline)
  const fromInline = inline.get(name)
  if (fromInline) return fromInline

  const others = getCandidateStyleParts(ctx).filter((path) => path !== ctx.partPath)
  if (others.length === 0) return null

  const index = await buildOdfStyleIndex(ctx, others)
  return index.get(name) ?? null
}

function buildHoverMarkdown(def: StyleDefinition): string[] {
  return [
    `**style:name="${def.name}"** _(from \`${def.sourcePart}\`)_`,
    '```xml\n' + indentXml(def.xml) + '\n```',
  ]
}

function indentXml(xml: string): string {
  const trimmed = xml.trim()
  const compact = trimmed.replace(/>\s+</g, '><').replace(/></g, '>\n<')
  const lines = compact.split('\n')
  let depth = 0
  return lines
    .map((raw) => {
      const line = raw.trim()
      if (!line) return ''
      const closing = line.startsWith('</')
      const opening = line.startsWith('<') && !closing && !line.startsWith('<?') && !line.startsWith('<!')
      const selfClosing = line.endsWith('/>')
      const inline = opening && line.includes('</')

      if (closing) depth = Math.max(0, depth - 1)
      const out = '  '.repeat(depth) + line
      if (opening && !selfClosing && !inline) depth++
      return out
    })
    .join('\n')
}

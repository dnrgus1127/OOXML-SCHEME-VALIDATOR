# OOXML Schema Validator

OOXML XSD 스키마를 JSON 런타임 타입으로 변환해 XML 문서를 스트리밍 방식으로 검증하는 엔진 구현입니다.
`docs/ooxml-validation-engine-design.md`와 `docs/ooxml-schema-types.ts` 설계를 기반으로 핵심 런타임을 구성했습니다.
현재 저장소는 **모노레포**로 구성되어 검증 엔진(`core`)과 데스크톱 UI(`desktop`)를 중심으로 개발 중입니다.

## 주요 구성

- `SchemaRegistry`/`SchemaRegistryBuilder`: 네임스페이스별 스키마 관리
- `CompositorState`: sequence/choice/all 검증 상태 관리
- `ValidationEngine`: 이벤트 기반 XML 검증

## 패키지 구성

- `packages/core`: OOXML 스키마 검증 엔진 **(주요 개발 대상)**
- `packages/desktop`: 데스크톱 UI **(주요 개발 대상)**
- `packages/parser`: XML 이벤트 스트리밍 파서
- `packages/mcp`: MCP 서버/도구 래퍼 (후순위)

## 사용 예시

```ts
import { SchemaRegistryImpl, ValidationEngine } from './dist'

const registry = new SchemaRegistryImpl(new Map())
const validator = new ValidationEngine(registry, { failFast: false })

validator.startDocument()
validator.startElement({
  name: 'c:chart',
  localName: 'chart',
  namespaceUri: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
  attributes: [],
})
validator.endElement({
  name: 'c:chart',
  localName: 'chart',
  namespaceUri: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
  attributes: [],
})
const result = validator.endDocument()

console.log(result.valid, result.errors)
```

## 개발

```bash
pnpm install
pnpm run build
```

### 자주 쓰는 스크립트

```bash
pnpm run dev
pnpm run test
pnpm run lint
pnpm run typecheck
```

## 개발 우선순위

현재 **core** (검증 엔진)와 **desktop** (데스크톱 UI) 개발에 집중하고 있습니다.
MCP 통합은 후순위로 계획되어 있습니다.

## 참고 문서

- MCP 통합 시나리오: `docs/mcp-integration.md`
- Electron/MCP 환경설정: `docs/electron-mcp-setup.md`

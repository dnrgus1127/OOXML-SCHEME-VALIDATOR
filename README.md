# MCP OOXML Schema Validator

OOXML XSD 스키마를 JSON 런타임 타입으로 변환해 XML 문서를 스트리밍 방식으로 검증하는 엔진 구현입니다.
`docs/ooxml-validation-engine-design.md`와 `docs/ooxml-schema-types.ts` 설계를 기반으로 핵심 런타임을 구성했습니다.
현재 저장소는 **모노레포**로 구성되어 검증 엔진, MCP 서버, 데스크톱 UI가 함께 관리됩니다.

## 주요 구성

- `SchemaRegistry`/`SchemaRegistryBuilder`: 네임스페이스별 스키마 관리
- `CompositorState`: sequence/choice/all 검증 상태 관리
- `ValidationEngine`: 이벤트 기반 XML 검증

## 패키지 구성

- `packages/core`: OOXML 스키마 검증 엔진
- `packages/parser`: XML 이벤트 스트리밍 파서
- `packages/mcp`: MCP 서버/도구 래퍼
- `packages/desktop`: 데스크톱 UI

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

## MCP 통합 시나리오

MCP 에이전트에서 XLSX 파일을 받아 스키마 검증까지 수행하는 흐름은
`docs/mcp-integration.md`에 정리했습니다.

## Electron/MCP 환경설정 가이드

Electron 데스크톱 환경설정, 실행 방법, 그리고 MCP를 Codex/Claude에 연결하는 절차는
`docs/electron-mcp-setup.md`를 참고하세요.

## MCP 에이전트 등록(개요)

이 프로젝트는 OOXML 검증 **엔진 라이브러리**이므로, MCP 에이전트 등록을 위해서는
엔진을 호출하는 **별도 MCP 서버/도구 래퍼**가 필요합니다. 상세 설계는
`docs/mcp-integration.md`를 참고하세요.

1. 패키지 빌드

   ```bash
   pnpm install
   pnpm run build
   ```

2. MCP 클라이언트 설정에 서버/도구 등록

   ```json
   {
     "mcpServers": {
       "ooxml-validator": {
         "command": "node",
         "args": ["path/to/your-mcp-server.js"]
       }
     }
   }
   ```

3. 에이전트가 도구를 호출하도록 연결
   - XLSX 파일 수신 → 압축 해제 → XML 이벤트 스트리밍 → 검증 결과 리포트 생성
   - 실제 호출 스펙/입출력 포맷은 `docs/mcp-integration.md`에서 정의한 예시를 기준으로 조정

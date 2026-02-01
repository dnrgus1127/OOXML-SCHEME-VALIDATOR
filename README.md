# MCP OOXML Schema Validator

OOXML XSD 스키마를 JSON 런타임 타입으로 변환해 XML 문서를 스트리밍 방식으로 검증하는 엔진 구현입니다.
`docs/ooxml-validation-engine-design.md`와 `docs/ooxml-schema-types.ts` 설계를 기반으로 핵심 런타임을 구성했습니다.

## 주요 구성

- `SchemaRegistry`/`SchemaRegistryBuilder`: 네임스페이스별 스키마 관리
- `CompositorState`: sequence/choice/all 검증 상태 관리
- `ValidationEngine`: 이벤트 기반 XML 검증

## 사용 예시

```ts
import { SchemaRegistryImpl, ValidationEngine } from './dist';

const registry = new SchemaRegistryImpl(new Map());
const validator = new ValidationEngine(registry, { failFast: false });

validator.startDocument();
validator.startElement({
  name: 'c:chart',
  localName: 'chart',
  namespaceUri: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
  attributes: [],
});
validator.endElement({
  name: 'c:chart',
  localName: 'chart',
  namespaceUri: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
  attributes: [],
});
const result = validator.endDocument();

console.log(result.valid, result.errors);
```

## 개발

```bash
npm install
npm run build
```

## MCP 통합 시나리오

MCP 에이전트에서 XLSX 파일을 받아 스키마 검증까지 수행하는 흐름은
`docs/mcp-integration.md`에 정리했습니다.

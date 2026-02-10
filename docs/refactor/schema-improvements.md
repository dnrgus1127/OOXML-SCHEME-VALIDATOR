# OOXML 스키마 지원 개선 명세서

**작성일:** 2026-02-10
**작성자:** schema-expert
**버전:** 1.0

---

## 1. 현황 분석

### 1.1 현재 아키텍처

**XSD 컨버터** (`tools/xsd-converter/src/index.ts`)

- 988줄, 완전 기능적 XSD → TypeScript 변환기
- `fast-xml-parser`의 `preserveOrder` 모드 사용으로 파티클 순서 보장
- 지원 기능:
  - Simple types (restriction, union, list)
  - Complex types (sequence, choice, all compositors)
  - Facets (enumeration, pattern, length, range, whiteSpace 등)
  - Attributes & attribute groups
  - Groups & group references
  - SimpleContent / ComplexContent (extension, restriction)
- 21개 XSD 파일 → TypeScript 스키마 생성 (sml, wml, pml, dml, shared)

**Simple Type Validator** (`packages/core/src/engine/simple-type-validator.ts`)

- 207줄, 순수 함수 기반 검증 엔진
- `validateBuiltinType()` - 15개 내장 타입 지원
- `validateFacet()` - 11가지 facet 검증
- **격차:**
  - `whiteSpace` facet: 라인 162에서 항상 `true` 반환 (검증 미구현)
  - `anyURI`: 라인 204에서 기본 `true` 반환 (RFC 3986 검증 없음)

**네임스페이스 정규화** (`packages/core/src/runtime.ts`)

- 라인 109-155: `TRANSITIONAL_TO_STRICT_NS` 매핑
- **현재 지원:** 18개 네임스페이스 (sml, wml, pml, dml 핵심)
- **미지원:** VML, Office extensions, Custom XML 관련 네임스페이스

### 1.2 스키마 파일 현황

**21개 XSD 파일** (총 ~880KB)

```
schemas/
├── dml-*.xsd (8개) - DrawingML 하위 스키마
├── pml.xsd         - PresentationML
├── sml.xsd         - SpreadsheetML
├── wml.xsd         - WordprocessingML
└── shared-*.xsd (10개) - 공통 타입, properties, math
```

**Import/Include 의존성:**

- 48개 import/include 선언 (17개 파일에 분산)
- **문제:** XSD 컨버터가 import/include 해석 안 함
  - 라인 260-266: import 메타데이터만 파싱
  - 실제 참조 해결은 `SchemaRegistry`에 위임
  - TODO 주석 (`packages/core/src/schema/registry.ts:82`)

---

## 2. 지원 격차 (Schema Support Gaps)

### 2.1 Facet 검증 미완성

#### 문제 1: WhiteSpace Facet 미구현

**위치:** `simple-type-validator.ts:161-162`

```typescript
case 'whiteSpace':
  return true  // ❌ 항상 통과
```

**XSD 명세 (XML Schema Part 2):**

- `preserve`: 모든 공백 유지
- `replace`: 탭/개행/캐리지리턴 → 스페이스
- `collapse`: replace + 연속 공백 제거 + trim

**현재 상태:**

- XSD 컨버터는 facet 파싱 ✅ (라인 339, 663)
- 런타임 검증 로직 없음 ❌

**영향:**

- `xsd:token` (collapse 필수) 검증 부정확
- `xsd:NCName`, `xsd:ID` 등 파생 타입 오류 발생 가능

#### 문제 2: anyURI 검증 미구현

**위치:** `simple-type-validator.ts:204`

```typescript
default:
  return true  // ❌ anyURI 포함
```

**RFC 3986 요구사항:**

- URI = scheme ":" hier-part [ "?" query ] [ "#" fragment ]
- 예: `http://example.com`, `mailto:user@host`, `urn:isbn:123`

**현재 상태:**

- 아무 문자열이나 통과
- Relationship 참조 검증 불가 (`r:id` attributes)

### 2.2 Import/Include 미해결

#### 문제: 의존성 그래프 미구축

**위치:** `xsd-converter/src/index.ts:260-266`, `schema/registry.ts:82`

**현재 동작:**

```typescript
// XSD 컨버터: 메타데이터만 저장
result.imports.push({
  namespace: attr(imp, 'namespace') || '',
  schemaLocation: attr(imp, 'schemaLocation') || '',
})

// Registry: TODO 주석만 존재
// TODO: import/include/redefine 처리 로직은 파서 구현에 위임
```

**XSD 의존성 예시 (dml-main.xsd):**

```xml
<xsd:import namespace="http://purl.oclc.org/ooxml/drawingml/chart"
            schemaLocation="dml-chart.xsd"/>
<xsd:import namespace="http://purl.oclc.org/ooxml/drawingml/diagram"
            schemaLocation="dml-diagram.xsd"/>
```

**영향:**

- 크로스 스키마 타입 참조 실패
- `dml:chart` 참조 시 `dml-chart.xsd` 타입 찾지 못함
- 수동 registry 구성 필요

### 2.3 네임스페이스 정규화 범위 제한

#### 문제: 18개 네임스페이스만 커버

**위치:** `runtime.ts:109-150`

**미지원 네임스페이스 (추정 30+):**

- **VML (Vector Markup Language):**
  - `urn:schemas-microsoft-com:vml`
  - `urn:schemas-microsoft-com:office:office`
  - `urn:schemas-microsoft-com:office:word`
  - `urn:schemas-microsoft-com:office:excel`
  - `urn:schemas-microsoft-com:office:powerpoint`
- **Office 확장:**
  - `http://schemas.microsoft.com/office/word/2010/wordml`
  - `http://schemas.microsoft.com/office/excel/2010/spreadsheetml`
  - 2012, 2013, 2015, 2019, 2021 버전 네임스페이스
- **Custom XML & Metadata:**
  - `http://schemas.openxmlformats.org/markup-compatibility/2006`
  - `http://schemas.openxmlformats.org/package/2006/metadata/core-properties`

**현재 XSD 파일에 VML 스키마 없음:**

```bash
$ grep -r "urn:schemas-microsoft-com:vml" schemas/*.xsd
# 0 results
```

**영향:**

- 실제 Office 파일의 레거시 요소 검증 불가
- Word VML 도형, Excel 차트 오류 발생

---

## 3. 개선 계획

### 3.1 WhiteSpace Facet 강제 구현

#### 설계

**파일:** `packages/core/src/engine/simple-type-validator.ts`

**구현 로직:**

```typescript
export function applyWhitespace(value: string, mode: 'preserve' | 'replace' | 'collapse'): string {
  if (mode === 'preserve') return value

  // Step 1: replace
  let result = value.replace(/[\t\n\r]/g, ' ')

  if (mode === 'replace') return result

  // Step 2: collapse
  result = result.replace(/\s{2,}/g, ' ').trim()
  return result
}

export function validateFacet(value: string, facet: Facet): boolean {
  switch (facet.type) {
    case 'whiteSpace':
      // whitespace facet은 정규화 규칙이므로 검증이 아닌 적용
      // 사전 정규화된 값과 비교
      const normalized = applyWhitespace(value, facet.value)
      return value === normalized
    // ...
  }
}
```

**통합 지점:**

- `validateRestriction()` (라인 38-63)에서 facet 검증 전 적용
- `validateBuiltinType()`에서 `xsd:token` 검증 시 자동 collapse

**테스트 케이스:**

```typescript
// packages/core/src/__tests__/whitespace-facet.test.ts
describe('WhiteSpace Facet', () => {
  it('preserve: 모든 공백 유지', () => {
    expect(applyWhitespace('a\t\nb  c', 'preserve')).toBe('a\t\nb  c')
  })

  it('replace: 제어 문자 → 스페이스', () => {
    expect(applyWhitespace('a\t\nb', 'replace')).toBe('a  b')
  })

  it('collapse: 연속 공백 제거 + trim', () => {
    expect(applyWhitespace('  a  b\tc  ', 'collapse')).toBe('a b c')
  })
})
```

**예상 변경량:** +40줄 코드, +60줄 테스트

### 3.2 URI 검증 개선 (RFC 3986)

#### 설계

**파일:** `packages/core/src/engine/simple-type-validator.ts`

**구현 로직:**

```typescript
export function validateBuiltinType(value: string, typeName: string): boolean {
  switch (typeName) {
    // ...
    case 'anyURI':
      return validateUri(value)
    // ...
  }
}

function validateUri(value: string): boolean {
  if (!value) return true // empty URI는 허용 (optional)

  // RFC 3986 간소화 정규식
  // URI = scheme ":" hier-part [ "?" query ] [ "#" fragment ]
  const uriPattern = /^[a-z][a-z0-9+.-]*:.+/i

  // 일반 URI 검증
  if (uriPattern.test(value)) return true

  // 상대 참조 허용 (OOXML relationships)
  if (/^[^:]+$/.test(value)) return true

  return false
}
```

**검증 수준:**

- **Level 1 (현재 제안):** Scheme + basic structure
- **Level 2 (선택):** Full RFC 3986 parser (외부 라이브러리)
  - 장점: 100% 표준 준수
  - 단점: 의존성 추가 (zero-dep 원칙 위배)

**대안: 커스텀 검증기**

```typescript
// runtime context에 등록
options: {
  customValidators: new Map([['anyURI', (value) => isValidRelationshipId(value)]])
}
```

**예상 변경량:** +25줄 코드, +40줄 테스트

### 3.3 XSD Import/Include 해결

#### 설계

**새 파일:** `tools/xsd-converter/src/dependency-resolver.ts`

**단계:**

**1단계: 의존성 그래프 구축**

```typescript
interface SchemaNode {
  filename: string
  targetNamespace: string
  imports: { namespace: string; location: string }[]
  includes: string[]
}

function buildDependencyGraph(schemasDir: string): Map<string, SchemaNode> {
  const graph = new Map<string, SchemaNode>()

  for (const xsdFile of findXsdFiles(schemasDir)) {
    const schema = parseSchemaMetadata(xsdFile)
    graph.set(schema.targetNamespace, schema)
  }

  return graph
}
```

**2단계: 토폴로지 정렬**

```typescript
function topologicalSort(graph: Map<string, SchemaNode>): string[] {
  // Kahn's algorithm
  const sorted: string[] = []
  const inDegree = new Map<string, number>()

  // Calculate in-degrees
  for (const node of graph.values()) {
    inDegree.set(node.targetNamespace, 0)
  }

  for (const node of graph.values()) {
    for (const imp of node.imports) {
      inDegree.set(imp.namespace, (inDegree.get(imp.namespace) || 0) + 1)
    }
  }

  // Process nodes with 0 in-degree
  const queue: string[] = []
  for (const [ns, degree] of inDegree.entries()) {
    if (degree === 0) queue.push(ns)
  }

  while (queue.length > 0) {
    const ns = queue.shift()!
    sorted.push(ns)

    const node = graph.get(ns)!
    for (const imp of node.imports) {
      const newDegree = inDegree.get(imp.namespace)! - 1
      inDegree.set(imp.namespace, newDegree)
      if (newDegree === 0) queue.push(imp.namespace)
    }
  }

  return sorted
}
```

**3단계: SchemaRegistry 자동 구성**

```typescript
// packages/core/src/schema/registry.ts
export function createRegistryWithDependencies(): SchemaRegistry {
  const registry = new SchemaRegistry()

  // Dependency order (생성된 순서)
  const schemas = [
    sharedCommonSimpleTypesSchema,
    sharedRelationshipReferenceSchema,
    dmlMainSchema,
    dmlChartSchema,
    // ...
  ]

  for (const schema of schemas) {
    registry.registerSchema(schema)
  }

  return registry
}
```

**4단계: 타입 참조 해결 개선**

```typescript
// packages/core/src/engine/type-resolver.ts
export function resolveTypeReference(
  typeRef: TypeReference,
  namespaceContext: Map<string, string>,
  registry: SchemaRegistry,
  errorCallback: ErrorCallback
): XsdComplexType | XsdSimpleType | null {
  // 1. 네임스페이스 prefix 해결
  const namespaceUri = resolveNamespaceWithFallback(
    typeRef.namespacePrefix,
    namespaceContext,
    registry
  )

  // 2. Import된 스키마에서 타입 검색
  const importedSchema = registry.getSchemaByNamespace(namespaceUri)
  if (!importedSchema) {
    errorCallback('SCHEMA_NOT_FOUND', `네임스페이스 ${namespaceUri} 스키마 없음`, typeRef.name)
    return null
  }

  // 3. 타입 조회
  return (
    importedSchema.complexTypes.get(typeRef.name) ||
    importedSchema.simpleTypes.get(typeRef.name) ||
    null
  )
}
```

**파일 변경:**

- `tools/xsd-converter/src/dependency-resolver.ts` (신규, ~200줄)
- `tools/xsd-converter/src/index.ts` (수정, +50줄)
- `packages/core/src/schema/registry.ts` (수정, +80줄 TODO 해결)
- `packages/core/src/engine/type-resolver.ts` (수정, +30줄)

**예상 변경량:** +360줄 코드, +120줄 테스트

### 3.4 네임스페이스 정규화 확장 (18 → 50+)

#### 설계

**파일:** `packages/core/src/runtime.ts`

**확장 전략:**

**1단계: 매핑 데이터 구조화**

```typescript
// packages/core/src/namespace-mappings.ts (신규)
interface NamespaceMapping {
  transitional: string
  strict: string
  category: 'core' | 'vml' | 'office-ext' | 'package' | 'markup'
  description: string
}

export const NAMESPACE_MAPPINGS: NamespaceMapping[] = [
  // Core OOXML (기존 18개)
  {
    transitional: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    strict: 'http://purl.oclc.org/ooxml/spreadsheetml/main',
    category: 'core',
    description: 'SpreadsheetML Main',
  },
  // ... (기존 17개)

  // VML (신규 5개)
  {
    transitional: 'urn:schemas-microsoft-com:vml',
    strict: 'urn:schemas-microsoft-com:vml', // VML은 변환 없음
    category: 'vml',
    description: 'Vector Markup Language',
  },
  {
    transitional: 'urn:schemas-microsoft-com:office:office',
    strict: 'urn:schemas-microsoft-com:office:office',
    category: 'vml',
    description: 'Office VML Extensions',
  },
  // ... (word, excel, powerpoint)

  // Office 2010+ Extensions (신규 15개)
  {
    transitional: 'http://schemas.microsoft.com/office/word/2010/wordml',
    strict: 'http://schemas.microsoft.com/office/word/2010/wordml',
    category: 'office-ext',
    description: 'Word 2010 Extensions',
  },
  // ... (2012, 2013, 2015, 2019, 2021 버전)

  // Package & Markup Compatibility (신규 7개)
  {
    transitional: 'http://schemas.openxmlformats.org/markup-compatibility/2006',
    strict: 'http://schemas.openxmlformats.org/markup-compatibility/2006',
    category: 'markup',
    description: 'Markup Compatibility',
  },
  {
    transitional: 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties',
    strict: 'http://purl.oclc.org/ooxml/package/metadata/core-properties',
    category: 'package',
    description: 'Package Core Properties',
  },
  // ... (relationships, content-types, digital-signatures)
]

// 빠른 조회를 위한 Map 생성
export const TRANSITIONAL_TO_STRICT_NS = new Map(
  NAMESPACE_MAPPINGS.map((m) => [m.transitional, m.strict])
)
```

**2단계: SchemaRegistry에 네임스페이스 등록**

```typescript
// packages/core/src/schema/registry.ts
export class SchemaRegistry {
  private knownNamespaces = new Set<string>()

  registerNamespaceMapping(mapping: NamespaceMapping): void {
    this.knownNamespaces.add(mapping.transitional)
    this.knownNamespaces.add(mapping.strict)
  }

  isKnownNamespace(uri: string): boolean {
    return this.knownNamespaces.has(uri)
  }
}
```

**3단계: 검증 옵션 추가**

```typescript
// packages/core/src/runtime.ts
export interface RuntimeValidationContext {
  options: {
    strict?: boolean
    allowUnknownNamespaces?: boolean // 신규
    // ...
  }
}

// packages/core/src/engine/validator.ts
function validateElementNamespace(
  namespaceUri: string,
  registry: SchemaRegistry,
  options: ValidationOptions
): boolean {
  const normalized = normalizeNamespace(namespaceUri)

  if (registry.isKnownNamespace(normalized)) return true

  if (options.allowUnknownNamespaces) {
    // Warning만 발생
    return true
  }

  // Strict mode: 에러 발생
  return false
}
```

**4단계: VML 스키마 추가 (선택적)**

- VML XSD 파일은 공식 배포 없음 (Microsoft 독점 포맷)
- 대안:
  1. **Best-effort 검증:** 구조만 검증 (`<v:shape>`, `<v:textbox>` 등)
  2. **Skip 모드:** VML 요소는 `allowUnknownNamespaces: true`로 통과
  3. **Custom XSD 작성:** 주요 VML 요소만 정의 (100-200줄)

**파일 변경:**

- `packages/core/src/namespace-mappings.ts` (신규, ~400줄)
- `packages/core/src/runtime.ts` (수정, -50줄 매핑 이동, +20줄 import)
- `packages/core/src/schema/registry.ts` (수정, +60줄)
- `schemas/vml-core.xsd` (선택, 신규, ~150줄)

**예상 변경량:** +630줄 (VML XSD 포함), +80줄 테스트

---

## 4. 우선순위 및 로드맵

### Phase 1: Critical Fixes (1주)

**목표:** 기존 기능 완성도 향상

| Task              | Files                      | LOC  | Risk | Impact |
| ----------------- | -------------------------- | ---- | ---- | ------ |
| WhiteSpace Facet  | `simple-type-validator.ts` | +100 | Low  | High   |
| anyURI Validation | `simple-type-validator.ts` | +65  | Low  | Medium |

**결과물:**

- 100% XSD 명세 준수 facet 검증
- Relationship 참조 타입 안정성 향상

### Phase 2: Import Resolution (2주)

**목표:** 크로스 스키마 타입 참조 지원

| Task                 | Files                | LOC  | Risk   | Impact |
| -------------------- | -------------------- | ---- | ------ | ------ |
| Dependency Resolver  | `xsd-converter/`     | +200 | Medium | High   |
| Registry Integration | `schema/registry.ts` | +80  | Medium | High   |
| Type Resolution      | `type-resolver.ts`   | +30  | Low    | High   |

**결과물:**

- Import/Include 자동 해결
- 21개 스키마 의존성 그래프 구축
- `dml:chart`, `dml:diagram` 등 참조 검증 가능

### Phase 3: Namespace Expansion (1주)

**목표:** 실제 Office 파일 커버리지 확대

| Task                  | Files                   | LOC  | Risk | Impact |
| --------------------- | ----------------------- | ---- | ---- | ------ |
| Namespace Mappings    | `namespace-mappings.ts` | +400 | Low  | Medium |
| Registry NS Support   | `schema/registry.ts`    | +60  | Low  | Medium |
| VML Schema (Optional) | `schemas/vml-core.xsd`  | +150 | High | Low    |

**결과물:**

- 50+ 네임스페이스 정규화
- Office 2010-2021 확장 지원
- VML 기본 검증 (선택)

### Phase 4: Testing & Documentation (1주)

**목표:** 안정성 보장 및 사용성 향상

| Task                   | Files        | LOC  | Risk   | Impact |
| ---------------------- | ------------ | ---- | ------ | ------ |
| Unit Tests             | `__tests__/` | +300 | Low    | High   |
| Integration Tests      | `__tests__/` | +150 | Medium | High   |
| Schema Coverage Report | `docs/`      | +200 | Low    | Medium |

**결과물:**

- 95%+ 코드 커버리지
- Import chain 통합 테스트
- 스키마 지원 매트릭스 문서

---

## 5. 리스크 및 완화 전략

### 리스크 1: 순환 의존성

**시나리오:** `dml-main.xsd` ↔ `dml-chart.xsd` 상호 참조

**완화:**

- Topological sort 실패 시 경고 + 수동 순서 지정
- Forward declaration 지원 (타입 참조를 lazy 해결)

### 리스크 2: 성능 저하

**시나리오:** 50+ 스키마 로드 시 초기화 시간 증가

**완화:**

- Lazy loading: 사용 시점에 스키마 로드
- Schema caching: 파싱 결과 직렬화 (JSON)
- Tree shaking: 사용하지 않는 스키마 제외

### 리스크 3: VML 스키마 불완전

**시나리오:** VML XSD 없이 검증 불가

**완화:**

- Phase 3을 optional로 설정
- `allowUnknownNamespaces: true` 기본값
- Best-effort 검증 (구조만 확인)

### 리스크 4: 하위 호환성

**시나리오:** 기존 검증 결과 변경 (더 엄격해짐)

**완화:**

- Feature flag: `strictFacetValidation: boolean`
- Opt-in 방식으로 새 기능 도입
- 마이그레이션 가이드 제공

---

## 6. 성공 지표

### 정량 지표

- [ ] WhiteSpace facet 테스트 커버리지 100%
- [ ] anyURI 검증 정확도 95%+ (RFC 3986 테스트 suite)
- [ ] Import resolution 성공률 100% (21개 파일)
- [ ] 네임스페이스 커버리지 50+ (18 → 50)
- [ ] 전체 테스트 실행 시간 < 5초 (현재 대비 +50% 이내)

### 정성 지표

- [ ] `TODO: import/include` 주석 제거
- [ ] `return true` placeholder 코드 0개
- [ ] Real-world XLSX/DOCX/PPTX 파일 검증 성공
- [ ] 개발자 피드백: "타입 참조 에러 감소"

---

## 7. 다음 단계

### 즉시 착수 (Phase 1)

1. **WhiteSpace Facet 구현** (`simple-type-validator.ts`)
   - `applyWhitespace()` 함수 추가
   - `validateFacet()` case 수정
   - 테스트 작성

2. **anyURI Validation 추가** (`simple-type-validator.ts`)
   - `validateUri()` 함수 추가
   - `validateBuiltinType()` case 수정
   - RFC 3986 테스트 케이스

### 병렬 준비 (Phase 2)

- Dependency resolver 설계 검토
- 토폴로지 정렬 알고리즘 선택
- Import chain 테스트 데이터 준비

### 추후 검토 (Phase 3-4)

- VML 스키마 필요성 재평가 (실제 파일 분석)
- Office 2021+ 네임스페이스 추가 조사
- Performance profiling

---

## 8. 참고 자료

### XSD 명세

- [XML Schema Part 2: Datatypes](https://www.w3.org/TR/xmlschema-2/)
- [XML Schema Part 1: Structures](https://www.w3.org/TR/xmlschema-1/)

### OOXML 표준

- [ECMA-376 Part 1 (5th edition)](https://www.ecma-international.org/publications-and-standards/standards/ecma-376/)
- [ISO/IEC 29500-1:2016](https://www.iso.org/standard/71691.html)

### RFC

- [RFC 3986: URI Generic Syntax](https://tools.ietf.org/html/rfc3986)

### 프로젝트 문서

- `/docs/ooxml-validation-engine-design.md` - 검증 엔진 아키텍처
- `/docs/modular-architecture-design.md` - 모듈 분해 전략
- `CLAUDE.md` - 프로젝트 규칙 및 명령어

---

**문서 상태:** ✅ 완료
**승인 필요:** team-lead
**다음 액션:** Phase 1 구현 시작 (Task #6 생성)

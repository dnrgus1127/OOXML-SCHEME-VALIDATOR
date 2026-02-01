# MCP 통합 시나리오

이 문서는 **MCP 에이전트가 XLSX 파일을 받아 OOXML 스키마 검증을 수행하고 보고서 형태로 반환**하기 위한
통합 흐름과 역할 분담을 정리합니다. 실제 구현은 에이전트/서버 환경에 맞게 조정하세요.

## 목표 흐름 요약

1. 에이전트가 사용자의 XLSX 파일을 수신
2. XLSX(Zip) 압축 해제 → 내부 XML 파트 추출
3. XML 파트를 스트리밍 방식으로 파싱하면서 스키마 검증
4. 결과를 사용자에게 리포트 형태로 제공

> 구현 작업 목록은 `docs/mcp-implementation-plan.md`에 정리했습니다.

## 역할 분담 옵션

### 1) 에이전트에서 압축 해제
- 장점: 현재 프로젝트는 검증 엔진에 집중 → 별도 의존성 불필요
- 흐름
  - 에이전트: Zip 해제 → XML 파트별로 검증 요청
  - 검증 엔진: XML 스트림 이벤트 처리 및 결과 반환

### 2) 프로젝트(서버)에서 압축 해제
- 장점: MCP 도구가 “xlsx → report” 단일 기능으로 동작
- 고려사항: zip 해제 라이브러리/파일 I/O 필요

#### zip 해제 + 파일 I/O 작업 체크리스트
- **의존성 선정**
  - Node.js 환경이라면 `adm-zip`, `yauzl`, `unzipper` 같은 zip 라이브러리 선정
  - 스트리밍 처리 필요 시 `yauzl` 같은 lazy/stream 지원 라이브러리 고려
- **보안/제한 사항**
  - Zip Slip(경로 탈출) 방지를 위해 추출 경로 정규화 및 검사
  - 최대 파일/압축 해제 용량 제한(Zip Bomb 방지)
- **임시 디렉터리 처리**
  - 안전한 임시 폴더 생성(`fs.mkdtemp`)
  - 작업 종료 시 정리(성공/실패 모두 cleanup)
- **파일 접근 방식**
  - 서버가 파일 경로를 직접 접근하는지, 바이너리 스트림/버퍼로 받는지 결정
  - 경로 접근 시 권한/경로 검증(allowlist)
- **파트 필터링**
  - `[Content_Types].xml`과 `.rels` 확인 후 필요한 XML 파트만 선별
  - 검증 대상 파트 목록을 정책으로 정의(예: `xl/workbook.xml`, `xl/worksheets/*.xml`)
- **오류 처리**
  - 손상된 zip, 누락된 필수 파트에 대한 오류 메시지 정의
  - 압축 해제 실패 시 사용자 리포트 포맷과 매핑

## MCP 서버/도구 설계 제안

### MCP 도구 이름 예시
- `validate_ooxml_xlsx`

### 입력(예시)
```json
{
  "filePath": "/path/to/file.xlsx",
  "parts": [
    "xl/workbook.xml",
    "xl/worksheets/sheet1.xml"
  ],
  "failFast": false
}
```

### 출력(예시)
```json
{
  "valid": false,
  "errors": [
    {
      "code": "MISSING_REQUIRED_ELEMENT",
      "message": "필수 요소 'sheetData'가 누락되었습니다.",
      "path": "/worksheet"
    }
  ],
  "warnings": []
}
```

## 검증 파이프라인 구성 예시

1. **파일 수신**
   - MCP 에이전트가 사용자로부터 XLSX 파일 수신
2. **압축 해제**
   - Zip 해제 후 XML 파트 목록 확보
3. **XML 파싱**
   - SAX 계열 스트리밍 파서로 파트별 이벤트 생성
4. **검증 엔진 연동**
   - 각 XML 이벤트를 `ValidationEngine`에 전달
5. **결과 수집**
   - `endDocument()` 결과를 모아 최종 리포트 생성

## 검증 이벤트 연동 예시(개념)

```ts
import { SchemaRegistryImpl, ValidationEngine } from '../dist';

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
```

> 실제 구현에서는 SAX 파서 이벤트(`startElement`, `endElement`, `text`)를
> 그대로 연결하면 됩니다.

### 이벤트 배열 유틸리티 사용 예시
```ts
import { validateXmlEvents } from '../dist';

const result = validateXmlEvents(registry, [
  { type: 'startDocument' },
  {
    type: 'startElement',
    element: {
      name: 'c:chart',
      localName: 'chart',
      namespaceUri: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
      attributes: [],
    },
  },
  {
    type: 'endElement',
    element: {
      name: 'c:chart',
      localName: 'chart',
      namespaceUri: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
      attributes: [],
    },
  },
  { type: 'endDocument' },
]);
```

## 리포트 구성 팁

- **파일/파트 구분**: 오류에 `part`(예: `xl/worksheets/sheet1.xml`)를 포함
- **경로 정보**: `ValidationEngine`이 제공하는 `path`를 그대로 노출
- **요약 정보**: `valid` 여부와 오류 개수

### 리포트 포맷 예시
```json
{
  "valid": false,
  "summary": {
    "totalParts": 3,
    "validatedParts": 2,
    "errorCount": 4,
    "warningCount": 1
  },
  "parts": [
    {
      "part": "xl/workbook.xml",
      "valid": true,
      "errors": [],
      "warnings": []
    },
    {
      "part": "xl/worksheets/sheet1.xml",
      "valid": false,
      "errors": [
        {
          "code": "MISSING_REQUIRED_ELEMENT",
          "message": "필수 요소 'sheetData'가 누락되었습니다.",
          "path": "/worksheet",
          "line": 12,
          "column": 5
        }
      ],
      "warnings": [
        {
          "code": "UNEXPECTED_TEXT",
          "message": "element-only 컨텐츠에서 텍스트가 발견되었습니다.",
          "path": "/worksheet/sheetData",
          "line": 20,
          "column": 9
        }
      ]
    }
  ]
}
```

## 다음 단계 제안

1. MCP 서버 구현 위치 확정
   - **에이전트 내부 서브프로세스**로 구성
2. XLSX 해제 책임 결정
   - 기술적으로 쉽게 구현 가능하면 **서버 프로세스**에서 처리
   - 구현 난이도가 높으면 **에이전트**에서 처리 후 XML 파트 전달
3. 파싱/검증 결과를 합산하는 리포트 포맷 확정
   - 위 리포트 포맷 예시를 바탕으로 필드 확정

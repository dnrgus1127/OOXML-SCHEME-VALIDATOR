# Desktop App Improvements Design

## 개요

OOXML Schema Validator 데스크톱 앱의 검증 UI/UX 개선 및 사용자 워크플로우 최적화 설계 문서.

## 현재 아키텍처 분석

### 주요 컴포넌트 구조

```
packages/desktop/src/
├── main/
│   └── index.ts              # Electron 메인 프로세스 (430줄)
│       - IPC 핸들러 (246-371줄)
│       - 검증 로직 통합
├── renderer/
│   ├── App.tsx               # 메인 레이아웃 (207줄)
│   ├── stores/
│   │   └── document.ts       # Zustand 상태 관리 (281줄)
│   └── components/
│       ├── DocumentTree.tsx  # 파일 트리 (177줄)
│       ├── XmlEditor.tsx     # XML 편집기 (190줄)
│       ├── ValidationPanel.tsx # 검증 결과 (189줄)
│       └── Toolbar.tsx       # 상단 툴바
```

### 현재 검증 워크플로우

1. **파일 열기** → `OoxmlParser.fromBuffer()`
2. **검증 실행** → `ValidationEngine` 초기화 → 각 파트별 이벤트 스트림 처리
3. **결과 표시** → `ValidationPanel` (에러 목록 + 요약)

### 현재 UI/UX 특징

#### 장점

- ✅ 파트별 에러 그룹화 (expandable)
- ✅ 에러 위치 표시 (line/column)
- ✅ 에러 코드 + 메시지 + 경로 + 값
- ✅ 파트 네비게이션 (→ 버튼)

#### 개선 필요 영역

- ❌ **에러 필터링 부재** (severity, error type)
- ❌ **검색 기능 부재** (에러 메시지, 경로 검색)
- ❌ **정렬 옵션 없음** (파트명, 에러 수, severity)
- ❌ **국제화 미지원** (하드코딩된 영문 메시지)
- ❌ **에러 상세 정보 제한적** (스키마 위치, 예상 값)
- ❌ **검증 진행 상태 없음** (대용량 파일 처리 시)
- ❌ **에러 복사/내보내기 없음**

## 개선 설계

### 1. 에러 표시 개선

#### 1.1 Severity 레벨 도입

```typescript
// packages/core/src/types.ts (확장)
export interface ValidationError {
  code: string
  message: string
  path: string
  value?: string
  line?: number
  column?: number
  severity: 'error' | 'warning' | 'info' // 추가
  expected?: string // 예상 값 (simple type 검증)
  schemaLocation?: string // 스키마 위치 (디버깅용)
}
```

**적용 원칙:**

- `error`: 스키마 위반 (invalid element, required attribute 누락)
- `warning`: 권장사항 (deprecated element, 비표준 확장)
- `info`: 정보성 (알 수 없는 네임스페이스, skip된 요소)

#### 1.2 에러 카테고리화

```typescript
export type ErrorCategory =
  | 'element' // 요소 관련 (unexpected, missing)
  | 'attribute' // 속성 관련 (required, invalid value)
  | 'type' // 타입 검증 (simple type, pattern)
  | 'sequence' // 순서 위반 (compositor)
  | 'namespace' // 네임스페이스 (unknown prefix)
  | 'xml' // XML 파싱 (malformed)

export interface ValidationError {
  // ... 기존 필드
  category: ErrorCategory // 추가
}
```

### 2. ValidationPanel 개선

#### 2.1 필터 UI 추가

```tsx
// components/ValidationPanel.tsx (새로운 섹션)
<div className="validation-filters">
  {/* Severity Filter */}
  <FilterGroup label="심각도">
    <Checkbox checked={filters.error} onChange={...}>에러</Checkbox>
    <Checkbox checked={filters.warning} onChange={...}>경고</Checkbox>
    <Checkbox checked={filters.info} onChange={...}>정보</Checkbox>
  </FilterGroup>

  {/* Category Filter */}
  <FilterGroup label="유형">
    <Checkbox checked={filters.element} onChange={...}>요소</Checkbox>
    <Checkbox checked={filters.attribute} onChange={...}>속성</Checkbox>
    <Checkbox checked={filters.type} onChange={...}>타입</Checkbox>
    <Checkbox checked={filters.sequence} onChange={...}>순서</Checkbox>
  </FilterGroup>

  {/* Search */}
  <SearchBox
    placeholder="에러 메시지 또는 경로 검색"
    value={searchQuery}
    onChange={setSearchQuery}
  />
</div>
```

#### 2.2 정렬 옵션

```tsx
// Sort Dropdown
<SortDropdown value={sortBy} onChange={setSortBy}>
  <option value="path">파일 경로</option>
  <option value="errorCount">에러 개수</option>
  <option value="severity">심각도</option>
</SortDropdown>
```

#### 2.3 에러 상세 정보 확장

```tsx
// validation-error.tsx (새로운 컴포넌트)
<div className="validation-error-detail">
  <div className="error-header">
    <Badge severity={error.severity}>{error.code}</Badge>
    <span className="error-location">
      Line {error.line}:{error.column}
    </span>
  </div>

  <div className="error-message">{error.message}</div>
  <div className="error-path">{error.path}</div>

  {error.value && (
    <div className="error-value">
      <label>실제 값:</label>
      <code>{error.value}</code>
    </div>
  )}

  {error.expected && (
    <div className="error-expected">
      <label>예상 값:</label>
      <code>{error.expected}</code>
    </div>
  )}

  {error.schemaLocation && (
    <div className="error-schema">
      <label>스키마 위치:</label>
      <code>{error.schemaLocation}</code>
    </div>
  )}

  {/* 액션 버튼 */}
  <div className="error-actions">
    <button onClick={() => copyError(error)}>복사</button>
    <button onClick={() => navigateToError(error)}>위치 이동</button>
  </div>
</div>
```

### 3. 국제화 (i18n) 적용

#### 3.1 메시지 파일 구조

```
packages/desktop/src/i18n/
├── index.ts           # i18n 초기화
├── locales/
│   ├── ko.json        # 한국어
│   └── en.json        # 영어
```

#### 3.2 메시지 키 체계

```json
// ko.json
{
  "validation": {
    "title": "검증 결과",
    "revalidate": "재검증",
    "summary": {
      "valid": "문서가 유효합니다",
      "invalid": "문서에 오류가 있습니다",
      "validParts": "{{count}}개 유효",
      "invalidParts": "{{count}}개 오류",
      "totalErrors": "총 {{count}}개 오류"
    },
    "filters": {
      "severity": "심각도",
      "category": "유형",
      "search": "검색"
    },
    "severity": {
      "error": "에러",
      "warning": "경고",
      "info": "정보"
    },
    "category": {
      "element": "요소",
      "attribute": "속성",
      "type": "타입",
      "sequence": "순서",
      "namespace": "네임스페이스",
      "xml": "XML 파싱"
    },
    "errors": {
      "INVALID_ELEMENT": "유효하지 않은 요소: {{element}}",
      "REQUIRED_ATTRIBUTE_MISSING": "필수 속성 누락: {{attribute}}",
      "INVALID_ATTRIBUTE_VALUE": "잘못된 속성 값: {{value}}",
      "SEQUENCE_VIOLATION": "요소 순서 위반",
      "XML_PARSE_ERROR": "XML 파싱 오류"
    }
  },
  "toolbar": {
    "open": "열기",
    "save": "저장",
    "saveAs": "다른 이름으로 저장",
    "validate": "검증"
  },
  "documentTree": {
    "partCount": "{{count}}개 파트"
  },
  "editor": {
    "format": "포맷",
    "highlight": "하이라이트"
  }
}
```

#### 3.3 React 통합

```tsx
// App.tsx
import { useTranslation } from 'react-i18next'

export default function App() {
  const { t } = useTranslation()

  return (
    <div className="app">
      <Toolbar
        onValidate={handleValidate}
        labels={{
          open: t('toolbar.open'),
          save: t('toolbar.save'),
          validate: t('toolbar.validate'),
        }}
      />
      {/* ... */}
    </div>
  )
}
```

### 4. 검증 진행 상태 표시

#### 4.1 스트리밍 진행 상태

```typescript
// main/index.ts (검증 핸들러 수정)
ipcMain.handle('ooxml:validate', async (event, base64Data: string) => {
  // ... 기존 로직

  const totalParts = validatableParts.length
  let processedParts = 0

  for (const [path, part] of doc.parts) {
    if (!shouldValidate(path, part)) continue

    processedParts++

    // 진행 상태 전송
    event.sender.send('ooxml:validate:progress', {
      current: processedParts,
      total: totalParts,
      currentPart: path,
    })

    // 검증 로직...
  }

  // ... 결과 반환
})
```

#### 4.2 UI 프로그레스 바

```tsx
// components/ValidationProgress.tsx (새로운 컴포넌트)
export function ValidationProgress({ current, total, currentPart }: Props) {
  const progress = (current / total) * 100

  return (
    <div className="validation-progress">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="progress-info">
        <span>
          검증 중: {current}/{total}
        </span>
        <span className="current-part">{currentPart}</span>
      </div>
    </div>
  )
}
```

### 5. 에러 복사/내보내기

#### 5.1 클립보드 복사

```typescript
// utils/error-export.ts
export function formatErrorForClipboard(error: ValidationError): string {
  return `[${error.code}] ${error.message}
Path: ${error.path}
${error.line ? `Location: Line ${error.line}:${error.column}` : ''}
${error.value ? `Value: ${error.value}` : ''}
${error.expected ? `Expected: ${error.expected}` : ''}`
}

export function copyAllErrors(results: ValidationResult): void {
  const text = results.results
    .filter((r) => !r.valid)
    .flatMap((r) => r.errors || [])
    .map(formatErrorForClipboard)
    .join('\n\n---\n\n')

  navigator.clipboard.writeText(text)
}
```

#### 5.2 JSON/CSV 내보내기

```typescript
// utils/error-export.ts
export function exportErrorsAsJSON(results: ValidationResult): string {
  return JSON.stringify(results, null, 2)
}

export function exportErrorsAsCSV(results: ValidationResult): string {
  const rows = results.results
    .filter((r) => !r.valid)
    .flatMap(
      (r) =>
        r.errors?.map((e) => ({
          part: r.path,
          code: e.code,
          severity: e.severity,
          message: e.message,
          path: e.path,
          line: e.line,
          column: e.column,
          value: e.value,
        })) || []
    )

  return Papa.unparse(rows) // papaparse 사용
}
```

#### 5.3 UI 내보내기 버튼

```tsx
// ValidationPanel.tsx (헤더에 추가)
<div className="validation-header">
  <h3>{t('validation.title')}</h3>

  <div className="header-actions">
    <DropdownMenu>
      <DropdownButton>내보내기</DropdownButton>
      <DropdownItems>
        <DropdownItem onClick={() => exportJSON(results)}>JSON으로 내보내기</DropdownItem>
        <DropdownItem onClick={() => exportCSV(results)}>CSV로 내보내기</DropdownItem>
        <DropdownItem onClick={() => copyAllErrors(results)}>클립보드에 복사</DropdownItem>
      </DropdownItems>
    </DropdownMenu>

    <button onClick={onRevalidate}>{t('validation.revalidate')}</button>
    <button onClick={onClose}>×</button>
  </div>
</div>
```

### 6. 에디터 통합 개선

#### 6.1 에러 위치로 스크롤

```tsx
// XmlEditor.tsx (개선)
export function XmlEditor({
  content,
  partPath,
  onChange,
  highlightLine, // 새로운 prop
}: XmlEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (highlightLine && textareaRef.current) {
      // 해당 라인으로 스크롤
      const lines = content.split('\n')
      const lineHeight = 18 // CSS line-height
      const scrollTop = (highlightLine - 1) * lineHeight

      textareaRef.current.scrollTop = scrollTop

      // 해당 라인 하이라이트 (일시적)
      setHighlightedLine(highlightLine)
      setTimeout(() => setHighlightedLine(null), 2000)
    }
  }, [highlightLine])

  // ... 기존 로직
}
```

#### 6.2 인라인 에러 마커

```tsx
// XmlEditor.tsx (CSS 클래스 추가)
;<pre
  ref={preRef}
  className="highlighted"
  dangerouslySetInnerHTML={{
    __html: highlightXmlWithErrors(escapedContent, errors),
  }}
/>

// utils/xml-highlighter.ts
function highlightXmlWithErrors(xml: string, errors: ValidationError[]): string {
  let result = highlightXml(xml)

  // 에러 위치에 마커 추가
  errors.forEach((error) => {
    if (error.line) {
      const lineIndex = error.line - 1
      // 해당 라인에 error-marker 클래스 추가 (placeholder 방식)
      result = addErrorMarker(result, lineIndex, error.severity)
    }
  })

  return result
}
```

### 7. 사용자 설정 저장

#### 7.1 설정 구조

```typescript
// stores/settings.ts (새로운 store)
interface SettingsState {
  // UI 설정
  validationPanelWidth: number
  sidebarWidth: number
  showLineNumbers: boolean
  autoFormat: boolean

  // 검증 설정
  maxErrors: number
  validationFilters: {
    error: boolean
    warning: boolean
    info: boolean
  }

  // 국제화
  locale: 'ko' | 'en'

  // 액션
  updateSettings: (updates: Partial<SettingsState>) => void
  resetSettings: () => void
}

export const useSettingsStore = create<SettingsState>(
  persist(
    (set) => ({
      validationPanelWidth: 300,
      sidebarWidth: 280,
      showLineNumbers: true,
      autoFormat: true,
      maxErrors: 100,
      validationFilters: { error: true, warning: true, info: true },
      locale: 'ko',

      updateSettings: (updates) => set(updates),
      resetSettings: () => set(getDefaultSettings()),
    }),
    {
      name: 'ooxml-validator-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
```

#### 7.2 설정 UI

```tsx
// components/SettingsDialog.tsx (새로운 컴포넌트)
export function SettingsDialog({ isOpen, onClose }: Props) {
  const { t } = useTranslation()
  const settings = useSettingsStore()

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>{t('settings.title')}</DialogTitle>
      <DialogContent>
        <SettingsSection title={t('settings.general')}>
          <Select
            label={t('settings.language')}
            value={settings.locale}
            onChange={(e) => settings.updateSettings({ locale: e.target.value })}
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </Select>
        </SettingsSection>

        <SettingsSection title={t('settings.validation')}>
          <NumberInput
            label={t('settings.maxErrors')}
            value={settings.maxErrors}
            onChange={(v) => settings.updateSettings({ maxErrors: v })}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.editor')}>
          <Checkbox
            checked={settings.showLineNumbers}
            onChange={(e) => settings.updateSettings({ showLineNumbers: e.target.checked })}
          >
            {t('settings.showLineNumbers')}
          </Checkbox>

          <Checkbox
            checked={settings.autoFormat}
            onChange={(e) => settings.updateSettings({ autoFormat: e.target.checked })}
          >
            {t('settings.autoFormat')}
          </Checkbox>
        </SettingsSection>
      </DialogContent>
    </Dialog>
  )
}
```

## 구현 우선순위

### Phase 1: 핵심 개선 (즉시)

1. ✅ Severity 레벨 추가 (`ValidationError` 인터페이스 확장)
2. ✅ 에러 카테고리 추가 (`category` 필드)
3. ✅ 필터 UI 구현 (`ValidationPanel` 개선)
4. ✅ 정렬 옵션 추가

### Phase 2: 사용성 개선 (단기)

5. ✅ 검색 기능 구현
6. ✅ 에러 복사/내보내기 (JSON, CSV, 클립보드)
7. ✅ 검증 진행 상태 표시

### Phase 3: 고급 기능 (중기)

8. ✅ 국제화 (i18n) 통합 (ko/en)
9. ✅ 에러 위치로 자동 스크롤
10. ✅ 인라인 에러 마커
11. ✅ 사용자 설정 저장/불러오기

### Phase 4: 완성도 향상 (장기)

12. ⏰ 다크/라이트 테마 전환
13. ⏰ 검증 프로파일 저장 (특정 에러 무시 규칙)
14. ⏰ 에러 통계 차트 (파트별, 카테고리별)
15. ⏰ 일괄 검증 (여러 파일)

## 패키지 간 통합 포인트

### @ooxml/core ← @ooxml/desktop

- `ValidationError` 인터페이스 확장 (severity, category, expected)
- `ValidationEngine` 옵션 확장 (progressCallback)

### @ooxml/parser ← @ooxml/desktop

- 스트리밍 파싱 진행 상태 콜백 (optional)

### @ooxml/core → i18n 메시지

- 에러 코드별 메시지 템플릿 정의
- `error-messages.json` (core 패키지에서 추출)

## 예상 파일 구조 (변경/추가)

```
packages/desktop/src/
├── main/
│   └── index.ts               # 검증 핸들러 수정 (진행 상태)
├── renderer/
│   ├── App.tsx                # 설정 다이얼로그 추가
│   ├── i18n/
│   │   ├── index.ts           # i18next 초기화
│   │   └── locales/
│   │       ├── ko.json        # 한국어 메시지
│   │       └── en.json        # 영어 메시지
│   ├── stores/
│   │   ├── document.ts        # 기존
│   │   └── settings.ts        # 새로운 설정 store
│   ├── components/
│   │   ├── ValidationPanel.tsx # 필터/검색/정렬 추가
│   │   ├── ValidationError.tsx # 새로운 에러 상세 컴포넌트
│   │   ├── ValidationProgress.tsx # 새로운 진행 상태 컴포넌트
│   │   ├── SettingsDialog.tsx # 새로운 설정 대화상자
│   │   ├── XmlEditor.tsx      # 에러 하이라이트 추가
│   │   └── ui/                # 새로운 공통 UI 컴포넌트
│   │       ├── Checkbox.tsx
│   │       ├── SearchBox.tsx
│   │       ├── Dropdown.tsx
│   │       └── Badge.tsx
│   └── utils/
│       ├── error-export.ts    # 새로운 내보내기 유틸
│       └── xml-highlighter.ts # 에러 마커 추가

packages/core/src/
├── types.ts                   # ValidationError 확장
└── error-messages.json        # 새로운 에러 메시지 템플릿
```

## 의존성 추가

```json
// packages/desktop/package.json
{
  "dependencies": {
    "react-i18next": "^14.0.0",
    "i18next": "^23.7.0",
    "zustand": "^4.4.0", // 기존
    "papaparse": "^5.4.1" // CSV 내보내기
  }
}
```

## 성능 고려사항

### 대용량 에러 목록 처리

- **가상 스크롤링**: `react-window` 사용 (1000+ 에러 처리)
- **Lazy 로딩**: 에러 상세 정보 on-demand
- **메모이제이션**: 필터/정렬 결과 캐싱 (`useMemo`)

### 검증 성능

- **웹 워커**: 검증 로직을 워커로 이동 (UI 블로킹 방지)
- **스트리밍**: 파트별 결과 실시간 전송
- **캔슬**: 진행 중인 검증 중단 기능

## 테스트 전략

### 단위 테스트

- `error-export.ts` 유틸 함수
- `xml-highlighter.ts` 하이라이트 로직
- i18n 메시지 키 일관성

### 통합 테스트

- 필터/검색/정렬 조합 시나리오
- 검증 진행 상태 이벤트 처리
- 설정 저장/복원

### E2E 테스트

- 에러 클릭 → 에디터 스크롤
- 내보내기 → 파일 생성 확인
- 언어 전환 → UI 번역 확인

## 마이그레이션 계획

### 기존 사용자 데이터

- 설정 스토어는 localStorage 사용 (자동 저장)
- 기존 파일 호환성 유지 (검증 결과 구조 변경 없음)

### 하위 호환성

- `ValidationError`의 새 필드는 optional
- 기존 에러 핸들러는 새 필드 무시 가능

## 다음 단계

1. **Task #3 (I18n 전략)**과 협업: 에러 메시지 키 체계 통일
2. **Task #2 (Compositor 분해)**과 협업: 에러 카테고리 매핑
3. Phase 1 구현 시작: `ValidationError` 인터페이스 확장

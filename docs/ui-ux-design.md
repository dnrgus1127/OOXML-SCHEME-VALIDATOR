# UI/UX 설계 문서

## 목차

1. [홈 화면 설계](#홈-화면-설계)
2. [배치 검증 툴 화면 설계](#배치-검증-툴-화면-설계)
3. [컴포넌트 구조](#컴포넌트-구조)
4. [사용자 플로우](#사용자-플로우)
5. [스타일 가이드](#스타일-가이드)

---

## 홈 화면 설계

### 개요

사용자가 앱을 처음 실행하면 나타나는 홈 화면으로, 사용 가능한 툴들을 카드 기반으로 제시합니다.

### 와이어프레임

```
┌─────────────────────────────────────────────────────────────┐
│  Toolbar (기존과 동일)                                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│                     OOXML Validator                          │
│                                                               │
│     ┌──────────────────────┐   ┌──────────────────────┐    │
│     │    📝 XML Editor     │   │   📊 Batch Validator  │    │
│     │                      │   │                        │    │
│     │  단일 OOXML 파일을   │   │  여러 파일을 한번에    │    │
│     │  열어 XML 파트를     │   │  검증하고 결과를       │    │
│     │  편집하고 검증합니다 │   │  보고서로 내보냅니다   │    │
│     │                      │   │                        │    │
│     │  [Open File]         │   │  [Select Files]        │    │
│     └──────────────────────┘   └──────────────────────┘    │
│                                                               │
│                                                               │
│                      Recent Files (optional)                 │
│                      - document1.xlsx                        │
│                      - presentation.pptx                      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 레이아웃 상세

#### 1. 헤더
- 타이틀: "OOXML Validator"
- 서브타이틀: "Choose a tool to get started"
- 중앙 정렬, 상단 여백 80px

#### 2. 툴 카드 그리드
- 2열 그리드 레이아웃 (향후 3-4개까지 확장 가능)
- 카드 크기: 280px × 320px
- 간격: 24px
- 중앙 정렬

#### 3. 각 카드 구성
- **아이콘 영역**: 상단, 48px 크기, 중앙 정렬
- **제목**: 16px, 600 weight, 중앙 정렬
- **설명**: 13px, 텍스트 색상 secondary, 3줄 제한
- **액션 버튼**: 하단 고정, 전체 너비, 높이 36px

#### 4. 최근 파일 (선택사항)
- 하단에 표시
- 최대 5개 항목
- 파일명 + 마지막 열람 시간
- 클릭 시 해당 툴로 바로 진입

### 스타일

```css
.home-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 40px;
  overflow-y: auto;
}

.home-header {
  text-align: center;
  margin-bottom: 48px;
}

.home-title {
  font-size: 32px;
  font-weight: 300;
  margin-bottom: 8px;
}

.home-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(2, 280px);
  gap: 24px;
  margin-bottom: 48px;
}

.tool-card {
  display: flex;
  flex-direction: column;
  padding: 32px 24px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.tool-card:hover {
  border-color: var(--accent);
  box-shadow: 0 4px 12px rgba(0, 120, 212, 0.15);
  transform: translateY(-2px);
}

.tool-icon {
  font-size: 48px;
  text-align: center;
  margin-bottom: 16px;
}

.tool-title {
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 12px;
}

.tool-description {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.5;
  margin-bottom: 24px;
  flex: 1;
}

.tool-action {
  width: 100%;
  padding: 10px 16px;
  background: var(--accent);
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.tool-action:hover {
  opacity: 0.9;
}

.recent-files {
  width: 100%;
  max-width: 600px;
}

.recent-files-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-secondary);
}

.recent-file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.recent-file-item:hover {
  background: var(--bg-hover);
}

.recent-file-name {
  font-family: var(--font-mono);
  font-size: 12px;
}

.recent-file-time {
  font-size: 11px;
  color: var(--text-muted);
}
```

---

## 배치 검증 툴 화면 설계

### 개요

여러 OOXML 파일을 동시에 검증하고, 결과를 트리 구조로 표시하며, 다양한 형식으로 내보낼 수 있는 툴입니다.

### 와이어프레임

```
┌────────────────────────────────────────────────────────────────┐
│  Toolbar: [← Home] [+ Add Files] [🗑 Clear] [Validate] [Export]│
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  📁 File Selection Area (드래그 앤 드롭 또는 클릭)         │  │
│  │                                                            │  │
│  │  Drop files here or click to select                       │  │
│  │  Supports: .xlsx, .docx, .pptx                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ⏳ Validating... 3/5 files (60%)                         │  │
│  │  ████████████░░░░░░░░                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  📊 Validation Summary                                    │  │
│  │  Total: 5 files | ✓ Valid: 3 | ✗ Invalid: 2 | Errors: 12│  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  📋 Results Tree                                          │  │
│  │                                                            │  │
│  │  ▼ 📄 document1.xlsx                          ✓           │  │
│  │    ▶ 📑 xl/workbook.xml                       ✓           │  │
│  │    ▼ 📑 xl/worksheets/sheet1.xml              ✗ (3)       │  │
│  │      ⚠ Invalid element: <unknown>                         │  │
│  │      ⚠ Missing required attribute: "name"                 │  │
│  │      ⚠ Type mismatch: expected number, got string         │  │
│  │                                                            │  │
│  │  ▼ 📄 presentation.pptx                       ✗ (9)       │  │
│  │    ▶ 📑 ppt/presentation.xml                  ✓           │  │
│  │    ▼ 📑 ppt/slides/slide1.xml                 ✗ (9)       │  │
│  │      ...                                                   │  │
│  │                                                            │  │
│  │  ▶ 📄 report.docx                             ✓           │  │
│  │                                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

### 레이아웃 상세

#### 1. Toolbar (상단 고정)
- **Home 버튼**: 홈 화면으로 돌아가기
- **Add Files 버튼**: 파일 추가 대화상자
- **Clear 버튼**: 모든 파일 제거 (확인 대화상자)
- **Validate 버튼**: 검증 시작 (파일이 있을 때만 활성화)
- **Export 버튼**: 드롭다운 메뉴 (HTML, JSON, CSV, PDF)

#### 2. File Selection Area
- 파일이 없을 때만 표시
- 드래그 앤 드롭 지원
- 클릭 시 파일 선택 대화상자
- 지원 확장자 표시

#### 3. Progress Bar (검증 진행 중일 때)
- 높이: 8px
- 배경: `var(--bg-tertiary)`
- 진행 바: `var(--accent)`
- 진행 상태 텍스트: "Validating... N/M files (XX%)"
- 전체 너비, 부드러운 애니메이션 (0.3s ease)

#### 4. Validation Summary
- 파일이 추가되면 표시
- 총 파일 수, 유효/무효 파일 수, 총 오류 수
- 색상 코딩 (유효: 초록, 무효: 빨강)

#### 5. Results Tree
- 3단계 계층 구조: 파일 > XML 파트 > 오류 상세
- 파일 레벨:
  - 파일명 + 상태 아이콘 + 오류 개수 (있을 경우)
  - 접기/펼치기 토글
- 파트 레벨:
  - 파트 경로 + 상태 아이콘 + 오류 개수
  - 접기/펼치기 토글
- 오류 레벨:
  - 오류 코드, 메시지, 위치 (라인/컬럼)
  - 값 정보 (있을 경우)

### 스타일

```css
.batch-validator {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.batch-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.batch-toolbar-btn {
  padding: 6px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.batch-toolbar-btn:hover:not(:disabled) {
  background: var(--bg-hover);
}

.batch-toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.batch-toolbar-btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.batch-toolbar-btn--danger {
  color: var(--error);
}

.batch-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.batch-progress {
  margin-bottom: 24px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}

.progress-text {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.file-drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 40px;
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 24px;
}

.file-drop-zone:hover,
.file-drop-zone.drag-over {
  border-color: var(--accent);
  background: var(--bg-tertiary);
}

.drop-zone-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.drop-zone-text {
  font-size: 16px;
  margin-bottom: 8px;
}

.drop-zone-hint {
  font-size: 13px;
  color: var(--text-secondary);
}

.batch-summary {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-bottom: 24px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.summary-item.total {
  font-weight: 600;
}

.summary-item.valid {
  color: var(--success);
}

.summary-item.invalid {
  color: var(--error);
}

.summary-divider {
  width: 1px;
  height: 20px;
  background: var(--border-color);
}

.batch-results-tree {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
}

.tree-file-item {
  border-bottom: 1px solid var(--border-color);
}

.tree-file-item:last-child {
  border-bottom: none;
}

.tree-file-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  cursor: pointer;
  background: var(--bg-tertiary);
  transition: background 0.2s;
}

.tree-file-header:hover {
  background: var(--bg-hover);
}

.tree-expand-icon {
  width: 16px;
  font-size: 10px;
  color: var(--text-secondary);
  transition: transform 0.2s;
}

.tree-expand-icon.expanded {
  transform: rotate(90deg);
}

.tree-file-icon {
  font-size: 16px;
}

.tree-file-name {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 13px;
}

.tree-file-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.tree-file-status.valid {
  color: var(--success);
}

.tree-file-status.invalid {
  color: var(--error);
}

.tree-error-count {
  font-size: 11px;
  padding: 2px 6px;
  background: var(--error);
  color: white;
  border-radius: 10px;
}

.tree-parts-list {
  background: var(--bg-primary);
}

.tree-part-item {
  border-bottom: 1px solid var(--border-color);
}

.tree-part-item:last-child {
  border-bottom: none;
}

.tree-part-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 10px 40px;
  cursor: pointer;
  transition: background 0.2s;
}

.tree-part-header:hover {
  background: var(--bg-hover);
}

.tree-part-icon {
  font-size: 14px;
}

.tree-part-path {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.tree-part-status {
  font-size: 12px;
}

.tree-errors-list {
  background: var(--bg-tertiary);
  padding: 8px 0;
}

.tree-error-item {
  padding: 8px 16px 8px 64px;
  font-size: 11px;
  border-left: 3px solid var(--error);
  margin: 4px 16px 4px 56px;
  background: var(--bg-primary);
}

.tree-error-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.tree-error-code {
  background: var(--error);
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
}

.tree-error-location {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
}

.tree-error-message {
  color: var(--text-primary);
  margin-bottom: 2px;
}

.tree-error-path {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
}

.tree-error-value {
  color: var(--text-secondary);
  margin-top: 4px;
}

.tree-error-value code {
  background: var(--bg-secondary);
  padding: 2px 4px;
  border-radius: 2px;
  font-family: var(--font-mono);
  color: var(--warning);
}

.export-dropdown {
  position: relative;
  display: inline-block;
}

.export-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 100;
  min-width: 120px;
}

.export-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s;
}

.export-menu-item:hover {
  background: var(--bg-hover);
}

.export-menu-item:first-child {
  border-radius: 4px 4px 0 0;
}

.export-menu-item:last-child {
  border-radius: 0 0 4px 4px;
}
```

---

## 컴포넌트 구조

### 홈 화면 컴포넌트

```
HomeScreen.tsx
├── HomeHeader
├── ToolsGrid
│   ├── ToolCard (XML Editor)
│   └── ToolCard (Batch Validator)
└── RecentFiles (optional)
    └── RecentFileItem[]
```

### 배치 검증 툴 컴포넌트

```
BatchValidator.tsx
├── BatchToolbar
│   ├── HomeButton
│   ├── AddFilesButton
│   ├── ClearButton
│   ├── ValidateButton
│   └── ExportDropdown
│       └── ExportMenu
├── FileDropZone (파일 없을 때)
├── BatchSummary (파일 있을 때)
└── BatchResultsTree (검증 결과 있을 때)
    └── FileTreeItem[]
        ├── FileHeader
        └── PartsTree[]
            └── PartItem[]
                ├── PartHeader
                └── ErrorsList[]
                    └── ErrorItem[]
```

### 컴포넌트 Props 정의

```typescript
// HomeScreen.tsx
interface ToolCardProps {
  icon: string
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}

// BatchValidator.tsx
interface BatchValidatorProps {
  onNavigateHome: () => void
}

interface FileTreeItemProps {
  file: BatchFileResult
  expanded: boolean
  onToggle: () => void
}

interface PartItemProps {
  part: PartValidationResult
  expanded: boolean
  onToggle: () => void
}

interface ErrorItemProps {
  error: ValidationError
}

interface BatchFileResult {
  fileName: string
  filePath: string
  valid: boolean
  parts: PartValidationResult[]
  totalErrors: number
}

interface PartValidationResult {
  path: string
  valid: boolean
  errors?: ValidationError[]
}

interface ValidationError {
  code: string
  message: string
  path: string
  value?: string
  line?: number
  column?: number
}
```

---

## 사용자 플로우

### 1. 홈 화면 진입

```
앱 실행
  ↓
홈 화면 표시
  ↓
사용자가 툴 선택
  ├── XML Editor 선택 → 기존 XML Editor 화면으로 이동
  └── Batch Validator 선택 → 배치 검증 툴 화면으로 이동
```

### 2. 배치 검증 플로우

```
배치 검증 툴 진입
  ↓
파일 선택 (드래그 앤 드롭 또는 클릭)
  ↓
파일 목록 표시
  ↓
"Validate" 버튼 클릭
  ↓
검증 진행 (진행 표시)
  ↓
결과 트리 표시
  ├── 파일/파트 클릭 → 펼치기/접기
  ├── 오류 상세 확인
  └── "Export" 버튼 클릭
      ↓
      형식 선택 (HTML, JSON, CSV, PDF)
      ↓
      파일 저장 대화상자
      ↓
      보고서 저장 완료
```

### 3. 네비게이션 플로우

```
홈 화면
  ↓
XML Editor 또는 Batch Validator 선택
  ↓
작업 수행
  ↓
"Home" 버튼 클릭 (배치 검증 툴에서)
  ↓
홈 화면으로 돌아감
```

### 4. 에러 처리 플로우

```
파일 선택 오류 (지원하지 않는 형식)
  → 에러 배너 표시 + 무시

검증 오류 (파일 손상, 파싱 실패)
  → 해당 파일 "오류" 상태로 표시 + 오류 메시지

내보내기 오류 (권한 없음, 디스크 부족)
  → 에러 배너 표시 + 재시도 옵션
```

---

## 스타일 가이드

### 색상 팔레트 (기존 유지)

```css
:root {
  --bg-primary: #1e1e1e;       /* 주 배경 */
  --bg-secondary: #252526;     /* 카드, 패널 배경 */
  --bg-tertiary: #2d2d2d;      /* 버튼, 입력 필드 배경 */
  --bg-hover: #3c3c3c;         /* 호버 상태 */
  --bg-selected: #094771;      /* 선택 상태 */
  --text-primary: #cccccc;     /* 주 텍스트 */
  --text-secondary: #858585;   /* 보조 텍스트 */
  --text-muted: #6e6e6e;       /* 비활성 텍스트 */
  --border-color: #3c3c3c;     /* 테두리 */
  --accent: #0078d4;           /* 강조 색상 (파란색) */
  --success: #4ec9b0;          /* 성공 (초록색) */
  --error: #f14c4c;            /* 오류 (빨간색) */
  --warning: #dcdcaa;          /* 경고 (노란색) */
  --font-mono: 'Consolas', 'Monaco', 'Courier New', monospace;
}
```

### 타이포그래피

- **제목 (H1)**: 32px, 300 weight, `--text-primary`
- **서브타이틀 (H2)**: 24px, 400 weight, `--text-primary`
- **헤딩 (H3)**: 16px, 600 weight, `--text-primary`
- **본문**: 13px, 400 weight, `--text-primary`
- **보조 텍스트**: 12px, 400 weight, `--text-secondary`
- **소형 텍스트**: 11px, 400 weight, `--text-muted`
- **코드/경로**: 12px, 400 weight, `var(--font-mono)`

### 간격

- **XS**: 4px (아이콘-텍스트 간격)
- **SM**: 8px (버튼 간격, 패딩)
- **MD**: 16px (카드 내부 패딩, 섹션 간격)
- **LG**: 24px (그리드 간격, 섹션 여백)
- **XL**: 48px (페이지 상단 여백)

### 테두리 반경

- **작은 요소** (버튼, 태그): 3-4px
- **중간 요소** (카드, 입력 필드): 6-8px
- **큰 요소** (모달, 드롭존): 8-12px

### 전환 효과

- **빠른 전환** (호버, 포커스): 0.2s ease
- **중간 전환** (펼치기/접기): 0.3s ease
- **느린 전환** (모달 등장): 0.4s ease-out

### 그림자

- **카드 호버**: `0 4px 12px rgba(0, 120, 212, 0.15)`
- **드롭다운 메뉴**: `0 4px 12px rgba(0, 0, 0, 0.3)`
- **모달**: `0 8px 24px rgba(0, 0, 0, 0.4)`

### 아이콘

- **파일 타입**: 📄 (일반), 📊 (Excel), 📝 (Word), 🎨 (PowerPoint)
- **XML 파트**: 📑
- **폴더**: 📁
- **상태**: ✓ (유효), ✗ (무효), ⚠ (경고)
- **액션**: ← (뒤로), + (추가), 🗑 (삭제), 💾 (저장), → (이동)
- **펼치기/접기**: ▶ (접힘), ▼ (펼쳐짐)

---

## 반응형 고려사항

### 최소 창 크기
- 너비: 800px
- 높이: 600px

### 창 크기 조정 시
- 홈 화면 툴 그리드: 창이 작아지면 1열로 전환 (600px 이하)
- 배치 검증 툴: 최소 너비 유지, 스크롤 표시
- 트리 항목: 텍스트 잘림 처리 (`text-overflow: ellipsis`)

---

## 접근성

### 키보드 네비게이션
- Tab 키로 모든 인터랙티브 요소 이동
- Enter/Space로 버튼 및 카드 활성화
- 화살표 키로 트리 네비게이션 (선택사항)

### 스크린 리더
- 모든 버튼에 aria-label 제공
- 상태 변경 시 aria-live 영역 업데이트
- 트리 구조에 적절한 ARIA 역할 부여 (role="tree", role="treeitem")

### 색상 대비
- WCAG AA 기준 준수 (4.5:1 이상)
- 상태를 색상만으로 표시하지 않음 (아이콘 병행)

---

## 구현 우선순위

### Phase 1: 기본 구조
1. HomeScreen 컴포넌트 구현
2. 라우팅 설정 (홈 ↔ XML Editor ↔ Batch Validator)
3. BatchValidator 기본 레이아웃 (Toolbar, 파일 선택 영역)

### Phase 2: 핵심 기능
4. 파일 선택 및 목록 표시
5. 배치 검증 로직 통합
6. 결과 트리 구조 표시

### Phase 3: 상세 기능
7. 트리 펼치기/접기 인터랙션
8. Export 기능 (HTML, JSON 우선)
9. 에러 처리 및 로딩 상태

### Phase 4: 개선
10. 최근 파일 목록 (선택사항)
11. 드래그 앤 드롭 지원
12. CSV, PDF Export 추가
13. 접근성 개선

---

## 참고 사항

- 기존 `globals.css`의 CSS 변수를 최대한 재사용하여 일관성 유지
- Monaco Editor 통합과 유사하게, 점진적으로 기능 추가
- 모든 컴포넌트는 TypeScript로 작성하며 명확한 Props 인터페이스 정의
- Zustand를 활용한 상태 관리 (배치 검증 결과, 선택된 파일 등)
- 기존 IPC 통신 패턴을 따라 메인 프로세스와 통신

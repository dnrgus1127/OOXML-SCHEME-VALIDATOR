# macOS Window Controls(traffic lights) 침범 방지 설계 계획

## 1) 배경과 문제 정의

현재 데스크탑 앱은 Electron `BrowserWindow`에서 `titleBarStyle: 'hiddenInset'`을 사용한다. 이 모드는 macOS의 좌상단 window controls(닫기/최소화/확대)가 웹 콘텐츠 영역 위로 겹칠 수 있기 때문에, 상단 헤더/툴바에 안전 여백(safe area)을 강제하지 않으면 버튼/제목/검색 입력이 침범될 수 있다.

현재 코드에는 `.app--mac .toolbar-left`, `.app--mac .batch-header`, `.app--mac .batch-toolbar`에 개별 `padding-left`를 주는 방식이 이미 존재한다. 즉, **화면별 예외 처리**로 대응 중이고, 새 화면/새 상단 컴포넌트가 생길 때 누락 위험이 있다.

---

## 2) 일반 macOS 앱/크로스플랫폼 앱에서의 처리 방식

### A. 네이티브(macOS/AppKit/SwiftUI)

- title bar 영역과 content 영역을 분리하고, 시스템이 제공하는 safe area를 사용해 자동 회피.
- 커스텀 툴바는 titlebar accessory 영역 또는 safe area insets 기반으로 배치.
- 핵심: "개별 화면 보정"이 아니라 "레이아웃 시스템"에 안전영역 규칙을 내장.

### B. Electron/크로스플랫폼 앱 (VS Code, Slack 류 패턴)

- 창 chrome 전략을 먼저 결정:
  - `titleBarStyle: 'default'`: 시스템 title bar 사용(침범 위험 낮음, 커스텀 제한 큼)
  - `hidden`/`hiddenInset`: 커스텀 UI 자유도 높음(침범 처리 책임이 앱에 있음)
  - `titleBarOverlay`: overlay 영역/높이 정보를 활용해 표준화된 보정 가능
- 렌더러에서는 CSS 변수(예: `--window-controls-offset-x`)로 여백 토큰화.
- 상단 인터랙션 컴포넌트는 공통 래퍼 컴포넌트를 통해 safe area를 자동 적용.
- 핵심: "플랫폼별 chrome 차이"를 design token + shell layout에서 흡수.

### C. 웹의 노치/안전영역 대응 패턴 차용

- `env(safe-area-inset-*)`와 fallback 변수를 결합해 안전영역을 계산.
- 중요 컴포넌트는 `padding-inline-start: calc(base + safe-area)` 형태로 설계.
- 핵심: 콘텐츠 컴포넌트는 시스템 inset 값을 직접 몰라도 되게 분리.

---

## 3) 현재 구조 기준 진단

### 강점

- macOS 여부를 `app--mac` 클래스로 구분하는 진입점이 이미 존재.
- 전역 CSS 토큰(`globals.css`)을 사용하는 구조라 설계 토큰 확장이 용이.

### 리스크

- 특정 클래스(`toolbar-left`, `batch-header`, `batch-toolbar`)만 수동 보정.
- 새로운 상단 영역 컴포넌트가 추가될 때 침범 버그가 재발 가능.
- 화면별로 padding 계산식이 중복되어 유지보수 비용이 증가.

---

## 4) 권장 설계 방향 (핵심)

> **규칙을 화면이 아니라 "프레임 컴포넌트"에 넣는다.**

### 4.1 레이아웃 책임 분리

- `AppFrame`(또는 `WindowFrame`) 컴포넌트를 도입해 상단 영역 전체의 안전영역 책임을 집중.
- `TopBar`, `PageHeader`, `BatchHeader`는 직접 mac 보정값을 계산하지 않고 frame 토큰만 소비.

### 4.2 Design Token 표준화

- 최소 토큰 세트 제안:
  - `--window-safe-top`
  - `--window-safe-left`
  - `--window-safe-right`
  - `--window-controls-gutter-inline-start`
  - `--topbar-content-padding-inline`
- 계산 예시:
  - `--topbar-leading-safe-padding: calc(var(--topbar-content-padding-inline) + var(--window-controls-gutter-inline-start));`

### 4.3 컴포넌트 계약(Contract)

- 상단 UI 공통 컴포넌트는 다음 API를 갖도록 고정:
  - `leading`, `center`, `trailing` 슬롯
  - `draggable?: boolean` (Electron drag region 제어)
  - `respectWindowControls?: boolean` (기본 true)
- 결과적으로 모든 상단 액션 버튼은 자동으로 no-drag + safe padding이 적용.

### 4.4 플랫폼 어댑터 계층

- `useWindowChromeMetrics()` 훅으로 플랫폼별 메트릭 제공:
  - mac + hiddenInset: 좌측 controls 여백 반영
  - windows/linux: 기본 0 또는 overlay 기반 값
- 이후 창 옵션 변경(`titleBarOverlay` 전환 등)에도 렌더러 컴포넌트 변경 최소화.

---

## 5) 단계별 실행 계획

### Phase 1 — 규칙 고정 (빠른 안정화)

1. 현재 하드코딩 여백을 토큰 중심으로 통합.
2. 상단 영역 공통 스타일 클래스(`.window-topbar`, `.window-topbar__leading`) 도입.
3. 기존 `toolbar`, `batch-header`, `batch-toolbar`를 공통 클래스 사용으로 치환.

### Phase 2 — 컴포넌트화

1. `renderer/components/layout/WindowFrame.tsx` 생성.
2. `HomeScreen`, `XmlEditorScreen`, `BatchValidator`의 상단 영역을 `WindowFrame` 기반으로 마이그레이션.
3. 스토리/스냅샷 또는 화면 테스트로 "mac controls 침범 없음" 회귀 방지.

### Phase 3 — 런타임 메트릭 고도화

1. 메인 프로세스에서 창 chrome 메트릭(플랫폼, titlebar style, overlay height 등) 제공.
2. preload 통해 renderer로 안전 전달.
3. CSS 변수 동적 주입으로 고정값 의존도 제거.

### Phase 4 — 품질 게이트 내재화

1. UI PR 체크리스트에 "mac traffic lights safe area 검증" 항목 추가.
2. 신규 상단 컴포넌트는 `WindowFrame` 외 직접 구현 금지 규칙화.

---

## 6) 컴포넌트 설계 제안 (실무 기준)

### 제안 A (권장): Shell 중심 단일 프레임

- 구조:
  - `WindowFrame`
    - `WindowTopBar`
    - `WindowContent`
- 장점:
  - 규칙이 한 곳에 모여 누락 가능성이 가장 낮음
  - 상단 상호작용/drag region/a11y 규칙 통합 쉬움
- 단점:
  - 초기 마이그레이션 비용 발생

### 제안 B: 기존 화면 유지 + SafeArea 래퍼 도입

- 구조:
  - 기존 컴포넌트 유지
  - `MacTrafficLightSafeArea` 래퍼로 leading 영역만 보호
- 장점:
  - 도입이 빠름
- 단점:
  - 레이아웃 파편화가 남고 장기적으로 누락 위험 유지

**결론:** 현재 프로젝트 규모와 유지보수성을 고려하면 **A안(WindowFrame 중심)**이 적합.

---

## 7) 디자인/UX 체크포인트

- 상단 주요 CTA가 traffic lights와 최소 12~16px 이상의 시각적 분리 유지.
- `-webkit-app-region: drag`와 `no-drag` 영역이 명확히 분리되어 클릭 손실 방지.
- 다국어(문구 길이 증가)에서도 leading 영역이 겹치지 않도록 우선순위 규칙 정의.
- 키보드 포커스 이동 시 첫 포커스 요소가 hidden controls 영역으로 시각적으로 눌려 보이지 않게 보장.

---

## 8) 최종 권고

1. macOS 안전영역을 "화면별 padding"이 아니라 "WindowFrame 계약"으로 승격.
2. CSS 변수 토큰으로 수치 책임을 분리하고, 상단 UI는 토큰만 소비.
3. 이후 `titleBarOverlay` 또는 플랫폼별 chrome 정책 변경에도 UI 계층 수정 범위를 최소화.
4. 코드리뷰 체크리스트에 안전영역 검증을 명시해 재발을 차단.

이 방식이면 "항상 저 부분을 고려하도록" 구조적으로 강제할 수 있다.

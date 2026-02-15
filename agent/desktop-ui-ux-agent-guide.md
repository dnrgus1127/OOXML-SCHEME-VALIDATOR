# @ooxml/desktop AI Agent Design & UI/UX Guide

## 1) Purpose

이 문서는 `@ooxml/desktop`(Electron + React) UI를 설계/구현하는 AI 에이전트가
일관된 품질 기준으로 작업하기 위한 필수 가이드다.

- 목표: 사용성, 접근성, 일관성, 성능, 유지보수성의 최소 기준을 보장한다.
- 대상: `packages/desktop/src/renderer` 내 화면/컴포넌트/스타일 변경 작업.
- 원칙: "보기 좋은 UI"보다 "업무 성공률이 높은 UI"를 우선한다.

## 2) Mandatory Rule For Agents

UI/UX 관련 작업을 시작하기 전에 에이전트는 반드시 이 파일을 먼저 읽는다.

- UI/UX 작업 범위:
  - 레이아웃, 정보 구조(IA), 컴포넌트 추가/변경
  - 색상/타이포그래피/간격/모션/테마
  - 폼, 검증 메시지, 피드백, 에러 처리
  - 접근성(키보드/포커스/명도대비/스크린리더)
  - 작업 흐름/탐색 구조/사용성 최적화
- 위 범위에 해당하면 "코드 작성 전" 아래를 수행:
  1. 현재 구현(`packages/desktop/src/renderer`)과 이 가이드의 충돌 여부 확인
  2. 변경 UI의 사용자 작업(Task)과 성공 기준 정의
  3. 접근성/상태 전이/오류 복구 시나리오를 포함한 설계 후 구현

## 3) Desktop UX Baseline (Must)

### 3.1 플랫폼 일관성

- macOS/Windows 공통으로 학습 가능한 패턴을 유지한다.
- 네이티브 앱 기대치(툴바 행동, 단축키, 포커스 이동, 파일 다이얼로그 흐름)를 깨지 않는다.
- 새 UI는 기존 토큰(`globals.css`의 CSS 변수)과 시각 언어를 우선 재사용한다.

### 3.2 사용성 휴리스틱 (NN/g 10 heuristics 적용)

- 시스템 상태 가시성: 실행 중/완료/실패 상태를 즉시 보여준다.
- 사용자 언어 사용: 내부 구현 용어 대신 사용자 작업 용어를 쓴다.
- 사용자 제어와 자유: 취소/닫기/되돌리기 경로를 제공한다.
- 일관성과 표준: 같은 의미는 같은 컴포넌트/문구/색을 사용한다.
- 에러 예방: 위험 작업 전 확인, 입력 제약, 선제적 검증을 제공한다.
- 기억 부담 최소화: 선택지는 보이게 만들고 기억에 의존하지 않는다.
- 효율성: 초보자와 고급 사용자 모두를 위한 단축 경로(단축키/빠른 액션)를 제공한다.
- 미니멀리즘: 현재 작업에 필요한 정보만 노출한다.
- 에러 복구 지원: 무엇이 왜 잘못됐는지, 다음 행동을 제시한다.
- 도움말/가이드: 복잡한 도메인(OOXML 구조)은 맥락형 도움말로 지원한다.

### 3.3 접근성 (WCAG 2.2 AA 최소)

- 키보드 전면 지원: 모든 인터랙션은 키보드만으로 수행 가능해야 한다.
- 명확한 포커스: 포커스 표시를 제거하지 않는다.
- 색 대비: 일반 텍스트는 4.5:1 이상, 큰 텍스트는 3:1 이상.
- 터치/포인터 타깃: 최소 24x24 CSS px 이상(예외 조건은 WCAG 기준 따름).
- 색만으로 상태 전달 금지: 아이콘/텍스트/패턴 등 보조 신호를 함께 제공한다.
- ARIA는 WAI-ARIA APG 패턴을 따르고, 네이티브 HTML 시맨틱을 우선 사용한다.

### 3.4 피드백과 오류 UX

- 사용자 액션 후 즉시 시각적 피드백을 준다(로딩, 진행률, 결과).
- 에러 메시지는 원인 + 영향 + 해결 행동을 한 번에 제공한다.
- 검증 실패는 "문서 전체 실패"가 아니라 "수정 가능한 단위"로 분해해 보여준다.
- 파괴적 작업(삭제/초기화)은 되돌리기 또는 재확인 경로를 둔다.

### 3.5 성능 UX

- 입력/클릭 이후 체감 지연을 줄이기 위해 INP 관점으로 상호작용 지연을 관리한다.
- 대용량 XML/트리 렌더링은 가상화, 청크 처리, 지연 로딩을 우선 검토한다.
- 긴 작업은 블로킹 대신 백그라운드 처리 + 진행상태 UI를 제공한다.

### 3.6 Electron 전용 고려사항

- 접근성 트리는 Electron 접근성 API 동작을 기준으로 확인한다.
- 보안 기본값(`contextIsolation`, Node.js 통합 제한 등)을 훼손하는 UI 편의 구현을 금지한다.
- 렌더러-메인 프로세스 경계는 preload API로 명시하고, UI 계층에서 직접 Node API를 호출하지 않는다.

## 4) Design System & Implementation Rules

- 토큰 우선: 색/간격/타이포는 하드코딩보다 CSS 변수 확장을 우선한다.
- 컴포넌트 우선: 동일 패턴을 새로 만들지 말고 재사용/확장한다.
- 상태 모델 명시: 각 화면은 `idle | loading | success | empty | error` 상태를 설계에 포함한다.
- 문구 규칙:
  - 버튼은 동사형(`Validate`, `Export Report`)으로 작성
  - 에러는 비난형 문구 금지, 조치 가능 문장 사용
- 모션 규칙:
  - 모션은 의미가 있을 때만 사용(상태 전이/주의 환기)
  - 과도한 애니메이션 금지, 감속/비활성 환경을 고려
- 다국어 준비:
  - 텍스트 길이 증가를 고려한 레이아웃(고정 폭 버튼 남용 금지)
  - 날짜/숫자/파일 크기 표시는 locale 친화적으로 처리

## 5) UX Delivery Checklist (Before Merge)

- [ ] 핵심 사용자 작업 3개 이상에 대해 시작-완료 플로우가 끊기지 않는다.
- [ ] 키보드만으로 모든 주요 액션 수행 가능(Tab/Shift+Tab/Enter/Esc).
- [ ] 포커스 표시가 모든 인터랙티브 요소에서 확인된다.
- [ ] 대비/가독성 기준(WCAG 2.2 AA)을 충족한다.
- [ ] 빈 상태/로딩/오류/성공 상태 UI가 모두 정의되어 있다.
- [ ] 오류 메시지에 해결 방법(다음 행동)이 포함되어 있다.
- [ ] 대용량 데이터에서 UI 프리즈 없이 진행상태를 제공한다.
- [ ] 기존 토큰/컴포넌트 체계를 우선 활용했다.
- [ ] 스크린샷 또는 짧은 GIF로 변경 UX를 PR에 첨부했다.

## 6) 8+ Year UI/UX Engineer Knowledge Baseline (Minimum)

아래 항목은 시니어(8년+) 수준의 최소 역량으로 간주하며, 에이전트 설계 판단의 기준으로 사용한다.

1. Problem Framing
   - 사용자 문제/비즈니스 목표/기술 제약을 분리해 정의한다.
   - 기능 요청을 그대로 구현하지 않고, 작업 성공 기준(Task success)으로 재정의한다.
2. Information Architecture
   - 탐색 구조, 화면 계층, 객체 모델을 사용자의 멘탈 모델과 맞춘다.
   - 검색/필터/정렬/드릴다운의 조합을 일관되게 설계한다.
3. Interaction Design
   - 상태 전이(정상/예외/경계 조건)를 먼저 설계하고 UI를 입힌다.
   - 단축키/멀티 선택/배치 작업 등 파워유저 효율을 함께 고려한다.
4. Accessibility Engineering
   - WCAG 2.2 AA, ARIA APG, 키보드/포커스/의미 구조를 코드 레벨에서 검증한다.
   - "접근성 옵션"이 아니라 기본 품질 기준으로 적용한다.
5. Visual Systems
   - 타이포 스케일, 대비, 간격 시스템, 정보 밀도를 목적에 맞게 제어한다.
   - 장식보다 판독성과 우선순위 전달을 중시한다.
6. Content Design
   - 마이크로카피로 행동 유도와 오류 복구를 지원한다.
   - 경고/오류/성공 메시지의 톤과 책임 주체를 일관되게 유지한다.
7. Metrics & Experimentation
   - HEART/과업 성공률/완료 시간/오류율 등 UX 지표를 정의한다.
   - 변화의 효과를 정성+정량으로 검증하고 회귀를 감시한다.
8. Delivery & Collaboration
   - 설계 의도를 컴포넌트 계약(Props, 상태, 이벤트)으로 명확히 전달한다.
   - 디자인 QA, 접근성 QA, 성능 QA를 배포 전 품질 게이트로 운영한다.

## 7) References (Researched on 2026-02-15)

- W3C, Web Content Accessibility Guidelines (WCAG) 2.2: https://www.w3.org/TR/WCAG22/
- W3C, What's New in WCAG 2.2: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- W3C, WAI-ARIA Authoring Practices Guide (APG): https://www.w3.org/WAI/ARIA/apg/
- Nielsen Norman Group, 10 Usability Heuristics for UI Design: https://www.nngroup.com/articles/ten-usability-heuristics/
- Google, INP (Interaction to Next Paint): https://web.dev/articles/inp
- Google Research, HEART framework: https://research.google/pubs/the-heart-framework-for-measuring-user-experience-in-at-scale-web-applications/
- Electron Docs, Accessibility: https://www.electronjs.org/docs/latest/tutorial/accessibility
- Electron Docs, Security Tutorial: https://www.electronjs.org/docs/latest/tutorial/security
- Microsoft Fluent 2 Design System: https://fluent2.microsoft.design/
- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/

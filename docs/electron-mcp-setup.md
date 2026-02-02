# Electron 환경설정 및 MCP 연결 가이드

이 문서는 데스크톱(Electron) 환경설정/실행 방법과 MCP 서버를 Codex 및 Claude에 연결하는 절차를 정리합니다.

## Electron 환경설정

### 구성 요약

- 데스크톱 앱은 `electron-vite`를 사용하며, `main/preload/renderer` 세 파트로 빌드됩니다.【F:packages/desktop/electron.vite.config.ts†L1-L35】
- 패키징은 `electron-builder` 설정(`electron-builder.yml`)을 따릅니다.【F:packages/desktop/electron-builder.yml†L1-L45】
- 주요 스크립트는 `@ooxml/desktop` 패키지에 정의되어 있습니다.【F:packages/desktop/package.json†L1-L48】

### 설치 및 실행

1. 의존성 설치 (모노레포 루트)

   ```bash
   pnpm install
   ```

2. 개발 모드 실행

   ```bash
   pnpm --filter @ooxml/desktop dev
   ```

3. 프로덕션 빌드 / 프리뷰

   ```bash
   pnpm --filter @ooxml/desktop build
   pnpm --filter @ooxml/desktop preview
   ```

4. 패키징 (OS별)

   ```bash
   pnpm --filter @ooxml/desktop package
   pnpm --filter @ooxml/desktop package:mac
   pnpm --filter @ooxml/desktop package:win
   pnpm --filter @ooxml/desktop package:linux
   ```

> 스크립트 이름과 패키징 옵션은 `@ooxml/desktop`의 설정을 기준으로 합니다.【F:packages/desktop/package.json†L1-L48】

## MCP 서버 실행

`@ooxml/mcp` 패키지는 MCP 서버 엔트리(`dist/index.js`)를 제공합니다.【F:packages/mcp/package.json†L1-L21】

### 빌드 및 실행

```bash
pnpm --filter @ooxml/mcp build
pnpm --filter @ooxml/mcp start
```

또는 개발 모드(파일 감시)로 실행할 수 있습니다.

```bash
pnpm --filter @ooxml/mcp dev
```

> 사용 가능한 스크립트는 `@ooxml/mcp`의 `scripts`에 정의되어 있습니다.【F:packages/mcp/package.json†L12-L24】

## MCP를 Codex/Claude에 연결하는 방법

Codex와 Claude는 모두 MCP 클라이언트 역할을 하며, **MCP 서버를 `mcpServers` 설정으로 등록**합니다.
설정 파일 위치와 UI는 각 클라이언트 버전에 따라 다르므로, 아래 예시는 **구성 포맷 참고용**입니다.

### 1) 공통 준비 단계

1. MCP 서버 빌드 (`@ooxml/mcp`)【F:packages/mcp/package.json†L12-L24】
2. MCP 서버 실행 명령 확인 (예: `node dist/index.js`)【F:packages/mcp/package.json†L1-L21】

### 2) Codex 연결 (예시 구성)

```json
{
  "mcpServers": {
    "ooxml-validator": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp/dist/index.js"]
    }
  }
}
```

### 3) Claude 연결 (예시 구성)

```json
{
  "mcpServers": {
    "ooxml-validator": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp/dist/index.js"]
    }
  }
}
```

### 4) 연결 확인

1. 클라이언트 재시작 후 MCP 도구 목록에 `ooxml-validator`가 보이는지 확인
2. 도구 호출 시 서버 프로세스가 실행되며 결과가 응답되는지 확인

> MCP 서버 등록 포맷은 README에 있는 기본 예시와 동일한 구조입니다.【F:README.md†L62-L86】

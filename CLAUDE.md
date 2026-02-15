# CLAUDE.md

## Project Overview

OOXML Schema Validator — a monorepo toolkit for validating XLSX, DOCX, and PPTX files against XSD schemas using a streaming event-based engine. Primary focus is on the core validation engine and Electron desktop app. MCP integration is planned for future development.

## Monorepo Structure

### Primary Development Focus

- `packages/core` — Validation engine, schema registry, compositor state management (zero runtime deps) **[ACTIVE]**
- `packages/desktop` — Electron + React desktop application with Monaco editor **[ACTIVE]**

### Supporting Packages

- `packages/parser` — OOXML document parsing, ZIP handling, XML streaming/conversion
- `tools/xsd-converter` — Build tool that converts XSD files to JSON schemas
- `schemas/` — OOXML XSD source files (sml, wml, pml, dml, shared)
- `agent/` — AI agent playbooks and mandatory task guides

### Future Development

- `packages/mcp` — MCP server exposing validation tools (lower priority)

## Mandatory Read For Desktop UI/UX Work

- Required doc: `agent/desktop-ui-ux-agent-guide.md`
- Any AI agent working on `packages/desktop` UI/UX must read this document before making design, layout, interaction, accessibility, or styling changes.
- Treat it as the default implementation and review checklist for desktop UX tasks.

## Common Commands

```bash
pnpm run build        # Build all packages (turbo, includes schema generation)
pnpm run test         # Run all tests (vitest)
pnpm run typecheck    # Type-check all packages (tsc --noEmit)
pnpm run lint         # Lint all packages
pnpm run format       # Format with Prettier
pnpm run dev          # Watch mode for all packages
pnpm run clean        # Remove dist/ and node_modules/
```

Per-package commands work from within each package directory (`build`, `dev`, `test`, `test:watch`, `typecheck`, `clean`).

Schema generation runs automatically as a prebuild step in `packages/core`:

```bash
pnpm run generate:schemas   # Convert XSD → JSON schemas
```

## Tech Stack

- **TypeScript 5.3** (strict mode, ES2022 target)
- **pnpm 9** workspaces + **Turbo 2** for build orchestration
- **tsup** for bundling all packages
- **Vitest** for testing (`--passWithNoTests`)
- **Prettier** for formatting
- **React 18** + **Electron 28** for desktop app
- **Vite 5** / **electron-vite** for desktop bundling

## Code Style

- Single quotes, no semicolons, 2-space indentation, 100-char line width, ES5 trailing commas
- Configured in `.prettierrc`; enforced by `pnpm run format`

## TypeScript Conventions

- Strict mode with `noUncheckedIndexedAccess` enabled
- Base config in `tsconfig.base.json`; each package extends it
- Public APIs exported via `src/index.ts` in each package

## Package Names

- `@ooxml/core`
- `@ooxml/parser`
- `@ooxml/mcp`
- `@ooxml/desktop`

## CI

GitHub Actions (`.github/workflows/ci.yml`): typecheck → lint → build → test, across Ubuntu/Windows/macOS × Node 18/20/22.

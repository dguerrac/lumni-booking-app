# CLAUDE.md — Lumni coworking room booking

Project instructions for Claude Code. The human (Diego) sets the plan and reviews every diff before it is committed.

## Stack and layout

npm workspaces monorepo, all TypeScript (strict).

- `apps/api` — Express 5 + Zod, Kysely + PostgreSQL, outbox email worker, AI assistant
- `apps/web` — Vite + React + React Router + TanStack Query + react-hook-form, CSS Modules with design tokens in `src/styles/theme.css` (palette names from evie-app)
- `packages/shared` — Zod schemas, types and business constants used by api, web and the AI tools
- Root: `docker-compose.yml` (Postgres on host port 5433, Mailpit 1025/8025), `README.md`, `INCIDENTE.md`, `consultas.sql`

API modules live in `apps/api/src/modules/<module>/`: `<module>.routes.ts` (HTTP only) → `<module>.service.ts` (business rules, transactions) → `<module>.repository.ts` (SQL), plus `domain/` for pure functions. Shared infrastructure: `apps/api/src/db/` (Kysely client, migrations, seed) and `apps/api/src/http/` (error and auth middleware). Create folders only in the step that needs them.

Layer-specific rules live in `.claude/rules/` and load automatically when a matching file is read or edited: `migrations`, `domain`, `api-layers`, `tests`, `assistant`, `web`.

## Agent tooling

| Skill             | Use for                                                                          |
| ----------------- | -------------------------------------------------------------------------------- |
| `tdd`             | Pricing, state machine, slot search, date resolution: red → green, test first    |
| `kcd-principles`  | React components, hooks and tests                                                |
| `codebase-design` | Deciding module boundaries and interfaces                                        |
| `review`          | Review the diff against `.claude/skills/review/checklist.md` before every commit |

A `PostToolUse` hook (`.claude/hooks/lint-edited-file.mjs`) runs Prettier and ESLint on every edited TS/TSX file and sends lint errors back until they are fixed. `.env` files are denied to the agent in `.claude/settings.json`.

## Rules

- Domain logic (pricing, state machine, slot search, date resolution) is pure functions with no I/O. "now" is a parameter, never read inside.
- Business rules run in America/Bogota via Luxon. Never use `new Date()`, `getDay()` or `getHours()` for weekday or hour logic. The DB stores `timestamptz`.
- Money is integer Colombian pesos. No floats; round explicitly.
- Every endpoint validates input with the shared Zod schema.
- `customer_id` always comes from the session, never from the request body or from an AI tool input.
- Concurrency is guaranteed by DB constraints (exclusion constraint, conditional UPDATE, UNIQUE on the outbox), not by checks in code.
- Concurrency tests run against a real test database. Never mock the DB for them.
- Write or update tests with every change.
- No new dependency without asking first.
- The AI assistant never computes prices or availability, never confirms or cancels, never sees other customers' bookings.

## Language

Code, identifiers, commits and this file: English. README.md, INCIDENTE.md and comments in consultas.sql: Spanish. User-facing UI text: Spanish.

## Commits

Conventional Commits (`feat(scope): …`, `fix`, `test`, `docs`, `chore`), one small commit per reviewed step. No `Co-Authored-By` trailer.

## Commands

- `docker compose up -d` · `npm install` · `npm run db:migrate` · `npm run db:seed` · `npm run dev`
- `npm test` · `npm run typecheck` · `npm run lint`

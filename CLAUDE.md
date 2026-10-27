# CLAUDE.md — Lumni coworking room booking

Project instructions for Claude Code. The human (Diego) sets the plan and reviews every diff before it is committed.

## Stack and layout

npm workspaces monorepo, all TypeScript (strict).

- `apps/api` — Express 5 + Zod, Kysely + PostgreSQL, outbox email worker, AI assistant
- `apps/web` — Vite + React + React Router + TanStack Query + react-hook-form
- `packages/shared` — Zod schemas, types and business constants used by api, web and the AI tools
- Root: `docker-compose.yml` (Postgres on host port 5433, Mailpit 1025/8025), `README.md`, `INCIDENTE.md`, `consultas.sql`

API module structure: `routes` (HTTP only) → `service` (business rules, transactions) → `repository` (SQL).

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
